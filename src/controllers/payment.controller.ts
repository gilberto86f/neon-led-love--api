import { Request, Response, NextFunction } from "express";
import { paymentService } from "../services/payment.service";
import { ok, okList } from "../utils/apiResponse";
import { HttpError } from "../utils/HttpError";
import { canAccessOrder } from "../utils/authorization";
import { FORBIDDEN_MESSAGE } from "../middlewares/authGuard";

const parseId = (raw: string | string[]): number => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid id");
  return id;
};

export const paymentController = {
  /**
   * POST /api/payments/create-intent
   *
   * The authenticated caller is taken from the verified token, never from the
   * body — the shopper cannot check out as somebody else. `200` when nothing
   * was created (the order *and* its PaymentIntent already existed), `201`
   * whenever this call created either of them.
   */
  createIntent: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth) throw new HttpError(401, "Authentication required.");
      const result = await paymentService.createPaymentIntent(req.body, req.auth);
      const status = result.reused ? 200 : 201;
      res.status(status).json(ok(result, status));
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/payments/webhook/stripe
   *
   * Called by Stripe, not by a browser: there is no JWT, the Stripe signature
   * *is* the authentication. Anything that throws here reaches the standard
   * error handler — a 4xx tells Stripe not to retry, a 5xx tells it to retry,
   * which is exactly the behaviour we want in each case.
   */
  stripeWebhook: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature = req.headers["stripe-signature"];
      const result = await paymentService.handleWebhookEvent(
        req.rawBody,
        typeof signature === "string" ? signature : undefined,
      );
      res.status(200).json(ok(result));
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/payments/order/:orderId — payment attempts for one order. */
  listForOrder: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orderId = parseId(req.params.orderId);
      const { ownerUserId, payments } = await paymentService.getPaymentsForOrder(orderId);
      if (!req.auth || !canAccessOrder(req.auth, ownerUserId)) {
        throw new HttpError(403, FORBIDDEN_MESSAGE);
      }
      res.status(200).json(okList(payments));
    } catch (err) {
      next(err);
    }
  },
};
