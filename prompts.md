👨‍💻

# Implement Stripe Payments — Backend

I want to integrate **Stripe as a payment provider** into my e-commerce backend using **Stripe Payment Intents**, so that the Angular frontend can use **Stripe Payment Element** to collect and confirm payments.

Before making any changes, **inspect and understand the existing project architecture**. Do not assume that the structures, names, endpoints, models, or services described below already exist. Adapt the implementation to the project's existing conventions.

---

## Current Backend Stack

The backend uses:

- Node.js
- Express
- TypeScript
- Prisma
- PostgreSQL
- JWT authentication
- Multer

The backend is a separate project from the Angular frontend.

---

## Overall Integration

The frontend and backend will communicate using the following payment flow:

```text
Angular Frontend
      │
      │ POST /payments/create-intent
      │
      │ { cartId, shipping information, ... }
      ▼
Backend
      │
      ├── Authenticate user
      ├── Validate cart
      ├── Validate products/variants
      ├── Calculate prices
      ├── Calculate discounts
      ├── Calculate shipping
      ├── Calculate final total
      │
      ├── Create Order
      │       └── PENDING_PAYMENT
      │
      └── Create Stripe PaymentIntent
              │
              └── client_secret
      │
      ▼
Angular
      │
      ├── Initialize Stripe Elements
      ├── Mount Payment Element
      └── stripe.confirmPayment()
      │
      ▼
Stripe
      │
      └── Processes payment
      │
      ▼
Stripe Webhook
      │
      ▼
Backend
      │
      ├── Verify webhook signature
      ├── Process event idempotently
      ├── Update Payment
      └── Update Order
```

The backend must be the **source of truth for prices and payment status**.

---

## IMPORTANT: Inspect Before Implementing

Before modifying anything:

1. Explore the entire backend project structure.
2. Identify the existing modules/features.
3. Find the current:
   - Cart implementation
   - Cart services
   - Product models
   - Product variants
   - Order models
   - Order services
   - Order controllers
   - Order routes
   - Authentication middleware
   - User models
   - Error handling
   - API response conventions
   - Environment/configuration system

4. Inspect the Prisma schema.
5. Check whether any payment-related implementation already exists.
6. Check existing enums and Order statuses.
7. Check the project's naming conventions.
8. Check how transactions are currently handled.
9. Check whether there is already a webhook architecture.

Do not create duplicate functionality.

After inspecting the project, provide a **short implementation plan** explaining:

- Which existing files/components will be reused.
- Which files will be created.
- Which files will be modified.
- Any Prisma changes required.
- The API contract that will be exposed to the frontend.

Then proceed with the implementation.

---

## Stripe SDK

Install the official Stripe Node.js SDK if it is not already installed.

Use environment variables:

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

Never hardcode these values.

Never expose `STRIPE_SECRET_KEY` to the frontend.

---

## Payment API

Implement an endpoint following the existing API conventions.

Conceptually:

```http
POST /payments/create-intent
```

The exact route may be different if the existing project uses another convention.

The frontend needs to be able to send enough information to identify the checkout/cart.

For example:

```json
{
  "cartId": "cart_123"
}
```

If shipping information or another checkout identifier is required by the existing architecture, include it according to the existing checkout design.

Do not accept the final order amount from the frontend.

---

## Backend Price Validation

The backend must calculate the final payment amount.

Never trust:

```text
price
subtotal
discount
shipping
tax
total
```

sent by the frontend.

The backend must:

1. Retrieve the authenticated user's cart.
2. Verify that the cart belongs to the current user.
3. Validate that the cart is not empty.
4. Retrieve current product/variant information from PostgreSQL.
5. Validate quantities.
6. Validate product availability.
7. Calculate the current product prices.
8. Calculate discounts according to existing business rules.
9. Calculate shipping according to existing business rules.
10. Calculate the final amount.

The amount sent to Stripe must be generated exclusively by this backend calculation.

---

## Order Creation

Inspect the existing Order model and lifecycle before making changes.

The intended lifecycle is:

```text
Order
  ↓
PENDING_PAYMENT
  ↓
Payment succeeds
  ↓
PAID
```

Create the Order **before** attempting the payment so that the PaymentIntent can be associated with an existing Order.

Do not create a second Order simply because a PaymentIntent is retried.

The implementation should support retrying payment for an existing pending-payment Order when appropriate.

Use the existing Order states if they already provide an equivalent concept.

Only introduce a new `PENDING_PAYMENT` state if necessary.

---

## Payment Model

Inspect the existing database schema first.

