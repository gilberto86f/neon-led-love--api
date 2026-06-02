👨‍💻

# Add a new optional property to the `User` type:

```TypeScript
isGuest?: boolean;
```

Goal:

Support guest checkout flows where customers can place orders without creating a full account.

---

## User type update

Add:

```TypeScript
isGuest?: boolean;
```

---

## Default behavior

When creating a user:

If `isGuest` is not provided:

```TypeScript
isGuest = false;
```

This should happen at the backend/service level, not only in the frontend.

Requirements:

- Existing users remain non-guest users
- Existing create-user flows continue working without changes

---

## User creation and update

Update:

- POST - /api/users - Create user
- PUT - /api/users/{id} - Update user

to support:

```JSON
{
  "isGuest": true
}
```

while still defaulting to:

```JSON
{
  "isGuest": false
}
```

when omitted.

---

## Authentication behavior

Guest users should not affect current authentication behavior.

For now:

- registration works as today
- login works as today
- account verification works as today

The new property should only prepare the project for future guest checkout functionality.

---

## Future guest checkout support

This property will later allow:

```
Checkout
  ↓
Customer does not want an account
  ↓
Create User with isGuest = true
  ↓
Create Order linked to that User
```

without requiring:

- password
- email verification
- login

DO NOT implement this yet.

---

## Filters

Prepare the Users list endpoint to easily support future filtering (`isGuest` should be an optional filter):

```http
GET /users?isGuest=true
GET /users?isGuest=false
```

---

## Data migration

Requirements:

- existing users should be treated as:

```TypeScript
isGuest = false
```

- avoid breaking existing user records

Goal:

- Add the foundation for guest checkout while preserving all current user and authentication behavior.

---

# 🤖

## Summary

Added an optional isGuest?: boolean to the User resource, defaulting to false at the service layer — foundation for future guest checkout, with no change to existing auth/create flows.

### Schema + migration

- schema.prisma — added isGuest Boolean @default(false) to User
- New migration 20260602195333_add_user_is_guest: ALTER TABLE "User" ADD COLUMN "isGuest" BOOLEAN NOT NULL DEFAULT false — the DEFAULT false backfills all existing rows as non-guest, so no records break.

### Service (user.service.ts)

- Added isGuest?: boolean to UserInput; validates it's a boolean when provided (400 otherwise)
- normalize sets isGuest: input.isGuest ?? false — so omitting it always yields false, including the existing POST /api/users and POST /api/auth/register flows
- Added isGuest: true to PUBLIC_USER_SELECT (now returned in responses)
- getUsers accepts an optional isGuest filter → where.isGuest

### Controller (user.controller.ts) — parses ?isGuest=true|false on the list endpoint; any other value returns 400.

Docs (same change)

- swagger.ts — isGuest on User + UserInput schemas, and an isGuest query param on GET /api/users
- README.md — User type, field table, validation rules, and the list-filter section (now "four optional filters")

**Authentication** — untouched. Register/login/verify behave exactly as before; guests just default in.

⚠️ Per your choice, I stopped your API dev server and Prisma Studio to free the locked query-engine DLL. Restart them when ready:

`npm run dev`
`npm run prisma:studio`
As CLAUDE.md notes, if VS Code still shows stale Prisma type errors, restart the TS server (Command Palette → "TypeScript: Restart TS server").

Note: guest checkout itself (creating a guest + linked order without password/verification) was not implemented — only the foundation, as requested.

👨‍💻

# Add new cart validate service

- This new service will be used after the user clicks on complete purchase, in the Cart page. Before navigating to the checkout page, we need to validate the cart products
- Validate all relevant information from the selected product variant, including:
  - Stock
  - Price
  - Product is active
  - Variant sizes
  - Discount (type, amount)
  - subtotalAmount
- If there is any problem, show an apropiate message, like: 'The price of product `Bulbasaur` has changed' or 'The product `Bulbasaur` is out of stock in that productVariant'
- Add the newest information of all products (so the front-end can update the cart products (stored in the LocalStorage))

## expected type of data being sent

```json
{
  "items": [
    {
      "productId": 7,
      "productSlug": "bulbasaur",
      "productName": "Bulbasaur",
      "productImageUrl": "/uploads/products/1778699383999-t517gwc-1.png",
      "variantId": 10,
      "width": 75,
      "height": 75,
      "sizeUnit": "cm",
      "originalUnitPrice": 1480,
      "unitPrice": 1465.2,
      "discountType": "percentage",
      "discount": 1,
      "quantity": 1,
      "subtotalAmount": 1465.2,
      "dateAddedToCart": "2026-06-02T05:29:01.795Z"
    },
    {
      "productId": 13,
      "productSlug": "pikachu",
      "productName": "Pikachu",
      "productImageUrl": "/uploads/products/1780378326491-m0gvx1h-25.png",
      "variantId": 12,
      "width": 80,
      "height": 90,
      "sizeUnit": "cm",
      "originalUnitPrice": 1489,
      "unitPrice": 1484,
      "discountType": "amount",
      "discount": 5,
      "quantity": 10,
      "subtotalAmount": 14840,
      "dateAddedToCart": "2026-06-02T05:36:12.372Z"
    }
  ],
  "subtotalAmount": 16305.2,
  "shippingAmount": 0,
  "taxAmount": 0,
  "discountAmount": 0,
  "totalAmount": 16305.2,
  "couponCode": "55454"
}
```
