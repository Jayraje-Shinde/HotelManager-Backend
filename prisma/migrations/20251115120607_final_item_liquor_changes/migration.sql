/*
  Warnings:

  - You are about to drop the column `created_at` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `duty_per_unit` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `Item` table. All the data in the column will be lost.
  - Made the column `tax_rate` on table `Item` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Item" DROP COLUMN "created_at",
DROP COLUMN "duty_per_unit",
DROP COLUMN "updated_at",
ADD COLUMN     "is_liquor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "manage_stock" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "ml_per_unit" INTEGER,
ADD COLUMN     "parent_id" INTEGER,
ADD COLUMN     "price_180ml" DOUBLE PRECISION,
ADD COLUMN     "price_30ml" DOUBLE PRECISION,
ADD COLUMN     "price_375ml" DOUBLE PRECISION,
ADD COLUMN     "price_60ml" DOUBLE PRECISION,
ADD COLUMN     "price_90ml" DOUBLE PRECISION,
ADD COLUMN     "variant_ml" INTEGER,
ALTER COLUMN "tax_rate" SET NOT NULL,
ALTER COLUMN "stock" DROP NOT NULL,
ALTER COLUMN "stock" DROP DEFAULT;

-- CreateTable
CREATE TABLE "OpenLiquorBottle" (
    "id" SERIAL NOT NULL,
    "item_id" INTEGER NOT NULL,
    "ml_remaining" INTEGER NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'open',

    CONSTRAINT "OpenLiquorBottle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" SERIAL NOT NULL,
    "table_no" TEXT NOT NULL,
    "user_id" INTEGER,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentMode" TEXT,
    "bill_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillItem" (
    "id" SERIAL NOT NULL,
    "bill_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "BillItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "bill_id" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "referenceNo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableStatus" (
    "id" SERIAL NOT NULL,
    "table_no" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "current_bill_id" INTEGER,

    CONSTRAINT "TableStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KOT" (
    "id" SERIAL NOT NULL,
    "table_no" TEXT NOT NULL,
    "waiter_id" INTEGER,
    "bill_id" INTEGER,
    "kot_no" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KOT_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KOTItem" (
    "id" SERIAL NOT NULL,
    "kot_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "note" TEXT,

    CONSTRAINT "KOTItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TableStatus_table_no_key" ON "TableStatus"("table_no");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenLiquorBottle" ADD CONSTRAINT "OpenLiquorBottle_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillItem" ADD CONSTRAINT "BillItem_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillItem" ADD CONSTRAINT "BillItem_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableStatus" ADD CONSTRAINT "TableStatus_current_bill_id_fkey" FOREIGN KEY ("current_bill_id") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KOT" ADD CONSTRAINT "KOT_waiter_id_fkey" FOREIGN KEY ("waiter_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KOT" ADD CONSTRAINT "KOT_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KOTItem" ADD CONSTRAINT "KOTItem_kot_id_fkey" FOREIGN KEY ("kot_id") REFERENCES "KOT"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KOTItem" ADD CONSTRAINT "KOTItem_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
