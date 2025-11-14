/*
  Warnings:

  - Added the required column `name` to the `Vendor` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "contact" TEXT,
ADD COLUMN     "license_no" TEXT,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "type" TEXT;
