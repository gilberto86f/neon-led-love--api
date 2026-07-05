# Neon LED Love — API

Backend API for an e-commerce site that sells LED neon signs. This document is written for someone who builds frontends (Angular, React, etc.) and has never touched a backend before. We will cover what each piece does, why it exists, and how to run it on your machine.

---

## Table of contents

1. [What is this project?](#1-what-is-this-project)
2. [What is a backend, in one minute](#2-what-is-a-backend-in-one-minute)
3. [Tech stack (and what each piece does)](#3-tech-stack-and-what-each-piece-does)
4. [Prerequisites — install these first](#4-prerequisites--install-these-first)
5. [Project setup, step by step](#5-project-setup-step-by-step)
6. [Running the server](#6-running-the-server)
7. [Trying the API](#7-trying-the-api)
8. [The response format (`ApiNeonResponse`)](#8-the-response-format-apineonresponse)
9. [API documentation (Swagger)](#9-api-documentation-swagger)
10. [Project structure explained](#10-project-structure-explained)
11. [Common errors and how to fix them](#11-common-errors-and-how-to-fix-them)
12. [Useful npm scripts](#12-useful-npm-scripts)
13. [Connecting from your Angular frontend](#13-connecting-from-your-angular-frontend)
14. [After pulling changes](#14-after-pulling-changes)

---

## 1. What is this project?

A small REST API that exposes endpoints to **list, create, read, update, and delete products** (the LED neon signs). Your Angular app will call these endpoints over HTTP to display products, manage them in an admin panel, etc.

This is an **MVP** (Minimum Viable Product) — the smallest possible version that works end-to-end so you can plug in the frontend and start iterating. It includes a JWT-based authentication layer (`/api/auth/...`) to power both the storefront (APP) and the admin (CMS).

---

## 2. What is a backend, in one minute

When your Angular app needs data (e.g. a list of products), it sends an **HTTP request** to a server. The server:

1. Receives the request (e.g. `GET /api/products`).
2. Looks up data in a **database**.
3. Sends back a **JSON response** like `{ "results": [ ... ] }`.

The "backend" is the program that does steps 1–3. In this project, that program is written in Node.js, using Express to handle HTTP and Prisma to talk to the database.

```
[ Angular app ]  --HTTP-->  [ Express server ]  --SQL-->  [ PostgreSQL DB ]
   (frontend)     <--JSON--    (this project)    <--rows--    (storage)
```

---

## 3. Tech stack (and what each piece does)

| Tool                | What it is                                                        | Why we use it                                                                                                                   |
| ------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Node.js**         | A JavaScript runtime that runs JS outside the browser.            | Lets us write the server in JS/TS, the same language as the frontend.                                                           |
| **TypeScript**      | JavaScript with types.                                            | Catches bugs at compile time. Same language family as Angular.                                                                  |
| **Express**         | A tiny library for building HTTP servers in Node.                 | Handles routing (`GET /products`, `POST /products`, etc.) without much boilerplate.                                             |
| **PostgreSQL**      | A relational database.                                            | Stores products in tables with rows and columns. Industry standard.                                                             |
| **Prisma**          | An **ORM** (Object–Relational Mapper).                            | Lets us read/write the database using TypeScript objects instead of raw SQL. Also auto-generates and applies schema migrations. |
| **Docker**          | A tool that runs apps in isolated containers.                     | Lets us run PostgreSQL without installing it on your system. One command, no global install.                                    |
| **dotenv**          | Loads variables from a `.env` file into `process.env`.            | Keeps secrets (DB password) out of source code.                                                                                 |
| **CORS middleware** | Tells the browser our server accepts requests from other origins. | Without it, your Angular dev server (different port) can't call this API.                                                       |

> **What is an ORM?** Instead of writing SQL like `SELECT * FROM Product WHERE id = 1`, you write `prisma.product.findUnique({ where: { id: 1 } })`. Prisma generates the SQL for you and gives back typed JavaScript objects.

---

## 4. Prerequisites — install these first

You need three things on your machine. If you already have them, skip to step 5.

### 4.1. Node.js (version 18 or newer)

- Download: <https://nodejs.org/> (pick the **LTS** version)
- Verify after install:
  ```powershell
  node --version
  npm --version
  ```

### 4.2. Docker Desktop

We use Docker to run PostgreSQL. This avoids installing PostgreSQL globally on your computer.

- Download: <https://www.docker.com/products/docker-desktop/>
- Install, reboot, then open Docker Desktop and wait until the bottom-left says **Engine running**.
- Verify:
  ```powershell
  docker --version
  docker compose version
  ```

### 4.3. A REST client (optional but recommended)

To test endpoints without the Angular frontend. Pick one:

- **Postman** — <https://www.postman.com/downloads/>
- **Insomnia** — <https://insomnia.rest/download>
- **VS Code REST Client extension** — search "REST Client" by Huachao Mao
- Or just `curl` from the terminal (built into Windows 10+).

---

## 5. Project setup, step by step

> All commands below are PowerShell, run from the project root: `c:\Users\Usuario\Documents\Web\nll\neon-led-love--api`.

### 5.1. Install npm dependencies

```powershell
npm install
```

This reads [package.json](package.json) and downloads every library into `node_modules/`. First run takes a minute or two.

### 5.2. Create the `.env` file

The `.env` file holds environment variables — values that change between machines (your dev laptop, a server, etc.) and should never be committed to git.

Copy the template:

```powershell
Copy-Item .env.example .env
```

Open the new [.env](.env) file. The default values match the Docker setup, so for local development **you don't need to change anything**:

```
DATABASE_URL="postgresql://nll:nll@localhost:5432/neon_led_love?schema=public"
PORT=3000

# --- JWT Authentication ---
JWT_ACCESS_SECRET="dev-access-secret-change-me"
JWT_REFRESH_SECRET="dev-refresh-secret-change-me"
JWT_ACCESS_EXPIRES_IN="30m"
JWT_REFRESH_EXPIRES_IN="30d"
JWT_REFRESH_TTL_DAYS=30
BCRYPT_SALT_ROUNDS=10
```

| Variable                    | What it controls                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| `JWT_ACCESS_SECRET`         | Secret used to sign access tokens. **Change it in production**; use a long random string.             |
| `JWT_REFRESH_SECRET`        | Secret used to sign refresh tokens. Must be different from the access secret. **Change in prod**.     |
| `JWT_ACCESS_EXPIRES_IN`     | Lifetime of an access token (e.g. `30m`, `1h`). Default: `30m`.                                       |
| `JWT_REFRESH_EXPIRES_IN`    | Lifetime of a refresh token (e.g. `30d`). Default: `30d`.                                             |
| `JWT_REFRESH_TTL_DAYS`      | Refresh-token expiry stored in the database in days. Should match `JWT_REFRESH_EXPIRES_IN`.           |
| `BCRYPT_SALT_ROUNDS`        | bcrypt cost factor for hashing passwords. Default: `10`.                                              |

> If `NODE_ENV=production`, the server refuses to start unless `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are set to non-default values.

Breaking down `DATABASE_URL`:

```
postgresql://  nll  :  nll  @  localhost  :  5432  /  neon_led_love  ?schema=public
   protocol    user    pass     host         port      database name      schema
```

### 5.3. Start the PostgreSQL database (via Docker)

```powershell
npm run db:up
```

What this does: reads [docker-compose.yml](docker-compose.yml), downloads the `postgres:16` image (first time only), and starts a container named `nll-postgres` listening on port 5432. Your data is saved in a Docker volume (`nll_pg`) so it survives container restarts.

Verify the container is up and healthy:

```powershell
docker ps
```

You should see one row with `nll-postgres` and status `Up X seconds (healthy)`. If it says `(starting)`, wait a few seconds and run it again.

### 5.4. Create the database tables (Prisma migrate)

Right now your PostgreSQL container is empty — no tables, no data. We need to create the `Product` table from our [prisma/schema.prisma](prisma/schema.prisma) file.

```powershell
npm run prisma:migrate
```

What this does:

1. Reads `prisma/schema.prisma` (the source of truth for your DB shape).
2. Compares it to the actual database.
3. Generates a SQL migration file in `prisma/migrations/` (so the change is version-controlled).
4. Applies that migration to PostgreSQL — the `Product` table now exists.
5. Regenerates the **Prisma Client** — the typed TS code you import to query the DB.

> **What is a migration?** A migration is a versioned, reproducible change to the database schema. Instead of editing the DB by hand, you change the schema file, run migrate, and Prisma writes a SQL file you can replay on any other machine to get the same result.

---

## 6. Running the server

```powershell
npm run dev
```

You should see:

```
[neon-led-love-api] listening on http://localhost:3000
```

The `dev` script uses `ts-node-dev`, which runs TypeScript directly **and restarts the server automatically when you save a file**. Keep this terminal open while working.

Quick smoke test — open another terminal and run:

```powershell
curl http://localhost:3000/health
```

Expected:

```json
{ "success": 1, "status": 200, "data": { "ok": true } }
```

If you get this, the server is working.

---

## 7. Trying the API

The API base URL is `http://localhost:3000/api`. All product endpoints live under `/products`, all category endpoints under `/categories`, and all tag endpoints under `/tags`.

### Authorization (roles & permissions)

Some endpoints are **public** (anyone can call them) and some are **protected** (you must send a valid login token, and your account must have the right **role**).

**The three roles**

| Role     | Who they are                          | What they can do                                                |
| -------- | ------------------------------------- | --------------------------------------------------------------- |
| `super`  | Site owner / top admin                | **Everything.** Bypasses every permission check.                |
| `admin`  | Staff managing the catalog & orders   | Manage all content; manage all orders **except deleting** them. |
| `client` | A normal customer                     | Browse the storefront; manage only **their own** account/orders. |

A caller with **no token is treated as a `client`/guest** — so the public storefront works without anyone logging in.

**Sending your token.** Log in via `POST /api/auth/login`, take the `accessToken` from the response, and send it on every protected request as a header:

```
Authorization: Bearer <accessToken>
```

**What happens when you're not allowed**

| Situation                                              | Status | Response body                                                                       |
| ------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------- |
| No token (or an expired/invalid one) on a protected endpoint | `401`  | `{ "success": 0, "status": 401, "error": "Authentication required." }`              |
| Logged in, but your role/ownership isn't enough        | `403`  | `{ "success": 0, "status": 403, "error": "You do not have permission to perform this action." }` |

**Who can do what**

| Action                                                           | super | admin | client / guest      |
| ---------------------------------------------------------------- | :---: | :---: | ------------------- |
| Read products, categories, tags, slides, prices                  |  ✅   |  ✅   | ✅                  |
| Validate cart (`POST /api/cart/validate`)                        |  ✅   |  ✅   | ✅                  |
| Upload a `quotes` image                                          |  ✅   |  ✅   | ✅                  |
| Create / update / delete products, categories, tags, slides, prices |  ✅   |  ✅   | ❌                  |
| Upload product/category/slide images, delete images              |  ✅   |  ✅   | ❌                  |
| List users / read **any** user                                   |  ✅   |  ✅   | ❌                  |
| Read / update / delete **own** account                           |  ✅   |  ✅   | ✅ (own only)       |
| Create a user, update/delete **any other** user                  |  ✅   |  ❌   | ❌                  |
| List / read orders                                               |  ✅   |  ✅   | ✅ (own orders only) |
| Create / update orders                                           |  ✅   |  ✅   | ❌                  |
| Delete an order                                                  |  ✅   |  ❌   | ❌                  |
| Create a quote (`POST /api/quotes`)                              |  ✅   |  ✅   | ✅ (guests too)     |
| List / read quotes                                               |  ✅   |  ✅   | ✅ (own quotes only) |
| Update a quote                                                   |  ✅   |  ✅   | ❌                  |
| Delete a quote                                                   |  ✅   |  ❌   | ❌                  |

**Ownership rules.** "Own only" means the API compares the `id` inside your token to the resource — never an `id` from the request body. A client can `GET/PUT/DELETE /api/users/{theirOwnId}` but gets `403` for anyone else's id; `GET /api/orders` returns only their own orders. When a non-super user updates their own account, any `role` or `status` they put in the body is **ignored** (you can't promote yourself).

**Registration is always a client.** `POST /api/auth/register` ignores any `role` in the body and always creates a `client`. Elevated accounts (`admin`/`super`) can only be created by a `super` via `POST /api/users`.

> **Bootstrapping the first super:** because creating users is super-only, there's a chicken-and-egg problem on a fresh database. Register a normal user, then open Prisma Studio (`npm run prisma:studio`) and set that user's `role` to `super` (and `isVerified` to `true`) by hand. After that, the super can create everyone else through the API.

**Auth**

JWT-based authentication. Register a user, verify the account, then log in to receive an `accessToken` (30 min) + `refreshToken` (30 days). Send the access token as `Authorization: Bearer <token>` on protected endpoints.

| Method | Path                  | Body (JSON)                          | Protected | What it does                                              |
| ------ | --------------------- | ------------------------------------ | --------- | --------------------------------------------------------- |
| POST   | `/auth/register`      | [Register](#auth-register-fields)    | no        | Create a new user. Returns a `verificationToken`.         |
| POST   | `/auth/verify-account`| `{ "token": "..." }`                 | no        | Verify the user's email using the token from register.    |
| POST   | `/auth/login`         | `{ "email", "password" }`            | no        | Returns `{ accessToken, refreshToken, user }`.            |
| POST   | `/auth/refresh`       | `{ "refreshToken": "..." }`          | no        | Returns a fresh access + refresh token pair (rotated).    |
| POST   | `/auth/logout`        | —                                    | yes       | Invalidates the stored refresh token for the user.        |
| GET    | `/auth/me`            | —                                    | yes       | Returns the user matching the access token.               |
| PUT    | `/auth/change-password` | [Change password](#auth-change-password-fields) | yes | Change your own password. Invalidates all refresh tokens. |

Notes:

- Login is rejected with `403` for accounts where `status=0` (INACTIVE) or `isVerified=false`.
- Refresh tokens are stored as a SHA-256 hash on the user row (`refreshTokenHash`). Issuing a new pair rotates the previous one, so an old refresh token is immediately useless.
- The access token is **stateless**: logging out clears the refresh token but does not invalidate the access token, which keeps working until it expires (max 30 min). Discard the access token client-side on logout.
- `PUT /auth/change-password` lets a logged-in user change **their own** password — the user is taken from the access token, so no user id is sent in the request. After a successful change, every refresh token for that user is invalidated (all other sessions are logged out). The current access token still works until it expires, so the frontend should log the user out and have them sign in again.
- Email sending is **not implemented yet**. The verification token is returned directly in the register response so the frontend can complete the flow manually. Once email delivery is wired up, the token will be sent over email and removed from the register response.
- Protect future endpoints with the helpers in [src/middlewares/authGuard.ts](src/middlewares/authGuard.ts): `authorize("super", "admin")` (token **and** role check, reads like `@Roles(...)`) for role-gated routes, or `jwtAuthGuard` alone when the controller does its own ownership check. Ownership predicates (`canViewUser`, `canManageUser`, `canAccessOrder`) live in [src/utils/authorization.ts](src/utils/authorization.ts). See [Authorization (roles & permissions)](#authorization-roles--permissions) for the full matrix.

**Products**

| Method | Path                              | Body (JSON)                | What it does                                                    |
| ------ | --------------------------------- | -------------------------- | --------------------------------------------------------------- |
| GET    | `/products`                       | —                          | List products (paginated)                                       |
| GET    | `/products/:slug`                 | —                          | Get one product by slug                                         |
| GET    | `/products/related`               | —                          | Get random products (no source product)                          |
| GET    | `/products/:productId/related`    | —                          | Get related products (see [Related products](#related-products)) |
| POST   | `/products`                       | [Product](#product-fields) | Create a new product                                            |
| PUT    | `/products/:id`                   | [Product](#product-fields) | Replace a product                                               |
| DELETE | `/products/:id`                   | —                          | Delete a product                                                |

> **Access:** all `GET`s are public. Every `POST`/`PUT`/`DELETE` here — including the variant, color-option, product-category, and product-tag sub-resources below — requires a `super` or `admin` token. (See [Authorization](#authorization-roles--permissions).)

**Categories**

| Method | Path                | Body (JSON)                  | What it does                |
| ------ | ------------------- | ---------------------------- | --------------------------- |
| GET    | `/categories`       | —                            | List categories (paginated) |
| GET    | `/categories/:slug` | —                            | Get one category by slug    |
| POST   | `/categories`       | [Category](#category-fields) | Create a new category       |
| PUT    | `/categories/:id`   | [Category](#category-fields) | Replace a category          |
| DELETE | `/categories/:id`   | —                            | Delete a category           |

> **Access:** the two `GET`s are public; `POST`/`PUT`/`DELETE` require a `super` or `admin` token.

**Prices (Custom Neon builder)**

A single shared pricing configuration that the Custom Neon builder uses to compute quotes. There is **one** configuration for the whole site (no list, no IDs in the URL). The CMS reads it with GET and overwrites it with PUT.

| Method | Path             | Body (JSON)                            | What it does                                                              |
| ------ | ---------------- | -------------------------------------- | ------------------------------------------------------------------------- |
| GET    | `/prices/custom` | —                                      | Get the current Custom Neon pricing config (auto-initialized to all 0 if never set) |
| PUT    | `/prices/custom` | [CustomPrices](#custom-prices-fields)  | Replace the full Custom Neon pricing config                               |

> **Access:** `GET /prices/custom` is public (the storefront builder reads it); `PUT /prices/custom` requires a `super` or `admin` token.

**Product-Category relations**

These endpoints manage which categories a product belongs to. Both IDs must refer to existing records.

| Method | Path                                          | Body | What it does                     |
| ------ | --------------------------------------------- | ---- | -------------------------------- |
| POST   | `/products/:productId/categories/:categoryId` | —    | Link a category to a product     |
| DELETE | `/products/:productId/categories/:categoryId` | —    | Unlink a category from a product |

**Product variants**

A variant is one specific size/price for a product. A product can have many variants (e.g. small, medium, large). Variants are managed via their own endpoints — you do **not** edit them by replacing the product.

| Method | Path                                       | Body                       | What it does                    |
| ------ | ------------------------------------------ | -------------------------- | ------------------------------- |
| GET    | `/products/:productId/variants`            | —                          | List all variants for a product |
| POST   | `/products/:productId/variants`            | [Variant](#variant-fields) | Add a new variant to a product  |
| PUT    | `/products/:productId/variants/:variantId` | [Variant](#variant-fields) | Replace a variant               |
| DELETE | `/products/:productId/variants/:variantId` | —                          | Delete a variant                |

Deleting a product also deletes its variants (cascade). When fetching a product (list, by slug, after create/update), each product response includes its `variants[]` array.

**Product color options**

A color option is a group of color choices for a product (e.g. "LED color" with warm-white, cool-white, RGB). A product can have many color options. Color options are managed via their own endpoints — you do **not** edit them by replacing the product.

| Method | Path                                           | Body                                | What it does                         |
| ------ | ---------------------------------------------- | ----------------------------------- | ------------------------------------ |
| GET    | `/products/:productId/color-options`           | —                                   | List all color options for a product |
| POST   | `/products/:productId/color-options`           | [ColorOption](#color-option-fields) | Add a new color option to a product  |
| PUT    | `/products/:productId/color-options/:optionId` | [ColorOption](#color-option-fields) | Replace a color option               |
| DELETE | `/products/:productId/color-options/:optionId` | —                                   | Delete a color option                |

Deleting a product also deletes its color options (cascade). Each product response includes its `colorOptions[]` array.

**Tags**

A tag is a short label (e.g. "outdoor", "bestseller") that can be attached to any number of products. Tags are **standalone entities**: you create, update, and delete them through their own endpoints, then link/unlink them to products separately.

| Method | Path           | Body (JSON)        | What it does           |
| ------ | -------------- | ------------------ | ---------------------- |
| GET    | `/tags`        | —                  | List tags (paginated)  |
| GET    | `/tags/:slug`  | —                  | Get one tag by slug    |
| POST   | `/tags`        | [Tag](#tag-fields) | Create a new tag       |
| PUT    | `/tags/:id`    | [Tag](#tag-fields) | Replace a tag          |
| DELETE | `/tags/:id`    | —                  | Delete a tag           |

> **Access:** the two `GET`s are public; `POST`/`PUT`/`DELETE` require a `super` or `admin` token.

`slug` is **globally unique** — two different tags can never share the same slug. Deleting a tag also removes it from every product it was linked to (the products themselves are not affected).

**Product-Tag relations**

These endpoints manage which tags a product has. Tags are **not** created here — create the tag with `POST /tags` first, then link it.

| Method | Path                                 | Body | What it does                |
| ------ | ------------------------------------ | ---- | --------------------------- |
| GET    | `/products/:productId/tags`          | —    | List a product's tags       |
| POST   | `/products/:productId/tags/:tagId`   | —    | Link an existing tag to a product   |
| DELETE | `/products/:productId/tags/:tagId`   | —    | Unlink a tag from a product |

Both IDs must refer to existing records or you get a `404`. Linking an already-linked pair, or unlinking a pair that was never linked, is a no-op (no error). Each product response still includes its `tags[]` array, and the link/unlink endpoints return the updated product with a `tagIds` field.

The relationship is **bidirectional and automatic**: linking a product to a category also makes that product appear in the category's `productIds` list, and vice versa. You do not need to call a separate endpoint on the category side.

Both operations are safe to repeat — linking an already-linked pair or unlinking a pair that was never linked causes no error.

The response returns the updated product with a `categoryIds` field showing its current linked categories:

```json
{
  "success": 1,
  "status": 200,
  "data": {
    "id": 1,
    "name": "Neon Heart",
    "slug": "neon-heart",
    "categoryIds": [2, 5]
  }
}
```

**Slides**

Slides power the homepage carousel. Each slide has a unique `position` that controls its display order. There is no hard delete — set `isActive: false` to hide a slide.

| Method | Path                  | Body (JSON)                      | What it does                          |
| ------ | --------------------- | -------------------------------- | ------------------------------------- |
| GET    | `/slides`             | —                                | List slides (ordered by position)     |
| GET    | `/slides/:id`         | —                                | Get one slide by ID                   |
| POST   | `/slides`             | [Slide](#slide-fields)           | Create a slide (appended at the end)  |
| PUT    | `/slides/:id`         | [Slide](#slide-fields)           | Update a slide's content/active state |
| PUT    | `/slides/reorder`     | `{ slideId, newPosition }`       | Move a slide to a new position        |

> **Access:** `GET /slides` and `GET /slides/:id` are public; creating, updating, and reordering slides require a `super` or `admin` token.

`GET /slides?isActive=true` returns only active slides; `isActive=false` returns only inactive ones; omit the param to get all.

The reorder endpoint shifts all affected slides so positions stay sequential and unique. Example:

```json
PUT /api/slides/reorder
{ "slideId": 3, "newPosition": 1 }
```

This moves slide 3 to position 1 and pushes the other slides down by one.

**Images**

Handles file uploads for all parts of the app. Files are saved to disk under `/uploads/{type}/` and served as static assets — no external storage needed.

| Method | Path                        | Body / Query                   | What it does              |
| ------ | --------------------------- | ------------------------------ | ------------------------- |
| POST   | `/images/upload/:type`      | `multipart/form-data` (field: `file`) | Upload a file      |
| DELETE | `/images?imageUrl=...`      | —                              | Delete an uploaded file   |

> **Access:** uploading to the `quotes` type is **public** (so guests can attach images to a custom-quote request during checkout). Uploading `products`/`categories`/`slides` assets and deleting any image require a `super` or `admin` token.

**Valid types:** `products`, `quotes`, `categories`, `slides`

**Accepted formats:** png, jpeg, jpg, gif, pdf, ai

**Maximum file size:** 20 MB

The upload response returns an `imageUrl` you can store and use in other resources (e.g. a slide's `imageUrl` field):

```json
POST /api/images/upload/products
→ { "success": 1, "status": 201, "data": { "imageUrl": "/uploads/products/1715000000000-ab3c7d1-neon-sign.png" } }
```

That URL is immediately accessible in the browser:

```
http://localhost:3000/uploads/products/1715000000000-ab3c7d1-neon-sign.png
```

To delete a file, pass `imageUrl` exactly as returned by the upload endpoint:

```
DELETE /api/images?imageUrl=/uploads/products/1715000000000-ab3c7d1-neon-sign.png
```

Uploaded files are stored in `uploads/` at the project root and are **not committed to git** (the folder is in `.gitignore`). The folder is created automatically on first upload.

**Users**

Customer and admin accounts. Unlike products and categories (which are read by `slug`), users are read and written by their numeric `id`. `email` is **globally unique**.

| Method | Path                          | Body (JSON)          | What it does                                   |
| ------ | ----------------------------- | -------------------- | ---------------------------------------------- |
| GET    | `/users`                      | —                    | List users (paginated)                         |
| GET    | `/users/check-email?email=…`  | —                    | Check if a user exists with this email (yes/no) |
| GET    | `/users/:id`                  | —                    | Get one user by ID                             |
| POST   | `/users`                      | [User](#user-fields) | Create a new user                              |
| PUT    | `/users/:id`                  | [User](#user-fields) | Replace a user                                 |
| DELETE | `/users/:id`                  | —                    | Delete a user                                  |

> **Access:** `GET /users/check-email` is public. Listing users (`GET /users`) is `super`/`admin` only. Reading a single user (`GET /users/:id`) is allowed for `super`/`admin` (any user) or the account owner. Creating a user (`POST /users`) is `super` only. Updating/deleting a user (`PUT`/`DELETE /users/:id`) is `super` (any user) or the account owner — an `admin` **cannot** modify another user. When a non-`super` updates their own account, `role` and `status` in the body are ignored. All of these (except `check-email`) require a token.

> **`check-email` is a lightweight existence check.** It returns only `{ email, exists }` — never user data — so guest-checkout and registration flows can ask "is this email taken?" without pulling a full user record. See [Checking if an email exists](#checking-if-an-email-exists).

The list endpoint supports the standard `page` / `perPage` pagination plus four optional filters:

- `search` — case-insensitive substring match against full name, email, or phone number.
- `role` — one of `admin`, `client`, `super`. Omit to return all roles.
- `status` — `0` (INACTIVE) or `1` (ACTIVE). Omit to return all statuses.
- `isGuest` — `true` (guests only) or `false` (non-guests only). Only the literal strings `"true"` and `"false"` are recognized — any other value returns `400`. Omit to return both.

Example: `GET /api/users?role=client&status=1&isGuest=false&search=ada&page=1&perPage=20`

**Orders**

A purchase made by a user. Each order owns its `items[]` — those items store a **snapshot** of product data (name, slug, image, unit price) at the time of purchase, so order history stays accurate even if a product is later renamed, repriced, or deleted.

| Method | Path           | Body (JSON)            | What it does               |
| ------ | -------------- | ---------------------- | -------------------------- |
| GET    | `/orders`      | —                      | List orders (paginated)    |
| GET    | `/orders/:id`  | —                      | Get one order by ID        |
| POST   | `/orders`      | [Order](#order-fields) | Create a new order         |
| PUT    | `/orders/:id`  | [Order](#order-fields) | Replace an order           |
| DELETE | `/orders/:id`  | —                      | Delete an order            |

> **Access:** every order endpoint requires a token. A `client` may list and read only **their own** orders (`GET /orders` is automatically filtered to them; reading someone else's order returns `403`). `super`/`admin` see all orders. Creating and updating orders is `super`/`admin`; **only `super` may delete** an order.

The list endpoint supports the standard `page` / `perPage` pagination plus two optional filters:

- `search` — matches an exact order ID (when the value is numeric), tracking number, payment ID, or the owning user's full name, email, or phone number (case-insensitive substring).
- `status` — one of `pending`, `paid`, `processing`, `shipped`, `delivered`, `cancelled`, `refunded`. Omit to return all statuses.

Example: `GET /api/orders?status=processing&search=lovelace&page=1&perPage=20`

Deleting an order also deletes its items (cascade). Deleting a user who has orders returns `400` with a message like `Cannot delete user 5: user has 3 orders. Delete them first.` — remove the user's orders first.

**Quotes**

A request for a **custom** LED neon sign. A shopper designs a sign in the frontend's "Custom Neon" builder and submits it here; the sign isn't a catalog product, so it can't go through the normal cart. A quote has two halves:

- the **request** half — contact info (`fullName`, `email`, `phoneNumber`) plus the custom-neon configuration (texts, size, backboard, mounting kits, reference images…). This is what the shopper sends.
- the **quote / pricing** half — the numbers your team fills in later (`price`, the per-feature `*Quote` / `*Price` / `*SuggestedPrice` fields, mock-ups). Empty until staff price the request.

Each quote carries a `status` — a **number**, not a string — describing where it is in its lifecycle:

| # | Status                 | Meaning                                                        |
| - | ---------------------- | ------------------------------------------------------------- |
| 0 | `DRAFT`                | Not yet submitted (may only exist on the frontend).           |
| 1 | `SUBMITTED`            | Submitted and awaiting attention. **New requests start here.**|
| 2 | `UNDER_REVIEW`         | The team is evaluating feasibility and cost.                  |
| 3 | `WAITING_FOR_CUSTOMER` | Waiting on info/approval from the customer.                   |
| 4 | `QUOTED`               | A price and validity period were sent.                        |
| 5 | `ACCEPTED`             | The customer accepted the quote.                              |
| 6 | `CONVERTED_TO_ORDER`   | Turned into an order.                                         |
| 7 | `REJECTED`             | The company can't carry out the project.                      |
| 8 | `CANCELLED`            | The client decided not to proceed.                            |
| 9 | `EXPIRED`              | The quote expired.                                            |

| Method | Path           | Body (JSON)                     | What it does                          |
| ------ | -------------- | ------------------------------- | ------------------------------------- |
| GET    | `/quotes`      | —                               | List quotes (paginated)               |
| GET    | `/quotes/:id`  | —                               | Get one full quote by ID              |
| POST   | `/quotes`      | [QuoteRequest](#quote-fields)   | Submit a new custom-neon quote request|
| PUT    | `/quotes/:id`  | [Quote](#quote-fields)          | Replace a quote (staff pricing etc.)  |
| DELETE | `/quotes/:id`  | —                               | Delete a quote                        |

> **Access:** creating a quote is **public** — guests must be able to request one, so `POST /quotes` needs no token. Every other endpoint requires a token. A `client` may list and read only **their own** quotes (`GET /quotes` is auto-filtered to them; reading someone else's quote returns `403`); `super`/`admin` see all. Guest-submitted quotes have no owner and are staff-only. Updating a quote is `super`/`admin`; **only `super` may delete** one.

On create, the server sets `status = 1` (SUBMITTED), stamps `createdAt`/`updatedAt`, and leaves everything outside the request half empty. `PUT` replaces the whole quote and refreshes `updatedAt`; omit `status` in the body to keep the current one.

The list endpoint returns a **compact** shape per quote — `id`, `status`, `clientId`, `fullName`, `email`, `phoneNumber`, `isCustom`, `price`, `notes`, `createdAt`, `updatedAt` — and supports the standard `page` / `perPage` pagination plus:

- `search` — case-insensitive substring match against `fullName` and `notes`.
- `status` — filter by a numeric status (0–9). Omit to return all.
- `clientId` — filter by owner (super/admin only; clients are always scoped to themselves).
- `sortBy` — one of `price`, `status`, `createdAt`, `updatedAt`, `fullName`. Defaults to `createdAt`.
- `sortDirection` — `asc` or `desc`. Defaults to `desc` (newest first). Sorting is applied before pagination.

Example: `GET /api/quotes?status=1&sortBy=price&sortDirection=asc&search=ada&page=1&perPage=20`

**Cart**

A pre-checkout safety check. The frontend keeps the shopper's cart in LocalStorage; prices, stock, and products can all change while the cart sits there. This endpoint re-checks the cart against the live database right before the shopper reaches the Checkout page, and hands back both a list of problems and a refreshed cart.

| Method | Path             | Body (JSON)                          | What it does                                  |
| ------ | ---------------- | ------------------------------------ | --------------------------------------------- |
| POST   | `/cart/validate` | [Cart](#cart-validation-fields)      | Validate the cart and return refreshed totals |

> **Access:** public — checkout must work for guests, so no token is required.

It does **not** touch orders — validating a cart neither reads nor writes any order. Think of it as the step between "Cart" and "Checkout": `Cart → Validate Cart → Checkout → Create Order`. See [Cart validation fields](#cart-validation-fields) for the request/response shape.

> **HTTP method conventions** (REST): GET = read, POST = create, PUT = replace, DELETE = remove. The URL identifies the resource, the method describes the action.

### Pagination

Both list endpoints (`GET /products` and `GET /categories`) accept query parameters:

| Parameter | Type   | Default | Max | Description            |
| --------- | ------ | ------- | --- | ---------------------- |
| `page`    | number | `1`     | —   | Page number (1-based). |
| `perPage` | number | `20`    | 100 | Items per page.        |

Example: `GET /api/products?page=2&perPage=10`

### Filtering products

`GET /products` accepts additional filter query parameters that can be combined freely:

| Parameter    | Type    | Description                                                                            |
| ------------ | ------- | -------------------------------------------------------------------------------------- |
| `search`     | string  | Return only products whose name or description contains this string (case-insensitive) |
| `categoryId` | number  | Return only products linked to the category with this ID                               |
| `tagSlug`    | string  | Return only products that have a tag with this slug (case-sensitive)                   |
| `isActive`   | boolean | `true` → only active products, `false` → only inactive. Omit to return both.           |

Examples:

- `GET /api/products?search=pikachu` — products whose name or description contains "pikachu"
- `GET /api/products?categoryId=123` — products in category 123
- `GET /api/products?tagSlug=coffee` — products that have a tag with slug "coffee"
- `GET /api/products?isActive=true` — only active products
- `GET /api/products?isActive=false` — only inactive products
- `GET /api/products?search=pikachu&categoryId=123&tagSlug=coffee&isActive=true` — all filters applied at once

Filters return an empty list (not a 404) when no products match. `categoryId` returns `400` if it is not a positive integer. Blank `search` and `tagSlug` values are ignored. `isActive` only recognizes the literal strings `"true"` and `"false"` — any other value (including `"1"`, `"0"`, or blank) is treated as if the param were omitted.

### Sorting products

`GET /products` accepts two sorting parameters. They work together with every filter above and with pagination.

| Parameter       | Type   | Allowed values                       | Default     | Description                  |
| --------------- | ------ | ------------------------------------ | ----------- | ---------------------------- |
| `sortBy`        | string | `id`, `name`, `createdAt`, `updatedAt` | `updatedAt` | Field to order the list by.  |
| `sortDirection` | string | `asc`, `desc`                        | `desc`      | Ascending or descending.     |

**Default ordering:** when you don't pass `sortBy`/`sortDirection`, products come back sorted by `updatedAt` descending — most recently modified first. (This is a change from the previous default of `id` ascending; if you relied on the old order, pass `?sortBy=id&sortDirection=asc` explicitly.)

**Validation:** unlike the filters above, an unrecognized `sortBy` or `sortDirection` value returns `400` rather than being ignored — for example `?sortBy=price` returns `Invalid sortBy (must be one of: id, name, createdAt, updatedAt)`. Omitting a param falls back to its default; only an explicitly wrong value is rejected.

Examples:

- `GET /api/products?sortBy=name&sortDirection=asc` — A→Z by name
- `GET /api/products?sortBy=createdAt&sortDirection=desc` — newest products first
- `GET /api/products?sortBy=updatedAt&sortDirection=desc` — recently updated first (the default)
- `GET /api/products?tagSlug=pokemon&sortBy=name&sortDirection=asc` — Pokémon-tagged products, A→Z
- `GET /api/products?categoryId=3&page=2&perPage=20&sortBy=updatedAt&sortDirection=desc` — filter + paginate + sort together
- `GET /api/products?search=pika&isActive=true&sortBy=createdAt&sortDirection=desc` — active matches for "pika", newest first

### Filtering categories

`GET /categories` accepts additional filter query parameters that can be combined freely:

| Parameter   | Type   | Description                                                                              |
| ----------- | ------ | ---------------------------------------------------------------------------------------- |
| `productId` | number | Return only categories linked to the product with this ID                                |
| `search`    | string | Return only categories whose name or description contains this string (case-insensitive) |

Examples:

- `GET /api/categories?productId=3` — categories linked to product 3
- `GET /api/categories?search=outdoor` — categories whose name or description contains "outdoor"
- `GET /api/categories?productId=3&search=outdoor` — both filters applied at once

Filters return an empty list (not a 404) when no categories match. `productId` returns `400` if it is not a positive integer. Blank `search` values are ignored.

The response includes `total`, `page`, and `perPage` alongside `results`:

```json
{
  "success": 1,
  "status": 200,
  "results": [ ... ],
  "total": 45,
  "page": 2,
  "perPage": 10
}
```

### Product fields

The **create and update payload** only accepts core product fields. `variants` are managed via the dedicated variant endpoints (see below).

```ts
// What you send for POST /products and PUT /products/:id
type ProductInput = {
  name: string; // required
  description: string; // required
  slug: string; // required — unique, URL-friendly identifier
  isActive: boolean; // required — set to false to deactivate without deleting
  images?: string[]; // optional — ordered list of image URLs; defaults to []
  discountType?: string; // optional — "percentage" or "amount" (alias: "fixed")
  discount?: number; // optional — percent when "percentage", else a currency amount
};
```

| Field          | Type     | Required | Notes                                                                                          |
| -------------- | -------- | -------- | ---------------------------------------------------------------------------------------------- |
| `name`         | string   | yes      | Product display name.                                                                          |
| `description`  | string   | yes      | Free-form description.                                                                         |
| `slug`         | string   | yes      | Unique. Used for public URLs. `neon-heart-xl`, etc.                                            |
| `isActive`     | boolean  | yes      | Whether the product is visible to shoppers. Set to `false` to deactivate without deleting.     |
| `images`       | string[] | no       | Ordered list of image URLs. The array order is the display order. Defaults to `[]` if omitted. |
| `discountType` | string   | no       | Free-form tag. Cart validation interprets `percentage` (percent off) and `amount`/`fixed` (a currency amount off); any other value applies no discount. |
| `discount`     | number   | no       | Discount value: a percent when `discountType` is `percentage` (e.g. `10` for 10% off), otherwise a currency amount off (e.g. `5` for $5 off). |

The server rejects a create/update request with `400` if any required field is missing, empty, or whitespace. Strings are trimmed before saving.

#### Managing product images

Product images use the existing upload system — there are no dedicated add/remove/reorder endpoints. The flow is:

1. **Upload** a file via `POST /api/images/upload/products` (multipart `file` field). The response contains `imageUrl`, e.g. `/uploads/products/1778311202127-hdjrg5c-bulbasaur.jpg`.
2. **Attach** it by sending the product's full `images` array (with the new URL appended in the desired position) in `PUT /products/:id`.
3. **Reorder** by sending the same URLs in a new order in `PUT /products/:id`.
4. **Detach** by sending the product's `images` array without that URL in `PUT /products/:id`. This only unlinks it from the product — the underlying file stays on disk. If you also want to delete the file, call `DELETE /api/images?imageUrl=...` separately.

Validation rules:

- `images` must be an array of non-empty strings.
- Duplicates within the same array are rejected with `400`.
- Each entry is trimmed before saving.

The **response** also includes read-only fields populated by the system:

| Field          | Type          | Notes                                                                           |
| -------------- | ------------- | ------------------------------------------------------------------------------- |
| `id`           | number        | Auto-generated.                                                                 |
| `variants`     | Variant[]     | Size/price variants. Managed via the `/products/:productId/variants` endpoints. |
| `colorOptions` | ColorOption[] | Color choices. Managed via the `/products/:productId/color-options` endpoints.  |
| `tags`         | Tag[]         | Linked tags. Tag entities are managed via `/tags`; links via `/products/:productId/tags/:tagId`. |
| `createdAt`    | string        | ISO datetime.                                                                   |
| `updatedAt`    | string        | ISO datetime.                                                                   |

#### Related products

`GET /products/:productId/related` returns a list of products related to the given one, ordered by relevance. It powers the "you might also like" surface in the storefront.

`GET /products/related` (no productId) returns random products — useful for generic discovery surfaces like a homepage "explore" section where there is no source product.

How relevance is computed:

| Signal                                          | Weight |
| ----------------------------------------------- | ------ |
| Each shared **category** with the source product | +5     |
| Each shared **tag** with the source product      | +3     |
| Each shared **keyword** in `name` + `description` (case-insensitive, tokens of length ≥ 3) | +1     |

Behavior:

- Only products that share at least one category or tag with the source are scored — text similarity alone is not enough to be a "related" match. This keeps the comparison cheap.
- Results are sorted by score (descending), ties broken by product ID (ascending) for deterministic output.
- If fewer than `limit` related products are found, the remaining slots are filled with **random products** (excluding the source and any product already in the list).
- The source product is always excluded from the result.

Query params:

| Param   | Type   | Default | Notes                                                |
| ------- | ------ | ------- | ---------------------------------------------------- |
| `limit` | number | `8`     | Maximum number of products to return. 1 ≤ limit ≤ 100. |

Response shape: a non-paginated list (`results: Product[]`, `total: number`). Each entry has the same shape as a product returned by `GET /products` (includes `variants`, `colorOptions`, `tags`).

Example:

```
GET /api/products/12/related?limit=8
```

If product 12 has 5 truly related products in the catalog, the response contains those 5 (ranked by score) followed by 3 random products to reach the limit.

### Variant fields

```ts
// What you send for POST /products/:productId/variants and PUT /products/:productId/variants/:variantId
type ProductVariantInput = {
  price: number; // required — must be > 0
  width: number; // required — must be > 0
  height: number; // required — must be > 0
  sizeUnit: string; // required — must be "cm" or "inch"
  stock: number; // required — non-negative integer (available inventory)
};
```

| Field      | Type   | Required | Notes                                                      |
| ---------- | ------ | -------- | ---------------------------------------------------------- |
| `price`    | number | yes      | Price for this size. Must be > 0.                          |
| `width`    | number | yes      | Width in `sizeUnit`. Must be > 0.                          |
| `height`   | number | yes      | Height in `sizeUnit`. Must be > 0.                         |
| `sizeUnit` | string | yes      | Either `"cm"` or `"inch"`. Trimmed before saving.          |
| `stock`    | number | yes      | Available inventory for this variant. Non-negative integer. |

Validation rules:

- All five fields are required on every create/update — `400` if any is missing or invalid.
- `price`, `width`, and `height` must be positive numbers.
- `sizeUnit` must equal `"cm"` or `"inch"` exactly (case-sensitive after trim).
- `stock` must be a non-negative integer (`0` is allowed; negatives and decimals are rejected).
- Returns `404` if the product does not exist, or if the variant ID does not belong to the given product.

### Color option fields

A color option groups several available colors plus the default selection from that group.

```ts
type Color = {
  colorName: string; // unique identifier within the option, e.g. "warm-white"
  label: string; // human-readable label, e.g. "Warm White"
  colorCode: string; // CSS color value, e.g. "#FFE6B3"
  light: boolean; // whether the color reads as a light shade
  simpleColor: boolean; // whether this is a plain color (vs. multi-color/RGB)
};

// What you send for POST /products/:productId/color-options and PUT /products/:productId/color-options/:optionId
type ProductColorOptionInput = {
  description: string; // required — what this group represents (e.g. "LED color")
  colors: Color[]; // required — must be a non-empty array of Color objects
  defaultColor: Color; // required — the default selection (a full Color object)
};
```

| Field          | Type    | Required | Notes                                                                 |
| -------------- | ------- | -------- | --------------------------------------------------------------------- |
| `description`  | string  | yes      | Trimmed before saving.                                                |
| `colors`       | Color[] | yes      | Must be a non-empty array. Each entry must be a full Color object.    |
| `defaultColor` | Color   | yes      | Must be a full Color object. Stored alongside `colors` on the option. |

Validation rules for every Color object (in `colors[i]` and `defaultColor`):

- `colorName`, `label`, `colorCode` are required non-empty strings (trimmed before saving).
- `light` and `simpleColor` are required booleans.
- Returns `400` if any field is missing or has the wrong type.
- Returns `404` if the product does not exist, or if the option ID does not belong to the given product.

`colors` and `defaultColor` are stored as JSON in the database (no separate Color table), so adding new fields to a Color shape later does not require a migration.

### Tag fields

```ts
// What you send for POST /tags and PUT /tags/:id
type TagInput = {
  name: string; // required
  slug: string; // required — globally unique
};
```

| Field  | Type   | Required | Notes                                       |
| ------ | ------ | -------- | ------------------------------------------- |
| `name` | string | yes      | Display name. Trimmed before saving.        |
| `slug` | string | yes      | **Globally unique.** Trimmed before saving. |

Validation rules:

- Both fields are required and must be non-empty after trimming — `400` if missing or invalid.
- `slug` must be unique across all tags — `400` with a clear message if a duplicate is attempted.
- Returns `404` from `GET /tags/:slug`, `PUT /tags/:id`, or `DELETE /tags/:id` when no tag matches.

Tags are independent of products. The same tag can be linked to many products, and a product can have many tags — see the **Product-Tag relations** endpoints to manage links.

### Auth register fields

```ts
// POST /api/auth/register
type RegisterInput = {
  fullName: string;       // required
  email: string;          // required — valid format, globally unique
  password: string;       // required — see strength rules below
  phoneNumber?: string;   // optional — max 20 characters
};
```

| Field         | Type   | Required | Notes                                                                |
| ------------- | ------ | -------- | -------------------------------------------------------------------- |
| `fullName`    | string | yes      | Trimmed before saving.                                               |
| `email`       | string | yes      | Must be valid and globally unique. Stored lowercased.                |
| `password`    | string | yes      | Must pass the [password strength rules](#password-strength-rules). Stored as a bcrypt hash; raw password is never persisted. |
| `phoneNumber` | string | no       | Max 20 characters.                                                   |

> **Role is not accepted here.** Public self-registration always creates a `client`; any `role` sent in the body is ignored. To create an `admin` or `super`, a `super` must use `POST /api/users`.

Successful registration returns:

```json
{
  "success": 1,
  "status": 201,
  "data": {
    "user": { "id": 7, "fullName": "Juan Pérez", "email": "juan@example.com", "isVerified": false, ... },
    "verificationToken": "f1c8a9b2e6d04a3f8c4d5e6f7a8b9c0d..."
  }
}
```

Send the `verificationToken` to `POST /api/auth/verify-account` to mark the account as verified. Until then, login responds with `403`.

### Password strength rules

Every password the API accepts (`POST /auth/register` and `PUT /auth/change-password`) must satisfy **all** of:

| Rule              | Requirement                                                            | Error message if broken                                       |
| ----------------- | --------------------------------------------------------------------- | ------------------------------------------------------------ |
| Minimum length    | At least 8 characters                                                 | `Field "password" must be at least 8 characters`             |
| Maximum length    | At most 72 characters (bcrypt ignores anything past 72 bytes)         | `Field "password" must be at most 72 characters`             |
| Lowercase letter  | At least one `a-z`                                                     | `Field "password" must contain at least one lowercase letter` |
| Uppercase letter  | At least one `A-Z`                                                     | `Field "password" must contain at least one uppercase letter` |
| Digit             | At least one `0-9`                                                     | `Field "password" must contain at least one digit`           |
| Special character | At least one character that is not a letter or digit (e.g. `!@#$ `)   | `Field "password" must contain at least one special character` |

These match the frontend's `passwordStrengthValidator`, so a password the form accepts will also pass here. The API checks the rules in the order above and returns the **first** one that fails as a `400` (`{ "success": 0, "status": 400, "error": "..." }`).

### Auth login fields

```ts
// POST /api/auth/login
type LoginInput = {
  email: string;
  password: string;
};
```

Successful response shape:

```json
{
  "success": 1,
  "status": 200,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { "id": 7, "fullName": "Juan Pérez", "email": "juan@example.com", ... }
  }
}
```

The frontend stores both tokens (typically: access token in memory, refresh token in `httpOnly` cookie or secure storage), attaches the access token as `Authorization: Bearer <accessToken>` to API calls, and uses the refresh token to obtain new pairs.

### Auth change-password fields

```ts
// PUT /api/auth/change-password  (Authorization: Bearer <accessToken>)
type ChangePasswordInput = {
  currentPassword: string; // required — must match the user's current password
  newPassword: string;     // required — same strength rules as register, must differ from current
};
```

The user is always taken from the access token, so you never send a user id. Successful response:

```json
{
  "success": 1,
  "status": 200,
  "data": { "message": "Password updated successfully." }
}
```

Error cases (all return the standard `{ "success": 0, "status", "error" }` envelope):

- `400` `"Current password is incorrect."` — `currentPassword` does not match.
- `400` `"The new password must be different from the current password."` — `newPassword` equals `currentPassword`.
- `400` `Field "password" must ...` — `newPassword` fails one of the [password strength rules](#password-strength-rules).
- `401` `"Authentication required."` — missing or invalid access token.

After a successful change, all of the user's refresh tokens are invalidated, so the user must log in again to get a new token pair.

### User fields

```ts
// What you send for POST /users and PUT /users/:id
type UserInput = {
  fullName: string;         // required
  email: string;            // required — valid format, globally unique
  phoneNumber?: string;     // optional — max 20 characters
  role: "admin" | "client" | "super"; // required
  status?: 0 | 1;           // optional — 0 = INACTIVE, 1 = ACTIVE (defaults to 1)
  notificationPreferences?: 1 | 2 | 3; // optional — 1 = EMAIL, 2 = SMS, 3 = WHATS_APP
  dateOfBirth?: string;     // optional — "YYYY-MM-DD"
  isGuest?: boolean;        // optional — marks a guest account (defaults to false)
};
```

| Field                     | Type   | Required | Notes                                                            |
| ------------------------- | ------ | -------- | ---------------------------------------------------------------- |
| `fullName`                | string | yes      | Trimmed before saving.                                           |
| `email`                   | string | yes      | Must be a valid email and **globally unique**. Stored lowercased. |
| `phoneNumber`             | string | no       | Max 20 characters. Stored as `null` when omitted.                |
| `role`                    | enum   | yes      | One of `admin`, `client`, `super`.                               |
| `status`                  | number | no       | `0` (INACTIVE) or `1` (ACTIVE). Defaults to `1`.                 |
| `notificationPreferences` | number | no       | `1` (EMAIL), `2` (SMS), or `3` (WHATS_APP). `null` when omitted. |
| `dateOfBirth`             | string | no       | `YYYY-MM-DD` format. `null` when omitted.                        |
| `isGuest`                 | boolean | no      | Marks a guest account. Defaults to `false` when omitted.        |

Validation rules:

- `fullName` and `email` are required and must be non-empty after trimming — `400` if missing.
- `email` must match a valid email pattern and be unique across all users — `400` with a clear message on duplicate.
- `phoneNumber`, when provided, must be a string of at most 20 characters.
- `role` must be one of the three allowed values; `status` must be `0` or `1`; `notificationPreferences` must be `1`, `2`, or `3`; `dateOfBirth` must match `YYYY-MM-DD` — each returns `400` if invalid.
- `isGuest`, when provided, must be a boolean — `400` otherwise. When omitted it defaults to `false`, so existing create flows and existing records remain non-guest users.
- Returns `404` from `GET /users/:id`, `PUT /users/:id`, or `DELETE /users/:id` when no user matches.

#### Checking if an email exists

`GET /users/check-email?email=…` answers one question — *does a user already exist with this email?* — and nothing else. It's meant for guest checkout and registration, where the frontend only needs a yes/no before deciding whether to log the user in, offer guest checkout, or start a fresh sign-up. It deliberately does **not** return the user, so it can't be used to fish for account details.

```http
GET /api/users/check-email?email=ada@example.com
```

```json
{
  "success": 1,
  "status": 200,
  "data": {
    "email": "ada@example.com",
    "exists": true
  }
}
```

Notes:

- `email` is a **required** query parameter and must be a valid email address — a missing or malformed value returns `400`.
- The check is **case-insensitive**: the value is trimmed and lowercased before matching, the same way emails are stored, so `Ada@Example.com` and `ada@example.com` are treated as the same address.
- The returned `email` is the normalized (trimmed, lowercased) form that was actually checked.
- `exists` is simply `true` or `false`. The endpoint always returns `200` for a valid email, whether or not a match was found.

> Addresses and payment methods are part of the broader user model but are **not** managed through these endpoints yet — they will get their own resources later. Orders **are** implemented — see [Order fields](#order-fields).

User responses also include a read-only `isVerified` boolean indicating whether the email has been verified via `POST /api/auth/verify-account`. Users created through `POST /api/users` are not given a password and cannot log in — for self-service signup, use `POST /api/auth/register` instead. Sensitive fields (`passwordHash`, `verificationToken`, `refreshTokenHash`) are **never** included in any user response.

### Order fields

```ts
type OrderStatus =
  | "pending" | "paid" | "processing" | "shipped"
  | "delivered" | "cancelled" | "refunded";

// What you send for POST /orders and PUT /orders/:id
type OrderInput = {
  userId: number;            // required — must reference an existing user
  status?: OrderStatus;      // optional — defaults to "pending"
  currency: string;          // required — e.g. "MXN", "USD"
  subtotalAmount: number;    // required — ≥ 0
  shippingAmount: number;    // required — ≥ 0
  taxAmount: number;         // required — ≥ 0
  totalAmount: number;       // required — must equal subtotal + shipping + tax
  items: OrderItemInput[];   // required — at least one line
  shippingAddress?: ShippingAddress; // optional
  paymentId?: string;        // optional
  trackingNumber?: string;   // optional
  notes?: string;            // optional
};

type OrderItemInput = {
  productId: number;         // reference (not a FK — kept as a snapshot)
  productName: string;       // snapshot at purchase time
  productSlug: string;       // snapshot at purchase time
  productImageUrl?: string;  // snapshot at purchase time
  unitPrice: number;         // snapshot at purchase time
  quantity: number;          // ≥ 1
  totalAmount: number;       // must equal unitPrice * quantity
};

type ShippingAddress = {
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  fullName: string;
  phoneNumber: string;
};
```

**Order-level fields**

| Field             | Type                        | Required | Notes                                                          |
| ----------------- | --------------------------- | -------- | -------------------------------------------------------------- |
| `userId`          | number                      | yes      | Must reference an existing user. Returns `400` if not found.   |
| `status`          | enum                        | no       | Defaults to `"pending"`. One of the seven `OrderStatus` values.|
| `currency`        | string                      | yes      | Trimmed before saving. E.g. `"MXN"`, `"USD"`.                  |
| `subtotalAmount`  | number                      | yes      | Non-negative.                                                  |
| `shippingAmount`  | number                      | yes      | Non-negative.                                                  |
| `taxAmount`       | number                      | yes      | Non-negative.                                                  |
| `totalAmount`     | number                      | yes      | **Must equal** `subtotal + shipping + tax` (±0.01).            |
| `items`           | array                       | yes      | At least one item. See below.                                  |
| `shippingAddress` | object \| null              | no       | All seven fields required when provided.                       |
| `paymentId`       | string \| null              | no       | E.g. a Stripe / PayPal transaction reference.                  |
| `trackingNumber`  | string \| null              | no       | Carrier tracking number.                                       |
| `notes`           | string \| null              | no       | Free-form customer notes.                                      |

**Item fields** (each entry in `items[]`)

| Field             | Type           | Required | Notes                                                  |
| ----------------- | -------------- | -------- | ------------------------------------------------------ |
| `productId`       | number         | yes      | Reference only — no FK; preserved even if the product is deleted. |
| `productName`     | string         | yes      | Snapshot at purchase time.                             |
| `productSlug`     | string         | yes      | Snapshot at purchase time.                             |
| `productImageUrl` | string \| null | no       | Snapshot at purchase time.                             |
| `unitPrice`       | number         | yes      | Non-negative. Snapshot at purchase time.               |
| `quantity`        | number         | yes      | Positive integer.                                      |
| `totalAmount`     | number         | yes      | **Must equal** `unitPrice * quantity` (±0.01).         |

Validation rules:

- `userId`, `currency`, the four amount fields, and `items[]` are all required — `400` if missing or invalid.
- `totalAmount` must equal `subtotalAmount + shippingAmount + taxAmount` (within a 0.01 tolerance for floating-point rounding).
- Each item's `totalAmount` must equal `unitPrice * quantity` (same tolerance).
- `status`, when provided, must be one of the seven allowed values.
- `shippingAddress`, when provided, must include every field as a non-empty string.
- Returns `404` from `GET /orders/:id`, `PUT /orders/:id`, or `DELETE /orders/:id` when no order matches.

**Why items are snapshots:** if a product is renamed or repriced after an order ships, the order should still show the data the customer actually saw and paid for. `productId` is stored as a reference but is **not** a foreign key — the product can be deleted without breaking historical orders.

**PUT replaces everything, including items:** updating an order deletes all existing items and recreates them from the request body, inside a single transaction. If you only need to change the status or tracking number, you still need to send the full order payload.

### Quote fields

A quote is stored as a wide, mostly-optional record. Only the three contact fields are required; everything else is optional custom-neon configuration (on create) or staff pricing (added later via `PUT`). Nested configuration is stored as JSON.

```ts
// What a guest/client sends to POST /quotes (the "request" half)
type CustomQuoteRequestData = {
  fullName: string;          // required
  email: string;             // required — must be a valid email
  phoneNumber: string;       // required
  clientId?: number;         // optional — an existing user id (guests omit it)
  isCustom?: boolean;
  width?: number;            // ≥ 0
  height?: number;           // ≥ 0
  sizeUnit?: string;
  images?: string[];         // reference image URLs
  neonTexts?: NeonTextConfig[];
  alignment?: string;
  size?: NeonSize;
  notes?: string;
  waterproof?: boolean;
  backboardStyle?: string;
  backboardColor?: string;
  wallMountingKit?: string;
  signMountingKit?: boolean;
  remoteControl?: boolean;
};

type NeonTextConfig = {
  text: string;              // required
  color: object;             // required — opaque color object from the frontend
  font: {                    // required
    class: string;
    complexity: number;
    name: string;
    upperDiffersFromLowercase: number;
  };
  size?: string;
  letterSpacing?: number;
  lineHeight?: number;
  italics?: boolean;
  uppercase?: boolean;
  horizontalPosition?: number;
  verticalPosition?: number;
};

type NeonSize = {
  width: number;             // required
  maxCharacters: number;     // required
  default?: boolean;
};

// PUT /quotes/:id additionally accepts the "quote / pricing" half:
type QuoteExtras = {
  status?: number;           // 0–9 (see the status table above); omit to keep current
  price?: number;            // ≥ 0
  descriptionQuote?: string;   descriptionPrice?: number;   descriptionSuggestedPrice?: number;
  widthQuote?: number;         heightQuote?: number;
  sizePrice?: number;          sizeSuggestedPrice?: number;
  waterproofQuote?: boolean;   waterproofPrice?: number;    waterproofSuggestedPrice?: number;
  backboardStyleQuote?: string; backboardStylePrice?: number; backboardStyleSuggestedPrice?: number;
  backboardColorQuote?: string; backboardColorPrice?: number; backboardColorSuggestedPrice?: number;
  mockUpQuote?: string[];      mockUpPrice?: number;        mockUpSuggestedPrice?: number;
};
```

**Request-half fields**

| Field         | Type            | Required | Notes                                                       |
| ------------- | --------------- | -------- | ----------------------------------------------------------- |
| `fullName`    | string          | yes      | Trimmed before saving.                                      |
| `email`       | string          | yes      | Must be a valid email; stored lower-cased.                  |
| `phoneNumber` | string          | yes      | Trimmed before saving.                                      |
| `clientId`    | number \| null  | no       | Positive integer; must reference an existing user (`400` otherwise). Guests omit it. |
| `isCustom`    | boolean         | no       | Defaults to `false`.                                        |
| `width`, `height` | number      | no       | Non-negative.                                               |
| `sizeUnit`    | string \| null  | no       | E.g. `"cm"`, `"in"`.                                        |
| `images`      | string[]        | no       | Reference-image URLs (upload them via the `quotes` image endpoint first). |
| `neonTexts`   | NeonTextConfig[]| no       | Each entry needs `text`, `color`, and a `font` object.      |
| `size`        | NeonSize \| null| no       | Needs `width` and `maxCharacters`.                          |
| `alignment`, `notes`, `backboardStyle`, `backboardColor`, `wallMountingKit` | string \| null | no | Free-form. |
| `waterproof`, `signMountingKit`, `remoteControl` | boolean \| null | no | — |

**Quote-half fields** (accepted by `PUT` only): `status` (numeric, 0–9), `price` (≥ 0), and the `*Quote` / `*Price` / `*SuggestedPrice` per-feature fields plus `mockUpQuote` (string array). All optional; anything omitted is stored as `null` (or `0`/`[]` for `price` and the array fields).

Validation rules:

- `fullName`, `email` (valid format), and `phoneNumber` are required — `400` if missing or invalid.
- `clientId`, when provided, must be a positive integer for an existing user.
- `neonTexts` must be an array; each item must have a non-empty `text`, an object `color`, and a `font` object with `class`, `name` (strings) and `complexity`, `upperDiffersFromLowercase` (numbers).
- `size`, when provided, must have numeric `width` and `maxCharacters`.
- `status`, when provided, must be an integer 0–9.
- Returns `404` from `GET /quotes/:id`, `PUT /quotes/:id`, or `DELETE /quotes/:id` when no quote matches.

**Create sets the rest for you:** `POST /quotes` forces `status = 1` (SUBMITTED), stamps `createdAt`/`updatedAt`, defaults `price` to `0`, and leaves the whole quote/pricing half empty. **PUT replaces the whole record** and refreshes `updatedAt` (super/admin only).

### Cart validation fields

`POST /cart/validate` takes the cart your frontend is holding and re-checks every line against the live database. It is meant to run once, right before the shopper reaches the Checkout page.

```ts
// What you send
type CartValidationInput = {
  items: CartItem[];          // required — at least one line
  subtotalAmount?: number;    // optional — see "passed through" below
  shippingAmount?: number;    // optional
  taxAmount?: number;         // optional
  discountAmount?: number;    // optional
  totalAmount?: number;       // optional
  couponCode?: string;        // optional — accepted but NOT applied yet
};

type CartItem = {
  productId: number;          // required — positive integer
  productSlug: string;        // required
  productName: string;        // required
  productImageUrl?: string;   // optional
  variantId: number;          // required — positive integer
  width: number;              // required
  height: number;             // required
  sizeUnit: string;           // required — e.g. "cm", "inch"
  originalUnitPrice: number;  // required — variant list price
  unitPrice: number;          // required — price after product discount
  discountType?: string;      // optional — "percentage" | "amount" (alias: "fixed")
  discount?: number;          // optional
  quantity: number;           // required — positive integer
  subtotalAmount: number;     // required — unitPrice * quantity
  dateAddedToCart?: string;   // optional — preserved as-is
};

// What you get back (inside the usual `data` envelope)
type CartValidationResult = {
  isValid: boolean;           // true only when issues is empty
  issues: CartIssue[];        // one structured issue per problem (see below)
  items: CartItem[];          // refreshed cart — newest data for every line
  subtotalAmount: number;     // recalculated from the refreshed line subtotals
  shippingAmount: number;     // passed through (default 0)
  taxAmount: number;          // passed through (default 0)
  discountAmount: number;     // passed through (default 0)
  totalAmount: number;        // subtotal + shipping + tax − discount
};

type CartIssue = {
  code: CartIssueCode;        // machine code — switch on this to build your own copy
  message: string;            // default English text — convenience, prefer translating from `code`
  productId: number;          // which product the issue is about
  productName: string;
  variantId: number;          // which cart-line variant
  // Extra fields, only present for the codes noted:
  availableStock?: number;            // OUT_OF_STOCK (0) and INSUFFICIENT_STOCK
  requestedQuantity?: number;         // OUT_OF_STOCK and INSUFFICIENT_STOCK
  previousUnitPrice?: number;         // PRICE_CHANGED — price after discount, as held
  currentUnitPrice?: number;          // PRICE_CHANGED — live price after discount
  previousOriginalUnitPrice?: number; // PRICE_CHANGED — list price (pre-discount), as held
  currentOriginalUnitPrice?: number;  // PRICE_CHANGED — live list price (pre-discount)
  previousDiscountType?: string | null; // PRICE_CHANGED — discount type, as held
  currentDiscountType?: string | null;  // PRICE_CHANGED — live discount type
  previousDiscount?: number | null;   // PRICE_CHANGED — discount value, as held
  currentDiscount?: number | null;    // PRICE_CHANGED — live discount value
  previousSubtotal?: number;          // SUBTOTAL_CHANGED
  currentSubtotal?: number;           // SUBTOTAL_CHANGED
};

type CartIssueCode =
  | "PRODUCT_UNAVAILABLE"   // product no longer exists
  | "PRODUCT_INACTIVE"      // product exists but is disabled
  | "VARIANT_UNAVAILABLE"   // variant was removed, or its dimensions changed
  | "PRICE_CHANGED"         // originalUnitPrice / unitPrice / discount changed
  | "OUT_OF_STOCK"          // variant has 0 stock
  | "INSUFFICIENT_STOCK"    // requested quantity exceeds available stock
  | "SUBTOTAL_CHANGED";     // the line subtotal no longer matches unitPrice * quantity
```

Because each issue carries a stable `code` plus the raw data (available stock, old/new price, etc.), the frontend can build its own message — translated, formatted, however it likes — instead of showing the backend's English `message` directly.

**What gets checked, per item:**

| Check    | What it validates                                                      | Issue `code`(s)                          |
| -------- | --------------------------------------------------------------------- | ---------------------------------------- |
| Product  | The product still exists and is active                                | `PRODUCT_UNAVAILABLE` / `PRODUCT_INACTIVE` |
| Variant  | The variant still exists and its `width` / `height` / `sizeUnit` match | `VARIANT_UNAVAILABLE`                    |
| Stock    | `quantity <= variant.stock`                                           | `OUT_OF_STOCK` / `INSUFFICIENT_STOCK`    |
| Pricing  | `originalUnitPrice`, `unitPrice`, `discountType`, `discount` still match | `PRICE_CHANGED`                       |
| Subtotal | The line's `subtotalAmount` equals `unitPrice * quantity`             | `SUBTOTAL_CHANGED`                       |

> **Note:** `PRICE_CHANGED` fires when **any** of the four pricing fields differs — not just `unitPrice`. A product's list price (`originalUnitPrice`) can change while the after-discount `unitPrice` stays the same (e.g. when there is no discount and the list price moved by an amount your cart hadn't caught up to). That's why the issue carries `previous*`/`current*` values for **all** of `originalUnitPrice`, `unitPrice`, `discountType`, and `discount`: compare those to see what actually changed — `previousUnitPrice` and `currentUnitPrice` being equal does **not** mean nothing changed.

**How it behaves:**

- It **always** returns `200`. A stale price or low stock is a *finding*, not an HTTP error — findings go into `issues` and flip `isValid` to `false`. Only a malformed request body (missing `items`, wrong field types, etc.) returns `400`.
- `items` in the response is a **refreshed** copy of your cart: each line carries the newest `productName`, `productImageUrl`, variant dimensions, `originalUnitPrice`, `unitPrice`, `discountType`, `discount`, and recalculated `subtotalAmount`. `quantity` and `dateAddedToCart` are preserved from your request. Use this to overwrite your LocalStorage cart in one shot — no extra requests needed.
- `productImageUrl` keeps the image you sent if it still belongs to the product; otherwise it falls back to the product's first image (or `null`).
- Totals are recalculated: `subtotalAmount` is the sum of the refreshed line subtotals; `totalAmount` is `subtotal + shipping + tax − discount`. `shippingAmount`, `taxAmount`, and `discountAmount` are currently **passed through** from your request (defaulting to `0`) — there is no shipping/tax/coupon engine yet.
- `couponCode` is accepted so the frontend contract stays stable, but **coupons are not implemented yet** — the code is set up so that coupon validation, shipping rules, minimum-order checks, regional availability, etc. can be added here later. This endpoint is intended to become the single source of truth before checkout.

**Example response** (one stale price, one low-stock line):

```json
{
  "success": 1,
  "status": 200,
  "data": {
    "isValid": false,
    "issues": [
      {
        "code": "PRICE_CHANGED",
        "message": "The price of product \"Bulbasaur\" has changed.",
        "productId": 7,
        "productName": "Bulbasaur",
        "variantId": 21,
        "previousUnitPrice": 1500,
        "currentUnitPrice": 1800,
        "previousOriginalUnitPrice": 1500,
        "currentOriginalUnitPrice": 1800,
        "previousDiscountType": null,
        "currentDiscountType": null,
        "previousDiscount": 0,
        "currentDiscount": 0
      },
      {
        "code": "INSUFFICIENT_STOCK",
        "message": "The product \"Pikachu\" only has 3 units available.",
        "productId": 12,
        "productName": "Pikachu",
        "variantId": 34,
        "availableStock": 3,
        "requestedQuantity": 5
      }
    ],
    "items": [ /* ...refreshed items... */ ],
    "subtotalAmount": 15000,
    "shippingAmount": 0,
    "taxAmount": 0,
    "discountAmount": 0,
    "totalAmount": 15000
  }
}
```

### Custom Prices fields

The Custom Neon builder pulls every numeric knob it needs (per-character prices, backboard surcharges, multipliers, kit add-ons, etc.) from a single, site-wide configuration row. The CMS edits that row through these endpoints; there are no IDs and no listing — there is exactly one configuration.

```ts
// What you send for PUT /prices/custom — every field is required.
type CustomPrices = {
  acrylicAreaMultiplier: number;
  acrylicCostPerSquareFoot: number;
  backboardColorPriceBlack: number;
  backboardColorPriceClear: number;
  backboardColorPriceGold: number;
  backboardColorPriceSilver: number;
  backboardColorPriceWhite: number;
  backboardStyleBox: number;
  backboardStyleBoxMin: number;
  backboardStyleCutAround: number;
  backboardStyleCutAroundMin: number;
  backboardStyleInvisible: number;
  backboardStyleInvisibleMin: number;
  backboardStyleRectangular: number;
  backboardStyleRectangularMin: number;
  backboardStyleStand: number;
  backboardStyleStandMin: number;
  backboardStyleStroke: number;
  backboardStyleStrokeMin: number;
  dynamicSmartLed: number;
  eliminator: number;
  fontComplexityMultiplier: number;
  fontStyleMultiplier: number;
  lowerCaseCharacters: number;
  mockUp: number;
  remoteControlPrice: number;
  signMountingKitPrice: number;
  specialCharacters: number;
  upperCaseCharacters: number;
  wallMountingKitBlack: number;
  wallMountingKitGold: number;
  wallMountingKitSilver: number;
  waterproof: number;
  waterproofMin: number;
};
```

Validation rules:

- Every one of the 32 fields is required on PUT — `400` if any is missing, `null`, or `undefined`.
- Each value must be a **finite number** (`Infinity`, `NaN`, and strings like `"5"` are rejected with `400`).
- Decimals are allowed and stored as double-precision floats (e.g. `1.25`, `8.5`).
- Partial updates are not supported — always send the full payload. Omitting a field is treated as missing, not "leave unchanged".

GET behavior:

- `GET /prices/custom` always succeeds. If no configuration has ever been saved, the server creates one on the fly with every value defaulted to `0` and returns it — the CMS form can render immediately and the frontend never has to handle a 404.

The **response** also includes server-managed read-only fields:

| Field       | Type    | Notes                                                              |
| ----------- | ------- | ------------------------------------------------------------------ |
| `id`        | integer | Always `1` — there is exactly one row.                             |
| `createdAt` | string  | ISO datetime — when the configuration was first initialized.       |
| `updatedAt` | string  | ISO datetime — when the configuration was last saved (via PUT).    |

### Category fields

The **create and update payload** only accepts core fields. `images`, `tagIds`, and `productIds` are managed by dedicated services (not yet implemented).

```ts
// What you send for POST /categories and PUT /categories/:id
type CategoryPayload = {
  name: string; // required
  slug: string; // required — unique, URL-friendly identifier
  description: string; // required
  isActive: boolean; // required
  notes: string; // required — internal notes
};
```

| Field         | Type    | Required | Notes                                   |
| ------------- | ------- | -------- | --------------------------------------- |
| `name`        | string  | yes      | Category display name.                  |
| `slug`        | string  | yes      | Unique. Used for public URLs.           |
| `description` | string  | yes      | Free-form description.                  |
| `isActive`    | boolean | yes      | Whether the category is visible/active. |
| `notes`       | string  | no       | Internal notes (not shown publicly). Defaults to `""` if omitted. |

The **response** includes additional read-only fields populated by the system:

| Field        | Type     | Notes                                                                                          |
| ------------ | -------- | ---------------------------------------------------------------------------------------------- |
| `id`         | number   | Auto-generated.                                                                                |
| `images`     | string[] | Managed by a dedicated image service (not yet implemented).                                    |
| `tagIds`     | number[] | IDs of linked tags. Managed by Tag service (not yet implemented).                              |
| `productIds` | number[] | IDs of linked products. Managed via `POST/DELETE /products/:productId/categories/:categoryId`. |
| `createdAt`  | string   | ISO datetime.                                                                                  |
| `updatedAt`  | string   | ISO datetime.                                                                                  |

### Slide fields

```ts
// What you send for POST /slides and PUT /slides/:id
type SlideInput = {
  isActive: boolean; // required — true to show, false to hide
  imageUrl?: string; // optional — URL of the slide image
  styleClass?: string; // optional — CSS class applied to the slide container
  title?: string; // optional — headline text
  description?: string; // optional — body/subtitle text
  buttonLabel?: string; // optional — label for the CTA button
  route?: string; // optional — router link or URL for the CTA button
  innerHtml?: string; // optional — raw HTML injected into the slide
  justifyContent?: string; // optional — CSS flex justification (e.g. "center")
};
```

| Field           | Type    | Required | Notes                                                        |
| --------------- | ------- | -------- | ------------------------------------------------------------ |
| `isActive`      | boolean | yes      | Controls visibility. Set to `false` instead of deleting.     |
| `imageUrl`      | string  | no       | URL of the background image. Defaults to `null`.             |
| `styleClass`    | string  | no       | CSS class for custom styling. Defaults to `null`.            |
| `title`         | string  | no       | Main headline. Defaults to `null`.                           |
| `description`   | string  | no       | Subtitle or body text. Defaults to `null`.                   |
| `buttonLabel`   | string  | no       | CTA button text. Defaults to `null`.                         |
| `route`         | string  | no       | CTA link target (Angular route or absolute URL). Defaults to `null`. |
| `innerHtml`     | string  | no       | Raw HTML injected into the slide. Defaults to `null`.        |
| `justifyContent`| string  | no       | CSS `justify-content` value (e.g. `"center"`). Defaults to `null`. |

The response also includes server-managed fields:

| Field       | Type   | Notes                                                               |
| ----------- | ------ | ------------------------------------------------------------------- |
| `id`        | number | Auto-generated.                                                     |
| `position`  | number | 1-based display order. Auto-assigned on create. Change via reorder. |
| `createdAt` | string | ISO datetime.                                                       |
| `updatedAt` | string | ISO datetime.                                                       |

### 7.1. curl examples (works in PowerShell)

**Create a product:**

```powershell
curl -X POST http://localhost:3000/api/products `
  -H "Content-Type: application/json" `
  -d '{"name":"Neon Heart","description":"Pink LED neon heart sign","slug":"neon-heart","discountType":"percentage","discount":10}'
```

The backtick (`` ` ``) is PowerShell's line-continuation character. You can also write it on one line.

**List all products:**

```powershell
curl http://localhost:3000/api/products
```

**Get one product:**

```powershell
curl http://localhost:3000/api/products/neon-heart
```

**Update a product:**

```powershell
curl -X PUT http://localhost:3000/api/products/1 `
  -H "Content-Type: application/json" `
  -d '{"name":"Neon Heart XL","description":"Bigger pink heart","slug":"neon-heart-xl"}'
```

**Delete a product:**

```powershell
curl -X DELETE http://localhost:3000/api/products/1
```

### 7.2. Postman quick setup

1. Create a new collection called "Neon LED Love".
2. Add a request: `POST http://localhost:3000/api/products`.
3. In the **Body** tab, pick **raw → JSON**, and paste:
   ```json
   {
     "name": "Neon Heart",
     "description": "Pink LED neon heart sign",
     "slug": "neon-heart",
     "discountType": "percentage",
     "discount": 10
   }
   ```
4. Send. You should get a `201 Created` response.

---

## 8. The response format (`ApiNeonResponse`)

**Every** endpoint returns the same envelope shape so the frontend can handle responses uniformly. Defined in [src/utils/apiResponse.ts](src/utils/apiResponse.ts):

```ts
type ApiNeonResponse<R = unknown> = {
  success?: number; // 1 = ok, 0 = error
  status?: number; // HTTP status code
  error?: any; // error message (only on failure)
  results?: R[]; // array (used by list endpoints)
  data?: R; // single object (used by single-item endpoints)
  total?: number; // count of results
  previous?: string; // pagination (future)
  next?: string; // pagination (future)
};
```

### Examples

**List response (`GET /products`):**

```json
{
  "success": 1,
  "status": 200,
  "results": [
    {
      "id": 1,
      "name": "Neon Heart",
      "description": "Pink LED neon heart sign",
      "slug": "neon-heart",
      "discountType": "percentage",
      "discount": 10
    }
  ],
  "total": 1
}
```

**Single response (`GET /products/1`):**

```json
{
  "success": 1,
  "status": 200,
  "data": {
    "id": 1,
    "name": "Neon Heart",
    "description": "Pink LED neon heart sign",
    "slug": "neon-heart",
    "discountType": "percentage",
    "discount": 10
  }
}
```

**Error response (e.g. missing field):**

```json
{
  "success": 0,
  "status": 400,
  "error": "Field required: \"name\""
}
```

In your Angular service, you can check `response.success === 1` to know whether it worked.

---

## 9. API documentation (Swagger)

### What is Swagger?

Swagger (based on the **OpenAPI** standard) is an interactive web page that documents every API endpoint. Instead of guessing what fields to send or reading source code, you can:

- See every endpoint, its URL, method, and description in one place.
- Read exactly which fields are required, what type they must be, and what the response looks like.
- Click **"Try it out"** to send real HTTP requests directly from the browser — no Postman or curl needed.

### How to access the docs

Start the server (`npm run dev`), then open:

```
http://localhost:3000/api/docs
```

The interactive Swagger UI loads immediately. No login required.

If you need the raw OpenAPI spec as JSON (e.g. to import into Postman):

```
http://localhost:3000/api/docs.json
```

### How to use the API explorer

1. Open `http://localhost:3000/api/docs` in your browser.
2. Click any endpoint to expand it (e.g. **POST /api/products**).
3. Click **"Try it out"** (top-right of the expanded panel).
4. Fill in the request body or parameters using the editable form.
5. Click **"Execute"** — the page shows the exact `curl` command it ran, the response status, and the response body.

> **Tip:** Use the "Try it out" feature as a quick way to seed test data or verify a fix without writing any code.

### Where the documentation lives

All endpoint documentation is defined in **[src/swagger.ts](src/swagger.ts)**. If you add a new endpoint or change a field, update that file to keep the docs in sync.

---

## 10. Project structure explained

```
neon-led-love--api/
├── prisma/
│   └── schema.prisma           Database schema — one source of truth for tables/columns.
├── src/
│   ├── controllers/            HTTP layer: read req, call service, send res. Stays thin.
│   │   └── product.controller.ts
│   ├── services/               Business logic + validation. No knowledge of HTTP.
│   │   └── product.service.ts
│   ├── routes/                 Maps URLs to controller functions.
│   │   ├── index.ts            Mounts feature routers under /api.
│   │   └── product.routes.ts
│   ├── middlewares/            Functions that run for every request (e.g. error handling).
│   │   └── errorHandler.ts
│   ├── prisma/
│   │   └── client.ts           A single, shared PrismaClient instance.
│   ├── utils/
│   │   ├── apiResponse.ts      Helpers (`ok`, `okList`, `fail`) that build ApiNeonResponse.
│   │   └── HttpError.ts        Custom error class with an HTTP status code attached.
│   ├── app.ts                  Builds the Express app (middlewares, routes, error handlers).
│   └── server.ts               Entry point — starts the HTTP listener.
├── docker-compose.yml          Defines the PostgreSQL container.
├── .env                        Local secrets (DB URL, port). NOT committed.
├── .env.example                Template for .env. Committed.
├── package.json                Dependencies + npm scripts.
└── tsconfig.json               TypeScript compiler settings.
```

### How a request flows through the layers

`POST /api/products` arrives. Here is what happens, in order:

1. **`server.ts`** — Express is already listening; routes the request.
2. **`app.ts`** — `cors()` and `express.json()` middleware run (parse JSON body, allow cross-origin).
3. **`routes/index.ts`** — sees `/api/products`, hands off to the product router.
4. **`routes/product.routes.ts`** — matches `POST /`, calls `productController.create`.
5. **`controllers/product.controller.ts`** — extracts `req.body`, calls `productService.create(body)`.
6. **`services/product.service.ts`** — validates the input, calls Prisma to insert a row, returns the new product.
7. Back in the controller: wraps the product in an `ApiNeonResponse` using `ok(...)` and sends `201 Created`.
8. If anything throws, **`middlewares/errorHandler.ts`** catches it and returns a properly-shaped error response.

This separation (routes → controllers → services) means business logic is **not** tangled with HTTP details. You could later swap Express for Fastify, or add a CLI, without rewriting the validation logic.

---

## 11. Common errors and how to fix them

### `P1001: Can't reach database server at localhost:5432`

PostgreSQL is not running. Start it:

```powershell
npm run db:up
docker ps
```

Wait until the container shows `(healthy)`, then retry.

### `P1000: Authentication failed ... credentials for USER are not valid`

Your [.env](.env) still has placeholder values. Make sure `DATABASE_URL` matches the credentials in [docker-compose.yml](docker-compose.yml):

```
DATABASE_URL="postgresql://nll:nll@localhost:5432/neon_led_love?schema=public"
```

### `'docker' is not recognized as an internal or external command`

Docker Desktop is not installed, or it's installed but the engine is not running. Open Docker Desktop and wait for **Engine running**, then retry.

### `Port 3000 is already in use`

Something else is using port 3000. Either stop that other app, or change `PORT=3000` in `.env` to e.g. `PORT=3001`.

### `EADDRINUSE: address already in use :::5432`

Another PostgreSQL is already running on your machine on the same port. Stop it, or change the host port in [docker-compose.yml](docker-compose.yml) (e.g. `"5433:5432"`) and update `DATABASE_URL` to match.

### CORS error in the browser console

Your Angular app's URL must be allowed by the API. CORS is currently wide-open (`app.use(cors())`) — fine for development. If you tighten it later, add your Angular origin (e.g. `http://localhost:4200`) to the allowlist.

### `npm warn ... --name is being parsed as a normal command line argument`

Newer npm versions strip `--`. The script in [package.json](package.json) already includes `--name init` directly, so just run `npm run prisma:migrate` (no extra args).

---

## 12. Useful npm scripts

| Script                    | What it does                                                                     |
| ------------------------- | -------------------------------------------------------------------------------- |
| `npm run dev`             | Start the server in dev mode (auto-restart on save).                             |
| `npm run build`           | Compile TS to JS into `dist/`.                                                   |
| `npm start`               | Run the compiled JS from `dist/`. Used in production.                            |
| `npm run prisma:generate` | Regenerate the typed Prisma Client. Run after editing `schema.prisma`.           |
| `npm run prisma:migrate`  | Create + apply a new migration.                                                  |
| `npm run prisma:studio`   | Open Prisma Studio — a web UI to browse/edit DB rows at `http://localhost:5555`. |
| `npm run db:up`           | Start the PostgreSQL Docker container.                                           |
| `npm run db:down`         | Stop the PostgreSQL container (data is preserved).                               |
| `npm run db:logs`         | Tail the Postgres container logs.                                                |

> **Tip:** `npm run prisma:studio` is the easiest way to see what's in your database without writing SQL.

> **Migration names:** `npm run prisma:migrate` will prompt you to enter a short name for each migration (e.g. `add-price-field`). Use a lowercase, hyphen-separated description of what changed — it becomes part of the migration folder name in `prisma/migrations/` and helps you trace history.

---

## 13. Connecting from your Angular frontend

In your Angular app, create a service that talks to this API:

```ts
import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { Observable } from "rxjs";

export interface Product {
  id: number;
  name: string;
  description: string;
  slug: string;
  discountType?: string;
  discount?: number;
}

export type ApiNeonResponse<R = unknown> = {
  success?: number;
  status?: number;
  error?: any;
  results?: R[];
  data?: R;
  total?: number;
};

@Injectable({ providedIn: "root" })
export class ProductService {
  private http = inject(HttpClient);
  private base = "http://localhost:3000/api/products";

  list(): Observable<ApiNeonResponse<Product>> {
    return this.http.get<ApiNeonResponse<Product>>(this.base);
  }

  create(input: Omit<Product, "id">): Observable<ApiNeonResponse<Product>> {
    return this.http.post<ApiNeonResponse<Product>>(this.base, input);
  }
}
```

Make sure `HttpClientModule` (or `provideHttpClient()` in standalone setups) is registered in your app config.

That's it. Build a component, inject `ProductService`, render `response.results`. Welcome to backend development.

---

## 14. After pulling changes

Whenever you pull new commits from the repository, follow these steps to bring your local environment up to date.

### 13.1. Install any new dependencies

```powershell
npm install
```

Run this every time `package.json` changes. It's safe to run even when nothing changed.

### 13.2. Apply database migrations (if the schema changed)

If `prisma/schema.prisma` was modified (a field was added, renamed, or its type changed), you need to apply the migration to your local database:

```powershell
npm run prisma:migrate
```

This will:

1. Detect what changed between the last applied migration and the current schema.
2. Generate a new SQL migration file.
3. Apply it to your PostgreSQL database.
4. Regenerate the Prisma Client so TypeScript types stay in sync.

> **How do I know if the schema changed?** Look at the git diff for `prisma/schema.prisma`, or check `prisma/migrations/` for new folders. If in doubt, running `npm run prisma:migrate` when nothing changed is harmless.

### 13.3. Restart the dev server

If the server was already running, stop it (`Ctrl+C`) and start it again:

```powershell
npm run dev
```

`ts-node-dev` restarts automatically on file saves, but it does **not** pick up new migration data or environment variable changes without a full restart.

### Summary checklist

| Situation                                   | Command to run                        |
| ------------------------------------------- | ------------------------------------- |
| New packages added to `package.json`        | `npm install`                         |
| `prisma/schema.prisma` changed              | `npm run prisma:migrate`              |
| Only `.ts` source files changed             | Nothing — `npm run dev` auto-restarts |
| `.env.example` changed (new variable added) | Update your `.env` manually           |
| Database is out of sync / tables look wrong | `npm run prisma:migrate`              |
| See what's in your database                 | `npm run prisma:studio`               |
