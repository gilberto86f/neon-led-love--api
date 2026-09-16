/**
 * Test harness for the payment service.
 *
 * The project has no test framework wired up, so these tests run on Node's
 * built-in runner (`node --test`) with `ts-node` for TypeScript — no new
 * dependency, no config file. They are unit tests: nothing here touches
 * PostgreSQL or the Stripe network API.
 *
 * `payment.service` reaches the outside world through exactly four modules —
 * the Prisma client, the Stripe client, the cart service and the order service.
 * The harness replaces those four in `require.cache` *before* the service is
 * loaded, so the real service code runs against in-memory doubles.
 *
 * Signature verification is the one thing that is NOT faked: the stub exposes
 * the real Stripe SDK's `webhooks` object, so `constructEvent` performs genuine
 * HMAC verification against a genuinely-signed payload.
 */
import path from "path";
import Stripe from "stripe";
import { Prisma } from "@prisma/client";

export const WEBHOOK_SECRET = "whsec_test_secret_for_unit_tests";

// Must be set before anything imports `stripeConfig`, which reads env at load.
process.env.STRIPE_SECRET_KEY = "sk_test_harness";
process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
process.env.STRIPE_CURRENCY = "mxn";

const srcPath = (rel: string) => path.join(__dirname, "..", "..", "src", rel);

const stubModule = (rel: string, exports: Record<string, unknown>) => {
  const filename = require.resolve(srcPath(rel));
  require.cache[filename] = {
    id: filename,
    filename,
    loaded: true,
    exports,
    children: [],
    paths: [],
  } as unknown as NodeModule;
};

// ── In-memory store ─────────────────────────────────────────────────────────

export interface StatusChange {
  orderId: number;
  newStatus: number;
  comment: string | null;
  actor: string | undefined;
}

export interface Store {
  orders: Map<number, any>;
  payments: any[];
  webhookEvents: Set<string>;
  statusChanges: StatusChange[];
  createdOrders: any[];
  seq: { order: number; payment: number };
}

export const store: Store = {
  orders: new Map(),
  payments: [],
  webhookEvents: new Set(),
  statusChanges: [],
  createdOrders: [],
  seq: { order: 0, payment: 0 },
};

export const resetStore = () => {
  store.orders.clear();
  store.payments = [];
  store.webhookEvents.clear();
  store.statusChanges = [];
  store.createdOrders = [];
  store.seq = { order: 100, payment: 500 };
};
resetStore();

const notFound = (message: string) =>
  new Prisma.PrismaClientKnownRequestError(message, {
    code: "P2025",
    clientVersion: "test",
  });

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });

// ── Prisma double ───────────────────────────────────────────────────────────

const prismaFake: any = {
  order: {
    findUnique: async ({ where }: any) => store.orders.get(where.id) ?? null,
    findFirst: async ({ where }: any) => {
      const matches = [...store.orders.values()].filter(
        (o) =>
          (where.userId === undefined || o.userId === where.userId) &&
          (where.checkoutKey === undefined || o.checkoutKey === where.checkoutKey) &&
          (where.status?.in === undefined || where.status.in.includes(o.status)),
      );
      matches.sort((a, b) => b.id - a.id);
      return matches[0] ?? null;
    },
    update: async ({ where, data }: any) => {
      const order = store.orders.get(where.id);
      if (!order) throw notFound(`Order ${where.id}`);
      Object.assign(order, data);
      return order;
    },
  },
  payment: {
    count: async ({ where }: any) =>
      store.payments.filter((p) => p.orderId === where.orderId).length,
    findFirst: async ({ where }: any) => {
      const matches = store.payments.filter((p) => p.orderId === where.orderId);
      matches.sort((a, b) => b.id - a.id);
      return matches[0] ?? null;
    },
    findMany: async ({ where }: any) =>
      store.payments.filter((p) => p.orderId === where.orderId).sort((a, b) => b.id - a.id),
    findUnique: async ({ where }: any) =>
      store.payments.find((p) => p.providerPaymentId === where.providerPaymentId) ?? null,
    upsert: async ({ where, create, update }: any) => {
      const existing = store.payments.find(
        (p) => p.providerPaymentId === where.providerPaymentId,
      );
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      const row = { id: ++store.seq.payment, ...create };
      store.payments.push(row);
      return row;
    },
    update: async ({ where, data }: any) => {
      const existing = store.payments.find(
        (p) => p.providerPaymentId === where.providerPaymentId,
      );
      if (!existing) throw notFound(`Payment ${where.providerPaymentId}`);
      Object.assign(existing, data);
      return existing;
    },
  },
  stripeWebhookEvent: {
    create: async ({ data }: any) => {
      if (store.webhookEvents.has(data.stripeEventId)) throw uniqueViolation();
      store.webhookEvents.add(data.stripeEventId);
      return { id: store.webhookEvents.size, ...data };
    },
    delete: async ({ where }: any) => {
      if (!store.webhookEvents.delete(where.stripeEventId)) {
        throw notFound(`Event ${where.stripeEventId}`);
      }
      return { stripeEventId: where.stripeEventId };
    },
  },
  // The advisory lock itself is a no-op here — but the serialisation it buys is
  // not, so `$transaction` runs its callbacks one at a time. Without that the
  // double would be *more* permissive than PostgreSQL and the concurrency test
  // would be checking a guarantee the real database provides but the fake does
  // not.
  $executeRaw: async () => 0,
  $transaction: async (arg: any) => {
    if (typeof arg !== "function") return Promise.all(arg);
    const run = txQueue.then(() => arg(prismaFake));
    txQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  },
};

