👨‍💻

# Add Cart Validation Service

Create a new service responsible for validating the cart immediately before checkout.

Goal:

Ensure all cart information is still valid before the user proceeds to the Checkout page.

---

# New endpoint

Add:

```http
POST /api/cart/validate
```

This endpoint should:

- validate all cart items
- return validation issues
- return refreshed product information
- return recalculated totals

---

# Request body

Use the current cart information sent by the frontend.

Example:

```JSON
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
  ],
  "subtotalAmount": 16305.2,
  "shippingAmount": 0,
  "taxAmount": 0,
  "discountAmount": 0,
  "totalAmount": 16305.2,
  "couponCode": "55454"
}
```

---

# Validation rules

For each cart item, validate:

## Product

- Product exists
- Product is active

Example errors:

```
The product "Bulbasaur" is no longer available.
The product "Bulbasaur" is inactive.
```

---

## Product Variant

Validate:

- variant exists
- width
- height
- sizeUnit

Example:

```
The selected variant for "Bulbasaur" is no longer available.
```

---

## Stock

Validate:

```TypeScript
quantity <= variant.stock
```

Example:

```
The product "Pikachu" only has 3 units available.
```

or

```
The product "Pikachu" is out of stock.
```

---

## Pricing

Validate:

- originalUnitPrice
- unitPrice
- discountType
- discount

Example:

```
The price of product "Bulbasaur" has changed.
```

---

## Totals

Recalculate:

```TypeScript
subtotalAmount
```

for every item:

```TypeScript
unitPrice * quantity
```

Validate:

```TypeScript
item.subtotalAmount
```

Example:

```
The subtotal for "Bulbasaur" has changed.
```

---

# Coupon validation

Prepare support for:

```TypeScript
couponCode
```

DO NOT implement coupons yet.

---

# Response structure

Suggested response:

```TypeScript
type CartValidationResponse = {
  isValid: boolean;

  messages: string[];

  items: CartItem[];

  subtotalAmount: number;
  shippingAmount: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
};
```

---

# Example response

```JSON
{
  "success": 1,
  "status": 200,
  "data": {
    "isValid": false,
    "messages": [
      "The price of product \"Bulbasaur\" has changed.",
      "The product \"Pikachu\" only has 3 units available."
    ],
    "items": [...updated items...],
    "subtotalAmount": 15000,
    "shippingAmount": 0,
    "taxAmount": 0,
    "discountAmount": 0,
    "totalAmount": 15000
  }
}
```

---

# Return updated cart information

The response should always return the newest information for every item:

Examples:

```TypeScript
price
discount
stock
productName
productImageUrl
variant
```

This allows the frontend to update LocalStorage without making additional requests.

---

# Architecture

Cart validation should remain independent from Order creation.

---

# Future compatibility

This service should become the single source of truth before:

```
Cart
→ Validate Cart
→ Checkout
→ Create Order
```

Future validations can easily be added:

- coupons
- shipping restrictions
- minimum order amount
- regional availability
- discontinued products

Goal:

Create a robust pre-checkout validation step that guarantees the cart is synchronized with the latest product information before the customer proceeds to Checkout.

---

# 🤖

## What I built

New endpoint: POST /api/cart/validate — always returns 200 with the standard ApiNeonResponse envelope.

### Files created:

- src/services/cart.service.ts — all the logic and validation
- src/controllers/cart.controller.ts — thin HTTP adapter, wraps with ok(), forwards errors via next(err)
- src/routes/cart.routes.ts — mounted at /cart in src/routes/index.ts

### Docs updated in the same change (per CLAUDE.md):

- src/swagger.ts — new Cart tag, CartItem / CartValidationInput / CartValidationResult / CartValidationResponse schemas, and the /api/cart/validate path
- README.md — endpoints table entry + a "Cart validation fields" section written for a frontend reader

## How it works

Per item, the service re-checks against the live DB and collects a human-readable message for each problem:

Check Message example
Product missing / inactive The product "Bulbasaur" is no longer available. / … is inactive.
Variant missing or dimensions changed The selected variant for "Bulbasaur" is no longer available.
Stock … only has 3 units available. / … is out of stock.
Pricing (originalUnitPrice, unitPrice, discountType, discount) The price of product "Bulbasaur" has changed.
Per-line subtotal The subtotal for "Bulbasaur" has changed.

### Key design points:

- Findings aren't HTTP errors — stale price/low stock go into messages + isValid: false with a 200. Only a malformed body throws HttpError(400). This matches the "robust pre-checkout step" goal rather than failing the request.
- Refreshed items returned — each line carries newest name, image, variant dims, price, discount, and recalculated subtotal; quantity and dateAddedToCart are preserved. The frontend can overwrite LocalStorage in one shot.
- Single batched query — products are loaded with findMany({ id: { in: [...] } }) to avoid N+1.
- Pricing helper mirrors storefront logic (percentage → price \* (1 - d/100), fixed → price - d); verified against your example (1480 @ 1% → 1465.2).
- Future-ready — couponCode is accepted but explicitly not applied; shipping/tax/discount are passed through (default 0) with comments marking where coupons, shipping rules, etc. plug in. The service is fully independent from order creation.

One assumption worth confirming: I mapped originalUnitPrice to ProductVariant.price and the product-level discountType/discount to the unit-price discount — if your storefront derives unitPrice differently (e.g. a variant-level discount), point me at that logic and I'll align computeUnitPrice.

I couldn't run a live request against the DB here, but the build is green. If you want, start npm run db:up && npm run dev and I can give you a ready-to-paste curl to smoke-test it.
