import crypto from "crypto";
import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client";
import { getStripe } from "../stripe/client";
import { HttpError } from "../utils/HttpError";
import {
  stripeConfig,
  toStripeAmount,
  fromStripeAmount,
  minimumChargeFor,
} from "../utils/stripeConfig";
import { cartService, CartItemInput, CartIssue } from "./cart.service";
import {
  orderService,
  validateShippingAddress,
  OrderStatus,
  ShippingAddressInput,
  OrderItemInput,
  CHANGED_BY_STRIPE_WEBHOOK,
  CHANGED_BY_SYSTEM,
} from "./order.service";
import { AccessTokenPayload } from "./auth.service";
import { canAccessOrder } from "../utils/authorization";
import { FORBIDDEN_MESSAGE } from "../middlewares/authGuard";

/**
 * Stripe payments. This service owns the whole money path:
 *
 *   validate the basket → price it server-side → create/reuse the Order →
 *   create/reuse the Stripe PaymentIntent → (later) apply the webhook
 *
 * Two rules shape everything below.
 *
 * **1. The backend is the only authority on price.** Nothing the frontend sends
 * about money is ever used. The basket lines are re-priced from the database by
 * `cartService.validateCart`, and shipping/tax are derived here. A cart whose
 * prices or stock have drifted is rejected before any order or PaymentIntent
 * exists.
 *
 * **2. The backend is the only authority on payment status.** An order becomes
 * PAID because a signature-verified Stripe webhook said so — never because the
 * browser reported that `confirmPayment()` resolved. Nothing in the
 * create-intent path writes a payment status other than PENDING.
 *
 * Consistency note: a database transaction cannot span the Stripe API, so the
 * flow is ordered so that a failure between the two is always *recoverable*.
 * The order is created first and carries a `checkoutKey`; if the PaymentIntent
 * call then fails, the next attempt with the same basket finds that order again
 * and retries only the Stripe half. No duplicate order, no orphaned intent.
 */

/**
 * Lifecycle of a payment attempt. Numeric enum stored in `Payment.status`,
 * matching the Int-enum convention used by OrderStatus and QuoteStatus.
 *
 * Mirrors the PaymentIntent states we actually act on; Stripe's finer-grained
 * `requires_payment_method` / `requires_confirmation` / `requires_action` all
 * land on PENDING, because to this API they mean the same thing: money has not
 * moved and the shopper can still complete the payment.
 */
export enum PaymentStatus {
  PENDING = 0,
  PROCESSING = 1,
  SUCCEEDED = 2,
  FAILED = 3,
  CANCELED = 4,
}

export const PAYMENT_STATUS_VALUES = Object.values(PaymentStatus).filter(
  (v): v is number => typeof v === "number",
);

/** Payload accepted by POST /api/payments/create-intent. */
export interface CreatePaymentIntentInput {
  /** The basket, in the same shape POST /api/cart/validate accepts. */
  items?: CartItemInput[];
  shippingAddress?: ShippingAddressInput | null;
  notes?: string | null;
  /**
   * Retry an order that already exists instead of pricing a basket. Optional —
   * the normal flow sends `items` and lets the server find or create the order.
   */
  orderId?: number;
}

export interface CreatePaymentIntentResult {
  /** Hand this to Stripe Elements. It is not a secret key — it is scoped to
   *  this one PaymentIntent — but it must still never be logged or persisted. */
  clientSecret: string;
  paymentIntentId: string;
  orderId: number;
  /** Authoritative amount, in pesos, exactly as charged. */
  amount: number;
  /** Lowercase ISO code sent to Stripe, e.g. "mxn". */
  currency: string;
  status: PaymentStatus;
  /**
   * True when this request created nothing — both the order and the
   * PaymentIntent already existed from an earlier identical call. The
   * controller answers 200 in that case and 201 whenever anything was created.
   */
  reused: boolean;
  order: unknown;
}

// ── Stripe status mapping ───────────────────────────────────────────────────

