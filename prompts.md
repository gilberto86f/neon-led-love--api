👨‍💻

# Refactor Orders

## Refactor Orders status management to use OrderStatusHistory

I need to refactor the existing Orders module in the backend.

### Current Orders API

The Orders module currently behaves like a generic CRUD resource with these endpoints:

- `GET /api/orders` — List orders
- `POST /api/orders` — Create order
- `GET /api/orders/{id}` — Get order by ID
- `PUT /api/orders/{id}` — Update order
- `DELETE /api/orders/{id}` — Delete order

---

## Desired design

I want to change the order status architecture so that every order has:

1. `status` — the current/active status.
2. `orderStatusHistory` — the complete audit history of status transitions.

I intentionally want to **keep `status` on the Order entity**.

The `status` field should be treated as the current-state projection/cache, while `orderStatusHistory` should be the source of truth for the audit trail.

This allows us to retrieve the current order status efficiently without loading the entire history.

The backend should be responsible for keeping these two pieces of information synchronized.

---

## Types

These are the types the frontend/shared layer will use:

```typescript
export type Order = {
  /**
   * Order ID
   */
  id: number;

  /**
   * User ID
   */
  userId: User["id"];

  /**
   * The client that placed the order. Populated by the read/list endpoints
   * (which join the related user); omitted from create requests.
   */
  user?: User;

  status: OrderStatus;

  orderStatusHistory: StatusHistory<OrderStatus>[];

  /**
   * Currency code
   * Example: USD, MXN
   */
  currency: string;

  /**
   * Subtotal before shipping/taxes
   */
  subtotalAmount: number;

  /**
   * Shipping cost
   */
  shippingAmount: number;

  /**
   * Taxes amount
   */
  taxAmount: number;

  /**
   * Final order total
   */
  totalAmount: number;

  /**
   * Order items
   */
  items: OrderItem[];

  /**
   * Shipping address
   */
  shippingAddress?: ShippingAddress;

  /**
   * Payment reference or transaction ID
   */
  paymentId?: string;

  /**
   * Tracking number
   */
  trackingNumber?: string;

  /**
   * Additional customer notes
   */
  notes?: string;

  /**
   * Order creation date
   */
  createdAt: Date;

  /**
   * Last update date
   */
  updatedAt: Date;
};

export type StatusHistory<S = OrderStatus | QuoteStatus> = {
  id: number;

  /**
   * orderId or quoteId
   */
  typeId: number;

  previousStatus: S;

  newStatus: S;

  createdAt: Date;

  /**
   * User ID, system action, or payment provider webhook.
   */
  changedByUser: User["id"] | "system" | "Stripe Webhook";

  comment?: string;
};

export enum OrderStatus {
  PENDING_PAYMENT = 0,
  PAID = 1,
  PAYMENT_FAILED = 2,
  PENDING_PRODUCTION = 3,
  IN_PRODUCTION = 4,
  QUALITY_CHECK = 5,
  READY_TO_SHIP = 6,
  SHIPPED = 7,
  DELIVERED = 8,
  CANCELLED = 9,
  REFUNDED = 10,
}

export enum QuoteStatus {
  DRAFT,
  SUBMITTED,
  UNDER_REVIEW,
  WAITING_FOR_CUSTOMER,
  QUOTED,
  IN_REVISION,
  ACCEPTED,
  CONVERTED_TO_ORDER,
  REJECTED,
  CANCELLED,
  EXPIRED,
}

export type ShippingAddress = Address & {
  fullName: string;
  phoneNumber: string;
};

export type Address = {
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};
```

---

## Important architectural requirement

Please do **not** treat `orderStatusHistory` as something the client sends in the `POST` or `PUT` request.

The client should never be able to directly manipulate the status history.

For example, this should NOT be accepted:

```json
{
  "status": 1,
  "orderStatusHistory": [...]
}
```

The backend should create history records automatically whenever the order status changes.

The client should only request a status transition through an appropriate backend operation.

---

## Help determine the best API design

Before implementing the changes, inspect the existing Orders module and determine the best approach for status transitions based on the current architecture.

I want to avoid treating order status as a generic editable field.

Please evaluate whether we should:

#### Option A

Keep:

```text
PUT /api/orders/{id}
```

but make `status` a controlled field and automatically create the corresponding history record whenever it changes.

#### Option B

Introduce a dedicated endpoint such as:

```text
PATCH /api/orders/{id}/status
```

with a request body such as:

```json
{
  "status": 4,
  "comment": "Production has started."
}
```

#### Option C

Create a dedicated Order status service/method responsible for transitions, with the controller exposing a dedicated endpoint.

For example:

```text
PATCH /api/orders/{id}/status
```

→ `OrderController.updateStatus()`

