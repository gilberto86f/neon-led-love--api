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
9. [Project structure explained](#9-project-structure-explained)
10. [Common errors and how to fix them](#10-common-errors-and-how-to-fix-them)
11. [Useful npm scripts](#11-useful-npm-scripts)
12. [Connecting from your Angular frontend](#12-connecting-from-your-angular-frontend)

---

## 1. What is this project?

A small REST API that exposes endpoints to **list, create, read, update, and delete products** (the LED neon signs). Your Angular app will call these endpoints over HTTP to display products, manage them in an admin panel, etc.

This is an **MVP** (Minimum Viable Product) — the smallest possible version that works end-to-end so you can plug in the frontend and start iterating. No authentication, no image uploads yet — those come later.

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

| Tool | What it is | Why we use it |
|---|---|---|
| **Node.js** | A JavaScript runtime that runs JS outside the browser. | Lets us write the server in JS/TS, the same language as the frontend. |
| **TypeScript** | JavaScript with types. | Catches bugs at compile time. Same language family as Angular. |
| **Express** | A tiny library for building HTTP servers in Node. | Handles routing (`GET /products`, `POST /products`, etc.) without much boilerplate. |
| **PostgreSQL** | A relational database. | Stores products in tables with rows and columns. Industry standard. |
| **Prisma** | An **ORM** (Object–Relational Mapper). | Lets us read/write the database using TypeScript objects instead of raw SQL. Also auto-generates and applies schema migrations. |
| **Docker** | A tool that runs apps in isolated containers. | Lets us run PostgreSQL without installing it on your system. One command, no global install. |
| **dotenv** | Loads variables from a `.env` file into `process.env`. | Keeps secrets (DB password) out of source code. |
| **CORS middleware** | Tells the browser our server accepts requests from other origins. | Without it, your Angular dev server (different port) can't call this API. |

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
```

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
{"success":1,"status":200,"data":{"ok":true}}
```

If you get this, the server is working.

---

## 7. Trying the API

The API base URL is `http://localhost:3000/api`. All product endpoints live under `/products`.

| Method | Path             | Body (JSON)           | What it does            |
|--------|------------------|-----------------------|-------------------------|
| GET    | `/products`      | —                     | List all products       |
| GET    | `/products/:id`  | —                     | Get one product by id   |
| POST   | `/products`      | [Product](#product-fields) | Create a new product    |
| PUT    | `/products/:id`  | [Product](#product-fields) | Replace a product       |
| DELETE | `/products/:id`  | —                     | Delete a product        |

> **HTTP method conventions** (REST): GET = read, POST = create, PUT = replace, DELETE = remove. The URL identifies the resource, the method describes the action.

### Product fields

```ts
interface Product {
  name: string;          // required
  description: string;   // required
  slug: string;          // required — unique, URL-friendly identifier (e.g. "neon-heart")
  discountType?: string; // optional — e.g. "percentage" or "fixed"
  discount?: string;     // optional — e.g. "10" or "5.00"
}
```

| Field          | Type   | Required | Notes                                                  |
|----------------|--------|----------|--------------------------------------------------------|
| `name`         | string | yes      | Product display name.                                  |
| `description`  | string | yes      | Free-form description.                                 |
| `slug`         | string | yes      | Unique. Used for public URLs. `neon-heart-xl`, etc.    |
| `discountType` | string | no       | Free-form tag (`percentage`, `fixed`, …).              |
| `discount`     | string | no       | Stored as string for MVP simplicity.                   |

The server rejects a create/update request with `400` if any required field is missing, empty, or whitespace. Strings are trimmed before saving.

### 7.1. curl examples (works in PowerShell)

**Create a product:**

```powershell
curl -X POST http://localhost:3000/api/products `
  -H "Content-Type: application/json" `
  -d '{"name":"Neon Heart","description":"Pink LED neon heart sign","slug":"neon-heart","discountType":"percentage","discount":"10"}'
```

The backtick (`` ` ``) is PowerShell's line-continuation character. You can also write it on one line.

**List all products:**

```powershell
curl http://localhost:3000/api/products
```

**Get one product:**

```powershell
curl http://localhost:3000/api/products/1
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
     "discount": "10"
   }
   ```
4. Send. You should get a `201 Created` response.

---

## 8. The response format (`ApiNeonResponse`)

**Every** endpoint returns the same envelope shape so the frontend can handle responses uniformly. Defined in [src/utils/apiResponse.ts](src/utils/apiResponse.ts):

```ts
type ApiNeonResponse<R = unknown> = {
  success?: number;     // 1 = ok, 0 = error
  status?: number;      // HTTP status code
  error?: any;          // error message (only on failure)
  results?: R[];        // array (used by list endpoints)
  data?: R;             // single object (used by single-item endpoints)
  total?: number;       // count of results
  previous?: string;    // pagination (future)
  next?: string;        // pagination (future)
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
      "discount": "10"
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
    "discount": "10"
  }
}
```

**Error response (e.g. missing field):**

```json
{
  "success": 0,
  "status": 400,
  "error": "Field \"name\" is required"
}
```

In your Angular service, you can check `response.success === 1` to know whether it worked.

---

## 9. Project structure explained

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

## 10. Common errors and how to fix them

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

## 11. Useful npm scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the server in dev mode (auto-restart on save). |
| `npm run build` | Compile TS to JS into `dist/`. |
| `npm start` | Run the compiled JS from `dist/`. Used in production. |
| `npm run prisma:generate` | Regenerate the typed Prisma Client. Run after editing `schema.prisma`. |
| `npm run prisma:migrate` | Create + apply a new migration. |
| `npm run prisma:studio` | Open Prisma Studio — a web UI to browse/edit DB rows at `http://localhost:5555`. |
| `npm run db:up` | Start the PostgreSQL Docker container. |
| `npm run db:down` | Stop the PostgreSQL container (data is preserved). |
| `npm run db:logs` | Tail the Postgres container logs. |

> **Tip:** `npm run prisma:studio` is the easiest way to see what's in your database without writing SQL.

---

## 12. Connecting from your Angular frontend

In your Angular app, create a service that talks to this API:

```ts
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface Product {
  id: number;
  name: string;
  description: string;
  slug: string;
  discountType?: string;
  discount?: string;
}

export type ApiNeonResponse<R = unknown> = {
  success?: number;
  status?: number;
  error?: any;
  results?: R[];
  data?: R;
  total?: number;
};

@Injectable({ providedIn: 'root' })
export class ProductService {
  private http = inject(HttpClient);
  private base = 'http://localhost:3000/api/products';

  list(): Observable<ApiNeonResponse<Product>> {
    return this.http.get<ApiNeonResponse<Product>>(this.base);
  }

  create(input: Omit<Product, 'id'>): Observable<ApiNeonResponse<Product>> {
    return this.http.post<ApiNeonResponse<Product>>(this.base, input);
  }
}
```

Make sure `HttpClientModule` (or `provideHttpClient()` in standalone setups) is registered in your app config.

That's it. Build a component, inject `ProductService`, render `response.results`. Welcome to backend development.