const PAYMENT_STATUS_BY_STRIPE_STATUS: Record<string, PaymentStatus> = {
  requires_payment_method: PaymentStatus.PENDING,
  requires_confirmation: PaymentStatus.PENDING,
  requires_action: PaymentStatus.PENDING,
  requires_capture: PaymentStatus.PROCESSING,
  processing: PaymentStatus.PROCESSING,
  succeeded: PaymentStatus.SUCCEEDED,
  canceled: PaymentStatus.CANCELED,
};

const toPaymentStatus = (stripeStatus: string): PaymentStatus =>
  PAYMENT_STATUS_BY_STRIPE_STATUS[stripeStatus] ?? PaymentStatus.PENDING;

/** Intents in these states can still be confirmed, so they are worth reusing. */
const REUSABLE_STRIPE_STATUSES = new Set([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
]);

/** Order states that mean the money question is already settled. */
const ORDER_ALREADY_SETTLED: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.PENDING_PRODUCTION,
  OrderStatus.IN_PRODUCTION,
  OrderStatus.QUALITY_CHECK,
  OrderStatus.READY_TO_SHIP,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.REFUNDED,
];

/** Order states a shopper may still pay for. */
const ORDER_PAYABLE: OrderStatus[] = [
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.PAYMENT_FAILED,
];

// ── Business rules: shipping and tax ────────────────────────────────────────
// The storefront charges neither yet — `cartService.validateCart` treats both
// as 0 — so checkout prices them the same way rather than inventing a rule the
// rest of the app does not apply. When real shipping/tax rules land, this is
// the one place the checkout total needs to change; keep it in step with the
// cart validator so the shopper is never quoted one total and charged another.

const calculateShipping = (_subtotal: number, _address: ShippingAddressInput | null): number => 0;

const calculateTax = (_subtotal: number, _address: ShippingAddressInput | null): number => 0;

// ── Helpers ─────────────────────────────────────────────────────────────────

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * A stable fingerprint of one checkout attempt: same shopper, same lines, same
 * amounts, same address ⇒ same key. It is what lets a double-clicked "Pay"
 * button, a refreshed browser, or a retried network request land on the order
 * that was already created instead of creating another one.
 *
 * Amounts are part of the key on purpose. If a price changes between attempts
 * the key changes too, so the shopper gets a fresh order at the new price
 * instead of silently paying a stale total.
 */
const buildCheckoutKey = (parts: {
  userId: number;
  currency: string;
  items: { productId: number; variantId: number; quantity: number; unitPrice: number }[];
  shippingAddress: ShippingAddressInput | null;
  totalAmount: number;
}): string => {
  const canonical = JSON.stringify({
    u: parts.userId,
    c: parts.currency,
    // Sorted so two requests that list the same lines in a different order
    // still produce the same key.
    i: parts.items
      .map((i) => [i.productId, i.variantId, i.quantity, round2(i.unitPrice)])
      .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3]),
    s: parts.shippingAddress
      ? [
          parts.shippingAddress.fullName,
          parts.shippingAddress.phoneNumber,
          parts.shippingAddress.address,
          parts.shippingAddress.city,
          parts.shippingAddress.state,
          parts.shippingAddress.postalCode,
          parts.shippingAddress.country,
        ].map((v) => v.trim().toLowerCase())
      : null,
    t: round2(parts.totalAmount),
  });
  return crypto.createHash("sha256").update(canonical).digest("hex");
};

/**
 * Turns a Stripe SDK failure into a safe application error. Stripe error
 * objects carry request ids, raw payloads and occasionally the request body —
 * none of that belongs in a response, so the client always gets a short,
 * generic message and the detail stays in the server log.
 */
