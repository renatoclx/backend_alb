/*
  Warnings:

  - Added the required column `type` to the `products` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('SALE', 'RENTAL');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "type" "ProductType" NOT NULL,
ALTER COLUMN "salePrice" DROP NOT NULL,
ALTER COLUMN "rentalPrice" DROP NOT NULL;
