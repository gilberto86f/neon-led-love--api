👨‍💻

# Add Change Password Endpoint

Create a new endpoint that allows authenticated users to change their password.

Goal:

Allow users to securely update their own password without requiring administrative intervention.

---

## Endpoint

```http
PUT /api/auth/change-password
```

Authentication required:

```
Bearer Token
```

---

## Authorization

A user may only change their own password.

The target user must always be determined from:

```TypeScript
request.user.id
```

obtained from the authenticated JWT.

Do not allow:

```TypeScript
userId
```

to be passed in the request body, query params, or route params.

---

## Request Body

```JSON
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword123!"
}
```

---

## Validation

### Current Password

Requirements:

- required
- must match the user's current password

If invalid:

```JSON
{
  "success": 0,
  "status": 400,
  "message": "Current password is incorrect."
}
```

---

### New Password

Apply the exact same validation rules already used during registration.

Reuse the existing validation logic instead of duplicating it.

Examples:

- minimum length
- maximum length
- uppercase requirements
- lowercase requirements
- numbers
- special characters

(or whatever rules currently exist in Register)

---

### Prevent Reusing Current Password

If:

```TypeScript
currentPassword === newPassword
```

return:

```JSON
{
  "success": 0,
  "status": 400,
  "message": "The new password must be different from the current password."
}
```

---

## Successful Response

```JSON
{
  "success": 1,
  "status": 200,
  "message": "Password updated successfully."
}
```

---

## Refresh Token Security

After a successful password change:

Invalidate all existing refresh tokens for the user.

This forces old sessions to become unusable.

Suggested approach:

```TypeScript
user.refreshTokenHash = null;
```

or the equivalent mechanism already used by Auth.

---

## Login Behavior After Password Change

The user should be required to authenticate again.

Recommended flow:

```
Change Password
↓
Password Updated
↓
Invalidate Refresh Tokens
↓
Logout Current Session
↓
User Logs In Again
```

This is the safest approach.

---

## Error Responses

### Not Authenticated

```JSON
{
  "success": 0,
  "status": 401,
  "message": "Authentication required."
}
```

---

### Incorrect Current Password

```JSON
{
  "success": 0,
  "status": 400,
  "message": "Current password is incorrect."
}
```

---

### Invalid New Password

Use the same validation messages already returned by Register.

---

🤖

# Summary

Added PUT /api/auth/change-password — an authenticated user can change their own password. The endpoint follows the project's strict route → controller → service → Prisma layering.

## Code changes:

- auth.service.ts — Extracted the registration password rule into a shared validatePassword helper (so register and change-password can't drift), refactored register to use it, and added a changePassword(userId, input) method that:
  - takes the user id from the verified JWT (never the body/params),
  - requires currentPassword/newPassword,
  - verifies the current password (400 "Current password is incorrect."),
  - validates the new password with the same rules as registration,
  - rejects a new password equal to the current one (400 "The new password must be different from the current password."),
  - hashes the new password and clears refreshTokenHash + refreshTokenExpiresAt to invalidate all sessions.
- auth.controller.ts — changePassword controller, guards on req.auth, passes req.auth.sub (the JWT's user id), returns ok({ message: "Password updated successfully." }).
- auth.routes.ts — router.put("/change-password", jwtAuthGuard, ...).

## Docs (required by CLAUDE.md, same change):

swagger.ts — ChangePasswordInput / ChangePasswordResponse schemas and the /api/auth/change-password path.
README.md — table row, a note explaining the session-invalidation behavior, and a "change-password fields" section.

## Two deliberate deviations from the prompt's JSON, to honor the CLAUDE.md envelope rule (which OVERRIDES — "never hand-roll the envelope"):

- The success body is { success: 1, status: 200, data: { message: "Password updated successfully." } } — the message lives under data, matching how /auth/logout returns { data: { loggedOut: true } }. The ApiNeonResponse type has no top-level message field.
- Error messages land in the error field (via the existing errorHandler → fail()), not message, but the exact strings from the prompt are preserved. The README documents this so the frontend reads error.

Authentication "required" / "incorrect password" copy reuses the existing AUTH_REQUIRED_MESSAGE ("Authentication required.") from the auth guard, so the 401 matches the rest of the API. npx tsc --noEmit passes.

Note: registration currently enforces only a minimum length of 8 — there are no uppercase/lowercase/number/special-character rules in this codebase, so "the same rules as register" means the min-length check. If you want the stronger rules the prompt lists as examples, I can add them to validatePassword and both flows will pick them up automatically.
