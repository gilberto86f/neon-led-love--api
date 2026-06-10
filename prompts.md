👨‍💻

# Add Sorting Support to GET `/api/products`

Extend:

```http
GET /api/products
```

to support sorting.

Goal:

Allow product lists to be sorted by common fields while preserving all existing filters and pagination behavior.

---

## Supported Fields

Allow sorting by:

```TypeScript
id
name
createdAt
updatedAt
```

Only these fields should be accepted.

---

## Query Parameters

Add:

```TypeScript
sortBy?: 'id' | 'name' | 'createdAt' | 'updatedAt';
sortDirection?: 'asc' | 'desc';
```

---

## Examples

Sort by ID ascending:

```http
GET /api/products?sortBy=id&sortDirection=asc
```

Sort by ID descending:

```http
GET /api/products?sortBy=id&sortDirection=desc
```

Sort by name ascending:

```http
GET /api/products?sortBy=name&sortDirection=asc
```

Sort by name descending:

```http
GET /api/products?sortBy=name&sortDirection=desc
```

Sort by newest products:

```http
GET /api/products?sortBy=createdAt&sortDirection=desc
```

Sort by recently updated:

```http
GET /api/products?sortBy=updatedAt&sortDirection=desc
```

---

## Compatibility with Existing Filters

Sorting must work together with all existing filters.

Examples:

```http
GET /api/products?tagSlug=pokemon&sortBy=name&sortDirection=asc
```

```http
GET /api/products?categoryId=3&page=2&perPage=20&sortBy=updatedAt&sortDirection=desc
```

```http
GET /api/products?search=pika&isActive=true&sortBy=createdAt&sortDirection=desc
```

---

## Backend Validation

Validate:

```TypeScript
sortBy
sortDirection
```

If an invalid value is provided:

Either:

```TypeScript
fallback to defaults
```

or:

```http
400 Bad Request
```

Use whichever validation approach is already used elsewhere in the API.

---

## Default Behavior

If sorting is not provided:

Keep the current behavior.

Recommended default:

```TypeScript
sortBy = 'updatedAt';
sortDirection = 'desc';
```

This shows recently modified products first.

---

# 👨‍💻

## What I added

`GET /api/products` now accepts `sortBy` and `sortDirection`, working alongside every existing filter and pagination.

**Files changed**:

- `src/services/product.service.ts` — exported `PRODUCT_SORT_FIELDS` (`id`, `name`, `createdAt`, `updatedAt`) and `SORT_DIRECTIONS` (`asc`, `desc`) as the single source of truth; `list()` now builds `orderBy` from the two params, defaulting to `updatedAt` / `desc`.
- `src/controllers/product.controller.ts` — parses and validates both params, throwing `400` for unrecognized values.
- `src/swagger.ts` — documented both query params (with enums + defaults) and the new default-ordering note.
- `README.md` — new "Sorting products" section with the allowed values, defaults, validation behavior, and all the combined-with-filters examples from the brief.

## Decisions made

Default ordering → `updatedAt desc`, per your answer. This changes the endpoint's previous default (`id asc`), so I called that out explicitly in both the README and Swagger so the frontend dev knows to pass `?sortBy=id&sortDirection=asc` if anything relied on the old order.
Invalid values → `400` (e.g. `?sortBy=price`), rather than silently falling back. The spec allowed either; I matched the dominant pattern in the codebase — this same endpoint already returns `400` for a bad `categoryId`/`limit`, and the order/user list endpoints 400 on bad status/role. An omitted param still falls back to its default; only an explicitly wrong value is rejected.

## One thing worth noting

`orderBy` is built as `{ [sortBy]: sortDirection }`. Because the allowed values are a fixed, server-defined whitelist (validated in the controller and typed as `ProductSortField`/`SortDirection`), there's no injection surface here — an arbitrary string can never reach the Prisma `orderBy` key. The `Prisma.ProductOrderByWithRelationInput` type annotation also keeps it honest if the field list ever changes.

I couldn't exercise it against a live DB from here, but once it's running:

`curl "http://localhost:3000/api/products?sortBy=name&sortDirection=asc"`