→ `OrderService.updateStatus()`

→ update `Order.status`

→ create `OrderStatusHistory`

I currently believe **Option C is the cleanest architecture**, but inspect the existing codebase first and confirm whether it fits the project's current Service / Controller / Repository architecture.

Do not blindly implement one option without examining the existing patterns.

---

## Status transition rules

Please introduce a centralized mechanism for validating order status transitions.

Do not allow arbitrary transitions such as:

```text
DELIVERED → PENDING_PAYMENT
```

or:

```text
CANCELLED → IN_PRODUCTION
```

Define a clear transition policy based on the following lifecycle:

```text
PENDING_PAYMENT
        ↓
PAID
        ↓
PENDING_PRODUCTION
        ↓
IN_PRODUCTION
        ↓
QUALITY_CHECK
        ↓
READY_TO_SHIP
        ↓
SHIPPED
        ↓
DELIVERED
```

Payment failure:

```text
PENDING_PAYMENT
        ↓
PAYMENT_FAILED
```

Cancellation and refund should be treated as exceptional transitions and should only be allowed from appropriate states.

Please determine reasonable transition rules for:

- `PENDING_PAYMENT`
- `PAID`
- `PAYMENT_FAILED`
- `PENDING_PRODUCTION`
- `IN_PRODUCTION`
- `QUALITY_CHECK`
- `READY_TO_SHIP`
- `SHIPPED`
- `DELIVERED`
- `CANCELLED`
- `REFUNDED`

Keep the transition rules centralized rather than scattering them across controllers.

---

## Order creation

Update order creation so that the client does not need to provide `status`.

For a newly created order, the backend should determine the initial status.

The normal initial state should be:

```typescript
OrderStatus.PENDING_PAYMENT;
```

When an order is created, the backend should:

1. Create the order with `status = PENDING_PAYMENT`.
2. Create the first `OrderStatusHistory` entry.
3. Use an appropriate `previousStatus` value for the initial transition.
4. Set `newStatus = PENDING_PAYMENT`.
5. Set `changedByUser = 'system'` when the order is created by the checkout/application flow.
6. Perform the order creation and history creation atomically using a database transaction.

Please determine the best representation for `previousStatus` on the first history entry. If the existing database schema does not support `null`, evaluate whether another explicit initial-state representation is more appropriate.

Do not make assumptions without checking the existing database schema.

---

## Status updates

When the order status changes:

1. Validate that the transition is allowed.
2. Retrieve the current order status.
3. Update `Order.status`.
4. Create a new `OrderStatusHistory` record containing:
   - `typeId`
   - `previousStatus`
   - `newStatus`
   - `changedByUser`
   - `comment`
   - `createdAt`

5. Perform the order update and history creation atomically.
6. Return the updated order/status information.

If the requested status is the same as the current status, do not create a duplicate history entry unless the existing architecture has a compelling reason to do so.

---

## Payment-related status changes

The order status should also be able to change automatically as a result of payment events.

For example:

```text
PENDING_PAYMENT
        ↓
PAID
```

or:

```text
PENDING_PAYMENT
        ↓
PAYMENT_FAILED
```

These changes should use:

```text
changedByUser = "Stripe Webhook"
```

when the change originates from a Stripe webhook.

Stripe is NOT integrated. The payment integration will be imlpemented later.

The frontend must never be considered the authoritative source for successful payment confirmation.

---

## PUT /orders/{id}

Review the current `PUT /api/orders/{id}` behavior.

I do NOT want clients to be able to arbitrarily modify historical or business-critical order information.

Determine which fields should remain editable after order creation.

In particular, evaluate whether these should be immutable after creation:

- `userId`
- `currency`
- `subtotalAmount`
- `shippingAmount`
- `taxAmount`
- `totalAmount`
- `items`
- `shippingAddress`
- `paymentId`

Fields such as these may have controlled update operations:

- `status`
- `trackingNumber`
- `notes`

Prefer dedicated endpoints for business operations over a generic PUT when appropriate.

If the existing generic `PUT` endpoint conflicts with this design, refactor it rather than preserving CRUD behavior just for consistency.

---

## DELETE /orders/{id}

Review whether deleting orders makes sense for this business domain.

Orders represent historical financial/business records, so they generally should not be physically deleted.

Please determine whether:

```text
DELETE /api/orders/{id}
```

should be:

- removed,
- restricted to a special administrative operation,
- replaced by cancellation,
- or implemented as a soft-delete/archive operation.

Do not introduce destructive deletion of paid orders.

Explain the recommendation before implementing it.

---

## GET endpoints

Update the read endpoints so that:

#### List

```text
GET /api/orders
```

returns the current `status`.

