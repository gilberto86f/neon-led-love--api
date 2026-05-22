-- Replace firstName / paternalLastName / maternalLastName with a single fullName.

-- 1. Add fullName as nullable so existing rows are not violated.
ALTER TABLE "User" ADD COLUMN "fullName" TEXT;

-- 2. Backfill fullName from the existing name columns (trimmed and collapsed whitespace).
UPDATE "User"
SET "fullName" = TRIM(REGEXP_REPLACE(
  CONCAT_WS(' ', "firstName", "paternalLastName", "maternalLastName"),
  '\s+', ' ', 'g'
));

-- 3. Now that every row has a value, enforce NOT NULL.
ALTER TABLE "User" ALTER COLUMN "fullName" SET NOT NULL;

-- 4. Drop the legacy columns.
ALTER TABLE "User" DROP COLUMN "firstName";
ALTER TABLE "User" DROP COLUMN "paternalLastName";
ALTER TABLE "User" DROP COLUMN "maternalLastName";
