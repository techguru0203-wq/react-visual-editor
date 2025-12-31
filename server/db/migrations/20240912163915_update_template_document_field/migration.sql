/*
  Warnings:

  - You are about to drop the column `templateIssueId` on the `templateDocuments` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "templateDocuments" DROP CONSTRAINT "templateDocuments_templateIssueId_fkey";

-- DropIndex
DROP INDEX "templateDocuments_organization_id_templateIssueId_creator_u_idx";

-- AlterTable
ALTER TABLE "templateDocuments" DROP COLUMN "templateIssueId",
ADD COLUMN     "template_issue_id" TEXT;

-- CreateIndex
CREATE INDEX "templateDocuments_organization_id_template_issue_id_creator_idx" ON "templateDocuments"("organization_id", "template_issue_id", "creator_user_id");

-- AddForeignKey
ALTER TABLE "templateDocuments" ADD CONSTRAINT "templateDocuments_template_issue_id_fkey" FOREIGN KEY ("template_issue_id") REFERENCES "templateIssues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