If there is no suitable payment model, introduce a dedicated Payment model rather than putting all Stripe-specific information directly into Order.

Conceptually, we need to associate:

```text
Order
   │
   └── Payment
          ├── Stripe PaymentIntent ID
          ├── amount
          ├── currency
          └── status
```

Adapt field names and relationships to the existing Prisma conventions.

Do not duplicate information unnecessarily.

Potential payment states:

```text
PENDING
PROCESSING
SUCCEEDED
FAILED
CANCELED
REFUNDED
```

Only add states that are actually needed.

---

## Stripe PaymentIntent

Create the PaymentIntent using the amount calculated by the backend.

Use MXN:

```text
mxn
```

Be careful with Stripe's amount representation for MXN. Verify the current Stripe API requirements rather than blindly assuming that every currency uses two decimal places.

The PaymentIntent should contain metadata that allows the webhook to identify our Order.

For example:

```typescript
metadata: {
  orderId: order.id,
  userId: user.id
}
```

Adapt this to the actual project.

Return the PaymentIntent `client_secret` to the frontend.

Example response:

```json
{
  "clientSecret": "pi_..._secret_..."
}
```

The response must not contain:

```text
STRIPE_SECRET_KEY
```

or other server-side secrets.

---

## PaymentIntent Idempotency

Design the implementation so that repeated requests do not unnecessarily create multiple PaymentIntents or Orders.

Consider the following scenarios:

```text
User clicks Pay twice
Network request is retried
Browser refreshes
Frontend retries create-intent
```

The implementation should safely handle these situations.

Reuse an existing pending PaymentIntent when appropriate, or use Stripe idempotency keys where appropriate.

Do not create duplicate Orders for the same checkout.

---

## Stripe Webhook

Implement a Stripe webhook endpoint.

Conceptually:

```http
POST /payments/webhook
```

Follow the project's existing route conventions.

The webhook must:

1. Receive the raw request body.
2. Verify the Stripe signature using `STRIPE_WEBHOOK_SECRET`.
3. Construct the Stripe event securely.
4. Process supported events.
5. Be idempotent.
6. Return an appropriate HTTP response.

IMPORTANT:

Stripe webhook signature verification requires the original raw request body.

Make sure Express JSON parsing does not destroy the raw body before the webhook is processed.

---

## Events

At minimum, handle:

```text
payment_intent.succeeded
payment_intent.payment_failed
payment_intent.canceled
```

Determine whether additional PaymentIntent-related events are necessary based on the current implementation.

For successful payment:

```text
Payment → SUCCEEDED
Order   → PAID
```

For failed payment:

```text
Payment → FAILED
```

Update the Order appropriately according to the existing Order state machine.

Do not mark an Order as `PAID` merely because the frontend reports that `confirmPayment()` returned successfully.

The Stripe webhook is the authoritative confirmation.

---

## Webhook Idempotency

Stripe may deliver the same webhook more than once.

Do not process the same event multiple times.

Inspect the current database architecture and implement a suitable strategy.

If necessary, introduce a persisted Stripe event record, for example:

```text
StripeWebhookEvent
    id
    stripeEventId
    eventType
    processedAt
```

But only do this if it fits the existing architecture.

The important requirement is:

```text
same Stripe event
      ↓
must not create duplicate effects
```

---

## Security Requirements

The implementation must:

- Never store card numbers.
- Never store CVC.
- Never receive raw card information in the backend.
- Never expose `STRIPE_SECRET_KEY` to Angular.
- Never trust frontend-calculated totals.
- Verify the authenticated user owns the Cart.
- Verify the authenticated user owns the Order.
- Verify Stripe webhook signatures.
- Avoid logging Stripe secrets.
- Avoid logging PaymentIntent client secrets.
- Avoid putting secrets in URLs.
- Validate all incoming request data.
- Follow existing authentication and authorization middleware.

Stripe Elements will collect payment information directly on the frontend.

---

## Checkout Failure Scenarios

Handle these situations correctly:

#### Cart not found

Return the project's standard not-found error.

#### Cart belongs to another user

Do not expose the cart.

#### Empty cart

Reject checkout.

#### Product changed

If prices or availability changed, prevent creating an incorrect payment.

Return the appropriate error according to the existing API error conventions.

#### PaymentIntent creation fails

Do not leave inconsistent Order/Payment records.

Use database transactions where appropriate.

#### Stripe API error

Return a safe application-level error without exposing sensitive Stripe information.

---

## Transactions and Consistency

Pay close attention to consistency between:

