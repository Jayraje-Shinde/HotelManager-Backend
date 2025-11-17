-- DropForeignKey
ALTER TABLE "LiquorShotUsage" DROP CONSTRAINT "LiquorShotUsage_bill_item_id_fkey";

-- AlterTable
ALTER TABLE "LiquorShotUsage" ALTER COLUMN "bill_item_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "LiquorShotUsage" ADD CONSTRAINT "LiquorShotUsage_bill_item_id_fkey" FOREIGN KEY ("bill_item_id") REFERENCES "BillItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorShotUsage" ADD CONSTRAINT "LiquorShotUsage_kot_id_fkey" FOREIGN KEY ("kot_id") REFERENCES "KOT"("id") ON DELETE SET NULL ON UPDATE CASCADE;
