/*
  Warnings:

  - A unique constraint covering the columns `[work_log_id]` on the table `issueChangeHistories` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "issueChangeHistories" ADD COLUMN     "work_log_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "issueChangeHistories_work_log_id_key" ON "issueChangeHistories"("work_log_id");
