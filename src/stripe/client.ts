import Stripe from "stripe";
import { stripeConfig } from "../utils/stripeConfig";
import { HttpError } from "../utils/HttpError";

/**
 * Single shared Stripe client, the counterpart of `src/prisma/client.ts`.
 * Import `getStripe()` from here; do not call `new Stripe(...)` anywhere else.
 *
 * It is created lazily so the server still boots (and every non-payment
 * endpoint keeps working) when `STRIPE_SECRET_KEY` is absent — only the payment
 * endpoints fail, and they fail with a clear 503 instead of a crash at import
 * time.
 *
 * `apiVersion` is deliberately not passed: the SDK pins the version its
 * TypeScript types were generated against, so the two can never drift. Upgrade
 * the API version by upgrading the `stripe` package.
 */
let client: Stripe | null = null;

export const isStripeConfigured = (): boolean => Boolean(stripeConfig.secretKey);

export const getStripe = (): Stripe => {
  if (!stripeConfig.secretKey) {
    throw new HttpError(
      503,
      "Payments are not configured on this server (STRIPE_SECRET_KEY is missing).",
    );
  }
  if (!client) {
    client = new Stripe(stripeConfig.secretKey, {
      // Surfaces this app in the Stripe dashboard's request logs.
      appInfo: { name: "neon-led-love-api" },
      // A create-intent call blocking a checkout for 80s helps nobody.
      timeout: 20_000,
      maxNetworkRetries: 2,
    });
  }
  return client;
};

/** Test seam: lets the suite install a stub without touching the network. */
export const __setStripeClientForTests = (stub: Stripe | null) => {
  client = stub;
};
