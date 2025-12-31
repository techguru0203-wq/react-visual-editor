/*
  Warnings:

  - A unique constraint covering the columns `[jira_id]` on the table `projects` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "jira_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "projects_jira_id_key" ON "projects"("jira_id");