const toSafeStripeError = (err: unknown, context: string): HttpError => {
  if (err instanceof HttpError) return err;

  const type = (err as { type?: string })?.type;
  const code = (err as { code?: string })?.code;

  // Logged without the raw payload so no secret, client secret, or customer
  // detail is written to the log.
  console.error(`[stripe] ${context} failed`, { type, code });

  switch (type) {
    case "StripeCardError":
      // Customer-facing and safe to show — it explains a declined card.
      return new HttpError(400, (err as Error).message, { code: code ?? "card_error" });
    case "StripeAuthenticationError":
    case "StripePermissionError":
      return new HttpError(
        503,
        "Payments are not correctly configured on this server. Please try again later.",
      );
    case "StripeRateLimitError":
      return new HttpError(
        503,
        "The payment provider is busy right now. Please try again in a moment.",
      );
    case "StripeConnectionError":
    case "StripeAPIError":
    case "StripeInvalidRequestError":
    case "StripeIdempotencyError":
      return new HttpError(
        502,
        "The payment provider could not be reached. Please try again.",
      );
    default:
      return new HttpError(502, "The payment could not be started. Please try again.");
  }
};

// ── Pricing ─────────────────────────────────────────────────────────────────

interface PricedCheckout {
  items: CartItemInput[];
  orderItems: OrderItemInput[];
  subtotalAmount: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
}

/**
 * Re-prices the basket from the database and rejects it if anything drifted.
 *
 * `cartService.validateCart` is called with **only** the lines — no amounts —
 * so every figure it returns is derived from the live product/variant rows.
 * Anything the caller sent about money is therefore structurally impossible to
 * use.
 */
const priceCheckout = async (
  items: CartItemInput[],
  shippingAddress: ShippingAddressInput | null,
): Promise<PricedCheckout> => {
  const validation = await cartService.validateCart({ items });

  if (!validation.isValid) {
    throw new HttpError(
      409,
      "The cart is no longer valid. Refresh it and try again.",
      { code: "CART_INVALID", issues: validation.issues satisfies CartIssue[] },
    );
  }

  const subtotalAmount = round2(validation.subtotalAmount);
  const shippingAmount = round2(calculateShipping(subtotalAmount, shippingAddress));
  const taxAmount = round2(calculateTax(subtotalAmount, shippingAddress));
  const totalAmount = round2(subtotalAmount + shippingAmount + taxAmount);

  const minimum = minimumChargeFor(stripeConfig.currency);
  if (minimum !== undefined && totalAmount < minimum) {
    throw new HttpError(
      400,
      `The order total (${totalAmount}) is below the minimum amount that can be charged ` +
        `in ${stripeConfig.currency.toUpperCase()} (${minimum}).`,
      { code: "AMOUNT_BELOW_MINIMUM", minimum, totalAmount },
    );
  }

  return {
    items: validation.items,
    orderItems: validation.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      productSlug: item.productSlug,
      productImageUrl: item.productImageUrl ?? null,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      totalAmount: item.subtotalAmount,
    })),
    subtotalAmount,
    shippingAmount,
    taxAmount,
    totalAmount,
  };
};

// ── Order resolution ────────────────────────────────────────────────────────

/**
 * Namespace for the per-shopper advisory lock below. Any constant works; it
 * only has to be distinct from other advisory locks the application might take.
 */
const CHECKOUT_LOCK_NAMESPACE = 8471;

/**
 * Finds the order this checkout already produced, or creates it — atomically.
 *
 * Two create-intent requests can arrive at the same instant (a double-clicked
 * Pay button, a retried fetch). A plain "look, then create" would let both
 * miss and both insert, giving the shopper two orders. The transaction takes a
 * Postgres advisory lock keyed on the user first, so the second request waits,
 * then finds what the first one created. The lock is scoped to the transaction,
 * so it is released on commit or rollback with no cleanup path to forget, and
 * it only ever serialises one shopper against themselves.
 */
