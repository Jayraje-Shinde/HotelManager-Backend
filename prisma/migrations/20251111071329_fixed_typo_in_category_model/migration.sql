/*
  Warnings:

  - You are about to drop the column `is_liquour` on the `Category` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Category" DROP COLUMN "is_liquour",
ADD COLUMN     "is_liqour" BOOLEAN NOT NULL DEFAULT false;
