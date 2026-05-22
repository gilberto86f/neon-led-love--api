# Refactor the `User` type and related services to replace:

```TypeScript
firstName
paternalLastName
maternalLastName
```

with a single:

```TypeScript
fullName
```

Goal:

Simplify the User structure and update all affected services/types accordingly.

---

# User type update

Replace the current structure:

```TypeScript
firstName: string;
paternalLastName: string;
maternalLastName: string;
```

with:

```TypeScript
fullName: string;
```

---

# Services refactor

Update all User-related services and logic.

Update Users search logic.

Instead of searching:

```TypeScript
firstName
paternalLastName
maternalLastName
```

search:

```TypeScript
fullName
```

while preserving existing behavior.

---

# Claude.code.

Refactor complete. firstName / paternalLastName / maternalLastName are gone everywhere — replaced by a single fullName:

- Schema — schema.prisma: User.fullName String (one column instead of three).
- Migration — 20260522000000_user_fullname/migration.sql: handwritten to preserve your dev data. Adds fullName nullable → backfills from CONCAT_WS(' ', firstName, paternalLastName, maternalLastName) with whitespace collapsed → sets NOT NULL → drops the three legacy columns. Applied via prisma migrate deploy; all 3 existing user rows kept their composed name.
- Service — user.service.ts: UserInput now has fullName; validate/normalize updated; list search now ORs fullName / email / phoneNumber.
- Orders search — order.service.ts: user.firstName/paternal/maternal clauses collapsed into a single user.fullName clause.
- Docs — swagger.ts (User + UserInput schemas, Users search description, Orders search description) and README.md (User type block, field table, validation bullet, Users search description, Orders search description).

Same DLL-lock situation as before — prisma generate is blocked by the running dev server. Stop npm run dev, run npm run prisma:generate, then npx tsc --noEmit will pass. Until then, expect stale type errors on prisma.user.fullName / where.fullName.
