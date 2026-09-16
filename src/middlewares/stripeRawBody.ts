import type { Request, Response } from "express";

declare global {
  namespace Express {
    interface Request {
      /**
       * The exact bytes of the request body, captured before JSON parsing.
       * Only ever populated for the Stripe webhook route — see `captureRawBody`.
       */
      rawBody?: Buffer;
    }
  }
}

/** Path prefix whose raw body must survive the JSON parser. */
export const STRIPE_WEBHOOK_PATH_PREFIX = "/api/payments/webhook";

/**
 * `verify` hook for `express.json()`.
 *
 * Stripe signs the raw bytes of the webhook payload, so verifying the signature
 * against a re-serialised `req.body` fails: key order, whitespace and unicode
 * escaping would all have to match byte for byte. body-parser hands the
 * untouched buffer to this hook before parsing, which is the one place the
 * original bytes are still available.
 *
 * The buffer is kept **only** for the webhook path, so no other request pays
 * for holding a second copy of its body in memory.
 */
export const captureRawBody = (
  req: Request,
  _res: Response,
  buf: Buffer,
): void => {
  const url = req.originalUrl || req.url || "";
  if (url.startsWith(STRIPE_WEBHOOK_PATH_PREFIX)) {
    req.rawBody = Buffer.from(buf);
  }
};
