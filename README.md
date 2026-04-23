# neon-led-love-api

Minimal MVP backend. Express + TypeScript + Prisma + PostgreSQL.

## Structure

```
src/
  controllers/   thin HTTP layer
  services/      business logic + validation
  routes/        Express routers
  prisma/        Prisma client singleton
  middlewares/   error handler
  utils/         ApiNeonResponse helpers, HttpError
  app.ts         Express app factory
  server.ts      entry point
prisma/
  schema.prisma  Product model
```

## Setup

1. Install deps:
   ```bash
   npm install
   ```
2. Copy env:
   ```bash
   cp .env.example .env
   ```
   Edit `DATABASE_URL` with your Postgres credentials.
3. Generate Prisma client + migrate DB:
   ```bash
   npm run prisma:migrate -- --name init
   ```
4. Run dev server:
   ```bash
   npm run dev
   ```
   Server: `http://localhost:3000`

## Endpoints

Base: `/api`

| Method | Path             | Body                          | Description     |
|--------|------------------|-------------------------------|-----------------|
| GET    | /products        | -                             | List products   |
| GET    | /products/:id    | -                             | Get product     |
| POST   | /products        | `{ name, description }`       | Create product  |
| PUT    | /products/:id    | `{ name, description }`       | Update product  |
| DELETE | /products/:id    | -                             | Delete product  |

Health: `GET /health`

## Response format (`ApiNeonResponse`)

List:
```json
{ "success": 1, "status": 200, "results": [...], "total": 3 }
```
Single:
```json
{ "success": 1, "status": 200, "data": { "id": 1, "name": "...", "description": "..." } }
```
Error:
```json
{ "success": 0, "status": 400, "error": "Field \"name\" is required" }
```

## curl examples

```bash
# create
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Neon Heart","description":"Pink LED neon heart sign"}'

# list
curl http://localhost:3000/api/products

# get one
curl http://localhost:3000/api/products/1

# update
curl -X PUT http://localhost:3000/api/products/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"Neon Heart XL","description":"Bigger pink heart"}'

# delete
curl -X DELETE http://localhost:3000/api/products/1
```