```text
Database
Stripe
```

A database transaction cannot atomically include Stripe's external API.

Therefore, do not assume:

```text
DB transaction + Stripe API call
```

can be rolled back together.

Design the flow so partially completed operations can be recovered safely.

For example:

```text
Order created
PaymentIntent created
PaymentIntent creation response fails locally
```

should not result in an unrecoverable duplicate order.

Use the existing architecture and appropriate idempotency mechanisms.

---

## Currency

The store uses:

```text
MXN
```

Use:

```text
mxn
```

for Stripe unless the existing architecture indicates otherwise.

Verify the current Stripe documentation for MXN amount handling before implementing the conversion.

Do not blindly multiply amounts by 100 without verifying the currency's rules.

---

## API Contract for Frontend

The final backend implementation must clearly document the contract that the Angular frontend will consume.

At minimum, provide:

#### Create PaymentIntent

```http
POST /payments/create-intent
```

Request:

```json
{
  "cartId": "..."
}
```

Response:

```json
{
  "clientSecret": "..."
}
```

If the actual request/response differs, document the real implementation instead.

Also document:

- Authentication requirements
- HTTP status codes
- Validation errors
- Payment-related errors
- Order behavior
- Retry behavior

---

## Frontend Expectations

The separate Angular frontend will:

1. Call the create-intent endpoint.
2. Receive the `clientSecret`.
3. Initialize Stripe Elements.
4. Create the Payment Element.
5. Mount it in the checkout.
6. Call:

```typescript
stripe.confirmPayment(...)
```

7. Handle any required redirect/authentication.
8. Show the final payment state.

The frontend will **not** create PaymentIntents directly.

The frontend will **not** calculate the authoritative payment amount.

The frontend will **not** mark the Order as PAID.

---

## Testing

Add appropriate tests following the existing testing framework.

Test at least:

#### Payment creation

- authenticated user
- unauthenticated user
- invalid cart
- empty cart
- unauthorized cart
- invalid products
- invalid quantities
- price changes
- successful PaymentIntent creation
- Stripe API failure
- duplicate create-intent request

#### Webhook

- valid signature
- invalid signature
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `payment_intent.canceled`
- duplicate webhook event
- unknown event
- Order not found
- Payment not found

Do not remove or disable existing tests.

---

## Documentation

At the end, document:

### Environment variables

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

### API endpoints

Document every new or modified endpoint.

### Database changes

Document:

- Prisma models
- fields
- relations
- enums
- migrations

### Stripe flow

Explain:

```text
Create PaymentIntent
        ↓
Payment Element
        ↓
confirmPayment
        ↓
Stripe
        ↓
Webhook
        ↓
Order PAID
```

### Local webhook development

Explain how to configure Stripe CLI for local development and how to obtain the webhook signing secret.

---

## Code Quality

Follow the existing project conventions.

Do not:

- Perform unrelated refactors.
- Rename existing APIs unnecessarily.
- Replace existing architecture.
- Introduce unnecessary dependencies.
- Duplicate services.
- Hardcode configuration.
- Disable TypeScript strictness.
- Disable tests.

Prefer small, focused changes.

---

## Final Report

After implementation, provide:

1. **Implementation summary**
2. **Files created**
3. **Files modified**
4. **Prisma changes**
5. **API contract**
6. **Environment variables**
7. **Stripe configuration**
8. **Webhook implementation**
9. **Tests executed**
10. **Any assumptions or decisions made**

If there are architectural inconsistencies or decisions that could affect the Angular frontend, explicitly call them out so the frontend implementation can consume the backend correctly.

# 🤖

Done. Here's the final report.

## 1. Implementation summary

Stripe Payment Intents are integrated end-to-end. The flow is: `POST /api/payments/create-intent` (JWT-authenticated) re-prices the cart from PostgreSQL, creates the Order at `PENDING_PAYMENT`, creates a Stripe PaymentIntent for that amount, and returns the `clientSecret`. `POST /api/payments/webhook/stripe` verifies the signature and is the only thing that marks an order PAID.

Three findings from the inspection reshaped the brief:

- **There is no Cart model.** The cart lives in the frontend's LocalStorage; cart.service.ts re-validates it. So there is no `cartId` — `create-intent` takes `items[]`, the same lines `POST /api/cart/validate` accepts. This is the main thing the Angular team needs to know.
- `PENDING_PAYMENT`/`PAID`/`PAYMENT_FAILED` already existed with a full transition table. I added no order states and reused `orderService.recordPaymentStatusChange`, which was already documented as "the seam the future webhook handler calls".
- No test framework existed. CLAUDE.md said not to invent one, but tests were explicitly requested — so I used Node 22's built-in `node --test` with the already-present `ts-node`. No new test dependency.

