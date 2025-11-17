/*
  Warnings:

  - You are about to drop the `AuditLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_user_id_fkey";

-- DropTable
DROP TABLE "AuditLog";

-- CreateTable
CREATE TABLE "Auditlog" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Auditlog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Auditlog_user_id_idx" ON "Auditlog"("user_id");

-- CreateIndex
CREATE INDEX "Auditlog_action_idx" ON "Auditlog"("action");

-- CreateIndex
CREATE INDEX "Auditlog_created_at_idx" ON "Auditlog"("created_at");

-- AddForeignKey
ALTER TABLE "Auditlog" ADD CONSTRAINT "Auditlog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
