-- CreateTable
CREATE TABLE "ProductColorOption" (
    "id" SERIAL NOT NULL,
    "description" TEXT NOT NULL,
    "colors" JSONB NOT NULL,
    "defaultColor" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "productId" INTEGER NOT NULL,

    CONSTRAINT "ProductColorOption_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ProductColorOption" ADD CONSTRAINT "ProductColorOption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