const findOrCreateOrder = async (
  auth: AccessTokenPayload,
  priced: PricedCheckout,
  checkoutKey: string,
  shippingAddress: ShippingAddressInput | null,
  notes: string | null,
): Promise<{ order: any; reused: boolean }> => {
  // Only the decision is made under the lock. Loading the order for the
  // response happens afterwards, so the transaction never waits on a second
  // connection from the pool while holding a lock — that is how a pool-sized
  // burst of checkouts would deadlock itself.
  const { orderId, reused } = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CHECKOUT_LOCK_NAMESPACE}::int, ${auth.sub}::int)`;

    const existing = await tx.order.findFirst({
      where: { userId: auth.sub, checkoutKey, status: { in: ORDER_PAYABLE } },
      orderBy: { id: "desc" },
      select: { id: true },
    });
    if (existing) return { orderId: existing.id, reused: true };

    const created = await orderService.createOrder(
      {
        userId: auth.sub,
        // Orders store the display code (uppercase); Stripe wants it lowercase.
        currency: stripeConfig.currency.toUpperCase(),
        subtotalAmount: priced.subtotalAmount,
        shippingAmount: priced.shippingAmount,
        taxAmount: priced.taxAmount,
        totalAmount: priced.totalAmount,
        items: priced.orderItems,
        shippingAddress,
        notes,
      },
      { checkoutKey, tx },
    );
    return { orderId: created.id as number, reused: false };
  });

  return { order: await orderService.getOrderById(orderId), reused };
};

/** Loads an order for an explicit `orderId` retry, enforcing ownership. */
const loadOrderForRetry = async (orderId: number, auth: AccessTokenPayload) => {
  const order = await orderService.getOrderById(orderId);
  if (!canAccessOrder(auth, order.userId as number)) {
    // Deliberately the same 403 the rest of the API uses — an order that is not
    // yours must not be distinguishable from one that does not exist.
    throw new HttpError(403, FORBIDDEN_MESSAGE);
  }
  const status = order.status as OrderStatus;
  if (ORDER_ALREADY_SETTLED.includes(status)) {
    throw new HttpError(409, `Order ${orderId} has already been paid.`, {
      code: "ORDER_ALREADY_PAID",
      orderId,
    });
  }
  if (!ORDER_PAYABLE.includes(status)) {
    throw new HttpError(409, `Order ${orderId} can no longer be paid.`, {
      code: "ORDER_NOT_PAYABLE",
      orderId,
      status,
    });
  }
  return order;
};

// ── PaymentIntent resolution ────────────────────────────────────────────────

const buildIntentParams = (
  order: any,
  auth: AccessTokenPayload,
  amountMinor: number,
): Stripe.PaymentIntentCreateParams => ({
  amount: amountMinor,
  currency: stripeConfig.currency,
  // Required by Stripe Payment Element: Stripe decides which methods to offer
  // from the dashboard configuration instead of the server hardcoding a list.
  automatic_payment_methods: { enabled: true },
  description: `Neon LED Love — order #${order.id}`,
  receipt_email: auth.email,
  // What the webhook uses to find its way back to our records. Metadata is
  // visible in the Stripe dashboard, so it holds ids only — no personal data.
  metadata: {
    orderId: String(order.id),
    userId: String(auth.sub),
    checkoutKey: String(order.checkoutKey ?? ""),
  },
});

/**
 * Returns a PaymentIntent the frontend can confirm — reusing the order's
 * existing one whenever Stripe says it is still usable.
 *
 * The decision is made from the *live* intent fetched from Stripe rather than
 * from our stored `Payment.status`, because Stripe is the authority and our row
 * may be a webhook behind.
 */
