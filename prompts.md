👨‍💻

# Create new Quotes Service

Implement a new `QuotesService` and all REST endpoints required to manage Quotes.

The implementation should follow the same architecture, conventions, pagination, validation, error handling, DTOs, documentation, and response format used by the existing services (Products, Categories, Users, etc.).

Keep the API documentation up to date.

---

## Quote Creation

Implement:

```http
POST /api/quotes
```

This endpoint is intended for customers requesting a custom neon quote.

The request body should be of type:

```TypeScript
CustomQuoteRequestData
```

### Behavior

When a request is received:

- Create a new `Quote`.
- Populate all fields coming from `CustomQuoteRequestData`.
- Automatically set:
  - `status = QuoteStatus.SUBMITTED`
  - `createdAt`
  - `updatedAt`
- Every property that does not exist in `CustomQuoteRequestData` should remain empty (`null` or `undefined`, whichever is already used throughout the project).
- Do **not** require authentication. Guests should be able to submit quote requests.

---

## List Quotes

Implement:

```http
GET /api/quotes
```

For each Quote return this information:

```TypeScript
{
  status: QuoteStatus;
  clientId: User["id"];
  fullName: string;
  email: string;
  phoneNumber: string;
  isCustom: boolean;
  price: number;
  createdAt: Date;
  updatedAt: Date;
}
```

Follow the same pagination implementation used by the other list endpoints.

### Filters

Support the following optional filters:

```TypeScript
clientId?: User['id'];
status?: QuoteStatus;
search?: string;
```

#### Search

The `search` parameter should perform a case-insensitive search against:

- `fullName`
- `notes`

---

### Sorting

Support:

```TypeScript
sortBy?:
  | 'price'
  | 'status'
  | 'createdAt'
  | 'updatedAt'
  | 'fullName';

sortDirection?: 'asc' | 'desc';
```

Default sorting:

```
createdAt DESC
```

(show newest quotes first).

Sorting should always be applied before pagination.

---

## Get Quote

Implement:

```http
GET /api/quotes/:id
```

Returns a single quote (all information) by its ID.

Return the standard API response format already used throughout the project.

---

## Update Quote

Implement:

```http
PUT /api/quotes/:id
```

The request body should contain the complete `Quote` object.

The backend should:

- update the quote
- automatically update `updatedAt`

---

## Delete Quote

Implement:

```http
DELETE /api/quotes/:id
```

Follow the same deletion strategy already used by the rest of the project (hard delete or soft delete, whichever is currently the project standard).

---

## Validation

Reuse the same validation approach used throughout the API.

Create DTOs where appropriate.

Validate:

- required fields
- enum values
- numeric fields
- arrays
- nested objects

---

## Permissions

Follow the existing authorization rules.

Suggested behavior:

| Endpoint           | Guest | Client                    | Admin | Super |
| ------------------ | ----- | ------------------------- | ----- | ----- |
| POST /quotes       | ✅    | ✅                        | ✅    | ✅    |
| GET /quotes        | ❌    | Own quotes only           | ✅    | ✅    |
| GET /quotes/:id    | ❌    | Own quote only            | ✅    | ✅    |
| PUT /quotes/:id    | ❌    | Own quote only (optional) | ✅    | ✅    |
| DELETE /quotes/:id | ❌    | ❌                        | ✅    | ✅    |

Reuse the project's existing permission guards instead of implementing new authorization logic.

---

## Types

Use the following types exactly as defined:

```TypeScript
export type CustomQuoteRequestData = CustomNeon & {
  isCustom?: boolean;
  fullName: string;
  email: string;
  phoneNumber: string;
  clientId?: User["id"];
  width?: number;
  height?: number;
  images?: string[];
  sizeUnit?: string;
};

export type NeonSize = {
  width: number;
  maxCharacters: number;
  default?: boolean;
};

export type CustomNeon = {
  id?: number;
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

export type NeonTextConfig = {
  text: string;
  color: Color;
  font: Font;
  size?: string;
  letterSpacing?: number;
  lineHeight?: number;
  italics?: boolean;
  uppercase?: boolean;
  horizontalPosition?: number;
  verticalPosition?: number;
};

export type Font = {
  class: string;
  complexity: number;
  name: string;
  upperDiffersFromLowercase: number;
};

export interface Quote extends CustomQuoteRequestData {
  price: number;
  status: QuoteStatus;
  descriptionQuote?: string;
  descriptionPrice?: number;
  descriptionSuggestedPrice?: number;
  widthQuote?: number;
  heightQuote?: number;
  sizePrice?: number;
  sizeSuggestedPrice?: number;
  waterproofQuote?: boolean;
  waterproofPrice?: number;
  waterproofSuggestedPrice?: number;
  backboardStyleQuote?: string;
  backboardStylePrice?: number;
  backboardStyleSuggestedPrice?: number;
  backboardColorQuote?: string;
  backboardColorPrice?: number;
  backboardColorSuggestedPrice?: number;
  mockUpQuote?: string[];
  mockUpPrice?: number;
  mockUpSuggestedPrice?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export enum QuoteStatus {
  /** The customer has not yet submitted the request (optional; this status may exist only on the front end). */
  DRAFT,
  /** The request was submitted and is awaiting attention. */
  SUBMITTED,
  /** The team is evaluating feasibility and cost. */
  UNDER_REVIEW,
  /** Information or approval from the customer is missing. */
  WAITING_FOR_CUSTOMER,
  /** A quote with a price and validity period was sent. */
  QUOTED,
  /** The customer accepted the quote. */
  ACCEPTED,
  /** The quote was converted into an order. */
  CONVERTED_TO_ORDER,
  /** The company cannot carry out the project. */
  REJECTED,
  /** The client decided not to proceed. */
  CANCELLED,
  /** The quote has expired. */
  EXPIRED,
}
```

🤖

# Done. The Quotes resource is fully implemented, following the existing architecture end-to-end, migrated, and smoke-tested against the live server.

## What was added

### Data layer

- prisma/schema.prisma — new Quote model (request half + staff-filled quote/pricing half) with an optional client relation to User (onDelete: SetNull so guest quotes survive user deletion). neonTexts/size are Json; images/mockUpQuote are text arrays; status is the numeric QuoteStatus (default 1 = SUBMITTED); price defaults to 0.
- prisma/migrations/20260704120000_add_quote/migration.sql — applied to the dev DB via migrate deploy.

### Application layer (strict route → controller → service → Prisma)

- src/services/quote.service.ts — QuoteStatus enum, DTOs, deep validation (required fields, email, enum, numbers, string arrays, nested neonTexts/font/size), normalization, and CRUD with pagination, clientId/status/search filters, and sortBy/sortDirection (default createdAt desc).
- src/controllers/quote.controller.ts — thin adapters; clients scoped to their own quotes; ownership decided from the stored owner, never the body.
- src/routes/quote.routes.ts + src/routes/index.ts — POST public; GET/PUT authenticated with controller ownership checks; DELETE authorize("super","admin").
- src/utils/authorization.ts — canAccessQuote (staff or owner; guest quotes are staff-only).

### Docs — src/swagger.ts (tag, quoteId param, QuoteRequest/QuoteInput/Quote/QuoteListItem/response schemas, all paths, updated permission matrix) and README.md (Quotes section, status table, field reference, permission matrix row).

## Verification

- tsc --noEmit → clean (exit 0).
- Live tests: POST /api/quotes (guest) → 201 with status=1, price=0, trimmed name, lowercased email, JSON stored, quote-half empty; GET/DELETE without token → 401; invalid email and malformed neonTexts.font → 400. Test row cleaned up afterward.

## Two notes

- Permissions: I followed your suggested matrix, where DELETE is admin + super (not super-only like Orders) and clients may update their own quote. Say the word if you'd rather match Orders (super-only delete, staff-only update).
- List includes id: your spec's list shape didn't list id, but I included it (alongside the specified fields) since the client needs it to call GET /quotes/:id. Easy to drop if you want it strictly per-spec.
- One environment aside: prisma generate couldn't swap the query-engine .dll because your running npm run dev and Prisma Studio hold it locked — harmless here (the binary is version-tied and unchanged; the TS types and runtime client did regenerate, and the server served the new routes). If you ever see stale Prisma types, stop those two processes and re-run npm run prisma:generate.
