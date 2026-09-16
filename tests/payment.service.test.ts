/**
 * POST /api/payments/create-intent.
 *
 * The two properties these tests exist to protect:
 *   1. the charged amount comes from the database, never from the request;
 *   2. repeating the request does not create a second order or a second charge.
 */
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  paymentService,
  PaymentStatus,
  OrderStatus,
  store,
  stripeStub,
  cartStub,
  resetAll,
  givenValidCart,
  givenInvalidCart,
  seedOrder,
  seedPayment,
  makePaymentIntent,
  AUTH,
  OTHER_AUTH,
  CART_ITEM,
  SHIPPING_ADDRESS,
} from "./helpers/harness";
import { HttpError } from "../src/utils/HttpError";
import { paymentController } from "../src/controllers/payment.controller";

beforeEach(() => resetAll());

/** Runs `fn` and returns the HttpError it threw, failing if it did not throw. */
const captureError = async (fn: () => Promise<unknown>): Promise<HttpError> => {
  try {
    await fn();
  } catch (err) {
    assert.ok(err instanceof HttpError, `expected HttpError, got ${err}`);
    return err;
  }
  assert.fail("expected the call to throw");
};

const validRequest = (overrides: Record<string, unknown> = {}) => ({
  items: [CART_ITEM],
  shippingAddress: SHIPPING_ADDRESS,
  ...overrides,
});

// ── Authentication ──────────────────────────────────────────────────────────

test("an unauthenticated request is rejected with 401 before any work happens", async () => {
  let captured: unknown;
  const req: any = { body: validRequest(), auth: undefined };
  const res: any = { status: () => res, json: () => res };

  await paymentController.createIntent(req, res, (err: unknown) => {
    captured = err;
  });

  assert.ok(captured instanceof HttpError);
  assert.equal((captured as HttpError).status, 401);
  // Nothing was priced, no order created, no Stripe call made.
  assert.equal(cartStub.calls.length, 0);
  assert.equal(store.createdOrders.length, 0);
  assert.equal(stripeStub.createCalls.length, 0);
});

// ── Request validation ──────────────────────────────────────────────────────

test("a non-object body is rejected with 400", async () => {
  const err = await captureError(() =>
    paymentService.createPaymentIntent([] as unknown as object, AUTH),
  );
  assert.equal(err.status, 400);
});

test("an empty cart is rejected with 400", async () => {
  const err = await captureError(() =>
    paymentService.createPaymentIntent({ items: [] }, AUTH),
  );
  assert.equal(err.status, 400);
  assert.match(err.message, /non-empty array/);
  assert.equal(store.createdOrders.length, 0);
});

test("a missing cart is rejected with 400", async () => {
  const err = await captureError(() => paymentService.createPaymentIntent({}, AUTH));
  assert.equal(err.status, 400);
});

test("sending an amount is an error, not something silently ignored", async () => {
  for (const field of ["totalAmount", "subtotalAmount", "shippingAmount", "taxAmount", "amount"]) {
    const err = await captureError(() =>
      paymentService.createPaymentIntent(validRequest({ [field]: 1 }), AUTH),
    );
    assert.equal(err.status, 400, `${field} should be rejected`);
    assert.match(err.message, new RegExp(field));
  }
  assert.equal(stripeStub.createCalls.length, 0);
});

test("a malformed shipping address is rejected with 400", async () => {
  const err = await captureError(() =>
    paymentService.createPaymentIntent(
      validRequest({ shippingAddress: { ...SHIPPING_ADDRESS, city: "" } }),
      AUTH,
    ),
  );
  assert.equal(err.status, 400);
  assert.match(err.message, /shippingAddress\.city/);
});

// ── Cart / product validation ───────────────────────────────────────────────

