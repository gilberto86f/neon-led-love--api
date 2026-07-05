👨‍💻

Could you add the `notes` to the list of properties shown when getting the list of quotes?

🤖

Done. notes is now included in the list projection, kept in sync across all three places:

- quote.service.ts — added notes: true to LIST_SELECT.
- src/swagger.ts — added notes to the QuoteListItem schema.
- README.md — added notes to the compact-shape field list.

Compiles clean. Each list item now returns notes (nullable string) alongside the existing fields.