const resolvePaymentIntent = async (
  order: any,
  auth: AccessTokenPayload,
): Promise<{ intent: Stripe.PaymentIntent; reused: boolean }> => {
  const stripe = getStripe();
  const amountMinor = toStripeAmount(order.totalAmount, stripeConfig.currency);

  const attempts = await prisma.payment.count({ where: { orderId: order.id } });
  const latest = await prisma.payment.findFirst({
    where: { orderId: order.id },
    orderBy: { id: "desc" },
  });

  if (latest) {
    let existing: Stripe.PaymentIntent;
    try {
      existing = await stripe.paymentIntents.retrieve(latest.providerPaymentId);
    } catch (err) {
      throw toSafeStripeError(err, `retrieve ${latest.providerPaymentId}`);
    }

    if (existing.status === "succeeded") {
      // Stripe already has the money. Reconcile our side rather than letting
      // the shopper pay twice; the webhook normally gets here first.
      await recordSucceeded(existing);
      throw new HttpError(409, `Order ${order.id} has already been paid.`, {
        code: "ORDER_ALREADY_PAID",
        orderId: order.id,
      });
    }

    if (existing.status === "processing" || existing.status === "requires_capture") {
      // In flight: an async method (an OXXO voucher, a bank debit) is pending,
      // or the funds are authorised but not yet captured. Neither is "paid", the
      // amount can no longer be changed, and a second intent would let the
      // shopper pay twice — so the existing one is handed back as-is.
      return { intent: existing, reused: true };
    }

    if (REUSABLE_STRIPE_STATUSES.has(existing.status)) {
      if (existing.amount !== amountMinor) {
        try {
          const updated = await stripe.paymentIntents.update(existing.id, {
            amount: amountMinor,
          });
          await syncPaymentRow(updated, order.id);
          return { intent: updated, reused: true };
        } catch (err) {
          throw toSafeStripeError(err, `update ${existing.id}`);
        }
      }
      return { intent: existing, reused: true };
    }
    // Anything else (canceled) falls through and a fresh intent is created.
  }

  let created: Stripe.PaymentIntent;
  try {
    created = await stripe.paymentIntents.create(buildIntentParams(order, auth, amountMinor), {
      // Deterministic per order *and* attempt: two concurrent requests for the
      // same attempt get the same intent back from Stripe instead of creating
      // two, while a genuine retry after a cancellation gets a new one.
      idempotencyKey: `nll-order-${order.id}-attempt-${attempts}`,
    });
  } catch (err) {
    throw toSafeStripeError(err, `create intent for order ${order.id}`);
  }

  await syncPaymentRow(created, order.id);
  return { intent: created, reused: false };
};

/**
 * Writes the Payment row for an intent. Upsert keyed on the unique
 * `providerPaymentId` so retries and webhook redeliveries converge on one row
 * instead of inserting duplicates. No client secret is ever stored.
 */
const syncPaymentRow = async (
  intent: Stripe.PaymentIntent,
  orderId: number,
  extra: { failureCode?: string | null; failureMessage?: string | null } = {},
) => {
  const status = toPaymentStatus(intent.status);
  const amount = fromStripeAmount(intent.amount, intent.currency);

  const payment = await prisma.payment.upsert({
    where: { providerPaymentId: intent.id },
    create: {
      orderId,
      provider: "stripe",
      providerPaymentId: intent.id,
      status,
      amount,
      currency: intent.currency,
      failureCode: extra.failureCode ?? null,
      failureMessage: extra.failureMessage ?? null,
    },
    update: {
      status,
      amount,
      currency: intent.currency,
      ...(extra.failureCode !== undefined ? { failureCode: extra.failureCode } : {}),
      ...(extra.failureMessage !== undefined ? { failureMessage: extra.failureMessage } : {}),
    },
  });

  // Keep the order's searchable payment reference pointing at the live attempt.
  await prisma.order.update({
    where: { id: orderId },
    data: { paymentId: intent.id },
  });

  return payment;
};

// ── Order status effects (webhook side) ─────────────────────────────────────

/**
 * Moves an order to PAID, tolerating every ordering the webhook can arrive in.
 *
 * Redeliveries, a success that lands after staff already advanced the order,
 * and a success for an order that had been marked PAYMENT_FAILED all have to be
 * safe — so this checks where the order actually is before asking for a
 * transition the state machine would reject.
 */
