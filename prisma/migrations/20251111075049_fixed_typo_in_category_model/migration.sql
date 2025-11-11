/*
  Warnings:

  - You are about to drop the column `is_liqour` on the `Category` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Category" DROP COLUMN "is_liqour",
ADD COLUMN     "is_liquor" BOOLEAN NOT NULL DEFAULT false;
