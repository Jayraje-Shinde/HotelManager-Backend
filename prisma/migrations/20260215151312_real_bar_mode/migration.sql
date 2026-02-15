/*
  Warnings:

  - You are about to drop the column `breakable` on the `Item` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "SaleMode" AS ENUM ('BOTTLE', 'SHOT');

-- AlterTable
ALTER TABLE "Item" DROP COLUMN "breakable";

-- AlterTable
ALTER TABLE "KOTItem" ADD COLUMN     "ml_per_shot" INTEGER,
ADD COLUMN     "sale_mode" "SaleMode";