const markOrderPaid = async (orderId: number, intentId: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true },
  });
  if (!order) {
    console.warn(`[stripe] payment succeeded for unknown order ${orderId} (${intentId})`);
    return;
  }
  const status = order.status as OrderStatus;

  // Already recorded, or already moved past PAID by staff — nothing to do.
  if (ORDER_ALREADY_SETTLED.includes(status)) return;

  if (status === OrderStatus.CANCELLED) {
    // Terminal: the state machine has no path out. This needs a human — the
    // shopper has been charged for an order that was cancelled.
    console.error(
      `[stripe] payment ${intentId} succeeded for CANCELLED order ${orderId}. ` +
        `A refund must be issued manually.`,
    );
    return;
  }

  if (status === OrderStatus.PAYMENT_FAILED) {
    // PAYMENT_FAILED cannot go straight to PAID; the state machine routes a
    // retry back through PENDING_PAYMENT first.
    await orderService.recordPaymentStatusChange(
      orderId,
      OrderStatus.PENDING_PAYMENT,
      "Payment retried.",
    );
  }

  await orderService.recordPaymentStatusChange(
    orderId,
    OrderStatus.PAID,
    `Payment succeeded (${intentId}).`,
    CHANGED_BY_STRIPE_WEBHOOK,
  );
};

const markOrderPaymentFailed = async (orderId: number, intentId: string, reason: string | null) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });
  if (!order) {
    console.warn(`[stripe] payment failed for unknown order ${orderId} (${intentId})`);
    return;
  }
  // A failure that arrives after the order was already paid or cancelled is
  // stale — the current state wins.
  if (order.status !== OrderStatus.PENDING_PAYMENT) return;

  await orderService.recordPaymentStatusChange(
    orderId,
    OrderStatus.PAYMENT_FAILED,
    `Payment failed (${intentId})${reason ? `: ${reason}` : "."}`,
    CHANGED_BY_STRIPE_WEBHOOK,
  );
};

const markOrderCancelled = async (orderId: number, intentId: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });
  if (!order) return;
  if (!ORDER_PAYABLE.includes(order.status as OrderStatus)) return;

  await orderService.recordPaymentStatusChange(
    orderId,
    OrderStatus.CANCELLED,
    `Payment cancelled (${intentId}).`,
    CHANGED_BY_STRIPE_WEBHOOK,
  );
};

/** Shared by the webhook and by the "Stripe says it is already paid" branch. */
const recordSucceeded = async (intent: Stripe.PaymentIntent) => {
  const orderId = await resolveOrderId(intent);
  if (orderId === null) return false;
  await syncPaymentRow(intent, orderId, { failureCode: null, failureMessage: null });
  await markOrderPaid(orderId, intent.id);
  return true;
};

/**
 * Finds the order an intent belongs to: by our Payment row first, falling back
 * to the intent's metadata for the window between creating the intent at Stripe
 * and writing the row locally.
 */
const resolveOrderId = async (intent: Stripe.PaymentIntent): Promise<number | null> => {
  const payment = await prisma.payment.findUnique({
    where: { providerPaymentId: intent.id },
    select: { orderId: true },
  });
  if (payment) return payment.orderId;

  const fromMetadata = Number(intent.metadata?.orderId);
  if (!Number.isInteger(fromMetadata) || fromMetadata <= 0) return null;

  const order = await prisma.order.findUnique({
    where: { id: fromMetadata },
    select: { id: true },
  });
  return order ? order.id : null;
};

// ── Webhook ─────────────────────────────────────────────────────────────────

export interface WebhookResult {
  received: true;
  /** False when the event type is one we deliberately ignore. */
  handled: boolean;
  /** True when this exact event id had already been processed. */
  duplicate: boolean;
  eventType: string;
}

