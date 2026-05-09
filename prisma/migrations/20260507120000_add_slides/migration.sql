-- Slides table for homepage carousel management.
-- position is unique and sequential; use the reorder endpoint to change order.

CREATE TABLE "Slide" (
    "id" SERIAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "styleClass" TEXT,
    "title" TEXT,
    "description" TEXT,
    "buttonLabel" TEXT,
    "route" TEXT,
    "innerHtml" TEXT,
    "justifyContent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Slide_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Slide_position_key" ON "Slide"("position");