test("a price change blocks the payment and reports the issues", async () => {
  givenInvalidCart([
    {
      code: "PRICE_CHANGED",
      message: 'The price of product "Bulbasaur" has changed.',
      productId: 7,
      productName: "Bulbasaur",
      variantId: 10,
      previousUnitPrice: 1465.2,
      currentUnitPrice: 1600,
    },
  ]);

  const err = await captureError(() =>
    paymentService.createPaymentIntent(validRequest(), AUTH),
  );

  assert.equal(err.status, 409);
  const details = err.details as { code: string; issues: { code: string }[] };
  assert.equal(details.code, "CART_INVALID");
  assert.equal(details.issues[0].code, "PRICE_CHANGED");
  // Crucially: no order and no PaymentIntent were created for a stale price.
  assert.equal(store.createdOrders.length, 0);
  assert.equal(stripeStub.createCalls.length, 0);
});

test("insufficient stock blocks the payment", async () => {
  givenInvalidCart([
    { code: "INSUFFICIENT_STOCK", productId: 7, variantId: 10, availableStock: 1, requestedQuantity: 5 },
  ]);
  const err = await captureError(() =>
    paymentService.createPaymentIntent(validRequest(), AUTH),
  );
  assert.equal(err.status, 409);
  assert.equal((err.details as any).issues[0].code, "INSUFFICIENT_STOCK");
});

test("a total below Stripe's MXN floor is refused before an order exists", async () => {
  givenValidCart([{ ...CART_ITEM, unitPrice: 5, subtotalAmount: 5 }]);
  const err = await captureError(() =>
    paymentService.createPaymentIntent(validRequest(), AUTH),
  );
  assert.equal(err.status, 400);
  assert.equal((err.details as any).code, "AMOUNT_BELOW_MINIMUM");
  assert.equal((err.details as any).minimum, 10);
  assert.equal(store.createdOrders.length, 0);
});

// ── Happy path ──────────────────────────────────────────────────────────────

test("a valid cart creates the order and a PaymentIntent for the server's amount", async () => {
  givenValidCart([{ ...CART_ITEM, quantity: 2, subtotalAmount: 2930.4 }]);

  const result = await paymentService.createPaymentIntent(validRequest(), AUTH);

  // The amount charged is the one the database produced, in centavos.
  assert.equal(stripeStub.createCalls.length, 1);
  assert.equal(stripeStub.createCalls[0].params.amount, 293040);
  assert.equal(stripeStub.createCalls[0].params.currency, "mxn");
  assert.equal(result.amount, 2930.4);

  // The order exists at PENDING_PAYMENT and belongs to the token's user.
  assert.equal(store.createdOrders.length, 1);
  const order = store.createdOrders[0];
  assert.equal(order.userId, AUTH.sub);
  assert.equal(order.status, OrderStatus.PENDING_PAYMENT);
  assert.equal(order.totalAmount, 2930.4);
  assert.equal(order.currency, "MXN");

  // The response carries the client secret and nothing secret.
  assert.match(result.clientSecret, /^pi_test_\d+_secret_/);
  assert.equal(result.orderId, order.id);
  assert.equal(result.status, PaymentStatus.PENDING);
  const serialised = JSON.stringify(result);
  assert.ok(!serialised.includes("sk_test"), "response must never contain the secret key");

  // A Payment row was written and linked back to the order.
  assert.equal(store.payments.length, 1);
  assert.equal(store.payments[0].orderId, order.id);
  assert.equal(store.payments[0].status, PaymentStatus.PENDING);
  assert.equal(store.payments[0].currency, "mxn");
  assert.equal(order.paymentId, result.paymentIntentId);
});

test("the intent carries the metadata the webhook needs to find the order", async () => {
  const result = await paymentService.createPaymentIntent(validRequest(), AUTH);
  const { metadata } = stripeStub.createCalls[0].params;
  assert.equal(metadata.orderId, String(result.orderId));
  assert.equal(metadata.userId, String(AUTH.sub));
  assert.ok(metadata.checkoutKey.length > 0);
});

test("amounts sent by the frontend are never consulted — the cart is priced from the DB", async () => {
  givenValidCart([CART_ITEM]);
  await paymentService.createPaymentIntent(validRequest(), AUTH);
  // The cart validator is called with the lines only: no amount field is
  // forwarded, so a frontend-supplied total is structurally unusable.
  const call = cartStub.calls[0];
  assert.deepEqual(Object.keys(call), ["items"]);
});