let txQueue: Promise<void> = Promise.resolve();

// ── Stripe double ───────────────────────────────────────────────────────────

/** Real SDK instance — used only for its (offline) signature crypto. */
const realStripe = new Stripe("sk_test_harness_offline");

export interface StripeStub {
  intents: Map<string, Stripe.PaymentIntent>;
  createCalls: { params: any; options: any }[];
  updateCalls: { id: string; params: any }[];
  /** Set to make the next paymentIntents.create/retrieve reject. */
  failNextWith: Error | null;
  client: any;
}

export const makePaymentIntent = (
  overrides: Partial<Stripe.PaymentIntent> = {},
): Stripe.PaymentIntent =>
  ({
    id: "pi_test_1",
    object: "payment_intent",
    amount: 146520,
    currency: "mxn",
    status: "requires_payment_method",
    client_secret: "pi_test_1_secret_abc",
    metadata: {},
    last_payment_error: null,
    ...overrides,
  }) as Stripe.PaymentIntent;

export const stripeStub: StripeStub = {
  intents: new Map(),
  createCalls: [],
  updateCalls: [],
  failNextWith: null,
  client: null,
};

export const resetStripe = () => {
  stripeStub.intents.clear();
  stripeStub.createCalls = [];
  stripeStub.updateCalls = [];
  stripeStub.failNextWith = null;
};

let intentCounter = 0;

stripeStub.client = {
  webhooks: realStripe.webhooks,
  paymentIntents: {
    create: async (params: any, options: any) => {
      if (stripeStub.failNextWith) {
        const err = stripeStub.failNextWith;
        stripeStub.failNextWith = null;
        throw err;
      }
      stripeStub.createCalls.push({ params, options });
      // Mimic Stripe's idempotency: the same key returns the same intent.
      const key = options?.idempotencyKey;
      if (key) {
        const seen = [...stripeStub.intents.values()].find(
          (i) => (i as any).__idempotencyKey === key,
        );
        if (seen) return seen;
      }
      const intent = makePaymentIntent({
        id: `pi_test_${++intentCounter}`,
        client_secret: `pi_test_${intentCounter}_secret_xyz`,
        amount: params.amount,
        currency: params.currency,
        metadata: params.metadata,
      });
      (intent as any).__idempotencyKey = key;
      stripeStub.intents.set(intent.id, intent);
      return intent;
    },
    retrieve: async (id: string) => {
      if (stripeStub.failNextWith) {
        const err = stripeStub.failNextWith;
        stripeStub.failNextWith = null;
        throw err;
      }
      const intent = stripeStub.intents.get(id);
      if (!intent) throw new Error(`No such payment_intent: ${id}`);
      return intent;
    },
    update: async (id: string, params: any) => {
      stripeStub.updateCalls.push({ id, params });
      const intent = stripeStub.intents.get(id)!;
      Object.assign(intent, params);
      return intent;
    },
  },
};

// ── Cart / Order doubles ────────────────────────────────────────────────────

export const cartStub = {
  /** Overridden per test. Defaults to "everything is fine". */
  result: {
    isValid: true,
    issues: [] as any[],
    items: [] as any[],
    subtotalAmount: 0,
    shippingAmount: 0,
    taxAmount: 0,
    discountAmount: 0,
    totalAmount: 0,
  },
  calls: [] as any[],
};

// The real order service is loaded first so the enums, transition table and
// actor constants under test are the genuine ones; only the four methods that
// touch the database are replaced.
const realOrderModule = require(srcPath("services/order.service"));

export const orderStub = {
  createOrder: async (input: any, options: any = {}) => {
    const order = {
      id: ++store.seq.order,
      userId: input.userId,
      status: realOrderModule.OrderStatus.PENDING_PAYMENT,
      currency: input.currency,
      subtotalAmount: input.subtotalAmount,
      shippingAmount: input.shippingAmount,
      taxAmount: input.taxAmount,
      totalAmount: input.totalAmount,
      shippingAddress: input.shippingAddress ?? null,
      notes: input.notes ?? null,
      checkoutKey: options.checkoutKey ?? null,
      paymentId: null,
      items: input.items,
    };
    store.orders.set(order.id, order);
    store.createdOrders.push(order);
    return order;
  },
  getOrderById: async (id: number) => {
    const order = store.orders.get(id);
    if (!order) {
      const { HttpError } = require(srcPath("utils/HttpError"));
      throw new HttpError(404, `Order not found ${id}`);
    }
    return order;
  },
  recordPaymentStatusChange: async (
    id: number,
    newStatus: number,
    comment: string | null = null,
    actor?: string,
  ) => {
    store.statusChanges.push({ orderId: id, newStatus, comment, actor });
    const order = store.orders.get(id);
    if (order) order.status = newStatus;
    return order;
  },
};

