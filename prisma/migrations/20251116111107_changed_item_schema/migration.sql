/*
  Warnings:

  - You are about to drop the column `duty_per_unit` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `is_variant` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `parent_id` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `price_180ml` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `price_30ml` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `price_375ml` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `price_60ml` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `price_90ml` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `purchase_price` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `variant_ml` on the `Item` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Item" DROP CONSTRAINT "Item_parent_id_fkey";

-- DropIndex
DROP INDEX "Item_category_id_idx";

-- DropIndex
DROP INDEX "Item_parent_id_idx";

-- AlterTable
ALTER TABLE "Item" DROP COLUMN "duty_per_unit",
DROP COLUMN "is_variant",
DROP COLUMN "parent_id",
DROP COLUMN "price_180ml",
DROP COLUMN "price_30ml",
DROP COLUMN "price_375ml",
DROP COLUMN "price_60ml",
DROP COLUMN "price_90ml",
DROP COLUMN "purchase_price",
DROP COLUMN "variant_ml",
ADD COLUMN     "breakable" BOOLEAN DEFAULT false;
