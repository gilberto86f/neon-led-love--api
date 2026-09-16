/**
 * POST /api/payments/webhook/stripe.
 *
 * The webhook is the only thing in the system allowed to say an order is paid,
 * so the properties under test are: an unsigned request cannot reach the
 * handler, a redelivered event cannot apply its effects twice, and an event
 * that arrives out of order cannot corrupt the order state machine.
 *
 * Signature verification here is real — the payload is signed with the Stripe
 * SDK's own HMAC helper and verified by the SDK's own `constructEvent`.
 */
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  paymentService,
  PaymentStatus,
  OrderStatus,
  CHANGED_BY_STRIPE_WEBHOOK,
  store,
  resetAll,
  seedOrder,
  seedPayment,
  signedWebhook,
  webhookEvent,
  WEBHOOK_SECRET,
} from "./helpers/harness";
import { HttpError } from "../src/utils/HttpError";

beforeEach(() => resetAll());

const captureError = async (fn: () => Promise<unknown>): Promise<HttpError> => {
  try {
    await fn();
  } catch (err) {
    assert.ok(err instanceof HttpError, `expected HttpError, got ${err}`);
    return err;
  }
  assert.fail("expected the call to throw");
};

/** Signs and delivers an event, returning the handler's result. */
const deliver = (event: Record<string, unknown>) => {
  const { rawBody, signature } = signedWebhook(event);
  return paymentService.handleWebhookEvent(rawBody, signature);
};

/** An order with a pending payment attempt, as create-intent would leave it. */
const givenPendingPayment = (orderStatus = OrderStatus.PENDING_PAYMENT) => {
  const order = seedOrder({ status: orderStatus });
  const payment = seedPayment({
    orderId: order.id,
    providerPaymentId: "pi_hook_1",
    status: PaymentStatus.PENDING,
  });
  return { order, payment };
};

const intentFor = (order: { id: number }, overrides: Record<string, unknown> = {}) => ({
  id: "pi_hook_1",
  amount: 146520,
  currency: "mxn",
  status: "succeeded",
  metadata: { orderId: String(order.id) },
  ...overrides,
});

// ── Signature verification ──────────────────────────────────────────────────

test("a correctly signed event is accepted", async () => {
  const { order } = givenPendingPayment();
  const result = await deliver(webhookEvent("payment_intent.succeeded", intentFor(order)));

  assert.equal(result.received, true);
  assert.equal(result.handled, true);
  assert.equal(result.duplicate, false);
});

test("an invalid signature is rejected with 400 and no side effects", async () => {
  const { order } = givenPendingPayment();
  const { rawBody } = signedWebhook(webhookEvent("payment_intent.succeeded", intentFor(order)));

  const err = await captureError(() =>
    paymentService.handleWebhookEvent(rawBody, "t=1,v1=deadbeef"),
  );

  assert.equal(err.status, 400);
  assert.equal(err.message, "Invalid Stripe signature.");
  assert.equal(store.statusChanges.length, 0);
  assert.equal(store.webhookEvents.size, 0, "an unverified event must not be claimed");
});

test("a payload signed with the wrong secret is rejected", async () => {
  const { order } = givenPendingPayment();
  const Stripe = require("stripe");
  const other = new Stripe("sk_test_other");
  const payload = JSON.stringify(webhookEvent("payment_intent.succeeded", intentFor(order)));
  const signature = other.webhooks.generateTestHeaderString({
    payload,
    secret: "whsec_a_completely_different_secret",
  });

  const err = await captureError(() =>
    paymentService.handleWebhookEvent(Buffer.from(payload), signature),
  );
  assert.equal(err.status, 400);
  assert.equal(store.statusChanges.length, 0);
});

test("a tampered payload fails verification even with a real signature", async () => {
  const { order } = givenPendingPayment();
  const event = webhookEvent("payment_intent.succeeded", intentFor(order));
  const { signature } = signedWebhook(event);
  // The amount is edited after signing — exactly the attack the signature exists
  // to stop.
  const tampered = Buffer.from(
    JSON.stringify({ ...event, data: { object: { ...(event.data as any).object, amount: 1 } } }),
  );

  const err = await captureError(() =>
    paymentService.handleWebhookEvent(tampered, signature),
  );
  assert.equal(err.status, 400);
});

test("a missing raw body is reported as 400 rather than crashing", async () => {
  const err = await captureError(() =>
    paymentService.handleWebhookEvent(undefined, "t=1,v1=abc"),
  );
  assert.equal(err.status, 400);
  assert.match(err.message, /raw request body/i);
});

test("a missing Stripe-Signature header is reported as 400", async () => {
  const { rawBody } = signedWebhook(webhookEvent("payment_intent.succeeded", { id: "pi_x" }));
  const err = await captureError(() => paymentService.handleWebhookEvent(rawBody, undefined));
  assert.equal(err.status, 400);
  assert.match(err.message, /Stripe-Signature/);
});

