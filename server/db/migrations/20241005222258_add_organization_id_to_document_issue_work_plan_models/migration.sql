-- DropIndex
DROP INDEX "documents_project_id_issue_id_creator_user_id_status_idx";

-- DropIndex
DROP INDEX "issues_project_id_work_plan_id_owner_user_id_creator_user_i_idx";

-- DropIndex
DROP INDEX "workPlans_project_id_parent_work_plan_id_creator_user_id_ow_idx";

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "organization_id" TEXT;

-- AlterTable
ALTER TABLE "issues" ADD COLUMN     "organization_id" TEXT;

-- AlterTable
ALTER TABLE "projects" ALTER COLUMN "access" SET DEFAULT 'SELF';

-- AlterTable
ALTER TABLE "workPlans" ADD COLUMN     "organization_id" TEXT;

-- CreateIndex
CREATE INDEX "documents_project_id_issue_id_creator_user_id_organization__idx" ON "documents"("project_id", "issue_id", "creator_user_id", "organization_id", "status");

-- CreateIndex
CREATE INDEX "issues_project_id_work_plan_id_owner_user_id_creator_user_i_idx" ON "issues"("project_id", "work_plan_id", "owner_user_id", "creator_user_id", "organization_id", "parent_issue_id", "status");

-- CreateIndex
CREATE INDEX "workPlans_project_id_parent_work_plan_id_creator_user_id_ow_idx" ON "workPlans"("project_id", "parent_work_plan_id", "creator_user_id", "owner_user_id", "organization_id");

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workPlans" ADD CONSTRAINT "workPlans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