// ── Install ─────────────────────────────────────────────────────────────────

stubModule("prisma/client", { prisma: prismaFake });
stubModule("stripe/client", {
  getStripe: () => stripeStub.client,
  isStripeConfigured: () => true,
  __setStripeClientForTests: () => undefined,
});
stubModule("services/cart.service", {
  cartService: {
    validateCart: async (input: any) => {
      cartStub.calls.push(input);
      return cartStub.result;
    },
  },
});
stubModule("services/order.service", {
  ...realOrderModule,
  orderService: { ...realOrderModule.orderService, ...orderStub },
});

// Loaded *after* the stubs are in place.
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const paymentModule = require(srcPath("services/payment.service"));
export const paymentService = paymentModule.paymentService;
export const PaymentStatus = paymentModule.PaymentStatus;
export const OrderStatus = realOrderModule.OrderStatus;
export const CHANGED_BY_STRIPE_WEBHOOK = realOrderModule.CHANGED_BY_STRIPE_WEBHOOK;
export { prismaFake };

// ── Convenience builders ────────────────────────────────────────────────────

export const AUTH = { sub: 42, email: "shopper@example.com", role: "client" };
export const OTHER_AUTH = { sub: 99, email: "someone@example.com", role: "client" };

export const CART_ITEM = {
  productId: 7,
  productSlug: "bulbasaur",
  productName: "Bulbasaur",
  productImageUrl: "/uploads/products/1.png",
  variantId: 10,
  width: 75,
  height: 75,
  sizeUnit: "cm",
  originalUnitPrice: 1480,
  unitPrice: 1465.2,
  discountType: "percentage",
  discount: 1,
  quantity: 1,
  subtotalAmount: 1465.2,
};

export const SHIPPING_ADDRESS = {
  address: "Av. Reforma 100",
  city: "Ciudad de México",
  state: "CDMX",
  postalCode: "06600",
  country: "MX",
  fullName: "Ana López",
  phoneNumber: "+525512345678",
};

/** Configures the cart double to price `items` as a valid cart. */
export const givenValidCart = (items = [CART_ITEM]) => {
  const subtotal = items.reduce((sum, i) => sum + i.subtotalAmount, 0);
  cartStub.result = {
    isValid: true,
    issues: [],
    items,
    subtotalAmount: subtotal,
    shippingAmount: 0,
    taxAmount: 0,
    discountAmount: 0,
    totalAmount: subtotal,
  };
  return subtotal;
};

export const givenInvalidCart = (issues: any[]) => {
  cartStub.result = { ...cartStub.result, isValid: false, issues };
};

/** Seeds an order directly into the store (for retry / webhook tests). */
export const seedOrder = (overrides: Partial<any> = {}) => {
  const order = {
    id: ++store.seq.order,
    userId: AUTH.sub,
    status: OrderStatus.PENDING_PAYMENT,
    currency: "MXN",
    subtotalAmount: 1465.2,
    shippingAmount: 0,
    taxAmount: 0,
    totalAmount: 1465.2,
    shippingAddress: SHIPPING_ADDRESS,
    notes: null,
    checkoutKey: "seeded",
    paymentId: null,
    items: [],
    ...overrides,
  };
  store.orders.set(order.id, order);
  return order;
};

export const seedPayment = (overrides: Partial<any> = {}) => {
  const payment = {
    id: ++store.seq.payment,
    orderId: overrides.orderId,
    provider: "stripe",
    providerPaymentId: "pi_test_seeded",
    status: PaymentStatus.PENDING,
    amount: 1465.2,
    currency: "mxn",
    failureCode: null,
    failureMessage: null,
    ...overrides,
  };
  store.payments.push(payment);
  return payment;
};

/** Builds a webhook request signed with the real Stripe HMAC scheme. */
export const signedWebhook = (event: Record<string, unknown>) => {
  const payload = JSON.stringify(event);
  const signature = realStripe.webhooks.generateTestHeaderString({
    payload,
    secret: WEBHOOK_SECRET,
  });
  return { rawBody: Buffer.from(payload, "utf8"), signature };
};

export const webhookEvent = (
  type: string,
  intent: Partial<Stripe.PaymentIntent>,
  id = `evt_${Math.random().toString(36).slice(2)}`,
) => ({
  id,
  object: "event",
  type,
  api_version: "2026-08-26.dahlia",
  created: Math.floor(Date.now() / 1000),
  data: { object: makePaymentIntent(intent) },
});

export const resetAll = () => {
  resetStore();
  resetStripe();
  cartStub.calls = [];
  givenValidCart();
};