// ── Idempotency ─────────────────────────────────────────────────────────────

test("repeating the same checkout reuses the order and the PaymentIntent", async () => {
  const first = await paymentService.createPaymentIntent(validRequest(), AUTH);
  const second = await paymentService.createPaymentIntent(validRequest(), AUTH);

  assert.equal(second.orderId, first.orderId);
  assert.equal(second.paymentIntentId, first.paymentIntentId);
  assert.equal(second.clientSecret, first.clientSecret);
  assert.equal(second.reused, true);
  assert.equal(store.createdOrders.length, 1, "a second order must not be created");
  assert.equal(stripeStub.createCalls.length, 1, "a second intent must not be created");
  assert.equal(store.payments.length, 1);
});

test("concurrent create-intent requests settle on one order and one intent", async () => {
  const [a, b, c] = await Promise.all([
    paymentService.createPaymentIntent(validRequest(), AUTH),
    paymentService.createPaymentIntent(validRequest(), AUTH),
    paymentService.createPaymentIntent(validRequest(), AUTH),
  ]);
  // The Stripe idempotency key collapses the duplicate creates even when the
  // order lookups race (the advisory lock does this for real in PostgreSQL).
  assert.equal(a.paymentIntentId, b.paymentIntentId);
  assert.equal(b.paymentIntentId, c.paymentIntentId);
  assert.equal(new Set(stripeStub.createCalls.map((x) => x.options.idempotencyKey)).size, 1);
});

test("a different basket is a different checkout and gets its own order", async () => {
  const first = await paymentService.createPaymentIntent(validRequest(), AUTH);
  givenValidCart([{ ...CART_ITEM, quantity: 3, subtotalAmount: 4395.6 }]);
  const second = await paymentService.createPaymentIntent(validRequest(), AUTH);

  assert.notEqual(second.orderId, first.orderId);
  assert.equal(store.createdOrders.length, 2);
});

test("an order left behind by a failed Stripe call is picked up by the retry", async () => {
  stripeStub.failNextWith = Object.assign(new Error("network down"), {
    type: "StripeConnectionError",
  });

  const err = await captureError(() =>
    paymentService.createPaymentIntent(validRequest(), AUTH),
  );
  assert.equal(err.status, 502);
  // The order survived; the Stripe half is the only thing missing.
  assert.equal(store.createdOrders.length, 1);
  assert.equal(store.payments.length, 0);

  const retry = await paymentService.createPaymentIntent(validRequest(), AUTH);
  assert.equal(retry.orderId, store.createdOrders[0].id);
  assert.equal(store.createdOrders.length, 1, "the retry must not create a second order");
  assert.equal(store.payments.length, 1);
});

// ── Stripe failures ─────────────────────────────────────────────────────────

test("a Stripe outage becomes a safe 502 that leaks nothing", async () => {
  stripeStub.failNextWith = Object.assign(new Error("Request req_123 failed: sk_test_abc"), {
    type: "StripeAPIError",
    requestId: "req_123",
  });

  const err = await captureError(() =>
    paymentService.createPaymentIntent(validRequest(), AUTH),
  );

  assert.equal(err.status, 502);
  assert.ok(!err.message.includes("sk_test"));
  assert.ok(!err.message.includes("req_123"));
  assert.match(err.message, /payment provider/i);
});

test("a Stripe authentication failure is reported as 503, not as a customer error", async () => {
  stripeStub.failNextWith = Object.assign(new Error("Invalid API Key"), {
    type: "StripeAuthenticationError",
  });
  const err = await captureError(() =>
    paymentService.createPaymentIntent(validRequest(), AUTH),
  );
  assert.equal(err.status, 503);
  assert.ok(!err.message.includes("API Key"));
});

// ── Retrying an existing order ──────────────────────────────────────────────

test("an order that does not exist returns 404", async () => {
  const err = await captureError(() =>
    paymentService.createPaymentIntent({ orderId: 999999 }, AUTH),
  );
  assert.equal(err.status, 404);
});

