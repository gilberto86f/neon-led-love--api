-- `Order.status` moves from the legacy string enum to the numeric OrderStatus
-- enum. The column is converted **in place** (not dropped and recreated), so no
-- existing order loses its state. Legacy value -> new value:
--   'pending'    -> 0  PENDING_PAYMENT      'shipped'   -> 7  SHIPPED
--   'paid'       -> 1  PAID                 'delivered' -> 8  DELIVERED
--   'processing' -> 3  PENDING_PRODUCTION   'cancelled' -> 9  CANCELLED
--                                           'refunded'  -> 10 REFUNDED
-- 'processing' maps to the earlier of the two production states so nothing is
-- reported as further along than it really is; staff can advance it afterwards.
ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Order"
  ALTER COLUMN "status" TYPE INTEGER
  USING (
    CASE "status"
      WHEN 'pending'    THEN 0
      WHEN 'paid'       THEN 1
      WHEN 'processing' THEN 3
      WHEN 'shipped'    THEN 7
      WHEN 'delivered'  THEN 8
      WHEN 'cancelled'  THEN 9
      WHEN 'refunded'   THEN 10
      ELSE 0
    END
  );

ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "previousStatus" INTEGER,
    "newStatus" INTEGER NOT NULL,
    "changedByUser" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_createdAt_idx" ON "OrderStatusHistory"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_createdAt_idx" ON "OrderStatusHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: give every pre-existing order an opening history row, so the
-- invariant "Order.status always has a matching history entry" holds for old
-- rows too. `previousStatus` is NULL — there was no earlier state on record.
INSERT INTO "OrderStatusHistory" ("orderId", "previousStatus", "newStatus", "changedByUser", "comment", "createdAt")
SELECT "id", NULL, "status", 'system', 'Backfilled when order status history was introduced.', "createdAt"
FROM "Order";
