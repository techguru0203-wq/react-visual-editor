/*
  Warnings:

  - A unique constraint covering the columns `[jira_id]` on the table `issues` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "issues" ADD COLUMN     "jira_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "issues_jira_id_key" ON "issues"("jira_id");
