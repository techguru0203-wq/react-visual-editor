/*
  Warnings:

  - A unique constraint covering the columns `[jira_sprint_id]` on the table `workPlans` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "workPlans" ADD COLUMN     "jira_sprint_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "workPlans_jira_sprint_id_key" ON "workPlans"("jira_sprint_id");