## 2. Files created

`src/services/payment.service.ts`, `src/controllers/payment.controller.ts`, `src/routes/payment.routes.ts`, `src/stripe/client.ts`, `src/utils/stripeConfig.ts`, `src/middlewares/stripeRawBody.ts`, `prisma/migrations/20260901174832_add_payments/`, `tests/{helpers/harness,stripeAmount.test,payment.service.test,payment.webhook.test}.ts`

## 3. Files modified

`prisma/schema.prisma`, `src/app.ts` (raw-body capture), `src/routes/index.ts`, `src/services/order.service.ts` (transaction-aware `createOrder`, exported `validateShippingAddress`, `checkoutKey` rejected from client bodies), `src/utils/{HttpError,apiResponse}.ts` + `src/middlewares/errorHandler.ts` (additive details field), `src/swagger.ts`, `README.md`, `CLAUDE.md`, `.env.example`, `.env`, `package.json`

## 4. Prisma changes

Purely additive — no drops, no type changes, no existing row touched. `Payment` (numeric `status`, unique `providerPaymentId`), `StripeWebhookEvent` (unique `stripeEventId` as the idempotency guard), and `Order.checkoutKey` + index + `payments[]`. No Prisma `enum` — `Int` status matches how `Order.status` and `Quote.status` already work.

## 5. API contract

Endpoint Auth Notes
`POST /api/payments/create-intent` **JWT** `{ items[], shippingAddress?, notes?, orderId? }` → `{ clientSecret, paymentIntentId, orderId, amount, currency, status, reused, order }`. `201` created / `200` fully reused.
`GET /api/payments/order/:orderId` **JWT** Payment attempts; same ownership rule as the order.
`POST /api/payments/webhook/stripe` **signature** Handles `succeeded`, `processing`, `payment_failed`, `canceled`.

Errors: `400` (malformed, or any amount field — rejected, not ignored), `401`, `403`, `404`, `409` (`details.code`: `CART_INVALID` with the full `issues[]`, `ORDER_ALREADY_PAID`, `ORDER_NOT_PAYABLE`), `502`, `503`.

## 6–8. Environment, Stripe config, webhook

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CURRENCY=mxn`. Production boot fails without the first two. Local setup via `stripe listen` is documented in README §15.7.

Raw body: `express.json({ verify: captureRawBody })` keeps the untouched bytes for the webhook path only — route-level express.raw() cannot work here because the global JSON parser already consumed the stream. Idempotency: the event id is claimed before processing and the claim is released if processing throws, so Stripe's retry can re-apply it.

## 9. Tests executed

57/57 passing (`npm test`), plus `tsc --noEmit`, `npm run build`, and three live checks: signature verification through the real Express stack on a booted server (valid → 200, tampered → 400, redelivery → `duplicate: true`), the advisory-lock SQL against real PostgreSQL, and `prisma migrate diff` confirming no drift. I deleted the one test row the live check left in your dev database.

## 10. Decisions and things to flag

- Verified, not assumed: MXN is a two-decimal currency (`$1,465.20` → `146520`), minimum charge MXN 10.00. `toStripeAmount` handles zero-, two- and three-decimal currencies rather than blindly multiplying by 100.
- Shipping and tax are 0 — because that is what `cartService.validateCart` already does. Inventing a rule the rest of the app doesn't apply would quote the shopper one total and charge another. Both are isolated functions with a comment marking where real rules go.
- Stock is not decremented. The existing order flow doesn't do it either; adding inventory reservation was beyond this scope. Worth raising separately — it's a real oversell risk at checkout.
- `shippingAddress` is optional, matching the existing `Order` model rather than imposing a new requirement on the frontend.
- **A price change mid-checkout produces a new order**, leaving the old unpaid one behind (deletable). The alternative — mutating a financial record's amounts — seemed worse.
- **Edge case needing a human**: a payment succeeding for an order already `CANCELLED` is recorded on the payment and logged loudly as needing a manual refund. `CANCELLED` is terminal in your state machine, so there is no correct automatic action.

**For the Angular team specifically**: send cart lines, never amounts (a `totalAmount` in the body is a `400`); and a resolved `confirmPayment()` is **not** proof of payment — poll `GET /api/orders/{id}` for status `1`, since the webhook occasionally lands after the browser redirect.
