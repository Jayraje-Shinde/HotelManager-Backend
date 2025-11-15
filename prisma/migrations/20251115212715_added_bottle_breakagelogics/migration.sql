/*
  Warnings:

  - The `status` column on the `Bill` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `KOT` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `OpenLiquorBottle` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `amount` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `bill_id` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `method` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `referenceNo` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `ref_type` on the `StockMovement` table. All the data in the column will be lost.
  - The `status` column on the `TableStatus` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `movement_type` to the `StockMovement` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('PURCHASE', 'SALE', 'BREAKAGE', 'MANUAL_ADJUSTMENT', 'OPEN_BOTTLE');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('OPEN', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TableState" AS ENUM ('VACANT', 'OCCUPIED', 'BILLED');

-- CreateEnum
CREATE TYPE "KOTStatus" AS ENUM ('OPEN', 'SERVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OpenBottleStatus" AS ENUM ('OPEN', 'FINISHED', 'BREAKAGE', 'CLOSED');

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_bill_id_fkey";

-- AlterTable
ALTER TABLE "Bill" DROP COLUMN "status",
ADD COLUMN     "status" "BillStatus" NOT NULL DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "is_variant" BOOLEAN DEFAULT false;

-- AlterTable
ALTER TABLE "KOT" DROP COLUMN "status",
ADD COLUMN     "status" "KOTStatus" NOT NULL DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "OpenLiquorBottle" ADD COLUMN     "breakage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "breakage_reason" TEXT,
ADD COLUMN     "closed_at" TIMESTAMP(3),
DROP COLUMN "status",
ADD COLUMN     "status" "OpenBottleStatus" NOT NULL DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "amount",
DROP COLUMN "bill_id",
DROP COLUMN "created_at",
DROP COLUMN "method",
DROP COLUMN "referenceNo",
ADD COLUMN     "billId" INTEGER;

-- AlterTable
ALTER TABLE "StockMovement" DROP COLUMN "ref_type",
ADD COLUMN     "movement_type" "MovementType" NOT NULL;

-- AlterTable
ALTER TABLE "TableStatus" DROP COLUMN "status",
ADD COLUMN     "status" "TableState" NOT NULL DEFAULT 'VACANT';

-- CreateTable
CREATE TABLE "PurchaseBatch" (
    "id" SERIAL NOT NULL,
    "item_id" INTEGER NOT NULL,
    "purchase_id" INTEGER NOT NULL,
    "qty_total" DOUBLE PRECISION NOT NULL,
    "qty_remaining" DOUBLE PRECISION NOT NULL,
    "cost_price" DOUBLE PRECISION NOT NULL,
    "pack_size" INTEGER NOT NULL,
    "ml_per_bottle" INTEGER,
    "scheme_qty" INTEGER DEFAULT 0,
    "batch_number" TEXT,
    "expiry_date" TIMESTAMP(3),
    "is_duty_paid" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillItemBatch" (
    "id" SERIAL NOT NULL,
    "bill_item_id" INTEGER NOT NULL,
    "purchase_batch_id" INTEGER NOT NULL,
    "qty_used" DOUBLE PRECISION NOT NULL,
    "ml_used" INTEGER,
    "cost_price_at_use" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillItemBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquorShotUsage" (
    "id" SERIAL NOT NULL,
    "bill_item_id" INTEGER NOT NULL,
    "open_bottle_id" INTEGER NOT NULL,
    "ml_used" INTEGER NOT NULL,
    "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiquorShotUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseBatch_item_id_idx" ON "PurchaseBatch"("item_id");

-- CreateIndex
CREATE INDEX "PurchaseBatch_purchase_id_idx" ON "PurchaseBatch"("purchase_id");

-- CreateIndex
CREATE INDEX "BillItemBatch_bill_item_id_idx" ON "BillItemBatch"("bill_item_id");

-- CreateIndex
CREATE INDEX "BillItemBatch_purchase_batch_id_idx" ON "BillItemBatch"("purchase_batch_id");

-- CreateIndex
CREATE INDEX "LiquorShotUsage_bill_item_id_idx" ON "LiquorShotUsage"("bill_item_id");

-- CreateIndex
CREATE INDEX "LiquorShotUsage_open_bottle_id_idx" ON "LiquorShotUsage"("open_bottle_id");

-- CreateIndex
CREATE INDEX "Bill_status_idx" ON "Bill"("status");

-- CreateIndex
CREATE INDEX "Item_category_id_idx" ON "Item"("category_id");

-- CreateIndex
CREATE INDEX "Item_parent_id_idx" ON "Item"("parent_id");

-- CreateIndex
CREATE INDEX "OpenLiquorBottle_item_id_idx" ON "OpenLiquorBottle"("item_id");

-- CreateIndex
CREATE INDEX "Purchase_vendor_id_idx" ON "Purchase"("vendor_id");

-- CreateIndex
CREATE INDEX "StockMovement_item_id_idx" ON "StockMovement"("item_id");

-- CreateIndex
CREATE INDEX "StockMovement_movement_type_idx" ON "StockMovement"("movement_type");

-- CreateIndex
CREATE INDEX "TableStatus_status_idx" ON "TableStatus"("status");

-- CreateIndex
CREATE INDEX "TableStatus_zone_idx" ON "TableStatus"("zone");

-- AddForeignKey
ALTER TABLE "PurchaseBatch" ADD CONSTRAINT "PurchaseBatch_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseBatch" ADD CONSTRAINT "PurchaseBatch_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillItemBatch" ADD CONSTRAINT "BillItemBatch_bill_item_id_fkey" FOREIGN KEY ("bill_item_id") REFERENCES "BillItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillItemBatch" ADD CONSTRAINT "BillItemBatch_purchase_batch_id_fkey" FOREIGN KEY ("purchase_batch_id") REFERENCES "PurchaseBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorShotUsage" ADD CONSTRAINT "LiquorShotUsage_bill_item_id_fkey" FOREIGN KEY ("bill_item_id") REFERENCES "BillItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquorShotUsage" ADD CONSTRAINT "LiquorShotUsage_open_bottle_id_fkey" FOREIGN KEY ("open_bottle_id") REFERENCES "OpenLiquorBottle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
