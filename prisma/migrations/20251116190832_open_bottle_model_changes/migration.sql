/*
  Warnings:

  - You are about to drop the column `batch_id` on the `StockMovement` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_batch_id_fkey";

-- AlterTable
ALTER TABLE "OpenLiquorBottle" ADD COLUMN     "batch_id" INTEGER;

-- AlterTable
ALTER TABLE "StockMovement" DROP COLUMN "batch_id",
ADD COLUMN     "purchaseBatchId" INTEGER;

-- AddForeignKey
ALTER TABLE "OpenLiquorBottle" ADD CONSTRAINT "OpenLiquorBottle_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "PurchaseBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_purchaseBatchId_fkey" FOREIGN KEY ("purchaseBatchId") REFERENCES "PurchaseBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
