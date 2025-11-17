-- AlterTable
ALTER TABLE "OpenLiquorBottle" ADD COLUMN     "batch_id" INTEGER;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "purchaseBatchId" INTEGER;

-- AddForeignKey
ALTER TABLE "OpenLiquorBottle" ADD CONSTRAINT "OpenLiquorBottle_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "PurchaseBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_purchaseBatchId_fkey" FOREIGN KEY ("purchaseBatchId") REFERENCES "PurchaseBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