Do NOT load the complete `orderStatusHistory` for every order in a large list unless the existing API architecture already requires it.

The list endpoint should be optimized for displaying many orders.

For example:

```json
{
  "id": 123,
  "status": 4,
  ...
}
```

#### Detail

```text
GET /api/orders/{id}
```

may return:

```json
{
  "id": 123,
  "status": 4,
  "orderStatusHistory": [
    ...
  ]
}
```

The complete status history should primarily be loaded when viewing the order detail.

If appropriate, consider whether a dedicated endpoint would be cleaner:

```text
GET /api/orders/{id}/status-history
```

Evaluate this against the existing API conventions before implementing it.

---

## Database considerations

Inspect the existing database schema and migrations.

Determine how to represent:

```text
Order
OrderStatusHistory
```

The history table/entity should have a foreign key/reference to the order.

At minimum it should store:

- `id`
- `orderId`
- `previousStatus`
- `newStatus`
- `changedByUser`
- `comment`
- `createdAt`

Use appropriate indexes for:

```text
orderId
createdAt
```

because order history will frequently be queried by order and sorted chronologically.

Use a database transaction whenever:

- an order is created together with its first history record
- an order status changes together with its history record

The database must never end up with:

```text
Order.status = PAID
```

while the corresponding history record was not created.

---

## API response considerations

The API should continue exposing:

```typescript
status: OrderStatus;
```

as the current status.

For order detail responses, expose:

```typescript
orderStatusHistory: StatusHistory < OrderStatus > [];
```

sorted chronologically, preferably oldest → newest, unless the existing API conventions dictate otherwise.

Do not expose internal database implementation details.

---

## Permissions

Review the existing authentication/authorization implementation.

A customer should only be able to access their own orders.

Customers should NOT be able to:

- change order status
- create arbitrary status history
- modify payment information
- modify order totals
- delete orders

Admin/Super Admin should have controlled access to order management.

Status transitions should go through the same authorization layer as the rest of the CMS.

---

## Important distinction

Please preserve this conceptual model:

```text
Order.status
    ↓
Current state / optimized projection

OrderStatusHistory
    ↓
Immutable audit trail
```

`status` is not being removed.

It is intentionally kept so that listing and filtering orders does not require loading the entire history.

However, application code should never update `status` without also creating the corresponding history record.

---

## Expected result

After the refactor, the Order lifecycle should look approximately like this:

```text
Create Order
    ↓
PENDING_PAYMENT
    ↓
OrderStatusHistory created
    ↓
Payment succeeds
    ↓
PAID
    ↓
OrderStatusHistory created
    ↓
PENDING_PRODUCTION
    ↓
OrderStatusHistory created
    ↓
IN_PRODUCTION
    ↓
OrderStatusHistory created
    ↓
QUALITY_CHECK
    ↓
OrderStatusHistory created
    ↓
READY_TO_SHIP
    ↓
OrderStatusHistory created
    ↓
SHIPPED
    ↓
OrderStatusHistory created
    ↓
DELIVERED
    ↓
OrderStatusHistory created
```

---

## Implementation requirements

Before making changes:

1. Inspect the existing Orders module.
2. Inspect the current Service / Controller / Repository patterns.
3. Inspect the database schema and migrations.
4. Inspect existing authentication and authorization.
5. Inspect existing status-related patterns in other modules.
6. Inspect the current payment integration, if any.

Then implement the refactor consistently with the existing architecture.

Do not introduce an entirely new architectural pattern if an equivalent pattern already exists in the codebase.

---

## Deliverables

After implementation, provide:

1. Summary of the architectural changes.
2. Final API endpoints for Orders.
3. Final request/response shapes.
4. Database changes/migrations.
5. Status transition rules.
6. Explanation of how `Order.status` and `OrderStatusHistory` stay synchronized.
7. Any recommendations for follow-up work.

Do not just implement the changes mechanically. First analyze the current codebase and make the design consistent with the existing architecture.

🤖

1. Architectural changes
Option C was the right call — and it fits the codebase without inventing anything new. There's no repository layer here (Prisma is the data layer, called only from services), so the pattern is route → controller → service → Prisma. A dedicated PATCH /api/orders/:id/status → orderController.updateStatus → orderService.updateStatus slots straight in, and it mirrors an existing precedent: PUT /slides/reorder is already a business operation with its own route rather than a field on a generic PUT.

Option A was rejected because a controlled status inside PUT still means the write path for a business transition is the same call that carries amounts and items — the thing you explicitly wanted to stop.

The other structural decisions:

status became numeric (Int), matching Quote.status, which was already the numeric-enum-shared-with-the-frontend pattern. It was a String with "pending" defaults before.
One funnel for status writes. applyStatusChange in order.service.ts is the only function in the codebase that writes Order.status. Creation, the PATCH endpoint, and the future Stripe webhook all route through it.
The DB field is statusHistory; the API exposes orderStatusHistory with typeId instead of orderId, matching your shared StatusHistory<S> type. A mapper handles the translation so storage details stay internal.
user is now joined onto list and detail reads, using PUBLIC_USER_SELECT (exported from user.service.ts rather than duplicated) so passwordHash and friends can't leak.
2. Final endpoints
Method	Path	Access
GET	/api/orders	auth; clients scoped to own
GET	/api/orders/:id	auth + ownership
GET	/api/orders/:id/status-history	auth + ownership
POST	/api/orders	super/admin
PUT	/api/orders/:id	super/admin
PATCH	/api/orders/:id/status	super/admin
DELETE	/api/orders/:id	super only, guarded
I added the dedicated status-history endpoint because it matches the existing sub-resource convention (/products/:id/variants, /products/:id/tags) and lets a timeline refresh after a transition without refetching the whole order.

3. Request/response shapes
POST no longer accepts status or orderStatusHistory — both return 400 rather than being silently dropped. Everything else is unchanged.

PUT is now a restricted merge over shippingAddress, trackingNumber, notes. Sending userId, currency, any amount, items, paymentId, or status returns a 400 naming the offending fields. That's deliberate: a caller still posting the whole legacy order object finds out immediately instead of assuming its amounts took effect. shippingAddress is editable until READY_TO_SHIP, then 409 — the parcel is already labelled.

PATCH /status takes { status, comment? } and returns the updated order with full history. There is no changedByUser field — the actor comes from the verified token.

Reads return status everywhere; orderStatusHistory (oldest → newest) only on detail, never on the list.

4. Database
20260807120000_add_order_status_history, already applied:

Converts Order.status in place with a USING CASE — your two existing orders kept their state ("pending" → 0) instead of being wiped. processing maps to 3 PENDING_PRODUCTION, the earlier of the two production states, so nothing reports as further along than it is.
New OrderStatusHistory table, onDelete: Cascade, indexed on (orderId, createdAt) and createdAt.
Backfills one opening entry per existing order, stamped with the order's original createdAt.
previousStatus is nullable, and the first entry uses null — the order didn't come from another state, it started there. Postgres supports it and the schema already uses nullable ints, so a sentinel value would have been worse: it would make "created" indistinguishable from a real transition. ⚠️ Your frontend type needs widening to previousStatus: S | null.

changedByUser is one String column holding either a user id as text or "system" / "Stripe Webhook". The API converts numeric-looking values back to numbers, so the response matches your User['id'] | 'system' | 'Stripe Webhook' union exactly.

5. Transition rules
Centralized in ORDER_STATUS_TRANSITIONS. Normal path 0 → 1 → 3 → 4 → 5 → 6 → 7 → 8, plus: PAYMENT_FAILED → PENDING_PAYMENT (retry), QUALITY_CHECK → IN_PRODUCTION (rework). Two rules of thumb drove the exceptional cases — cancellation only while the sign is still with you (nothing from SHIPPED onward), refund only where money was actually taken (never from PENDING_PAYMENT/PAYMENT_FAILED). CANCELLED and REFUNDED are terminal. Illegal transitions return 409 with the allowed set listed.

6. How the two stay in sync
Both writes happen in one prisma.$transaction inside applyStatusChange — the DB can't hold status = PAID without the matching entry, because both commit or neither does. Order creation does the same for the row plus its opening entry.

One thing I added beyond the spec: the update is conditional on the status that was read (WHERE id = ? AND status = ?). Two staff members hitting the same order simultaneously would otherwise both pass validation and one would silently overwrite the other, leaving a history that doesn't match. Now the loser matches zero rows and gets a 409 to retry.

7. Recommendations
Frontend type fix: previousStatus: S | null.
Breaking change to flag: anything sending or reading the old status strings.
Stripe: orderService.recordPaymentStatusChange() is the seam, with no route exposed on purpose. Wire it to a signature-verified webhook only — a browser claiming payment succeeded is a claim, not proof.
Order creation by customers stays staff-only as you chose; checkout will need its own endpoint that derives amounts server-side from the cart rather than trusting the body.
OrderItem deletion is now unreachable — PUT no longer replaces items, and there's no other path. If you need to correct a line, that's a follow-up decision (an amendment operation, or accepting that orders are immutable once placed).
TODOS.md line 5 (sortBy/sortDirection on the orders list) is still open — I left it alone as out of scope.
Both docs are updated in the same change set: Swagger (verified serving all four order paths and the new schemas) and README, which gained a status table, the transition matrix, the sync explanation, the payment note, and a migration section written for someone who hasn't done backend work before.