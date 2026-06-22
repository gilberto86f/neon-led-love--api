👨‍💻

# Add Role-Based Permissions and Ownership Rules

Implement authorization rules based on user roles and resource ownership.

Goal:

Protect administrative operations while allowing clients to access only the information and actions they are authorized to use.

---

## Roles

Supported roles:

```TypeScript
type UserRole =
  | 'super'
  | 'admin'
  | 'client';
```

---

## Default Role for Non-Authenticated Users

Users without an authenticated session should be treated as:

```TypeScript
role = 'client'
```

This means public endpoints available to clients should also be available to guests unless explicitly protected.

---

## Permission Matrix

| Action          | Super | Admin | Client / Guest                   |
| --------------- | ----- | ----- | -------------------------------- |
| Read Products   | ✅    | ✅    | ✅                               |
| Read Categories | ✅    | ✅    | ✅                               |
| Read Tags       | ✅    | ✅    | ✅                               |
| Read Slides     | ✅    | ✅    | ✅                               |
| Read Prices     | ✅    | ✅    | ✅                               |
| Validate Cart   | ✅    | ✅    | ✅                               |
| Create User     | ✅    | ❌    | ❌                               |
| Update Any User | ✅    | ❌    | ❌                               |
| Delete Any User | ✅    | ❌    | ❌                               |
| Update Own User | ✅    | ✅    | ✅                               |
| Delete Own User | ✅    | ✅    | ✅                               |
| Read Any User   | ✅    | ✅    | ❌                               |
| Read Own User   | ✅    | ✅    | ✅                               |
| CRUD Products   | ✅    | ✅    | ❌                               |
| CRUD Categories | ✅    | ✅    | ❌                               |
| CRUD Tags       | ✅    | ✅    | ❌                               |
| CRUD Slides     | ✅    | ✅    | ❌                               |
| CRUD Prices     | ✅    | ✅    | ❌                               |
| CRUD Orders     | ✅    | ✅    | Limited (future ownership rules) |

---

## User Ownership Rules

Users should always be allowed to manage their own account.

Examples:

```
GET /users/15
PUT /users/15
DELETE /users/15
```

Allowed when:

```TypeScript
authenticatedUser.id === 15
```

---

## Client Restrictions

A client user must NOT be able to:

```
GET /users
GET /users/2
PUT /users/2
DELETE /users/2
```

unless:

```TypeScript
authenticatedUser.id === requestedUserId
```

---

## Admin Restrictions

Admins should be able to:

```
GET /users
GET /users/:id
```

but NOT:

```
POST /users
PUT /users/:id
DELETE /users/:id
```

for other users.

Only Super users may manage users globally.

Admins should still be able to:

```
PUT /users/{theirOwnId}
DELETE /users/{theirOwnId}
```

for their own account.

---

## Super Permissions

Super users bypass all permission checks.

They should have access to:

```TypeScript
all endpoints
all resources
all users
```

---

## Read Permissions

Client users should have access to all public read operations.

Examples:

```
GET /products
GET /products/:slug

GET /categories
GET /categories/:slug

GET /tags
GET /tags/:slug

GET /slides

GET /prices
```

---

## Cart Validation

Allow:

```http
POST /cart/validate
```

for:

```TypeScript
super
admin
client
guest
```

because checkout must work without requiring authentication.

---

## Authorization Infrastructure

Introduce reusable authorization helpers.

Suggested:

```TypeScript
@Roles(...)
```

Examples:

```TypeScript
@Roles('super')
```

```TypeScript
@Roles('super', 'admin')
```

```TypeScript
@Roles('super', 'admin', 'client')
```

---

## Ownership Helper

Introduce a reusable ownership check.

Example:

```TypeScript
canAccessUser(
  authenticatedUser,
  requestedUserId
)
```

Pseudo logic:

```TypeScript
if (user.role === 'super') {
  return true;
}

if (user.id === requestedUserId) {
  return true;
}

return false;
```

---

## Unauthorized Responses

When authentication is required but missing:

Return:

```JSON
{
  "success": 0,
  "status": 401,
  "message": "Authentication required."
}
```

HTTP:

```http
401 Unauthorized
```

---

## Forbidden Responses

When authenticated but lacking permission:

Return:

```JSON
{
  "success": 0,
  "status": 403,
  "message": "You do not have permission to perform this action."
}
```

HTTP:

```http
403 Forbidden
```

Use the same response structure throughout the API.

---

## Authenticated User Source

Use the authenticated JWT user information.

Example:

```TypeScript
request.user.id
request.user.role
```

Never trust IDs coming from the request body.

---

## Protect Existing Endpoints

