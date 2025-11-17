/*
  Warnings:

  - Added the required column `amount` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Made the column `billId` on table `Payment` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "PaymentMethods" AS ENUM ('CASH', 'UPI', 'CREDITCARD', 'DEBITCARD');

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_billId_fkey";

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "amount" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "method" "PaymentMethods" NOT NULL DEFAULT 'CASH',
ADD COLUMN     "referenceNo" TEXT,
ALTER COLUMN "billId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
