-- AlterEnum
ALTER TYPE "KOTStatus" ADD VALUE 'SENT';

-- AlterTable
ALTER TABLE "LiquorShotUsage" ADD COLUMN     "kot_id" INTEGER;
