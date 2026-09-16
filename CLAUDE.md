# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Express + TypeScript + Prisma + PostgreSQL REST API for an LED neon sign e-commerce site (MVP). Currently exposes a single `Product` resource under `/api/products`. No auth, no image upload.

## Commands

| Task | Command |
| ---- | ------- |
| Start dev server (auto-reload via `ts-node-dev`) | `npm run dev` |
| Compile TS → `dist/` | `npm run build` |
| Run compiled output | `npm start` |
| Start PostgreSQL (Docker container `nll-postgres`, port 5432) | `npm run db:up` |
| Stop PostgreSQL (volume `nll_pg` is preserved) | `npm run db:down` |
| Tail Postgres logs | `npm run db:logs` |
| Create + apply a new Prisma migration (prompts for name) | `npm run prisma:migrate` |
| Regenerate Prisma Client only (no migration) | `npm run prisma:generate` |
| Open Prisma Studio (DB browser at `localhost:5555`) | `npm run prisma:studio` |
| Run the payment tests (Node's built-in runner; no DB/network) | `npm test` |

There is **no linter and no formatter** wired up. Don't invent commands for them.

The only tests are the payment suite in `tests/`, run with `npm test`. It uses Node's built-in runner (`node --test`) with `ts-node` — there is no jest/vitest, no config file, and no test database. `tests/helpers/harness.ts` swaps the Prisma, Stripe, cart and order modules in `require.cache` before loading `payment.service`. Follow that pattern rather than adding a test framework.

After running `prisma:migrate` or `prisma:generate`, stale Prisma type errors in VS Code may persist — restart the TS server (Command Palette → "TypeScript: Restart TS server").

Local config lives in `.env` (copied from `.env.example`). Default `DATABASE_URL` matches the credentials in [docker-compose.yml](docker-compose.yml) — no edits needed for local dev.

## Architecture

Strict layering. A request flows: **route → controller → service → Prisma → DB**. Each layer has one job; do not collapse them.

- **[src/server.ts](src/server.ts)** — entry point. Loads `dotenv`, calls `createApp()`, listens on `PORT`.
- **[src/app.ts](src/app.ts)** — builds the Express app: `cors()` (wide-open), `express.json()`, `/health`, mounts `/api`, then `notFoundHandler` + `errorHandler` last.
- **[src/routes/](src/routes/)** — URL → controller method only. No logic.
- **[src/controllers/](src/controllers/)** — thin HTTP adapter. Reads `req`, calls service, wraps result with `ok` / `okList`, sends response. Always `try/catch` and forward errors via `next(err)`. Numeric path params (e.g. `:id`) are validated with `parseId` which throws `HttpError(400)` for non-positive integers.
- **[src/services/](src/services/)** — business logic, validation, and **all** Prisma calls. Knows nothing about `req`/`res`. Throws `HttpError` for expected failures (404, 400). Validates inputs in-place (see `validate` / `requireString` / `optionalString` / `optionalNumber` in [product.service.ts](src/services/product.service.ts)) and trims strings via `normalize` before persisting.
- **[src/prisma/client.ts](src/prisma/client.ts)** — single shared `PrismaClient` instance. Import `prisma` from here; do not instantiate `new PrismaClient()` elsewhere.
- **[src/middlewares/errorHandler.ts](src/middlewares/errorHandler.ts)** — central error funnel. `HttpError` → matching status; anything else → 500 with `console.error('[unhandled]', err)`.

### Response envelope

Every endpoint (success or failure) returns the same `ApiNeonResponse` shape from [src/utils/apiResponse.ts](src/utils/apiResponse.ts). Use the three helpers, never hand-roll the envelope:

- `ok(data, status?)` — single-item success → `{ success: 1, status, data }`
- `okList(results, total?, status?)` — list success → `{ success: 1, status, results, total }`
- `fail(error, status?)` — error → `{ success: 0, status, error }`

Frontend checks `response.success === 1`. Keep this contract; if you add fields, extend the type rather than break the shape.

### Error convention

Throw `HttpError(status, message)` from any service or controller helper. The `errorHandler` middleware translates it into a `fail(...)` response with the correct status. Anything that escapes as a plain `Error` becomes a 500 — only let that happen for genuinely unexpected failures.

### Routing quirk

Reads use `slug` but writes use numeric `id`:

- `GET /api/products/:slug` → `productService.getBySlug`
- `PUT /api/products/:id` and `DELETE /api/products/:id` → numeric id

If you add new endpoints, follow the same split (public-facing reads by slug, admin writes by id) unless the user asks otherwise. The `Product.slug` column is `@unique` in [prisma/schema.prisma](prisma/schema.prisma) — preserve that on schema changes.

## Adding a new resource

1. Add the model to [prisma/schema.prisma](prisma/schema.prisma) and run `npm run prisma:migrate` (use a short, hyphen-separated name, e.g. `add-order`).
2. Create `src/services/<name>.service.ts` — define the input interface, validate, normalize, and expose CRUD methods that throw `HttpError` on missing rows.
3. Create `src/controllers/<name>.controller.ts` — one async function per route, wrap responses with `ok`/`okList`, forward errors with `next(err)`.
4. Create `src/routes/<name>.routes.ts` and mount it in [src/routes/index.ts](src/routes/index.ts).

## Payments (Stripe)

`POST /api/payments/create-intent` and `POST /api/payments/webhook/stripe` live in [src/services/payment.service.ts](src/services/payment.service.ts). Four invariants there are load-bearing — do not weaken them:

1. **The amount always comes from the database.** `priceCheckout` calls `cartService.validateCart({ items })` with the lines only, so a frontend-supplied amount is structurally unusable. Amount fields in the request body are a 400, not a silent override.
2. **Only the verified webhook writes payment outcomes.** Order status changes go through `orderService.recordPaymentStatusChange` (actor `CHANGED_BY_STRIPE_WEBHOOK`), never from a create-intent response or anything the browser reports.
3. **The webhook needs the raw body.** `express.json({ verify: captureRawBody })` in [src/app.ts](src/app.ts) keeps the untouched bytes for the webhook path. Changing body parsing breaks signature verification.
4. **Both endpoints are idempotent.** Create-intent reuses an order via `Order.checkoutKey` under a PostgreSQL advisory lock plus a Stripe idempotency key; the webhook claims `StripeWebhookEvent.stripeEventId` before doing work and releases the claim if the work throws.

Stripe amounts go in the currency's smallest unit and MXN has two decimals — use `toStripeAmount`/`fromStripeAmount` from [src/utils/stripeConfig.ts](src/utils/stripeConfig.ts) rather than multiplying by 100.

Never log a secret key, a client secret, or a raw Stripe error object; `toSafeStripeError` exists for that.

## Documentation

This project is maintained by a frontend developer without backend experience. The README is their primary guide for understanding and operating the API, so keeping it accurate and up to date is critical. After any important change — new endpoint, schema change, new field, changed behavior, updated scripts — update [README.md](README.md) to reflect it. Assume the reader is not familiar with backend concepts and may need context, not just raw facts.

**No API change is complete until the docs are updated.** This rule covers:

- [src/swagger.ts](src/swagger.ts) — update for any new endpoint, renamed/added/removed param, changed request body, changed response shape, or validation rule change.
- [README.md](README.md) — update when the change is user-facing enough that someone setting up or consuming the API needs to know (new resource, behavior change, new query param, etc.).

Both docs must be updated in the same commit/change as the code. Never leave them out of sync.

## Migrations

Each schema change must produce a migration in `prisma/migrations/` — never edit the database manually. Column-type changes can drop existing data; review the generated SQL before applying it on anything other than a throwaway dev DB (see [prisma/migrations/20260425183908_discount_int/migration.sql](prisma/migrations/20260425183908_discount_int/migration.sql) for a real example of a destructive type change in this repo's history).
