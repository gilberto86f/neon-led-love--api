👨‍💻

Could you change the Quote permissions to match Orders (super-only delete, staff-only update)?

🤖

Done. Quote permissions now match Orders exactly:

Endpoint Guest Client Admin Super
POST /quotes ✅ ✅ ✅ ✅
GET /quotes, /quotes/:id ❌ own only ✅ ✅
PUT /quotes/:id ❌ ❌ ✅ ✅
DELETE /quotes/:id ❌ ❌ ❌ ✅

Changes:

- quote.routes.ts — PUT → authorize("super","admin"), DELETE → authorize("super").
- quote.controller.ts — dropped the ownership check in update (now staff-only, like Orders); getById keeps its client-ownership check.
- src/swagger.ts — permission matrix, Quotes tag, and PUT/DELETE descriptions.
- README.md — permission matrix rows, access note, and the Quote-fields PUT line.

Verified: tsc --noEmit clean, and PUT/DELETE without a token return 401.