Review all controllers and apply authorization rules consistently:

- Users
- Products
- Categories
- Tags
- Slides
- Prices
- Orders
- Images
- Cart
- Auth

Any endpoint not explicitly public should define its authorization requirements.

---

If I am missing some endpoint, please ask how you should proceed

# 🤖

Role-Based Authorization & Ownership Rules
Context
The API already issues JWTs (auth.service.ts) and ships an unused jwtAuthGuard / requireRole pair in authGuard.ts, but no resource route enforces anything — only /auth/logout and /auth/me are guarded. Every other endpoint (users, products, categories, tags, slides, prices, images, orders) is wide open, so any anonymous caller can create/delete products or read/modify any user.

This change introduces a small, declarative authorization layer and applies it across all routers per the permission matrix, plus ownership rules for users and orders. It closes a privilege-escalation hole in register and keeps the public storefront (reads, cart validation, quote-image upload) fully open.

Decisions confirmed with the user
Orders: client may GET /orders (own only) and GET /orders/:id (own only); create/update = super+admin; delete = super only ("admin everything except delete").
Register: force role = 'client' (ignore any role in the body).
Image uploads: POST /images/upload/quotes stays public; other types + DELETE /images require super+admin.
Error body: keep the existing fail() envelope ({ success:0, status, error }) — the prompt's message key would break the project-wide contract in CLAUDE.md. Message text matches the spec verbatim.
Roles: super, admin, client. Unauthenticated callers are treated as client/guest — implemented simply by leaving public routes unguarded (no middleware).

Authorization infrastructure

1. Extend src/middlewares/authGuard.ts (reuse existing jwtAuthGuard + requireRole):

Update messages to the exact spec text:
missing/invalid Authorization header → HttpError(401, "Authentication required.")
role mismatch → HttpError(403, "You do not have permission to perform this action.")
Add a composer that reads like @Roles(...):
export const authorize = (...roles: UserRole[]) => [jwtAuthGuard, requireRole(...roles)];
Express flattens the array, so usage is router.post('/', authorize('super','admin'), ctrl.create). 2. New src/utils/authorization.ts — reusable ownership predicates (operate on the JWT payload AccessTokenPayload, never on body IDs):

isStaff(role) → role === 'super' || role === 'admin'
canViewUser(auth, requestedId) → staff or auth.sub === requestedId (GET /users/:id)
canManageUser(auth, requestedId) → auth.role === 'super' or auth.sub === requestedId (PUT/DELETE /users/:id — admins can only manage themselves)
canAccessOrder(auth, ownerId) → staff or auth.sub === ownerId
Per-route authorization map
PUB = no middleware (public/guest). AUTH = jwtAuthGuard + controller ownership check.

Router Endpoint Rule
auth register / login / refresh / verify-account PUB (register forces client)
auth logout, me jwtAuthGuard (unchanged)
users GET / (list), POST / create list authorize('super','admin'); create authorize('super')
users GET /check-email PUB (signup helper, returns only {exists})
users GET /:id AUTH + canViewUser
users PUT /:id, DELETE /:id AUTH + canManageUser
products GET list/related/:slug, GET variants/color-options/tags PUB
products all POST/PUT/DELETE (incl. variants, color-options, product-category, product-tag) authorize('super','admin')
categories GET /, GET /:slug PUB
categories POST, PUT /:id, DELETE /:id authorize('super','admin')
tags reads PUB; writes authorize('super','admin')
slides GET /, GET /:id PUB; POST, PUT /reorder, PUT /:id authorize('super','admin')
prices GET /custom PUB; PUT /custom authorize('super','admin')
images POST /upload/:type quotes PUB, else super+admin (per-type middleware)
images DELETE / authorize('super','admin')
orders GET / list AUTH; client scoped to own
orders GET /:id AUTH + canAccessOrder
orders POST /, PUT /:id authorize('super','admin')
orders DELETE /:id authorize('super')
cart POST /validate PUB
Service / controller hardening
auth.service.register (auth.service.ts) — drop the role-from-body logic; always create role: 'client'. Remove role from the input shape/validation.
userController (user.controller.ts) — getById: if (!canViewUser(req.auth!, id)) throw 403. update/remove: if (!canManageUser(req.auth!, id)) throw 403. In update, for a non-super actor, pin role/status to the current DB values before calling the service so self-service updates can't escalate privileges (load via userService.getUserById).
order.service.getOrders (order.service.ts) — add optional userId?: number filter (where.userId = userId).
orderController (order.controller.ts) — list: pass userId: req.auth!.sub when the actor is not staff. getById: after fetch, if (!canAccessOrder(req.auth!, order.userId)) throw 403.
imageController / route — add an authorizeImageUpload middleware in image.routes.ts: if req.params.type === 'quotes' → next(), else run jwtAuthGuard then requireRole('super','admin'). Mount it after validateUploadType, before handleUpload (authorize before accepting the file).
All ownership checks live at the controller boundary (they depend on req.auth + the parsed path id), keeping services free of req/res per the layering rule.

