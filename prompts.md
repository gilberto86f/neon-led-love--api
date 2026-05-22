# Refactor the `ProductVariant` type to add:

```TypeScript
stock: number;
```

This property should be:

- required
- supported across all ProductVariant-related services, UI, and business logic

Goal:

Add inventory support at the variant level.

---

## CRUD/services updates

Update all ProductVariant-related services and flows.

---

## Validation

Requirements:

- `stock` is required
- must be a number
- minimum value:

```TypeScript
0
```

Do not allow negative stock.

---

Goal:

- Add proper inventory support to ProductVariants across APP and CMS.

---

# Claude.code

Done. ProductVariant.stock: number is now a required, non-negative integer field across the stack:

- Schema — schema.prisma: stock Int @default(0). The default lets existing variant rows survive the migration cleanly while the API still requires the field on every POST/PUT.
- Migration — 20260522230659_variant_stock applied. Existing variants default to stock: 0.
- Service — productVariant.service.ts: stock: number added to ProductVariant interface, validated as Number.isInteger(stock) && stock >= 0 (returns 400 on negative, decimal, or non-numeric), and passed through normalize into Prisma writes.
- Swagger — swagger.ts: added to ProductVariant and ProductVariantInput schemas (type: "integer", minimum: 0), added to required, and the create-variant endpoint description updated to mention the stock rule.
- README — README.md: ProductVariantInput type block, field table, and validation rules updated.

Same Prisma client lock as before — stop the dev server and run npm run prisma:generate to refresh runtime types/binary. Until then, prisma.productVariant.create({ data: { ..., stock } }) will look stale to tsc.
