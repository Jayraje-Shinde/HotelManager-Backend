/*
  Warnings:

  - You are about to drop the column `paymentMode` on the `Bill` table. All the data in the column will be lost.
  - You are about to drop the column `role_name` on the `Role` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `Role` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `Role` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentMethods" ADD VALUE 'BANK_TRANSFER';
ALTER TYPE "PaymentMethods" ADD VALUE 'CHEQUE';

-- DropForeignKey
ALTER TABLE "Bill" DROP CONSTRAINT "Bill_customer_id_fkey";

-- DropIndex
DROP INDEX "Role_role_name_key";

-- AlterTable
ALTER TABLE "Bill" DROP COLUMN "paymentMode";

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "credit_limit" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "amount_paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "payment_status" "PurchasePaymentStatus" NOT NULL DEFAULT 'PAID';

-- AlterTable
ALTER TABLE "PurchasePayment" ADD COLUMN     "reference" TEXT;

-- AlterTable
ALTER TABLE "Role" DROP COLUMN "role_name",
ADD COLUMN     "name" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Bill_customer_id_idx" ON "Bill"("customer_id");

-- CreateIndex
CREATE INDEX "Payment_billId_idx" ON "Payment"("billId");

-- CreateIndex
CREATE INDEX "Purchase_payment_status_idx" ON "Purchase"("payment_status");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
