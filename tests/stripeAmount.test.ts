/**
 * Currency conversion. Getting this wrong charges the customer 100x too much or
 * too little, so every currency shape Stripe defines is pinned here.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  toStripeAmount,
  fromStripeAmount,
  minimumChargeFor,
} from "../src/utils/stripeConfig";

test("MXN is a two-decimal currency: pesos are sent as centavos", () => {
  assert.equal(toStripeAmount(1465.2, "mxn"), 146520);
  assert.equal(toStripeAmount(10, "mxn"), 1000);
  assert.equal(toStripeAmount(0, "mxn"), 0);
  assert.equal(toStripeAmount(16305.2, "mxn"), 1630520);
});

test("MXN conversion is immune to binary floating-point drift", () => {
  // 1465.2 * 100 === 146519.99999999999 in IEEE-754. A bare multiplication
  // would truncate to 146519 and undercharge by a centavo.
  assert.equal(toStripeAmount(1465.2, "mxn"), 146520);
  assert.equal(toStripeAmount(0.29, "mxn"), 29);
  assert.equal(toStripeAmount(19.99, "mxn"), 1999);
  // 1.1 * 3 === 3.3000000000000003; rounding keeps it at 330 centavos.
  assert.equal(toStripeAmount(1.1 * 3, "mxn"), 330);
});

test("zero-decimal currencies are sent unmultiplied", () => {
  assert.equal(toStripeAmount(500, "jpy"), 500);
  assert.equal(toStripeAmount(50, "krw"), 50);
  assert.equal(toStripeAmount(1000, "vnd"), 1000);
});

test("three-decimal currencies round to a multiple of ten", () => {
  // Stripe requires the smallest-unit amount to be divisible by 10 for these.
  assert.equal(toStripeAmount(5.123, "kwd"), 5120);
  assert.equal(toStripeAmount(1, "bhd"), 1000);
  assert.equal(toStripeAmount(5.123, "kwd") % 10, 0);
});

test("currency codes are matched case-insensitively", () => {
  assert.equal(toStripeAmount(10, "MXN"), toStripeAmount(10, "mxn"));
  assert.equal(toStripeAmount(500, "JPY"), 500);
});

test("fromStripeAmount is the inverse of toStripeAmount", () => {
  for (const [amount, currency] of [
    [1465.2, "mxn"],
    [16305.2, "mxn"],
    [500, "jpy"],
    [10, "mxn"],
  ] as const) {
    assert.equal(fromStripeAmount(toStripeAmount(amount, currency), currency), amount);
  }
});

test("a non-finite or negative amount is refused, never silently coerced", () => {
  assert.throws(() => toStripeAmount(NaN, "mxn"));
  assert.throws(() => toStripeAmount(Infinity, "mxn"));
  assert.throws(() => toStripeAmount(-1, "mxn"));
  assert.throws(() => toStripeAmount("100" as unknown as number, "mxn"));
});

test("the MXN minimum charge matches Stripe's published floor", () => {
  assert.equal(minimumChargeFor("mxn"), 10);
  assert.equal(minimumChargeFor("MXN"), 10);
  assert.equal(minimumChargeFor("xyz"), undefined);
});
