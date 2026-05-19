# Implement full CRUD services for `Orders`.

Use the same architecture, pagination patterns, error handling, and conventions already used in:

- Products
- Categories
- Tags
- Users

Use these provided types as the base models:

```TypeScript
Order
OrderItem
OrderStatus
Address
ShippingAddress
```

## Endpoints

Create a new `/orders` resource.

Implement:

```http
GET /api/orders
GET /api/orders/:id
POST /api/orders
PUT /api/orders/:id
DELETE /api/orders/:id
```

---

## OrdersService

Create a new:

```TypeScript
OrdersService
```

Methods:

```TypeScript
getOrders(
  page?: number,
  perPage?: number,
  search?: string,
  status?: OrderStatus
)

getOrderById(id: Order['id'])

createOrder(order: Order)

updateOrder(id: Order['id'], order: Order)

deleteOrder(id: Order['id'])
```

---

## Pagination

`getOrders()` should follow the same pagination structure already used in the project.

Requirements:

- `page`
- `perPage`
- pagination metadata
- consistent response shape

Keep it aligned with existing list endpoints.

---

## Search & filters

Add optional filtering support.

### Search

Search should support:

- order id
- user/customer information
- tracking number
- paymentId

---

### Status filter

Allow filtering by:

```TypeScript
OrderStatus
```

Example:

```http
GET /api/orders?status=processing
```

---

## Order items behavior

`Order.items` should store snapshots of product data at purchase time.

Important:

Do not dynamically depend on current Product data.

Keep:

```TypeScript
productName
productSlug
productImageUrl
unitPrice
```

inside `OrderItem`.

This preserves historical order accuracy even if Products later change.

---

## Amount calculations

Validate consistency between:

```TypeScript
subtotalAmount
shippingAmount
taxAmount
totalAmount
```

Suggested:

```TypeScript
totalAmount =
  subtotalAmount +
  shippingAmount +
  taxAmount
```

Server-side validation is recommended.

---

## Address structure

Keep:

```TypeScript
ShippingAddress = Address & {
  fullName;
  phoneNumber;
}
```

Do not duplicate address logic unnecessarily.

---

## Status management

Use:

```TypeScript
OrderStatus
```

exactly as defined.

Validate allowed statuses.

---

## Dates

Ensure:

```TypeScript
createdAt
updatedAt
```

are properly handled and updated automatically.

---

## types:

- These are the complete types needed:

```TypeScript

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type Order = {
  /**
   * Order ID
   */
  id: string;

  /**
   * User ID
   */
  userId: string;

  /**
   * Order status
   */
  status: OrderStatus;

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

export type OrderItem = {
  /**
   * Product ID reference
   */
  productId: string;

  /**
   * Product name snapshot
   */
  productName: string;

  /**
   * Product slug snapshot
   */
  productSlug: string;

  /**
   * Product image snapshot
   */
  productImageUrl?: string;

  /**
   * Unit price at purchase time
   */
  unitPrice: number;

  /**
   * Quantity purchased
   */
  quantity: number;

  /**
   * Total line amount
   */
  totalAmount: number;
};

export type Address = {
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type ShippingAddress = Address & {
  fullName: string;
  phoneNumber: string;
};

```

---

## Goal:

- Create a scalable Orders foundation for checkout, user history, CMS management, analytics, and shipping flows.

---

# Response from Claude code

Orders CRUD is implemented end-to-end, matching the Users/Tags/Categories layering. The migration 20260519232154_add_order applied cleanly. However, prisma generate is blocked by the same Windows DLL lock as last time — your dev server is holding query_engine-windows.dll.node, and there are 11 node.exe processes running so I can't safely pick which to kill. Please stop your npm run dev server and run npm run prisma:generate, then npx tsc --noEmit should pass clean. (Currently it reports 8 errors of the form Property 'order' does not exist on type 'PrismaClient' — all stale-types symptoms that vanish once the client is regenerated.)

## What was built:

Schema — schema.prisma: Order with userId FK to User (onDelete: Restrict so orders survive accidental user deletes), shippingAddress Json?, and an items OrderItem[] relation. OrderItem with snapshot fields (productName, productSlug, productImageUrl, unitPrice) and productId Int as a non-FK reference so item history survives product deletes. onDelete: Cascade on the order relation so deleting an order removes its items.
Service — order.service.ts: getOrders / getOrderById / createOrder / updateOrder / deleteOrder. Validates statuses, currency, all four amounts (non-negative + sum check within ±0.01), each item (totalAmount === unitPrice \* quantity), shipping-address shape when provided, and ensures userId references an existing user. PUT replaces items in a single transaction (deleteMany + nested create).
Search — exact numeric ID match plus trackingNumber, paymentId, and the related user's firstName/paternalLastName/maternalLastName/email/phoneNumber (case-insensitive substring), all OR'd together. status filter validated against the seven allowed values.
Controller / route / mount — order.controller.ts, order.routes.ts, mounted at /orders in routes/index.ts.
Docs — swagger.ts (Orders tag, orderId param, Order/OrderInput/OrderItem/OrderItemInput/ShippingAddress + list/single response wrappers, four paths) and README.md (endpoints table + "Order fields" section with full validation rules and the snapshot rationale).

## Scope decisions to flag:

IDs are Int, not string — the spec types declared Order.id and userId as string, but every other resource here uses Int @id @default(autoincrement()) and userId must FK to User.id which is Int. Going with Int keeps consistency; documented as such.
shippingAddress stored as a Json column — no separate Address table. The address is a frozen snapshot taken at order time, so a JSON column is the right shape and avoids introducing a model without endpoints (matches the "don't design for hypothetical future" principle).
OrderItem.productId is not an FK — it's a plain Int reference. Deleting the product won't break the order. This is the explicit "snapshot" behavior requested in the prompt.
Deleting a user with orders is blocked by onDelete: Restrict — surfaced as a 500 from Prisma right now. If you want a nicer 400 message ("user has N orders, delete them first"), I can add a check in userService.deleteUser. Let me know.

## add a nicer 400 message ("user has N orders, delete them first")

Done — userService.deleteUser now checks prisma.order.count and throws HttpError(400, ...) with a message like Cannot delete user 5: user has 3 orders. Delete them first. (singular/plural handled). Swagger and README updated to describe the new behavior.

prisma generate is still blocked by the same DLL lock from before — stop the dev server, run npm run prisma:generate, then npx tsc --noEmit will pass clean (the new prisma.order.count(...) call needs the regenerated client just like the rest of the Orders work).