test("the signing secret is never echoed back in an error", async () => {
  const { rawBody } = signedWebhook(webhookEvent("payment_intent.succeeded", { id: "pi_x" }));
  const err = await captureError(() =>
    paymentService.handleWebhookEvent(rawBody, "t=1,v1=bad"),
  );
  assert.ok(!err.message.includes(WEBHOOK_SECRET));
  assert.ok(!JSON.stringify(err.details ?? {}).includes(WEBHOOK_SECRET));
});

// ── payment_intent.succeeded ────────────────────────────────────────────────

test("payment_intent.succeeded marks the payment SUCCEEDED and the order PAID", async () => {
  const { order } = givenPendingPayment();

  await deliver(webhookEvent("payment_intent.succeeded", intentFor(order)));

  assert.equal(
    store.payments.find((p) => p.providerPaymentId === "pi_hook_1").status,
    PaymentStatus.SUCCEEDED,
  );
  assert.deepEqual(
    store.statusChanges.map((c) => c.newStatus),
    [OrderStatus.PAID],
  );
  // The actor recorded in the audit trail is the webhook, not a user.
  assert.equal(store.statusChanges[0].actor, CHANGED_BY_STRIPE_WEBHOOK);
  assert.match(store.statusChanges[0].comment!, /pi_hook_1/);
});

test("a success for an order marked PAYMENT_FAILED is routed through PENDING_PAYMENT", async () => {
  const { order } = givenPendingPayment(OrderStatus.PAYMENT_FAILED);

  await deliver(webhookEvent("payment_intent.succeeded", intentFor(order)));

  // PAYMENT_FAILED → PAID is not a legal edge; the handler re-enters the state
  // machine rather than asking for a transition it would reject.
  assert.deepEqual(
    store.statusChanges.map((c) => c.newStatus),
    [OrderStatus.PENDING_PAYMENT, OrderStatus.PAID],
  );
  assert.equal(store.orders.get(order.id).status, OrderStatus.PAID);
});

test("a success for an order staff already advanced does not drag it back to PAID", async () => {
  const { order } = givenPendingPayment(OrderStatus.IN_PRODUCTION);

  const result = await deliver(webhookEvent("payment_intent.succeeded", intentFor(order)));

  assert.equal(result.handled, true);
  assert.equal(store.statusChanges.length, 0);
  assert.equal(store.orders.get(order.id).status, OrderStatus.IN_PRODUCTION);
});

test("a success for a CANCELLED order is acknowledged, not forced through", async () => {
  const { order } = givenPendingPayment(OrderStatus.CANCELLED);

  // CANCELLED is terminal. Throwing here would make Stripe retry forever; the
  // handler records the payment, leaves the order alone, and logs for a human.
  const result = await deliver(webhookEvent("payment_intent.succeeded", intentFor(order)));

  assert.equal(result.handled, true);
  assert.equal(store.statusChanges.length, 0);
  assert.equal(store.orders.get(order.id).status, OrderStatus.CANCELLED);
  assert.equal(
    store.payments.find((p) => p.providerPaymentId === "pi_hook_1").status,
    PaymentStatus.SUCCEEDED,
  );
});

// ── payment_intent.payment_failed ───────────────────────────────────────────

test("payment_intent.payment_failed records the decline reason on the payment", async () => {
  const { order } = givenPendingPayment();

  await deliver(
    webhookEvent(
      "payment_intent.payment_failed",
      intentFor(order, {
        status: "requires_payment_method",
        last_payment_error: {
          code: "card_declined",
          decline_code: "insufficient_funds",
          message: "Your card has insufficient funds.",
        },
      }),
    ),
  );

  const payment = store.payments.find((p) => p.providerPaymentId === "pi_hook_1");
  assert.equal(payment.status, PaymentStatus.FAILED);
  assert.equal(payment.failureCode, "card_declined");
  assert.equal(payment.failureMessage, "Your card has insufficient funds.");

  assert.deepEqual(
    store.statusChanges.map((c) => c.newStatus),
    [OrderStatus.PAYMENT_FAILED],
  );
  assert.equal(store.orders.get(order.id).status, OrderStatus.PAYMENT_FAILED);
});

test("a stale failure for an already-paid order is ignored", async () => {
  const { order } = givenPendingPayment(OrderStatus.PAID);

  await deliver(
    webhookEvent("payment_intent.payment_failed", intentFor(order, { status: "requires_payment_method" })),
  );

  assert.equal(store.statusChanges.length, 0);
  assert.equal(store.orders.get(order.id).status, OrderStatus.PAID);
});

// ── payment_intent.canceled ─────────────────────────────────────────────────

test("payment_intent.canceled cancels the payment and the order", async () => {
  const { order } = givenPendingPayment();

  await deliver(
    webhookEvent("payment_intent.canceled", intentFor(order, { status: "canceled" })),
  );

  assert.equal(
    store.payments.find((p) => p.providerPaymentId === "pi_hook_1").status,
    PaymentStatus.CANCELED,
  );
  assert.deepEqual(
    store.statusChanges.map((c) => c.newStatus),
    [OrderStatus.CANCELLED],
  );
});

test("a cancellation for an order that is already paid leaves it alone", async () => {
  const { order } = givenPendingPayment(OrderStatus.PAID);
  await deliver(
    webhookEvent("payment_intent.canceled", intentFor(order, { status: "canceled" })),
  );
  assert.equal(store.statusChanges.length, 0);
});

