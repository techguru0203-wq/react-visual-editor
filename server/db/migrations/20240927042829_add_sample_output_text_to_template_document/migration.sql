/*
  Warnings:

  - You are about to drop the column `template_issue_id` on the `templateDocuments` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "templateDocuments" DROP CONSTRAINT "templateDocuments_template_issue_id_fkey";

-- DropIndex
DROP INDEX "templateDocuments_organization_id_template_issue_id_creator_idx";

-- AlterTable
ALTER TABLE "templateDocuments" DROP COLUMN "template_issue_id",
ADD COLUMN     "sample_output_text" TEXT,
ADD COLUMN     "templateIssueId" TEXT,
ALTER COLUMN "prompt_text" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "templateDocuments_organization_id_creator_user_id_idx" ON "templateDocuments"("organization_id", "creator_user_id");

-- AddForeignKey
ALTER TABLE "templateDocuments" ADD CONSTRAINT "templateDocuments_templateIssueId_fkey" FOREIGN KEY ("templateIssueId") REFERENCES "templateIssues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