const EVENT_HANDLERS: Record<string, (intent: Stripe.PaymentIntent) => Promise<void>> = {
  "payment_intent.succeeded": async (intent) => {
    await recordSucceeded(intent);
  },

  "payment_intent.processing": async (intent) => {
    // Async methods (OXXO vouchers, bank debits) sit here for hours or days.
    // The payment moves to PROCESSING; the order stays PENDING_PAYMENT until
    // the money actually lands.
    const orderId = await resolveOrderId(intent);
    if (orderId === null) return;
    await syncPaymentRow(intent, orderId);
  },

  "payment_intent.payment_failed": async (intent) => {
    const orderId = await resolveOrderId(intent);
    if (orderId === null) return;
    const error = intent.last_payment_error;
    await syncPaymentRow(intent, orderId, {
      failureCode: error?.code ?? error?.decline_code ?? null,
      failureMessage: error?.message ?? null,
    });
    // A failed attempt leaves the intent reusable, so `Payment.status` follows
    // Stripe (PENDING) while the *order* records that an attempt failed.
    await prisma.payment.update({
      where: { providerPaymentId: intent.id },
      data: { status: PaymentStatus.FAILED },
    });
    await markOrderPaymentFailed(orderId, intent.id, error?.message ?? null);
  },

  "payment_intent.canceled": async (intent) => {
    const orderId = await resolveOrderId(intent);
    if (orderId === null) return;
    await syncPaymentRow(intent, orderId);
    await markOrderCancelled(orderId, intent.id);
  },
};

