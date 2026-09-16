/**
 * Stripe configuration, read from the environment. Mirrors `authConfig`: the
 * values live here so nothing else in the codebase reads `process.env` directly
 * and no key is ever hardcoded.
 *
 * `STRIPE_SECRET_KEY` is server-side only — it must never reach the frontend,
 * be logged, or appear in a response body. The frontend uses its *publishable*
 * key, which it holds in its own environment.
 */
export const stripeConfig = {
  secretKey: process.env.STRIPE_SECRET_KEY || "",
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  /** The store sells in Mexican pesos. Stripe expects the code in lowercase. */
  currency: (process.env.STRIPE_CURRENCY || "mxn").toLowerCase(),
};

if (process.env.NODE_ENV === "production") {
  if (!stripeConfig.secretKey || !stripeConfig.webhookSecret) {
    throw new Error(
      "STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET must be set in production",
    );
  }
}

// ── Amounts ────────────────────────────────────────────────────────────────
// The Stripe API takes amounts as an integer in the currency's *smallest unit*.
// Most currencies have two decimals (MXN included: 1 peso = 100 centavos, so
// $1,465.20 MXN is sent as `146520`), but not all — hence the tables below
// rather than an unconditional `* 100`.
// Source: https://docs.stripe.com/currencies

/** Charged 1:1 — ¥500 JPY is sent as `500`, not `50000`. */
const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga",
  "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);

/**
 * Three-decimal currencies. Stripe additionally requires the smallest-unit
 * amount to be evenly divisible by 10 for these.
 */
const THREE_DECIMAL_CURRENCIES = new Set(["bhd", "jod", "kwd", "omr", "tnd"]);

const decimalsFor = (currency: string): number => {
  const code = currency.toLowerCase();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 3;
  return 2;
};

/**
 * Converts a human amount (e.g. `1465.2` MXN) into the integer Stripe expects
 * (`146520`). Throws for anything that is not a finite, non-negative number so
 * a bad total can never silently become a wrong charge.
 */
export const toStripeAmount = (amount: number, currency: string): number => {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
    throw new Error(`Cannot convert amount to Stripe minor units: ${amount}`);
  }
  const decimals = decimalsFor(currency);
  const minor = Math.round(amount * 10 ** decimals);
  // Three-decimal currencies must be a multiple of 10 in the smallest unit.
  return decimals === 3 ? Math.round(minor / 10) * 10 : minor;
};

/** Inverse of `toStripeAmount` — turns `146520` back into `1465.2`. */
export const fromStripeAmount = (minorAmount: number, currency: string): number => {
  const decimals = decimalsFor(currency);
  return minorAmount / 10 ** decimals;
};

/**
 * Stripe rejects charges below a per-currency floor (MXN 10.00 — see
 * https://docs.stripe.com/currencies#minimum-and-maximum-charge-amounts).
 * Checking it here turns an opaque Stripe rejection into a clear 400 before we
 * ever create an order. Currencies without an entry are not floor-checked.
 */
const MINIMUM_CHARGE: Record<string, number> = {
  mxn: 10,
  usd: 0.5,
  eur: 0.5,
  cad: 0.5,
};

export const minimumChargeFor = (currency: string): number | undefined =>
  MINIMUM_CHARGE[currency.toLowerCase()];
