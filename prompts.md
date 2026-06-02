👨‍💻

# Add Email Check Endpoint

Add a new endpoint to determine whether a user already exists with a given email address.

Goal:

Support guest checkout and registration flows without requiring unnecessary requests to retrieve full user information.

---

## Endpoint

```http
GET /api/users/check-email?email=usertest@email.com
```

---

## Purpose

This endpoint should answer only:

```TypeScript
Does a user exist with this email?
```

It should not return full user information.

---

## Request

Example:

```http
GET /api/users/check-email?email=ada@example.com
```

---

# 🤖

## What I added

Endpoint: GET `/api/users/check-email?email=… `— returns only `{ email, exists }`, never user data, exactly as the brief required for guest-checkout/registration flows.

### Files changed:

- src/services/user.service.ts — checkEmail(): validates the param (required + valid format via the existing EMAIL_RE), normalizes it (trim().toLowerCase() — matching how emails are stored), and does a minimal findFirst selecting only { id: true }.
- src/controllers/user.controller.ts — thin checkEmail handler, wraps with ok(), forwards errors via next(err).
- src/routes/user.routes.ts — GET /check-email registered before /:id.
- src/swagger.ts — EmailCheckResponse schema + /api/users/check-email path.
- README.md — Users table row + a "Checking if an email exists" section.

### The one subtle thing worth flagging

Route ordering matters here. Express matches in registration order, and the existing GET /:id would otherwise capture check-email as an id, fail parseId, and return 400 Invalid id. Placing check-email before /:id fixes that — I verified the build, but the route precedence is the thing to keep in mind if routes are ever reordered.

### Two design choices I made (easy to change)

- Case-insensitive match. Emails are stored lowercased (see normalize in the service), so I lowercase the query value before matching — otherwise Ada@Example.com would wrongly report exists: false. The response echoes back the normalized email that was actually checked.
- Lookup ignores isGuest. It reports exists: true for any user with that email, including guest accounts. That's the safest default for "is this email taken?", but if guest-checkout should treat guest records as "not really registered," I can add an ?includeGuests=false filter — let me know.

I couldn't hit a live DB from here, but once it's running you can smoke-test with:

`curl "http://localhost:3000/api/users/check-email?email=ada@example.com"`