export const paymentService = {
  /**
   * POST /api/payments/create-intent — the checkout entry point.
   *
   * Returns the `client_secret` of a PaymentIntent whose amount was computed
   * entirely from the database, together with the order it belongs to.
   */
  createPaymentIntent: async (
    input: CreatePaymentIntentInput,
    auth: AccessTokenPayload,
  ): Promise<CreatePaymentIntentResult> => {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      throw new HttpError(400, "Request body must be an object");
    }

    // Amount fields are not merely ignored — sending one is an error, so a
    // frontend that believes it controls the price finds out immediately.
    const priceFields = ["subtotalAmount", "shippingAmount", "taxAmount", "totalAmount", "amount"];
    const sentPrices = priceFields.filter((f) =>
      Object.prototype.hasOwnProperty.call(input, f),
    );
    if (sentPrices.length > 0) {
      throw new HttpError(
        400,
        `The amount to charge is calculated by the server and cannot be supplied: ` +
          `${sentPrices.join(", ")}.`,
      );
    }

    const shippingAddress = input.shippingAddress ?? null;
    if (shippingAddress !== null) validateShippingAddress(shippingAddress);

    const notes =
      input.notes === undefined || input.notes === null
        ? null
        : typeof input.notes === "string"
          ? input.notes.trim() || null
          : (() => {
              throw new HttpError(400, `Field must be a string: "notes"`);
            })();

    let order: any;
    let reusedOrder: boolean;

    if (input.orderId !== undefined) {
      if (!Number.isInteger(input.orderId) || input.orderId <= 0) {
        throw new HttpError(400, `Field "orderId" must be a positive integer`);
      }
      // Retrying an existing order: its amounts are already a record of what
      // was agreed, so they are used as-is rather than re-priced.
      order = await loadOrderForRetry(input.orderId, auth);
      reusedOrder = true;
    } else {
      if (!Array.isArray(input.items) || input.items.length === 0) {
        throw new HttpError(400, `Field "items" must be a non-empty array`);
      }
      const priced = await priceCheckout(input.items, shippingAddress);
      const checkoutKey = buildCheckoutKey({
        userId: auth.sub,
        currency: stripeConfig.currency,
        items: priced.items,
        shippingAddress,
        totalAmount: priced.totalAmount,
      });
      const found = await findOrCreateOrder(auth, priced, checkoutKey, shippingAddress, notes);
      order = found.order;
      reusedOrder = found.reused;
    }

    // A previous attempt failed: the state machine routes the retry back
    // through PENDING_PAYMENT before a new intent is confirmed.
    if ((order.status as OrderStatus) === OrderStatus.PAYMENT_FAILED) {
      order = await orderService.recordPaymentStatusChange(
        order.id,
        OrderStatus.PENDING_PAYMENT,
        "Payment retried by the customer.",
        CHANGED_BY_SYSTEM,
      );
    }

    const { intent, reused: reusedIntent } = await resolvePaymentIntent(order, auth);

    if (!intent.client_secret) {
      // Should be unreachable for a freshly created/retrieved intent.
      throw new HttpError(502, "The payment could not be started. Please try again.");
    }

    return {
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      orderId: order.id,
      amount: fromStripeAmount(intent.amount, intent.currency),
      currency: intent.currency,
      status: toPaymentStatus(intent.status),
      reused: reusedOrder && reusedIntent,
      order: await orderService.getOrderById(order.id),
    };
  },

  /**
   * POST /api/payments/webhook/stripe — the authoritative payment signal.
   *
   * Verifies the signature against `STRIPE_WEBHOOK_SECRET`, then processes the
   * event exactly once. Stripe delivers at least once and may deliver
   * concurrently, so the event id is *claimed* by inserting it into
   * `StripeWebhookEvent`; the unique constraint makes that claim atomic, and a
   * redelivery is recognised and skipped. If processing then throws, the claim
   * is released so Stripe's retry can pick it up again.
   */
  handleWebhookEvent: async (
    rawBody: Buffer | string | undefined,
    signature: string | undefined,
  ): Promise<WebhookResult> => {
    if (!stripeConfig.webhookSecret) {
      throw new HttpError(
        503,
        "Stripe webhooks are not configured on this server (STRIPE_WEBHOOK_SECRET is missing).",
      );
    }
    if (!rawBody) {
      // Almost always a body-parser misconfiguration rather than a bad request:
      // signature verification needs the exact bytes Stripe signed.
      throw new HttpError(400, "Missing raw request body for Stripe signature verification.");
    }
    if (!signature) {
      throw new HttpError(400, "Missing Stripe-Signature header.");
    }

    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(
        rawBody,
        signature,
        stripeConfig.webhookSecret,
      );
    } catch (err) {
      // Never echo the underlying message — it can quote header contents.
      console.error("[stripe] webhook signature verification failed");
      throw new HttpError(400, "Invalid Stripe signature.");
    }

    // Claim the event. A duplicate delivery loses the race and stops here.
    try {
      await prisma.stripeWebhookEvent.create({
        data: { stripeEventId: event.id, eventType: event.type },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return { received: true, handled: true, duplicate: true, eventType: event.type };
      }
      throw err;
    }

    const handler = EVENT_HANDLERS[event.type];
    if (!handler) {
      // Unknown/unsubscribed event types are acknowledged, not retried.
      return { received: true, handled: false, duplicate: false, eventType: event.type };
    }

    try {
      await handler(event.data.object as Stripe.PaymentIntent);
    } catch (err) {
      // Release the claim so Stripe's redelivery can try again, then let the
      // controller answer 500 — which is what tells Stripe to retry.
      await prisma.stripeWebhookEvent
        .delete({ where: { stripeEventId: event.id } })
        .catch(() => undefined);
      console.error(`[stripe] failed to process ${event.type} (${event.id})`, err);
      throw err;
    }

    return { received: true, handled: true, duplicate: false, eventType: event.type };
  },

  /**
   * GET /api/payments/order/:orderId — the payment attempts on one order.
   * Ownership is enforced by the controller with the same rule as the order
   * itself. No client secrets are returned.
   */
  getPaymentsForOrder: async (orderId: number) => {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true },
    });
    if (!order) throw new HttpError(404, `Order not found ${orderId}`);

    const payments = await prisma.payment.findMany({
      where: { orderId },
      orderBy: { id: "desc" },
    });
    return { ownerUserId: order.userId, payments };
  },
};

/** Exported for the test suite only. */
export const __testables = {
  buildCheckoutKey,
  toPaymentStatus,
  toSafeStripeError,
  markOrderPaid,
  EVENT_HANDLERS,
};