test("another shopper's order is never exposed", async () => {
  const order = seedOrder({ userId: OTHER_AUTH.sub });
  const err = await captureError(() =>
    paymentService.createPaymentIntent({ orderId: order.id }, AUTH),
  );
  assert.equal(err.status, 403);
  assert.equal(stripeStub.createCalls.length, 0);
});

test("an already-paid order cannot be paid again", async () => {
  const order = seedOrder({ status: OrderStatus.PAID });
  const err = await captureError(() =>
    paymentService.createPaymentIntent({ orderId: order.id }, AUTH),
  );
  assert.equal(err.status, 409);
  assert.equal((err.details as any).code, "ORDER_ALREADY_PAID");
});

test("a cancelled order cannot be paid", async () => {
  const order = seedOrder({ status: OrderStatus.CANCELLED });
  const err = await captureError(() =>
    paymentService.createPaymentIntent({ orderId: order.id }, AUTH),
  );
  assert.equal(err.status, 409);
  assert.equal((err.details as any).code, "ORDER_NOT_PAYABLE");
});

test("retrying a failed order moves it back to PENDING_PAYMENT first", async () => {
  const order = seedOrder({ status: OrderStatus.PAYMENT_FAILED });

  const result = await paymentService.createPaymentIntent({ orderId: order.id }, AUTH);

  // PAYMENT_FAILED has no direct edge to PAID, so the retry re-enters the
  // state machine through PENDING_PAYMENT.
  assert.deepEqual(
    store.statusChanges.map((c) => c.newStatus),
    [OrderStatus.PENDING_PAYMENT],
  );
  assert.equal(store.orders.get(order.id).status, OrderStatus.PENDING_PAYMENT);
  assert.ok(result.clientSecret);
});

test("Stripe reporting the intent as already succeeded stops a double charge", async () => {
  const order = seedOrder();
  const intent = makePaymentIntent({
    id: "pi_already_paid",
    status: "succeeded",
    metadata: { orderId: String(order.id) },
  });
  stripeStub.intents.set(intent.id, intent);
  seedPayment({ orderId: order.id, providerPaymentId: intent.id });

  const err = await captureError(() =>
    paymentService.createPaymentIntent({ orderId: order.id }, AUTH),
  );

  assert.equal(err.status, 409);
  assert.equal((err.details as any).code, "ORDER_ALREADY_PAID");
  // Our records were reconciled with Stripe rather than left stale.
  assert.equal(store.orders.get(order.id).status, OrderStatus.PAID);
  assert.equal(
    store.payments.find((p) => p.providerPaymentId === intent.id).status,
    PaymentStatus.SUCCEEDED,
  );
});

test("an in-flight (processing) intent is reused rather than duplicated", async () => {
  const order = seedOrder();
  const intent = makePaymentIntent({
    id: "pi_processing",
    status: "processing",
    client_secret: "pi_processing_secret_1",
    metadata: { orderId: String(order.id) },
  });
  stripeStub.intents.set(intent.id, intent);
  seedPayment({ orderId: order.id, providerPaymentId: intent.id });

  const result = await paymentService.createPaymentIntent({ orderId: order.id }, AUTH);

  assert.equal(result.paymentIntentId, "pi_processing");
  assert.equal(result.status, PaymentStatus.PROCESSING);
  assert.equal(stripeStub.createCalls.length, 0);
});

test("a cancelled intent is replaced by a fresh one for the same order", async () => {
  const order = seedOrder();
  const intent = makePaymentIntent({
    id: "pi_cancelled",
    status: "canceled",
    metadata: { orderId: String(order.id) },
  });
  stripeStub.intents.set(intent.id, intent);
  seedPayment({ orderId: order.id, providerPaymentId: intent.id });

  const result = await paymentService.createPaymentIntent({ orderId: order.id }, AUTH);

  assert.notEqual(result.paymentIntentId, "pi_cancelled");
  assert.equal(stripeStub.createCalls.length, 1);
  // A new attempt gets its own idempotency key so Stripe does not return the
  // cancelled intent.
  assert.match(stripeStub.createCalls[0].options.idempotencyKey, /attempt-1$/);
  assert.equal(result.orderId, order.id);
});
