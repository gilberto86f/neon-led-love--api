## Implement JWT Authentication for the project.

Goal:

Add a scalable authentication foundation for APP and CMS.

Implement:

- Register
- Login
- Email verification flow
- Access tokens
- Refresh tokens
- Logout

Use secure JWT-based authentication architecture.

---

## Authentication architecture

Create a dedicated:

```TypeScript
AuthService
```

Responsibilities:

- register users
- login users
- generate/refresh tokens
- validate accounts
- logout
- token validation

Keep auth logic centralized.

---

## User model updates

Add authentication-related fields to `User`.

Suggested additions:

```TypeScript
passwordHash: string;
isVerified: boolean;
verificationToken?: string;
refreshToken?: string;
refreshTokenExpiresAt?: Date;
```

Do NOT store raw passwords.

---

## Password handling

Requirements:

- hash passwords before storage
- never return passwordHash in responses

Suggested:

```TypeScript
bcrypt
```

or equivalent secure hashing library.

---

## JWT tokens

Implement:

### Access token

Short-lived token.

Requirements:

- expiration: 30 minutes
- used for authenticated API requests

Suggested payload:

```TypeScript
{
  sub: user.id,
  email: user.email
}
```

---

### Refresh token

Long-lived token.

Used to:

- refresh expired access tokens
- preserve login session

Requirements:

- securely generated
- stored hashed if possible
- revocable

---

## Endpoints

Implement:

```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
POST /api/auth/verify-account
GET  /api/auth/me
```

---

## Register

### Endpoint

```http
POST /api/auth/register
```

Requirements:

- create new user
- hash password
- generate verification token
- set:
  - `isVerified = false`

Example payload:

```JSON
{
  "fullName": "Juan Pérez",
  "email": "juan@example.com",
  "password": "12345678"
}
```

---

## Login

### Endpoint

```http
POST /api/auth/login
```

Requirements:

- validate email/password
- reject invalid credentials
- reject unverified accounts
- generate:
  - accessToken
  - refreshToken

Example response:

```JSON
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": {}
}
```

---

## Email verification

Implement verification flow structure only.

Do NOT implement actual email sending yet.

Requirements:

- generate verification token
- create verification endpoint
- validate token
- mark account as verified

Example:

```http
POST /api/auth/verify-account
```

Payload:

```JSON
{
  "token": "abc123"
}
```

---

## Refresh token

### Endpoint

```http
POST /api/auth/refresh
```

Requirements:

- validate refresh token
- generate new access token
- optionally rotate refresh token

---

## Logout

### Endpoint

```http
POST /api/auth/logout
```

Requirements:

- invalidate/remove refresh token
- clear session state

---

## Protected routes

Add JWT authentication guard/middleware.

Protect future authenticated endpoints.

Suggested:

```TypeScript
JwtAuthGuard
```

---

## Security requirements

Requirements:

- never expose passwordHash
- validate email uniqueness
- hash passwords securely
- validate JWT expiration
- invalidate refresh tokens on logout

---

## Validation

### Register

Requirements:

- valid email
- minimum password length
- unique email

Suggested password minimum:

```TypeScript
8
```

---

Goal:

- Create a scalable secure authentication foundation for APP and CMS.

---

# Claude.code

## Summary

JWT authentication is wired up. Migration applied to the DB; code in place.

### What I added

- Deps: bcryptjs, jsonwebtoken (+ their @types/).
- Schema (prisma/schema.prisma): passwordHash, isVerified, verificationToken (unique), refreshTokenHash, refreshTokenExpiresAt on User. Migration applied: prisma/migrations/20260525000000_add_auth_fields/migration.sql.
- Auth service (src/services/auth.service.ts): register, login, refresh (with rotation), logout, verifyAccount, getCurrentUser, verifyAccessToken. Passwords bcrypt-hashed; refresh tokens stored as SHA-256 hash.
- JWT guard (src/middlewares/authGuard.ts): jwtAuthGuard and requireRole(...). Attaches req.auth = { sub, email, role }.
- Controller + routes (src/controllers/auth.controller.ts, src/routes/auth.routes.ts) mounted at /api/auth in src/routes/index.ts.
- Endpoints: POST /api/auth/register, POST /api/auth/login, POST /api/auth/refresh, POST /api/auth/logout (protected), POST /api/auth/verify-account, GET /api/auth/me (protected).
- Sensitive field protection (src/services/user.service.ts): all prisma.user queries now select a public projection that excludes passwordHash, verificationToken, and refreshTokenHash.
- Config (src/utils/authConfig.ts) + new env vars in .env and .env.example. Production requires real secrets.
- Docs: src/swagger.ts gets a new Auth tag, bearerAuth security scheme, request/response schemas, and full paths. README.md has a new Auth section and Auth register fields / Auth login fields reference.

### Action required on your side

1. Stop the dev server (Ctrl+C in the terminal running npm run dev).
2. Regenerate the Prisma client: npm run prisma:generate. (It failed to regenerate now because the dev server was holding query_engine-windows.dll.node open.)
3. Restart: npm run dev.
4. In VS Code, if Prisma type errors still show: Command Palette → "TypeScript: Restart TS Server" (per CLAUDE.md).

### Notable design choices

- Email sending not implemented (per the task). POST /auth/register returns the verificationToken in the response so the frontend can complete the flow. When email is wired up later, drop it from the response.
- Login rejects unverified (isVerified=false) and inactive (status=0) accounts with 403.
- Refresh tokens rotate on every /refresh call (and on /login). The previous one is immediately invalid because only the latest hash is stored.
- Access tokens are stateless: /logout clears the refresh-token state but the access token keeps working until it expires (≤30 min). That's the standard JWT trade-off; document it client-side.
- The pre-existing POST /api/users admin endpoint stays unchanged — users created that way have no password and can't log in. Self-service signup goes through /auth/register.
