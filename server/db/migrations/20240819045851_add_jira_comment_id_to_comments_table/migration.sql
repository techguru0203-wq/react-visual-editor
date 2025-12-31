/*
  Warnings:

  - A unique constraint covering the columns `[jira_comment_id]` on the table `comments` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "jira_comment_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "comments_jira_comment_id_key" ON "comments"("jira_comment_id");