// ── payment_intent.processing ───────────────────────────────────────────────

test("payment_intent.processing moves the payment on but not the order", async () => {
  const { order } = givenPendingPayment();

  await deliver(
    webhookEvent("payment_intent.processing", intentFor(order, { status: "processing" })),
  );

  // Async methods (an OXXO voucher, a bank debit) sit here until the money
  // actually arrives — the order must not be treated as paid yet.
  assert.equal(
    store.payments.find((p) => p.providerPaymentId === "pi_hook_1").status,
    PaymentStatus.PROCESSING,
  );
  assert.equal(store.statusChanges.length, 0);
  assert.equal(store.orders.get(order.id).status, OrderStatus.PENDING_PAYMENT);
});

// ── Idempotency ─────────────────────────────────────────────────────────────

test("a redelivered event is recognised and applies no second effect", async () => {
  const { order } = givenPendingPayment();
  const event = webhookEvent("payment_intent.succeeded", intentFor(order), "evt_fixed_id");

  const first = await deliver(event);
  const second = await deliver(event);
  const third = await deliver(event);

  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(third.duplicate, true);
  // One status change, not three.
  assert.equal(store.statusChanges.length, 1);
  assert.equal(store.statusChanges[0].newStatus, OrderStatus.PAID);
});

test("two different events for the same intent are both processed", async () => {
  const { order } = givenPendingPayment();

  await deliver(
    webhookEvent(
      "payment_intent.payment_failed",
      intentFor(order, { status: "requires_payment_method" }),
      "evt_a",
    ),
  );
  await deliver(webhookEvent("payment_intent.succeeded", intentFor(order), "evt_b"));

  // The retry path: failed, then paid on the second attempt.
  assert.deepEqual(
    store.statusChanges.map((c) => c.newStatus),
    [OrderStatus.PAYMENT_FAILED, OrderStatus.PENDING_PAYMENT, OrderStatus.PAID],
  );
});

test("a failed handler releases its claim so Stripe's retry can succeed", async () => {
  const { order } = givenPendingPayment();
  const event = webhookEvent("payment_intent.succeeded", intentFor(order), "evt_retry");

  // Break the order lookup for the first delivery only.
  const orderRow = store.orders.get(order.id);
  store.orders.delete(order.id);
  const originalPayments = store.payments;
  store.payments = new Proxy(originalPayments, {
    get(target, prop) {
      if (prop === "find") {
        return () => {
          throw new Error("transient database failure");
        };
      }
      return (target as any)[prop];
    },
  }) as any;

  await assert.rejects(() => deliver(event), /transient database failure/);
  assert.equal(store.webhookEvents.has("evt_retry"), false, "the claim must be released");

  // Restore and redeliver, exactly as Stripe would.
  store.payments = originalPayments;
  store.orders.set(order.id, orderRow);
  const retry = await deliver(event);

  assert.equal(retry.duplicate, false);
  assert.equal(retry.handled, true);
  assert.equal(store.orders.get(order.id).status, OrderStatus.PAID);
});

// ── Unknown / unmatched events ──────────────────────────────────────────────

test("an event type we do not subscribe to is acknowledged, not retried", async () => {
  const result = await deliver(webhookEvent("charge.refunded", { id: "pi_hook_1" }));

  assert.equal(result.received, true);
  assert.equal(result.handled, false);
  assert.equal(result.eventType, "charge.refunded");
  assert.equal(store.statusChanges.length, 0);
});

test("an event for an unknown order is acknowledged without side effects", async () => {
  const result = await deliver(
    webhookEvent("payment_intent.succeeded", {
      id: "pi_unknown",
      status: "succeeded",
      metadata: { orderId: "424242" },
    }),
  );

  // Returning 200 stops Stripe retrying an event we can never match — e.g. one
  // from another environment pointed at this endpoint.
  assert.equal(result.handled, true);
  assert.equal(store.statusChanges.length, 0);
  assert.equal(store.payments.length, 0);
});

test("an event with no Payment row still finds its order through metadata", async () => {
  // The window between creating the intent at Stripe and writing our row: the
  // webhook can win the race, and must still work.
  const order = seedOrder();

  await deliver(
    webhookEvent("payment_intent.succeeded", {
      id: "pi_no_row_yet",
      status: "succeeded",
      metadata: { orderId: String(order.id) },
    }),
  );

  assert.equal(store.payments.length, 1);
  assert.equal(store.payments[0].orderId, order.id);
  assert.equal(store.payments[0].status, PaymentStatus.SUCCEEDED);
  assert.equal(store.orders.get(order.id).status, OrderStatus.PAID);
});

test("an event with neither a Payment row nor usable metadata is ignored safely", async () => {
  const result = await deliver(
    webhookEvent("payment_intent.succeeded", { id: "pi_orphan", status: "succeeded", metadata: {} }),
  );
  assert.equal(result.handled, true);
  assert.equal(store.payments.length, 0);
  assert.equal(store.statusChanges.length, 0);
});