Documentation (required, same change)
src/swagger.ts — add components.securitySchemes.bearerAuth (http/bearer JWT); add security: [{ bearerAuth: [] }] to every protected operation; document 401/403 responses; update the register request body (no role); note order ownership and that quotes upload is public.
README.md — new "Authentication & Authorization" section: the three roles + guest default, how to send Authorization: Bearer <token>, the public-vs-protected breakdown, the 401/403 messages, register-forces-client, public quotes upload, and order ownership.
Files
Edit: src/middlewares/authGuard.ts, src/services/auth.service.ts, src/controllers/user.controller.ts, src/controllers/order.controller.ts, src/services/order.service.ts, src/routes/\*.routes.ts (users, products, categories, tags, slides, prices, images, orders), src/swagger.ts, README.md
New: src/utils/authorization.ts
Verification (no test suite — manual + compile)
npm run build — must compile clean (TS).
npm run db:up && npm run dev.
Bootstrap: register a user, then promote it to super in Prisma Studio (npm run prisma:studio) + set isVerified=true — the first super must be seeded manually because POST /users now requires super.
Register hardening: POST /auth/register with "role":"super" → response user has role:"client".
Public reads: GET /api/products, GET /api/categories, GET /api/prices/custom, POST /api/cart/validate, POST /api/images/upload/quotes (no token) → all succeed.
Guards: POST /api/products no token → 401 "Authentication required."; with a client token → 403 "You do not have permission to perform this action."; with super/admin → 201.
User ownership: client GET /api/users → 403; GET /api/users/{ownId} → 200; GET /api/users/{otherId} → 403; PUT /api/users/{ownId} with role:"super" in body → 200 but role stays client; admin GET /api/users → 200; admin POST /api/users → 403; super POST /api/users → 201.
Orders: client GET /api/orders → only own rows; client GET /api/orders/{othersOrder} → 403; admin DELETE /api/orders/:id → 403; super DELETE → 200.
Images: POST /api/images/upload/products no token → 401; with admin token → 201.

## What changed

### Authorization infrastructure

- authGuard.ts — added the @Roles(...)-style authorize(...roles) composer ([jwtAuthGuard, requireRole(...)]), and standardized the spec messages as shared constants: 401 "Authentication required." and 403 "You do not have permission to perform this action."
- authorization.ts (new) — ownership predicates isStaff, canViewUser, canManageUser, canAccessOrder, all operating on the JWT payload, never on body IDs.

### Route guards (reads public, writes super/admin)

- products (+ variants, color-options, product-category, product-tag), categories, tags, slides, prices, images-delete all gated with authorize("super","admin").
- users: list = super/admin; create = super-only; GET/PUT/DELETE /:id use jwtAuthGuard + controller ownership (super → anyone; admin → self only; client → self only).
- orders: all require auth; clients are auto-scoped to their own orders on list and get 403 on others' orders; create/update = super/admin; delete = super only (per your "admin everything except delete").
- images: quotes uploads public; product/category/slide uploads require super/admin.
- cart /validate stays public.

### Hardening

- POST /auth/register now always creates a client — any role in the body is ignored (auth.service.ts).
- A non-super updating their own account can't change role/status — they're pinned to the stored values (user.controller.ts).

### Docs (same change, per CLAUDE.md)

- swagger.ts — full Authorization section + permission matrix in the API description, role rules on the Users/Orders/Images tags, and the role field removed from the register body schema.
- README.md — new "Authorization (roles & permissions)" section (roles, token usage, 401/403, matrix, ownership, first-super bootstrap) plus per-resource Access notes and the corrected register fields.

One decision I made without asking: the 401/403 bodies use the project's existing error key (not the prompt's message), since CLAUDE.md mandates the fail() envelope contract — the message text matches your spec verbatim.

## Verify

npm run build passes. For a runtime check: npm run db:up && npm run dev, then follow the steps in the plan — notably, seed the first super manually in Prisma Studio (create-user is now super-only, so a fresh DB has a chicken-and-egg otherwise). The README's bootstrap note documents this for your frontend teammates too.

One thing worth flagging: this protects order creation to super/admin. If/when you build customer checkout that creates an order from the client side, that endpoint will need its own ownership-scoped rule — you marked it "future" and I kept it staff-only for now.
