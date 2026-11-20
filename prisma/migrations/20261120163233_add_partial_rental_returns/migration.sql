-- AlterEnum
ALTER TYPE "RentalStatus" ADD VALUE 'PARTIALLY_RETURNED';

-- CreateTable
CREATE TABLE "rental_returns" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "returnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_return_items" (
    "id" TEXT NOT NULL,
    "rentalReturnId" TEXT NOT NULL,
    "rentalItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "rental_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rental_returns_rentalId_idx" ON "rental_returns"("rentalId");

-- CreateIndex
CREATE INDEX "rental_return_items_rentalReturnId_idx" ON "rental_return_items"("rentalReturnId");

-- CreateIndex
CREATE INDEX "rental_return_items_rentalItemId_idx" ON "rental_return_items"("rentalItemId");

-- AddForeignKey
ALTER TABLE "rental_returns" ADD CONSTRAINT "rental_returns_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "rentals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_return_items" ADD CONSTRAINT "rental_return_items_rentalReturnId_fkey" FOREIGN KEY ("rentalReturnId") REFERENCES "rental_returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_return_items" ADD CONSTRAINT "rental_return_items_rentalItemId_fkey" FOREIGN KEY ("rentalItemId") REFERENCES "rental_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
