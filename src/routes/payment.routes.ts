import { Router } from "express";
import { paymentController } from "../controllers/payment.controller";
import { jwtAuthGuard } from "../middlewares/authGuard";

const router = Router();

// The webhook is intentionally *not* behind jwtAuthGuard: Stripe cannot present
// a JWT. Its authentication is the `Stripe-Signature` header, verified against
// STRIPE_WEBHOOK_SECRET in paymentService.handleWebhookEvent. It must stay
// first so no auth middleware is ever added above it by accident.
router.post("/webhook/stripe", paymentController.stripeWebhook);

// Everything else is a shopper action and requires a valid access token.
router.post("/create-intent", jwtAuthGuard, paymentController.createIntent);
router.get("/order/:orderId", jwtAuthGuard, paymentController.listForOrder);

export default router;
