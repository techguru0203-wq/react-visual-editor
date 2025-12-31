-- DropIndex
DROP INDEX "comments_issue_id_idx";

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "event_id" TEXT;

-- CreateIndex
CREATE INDEX "comments_issue_id_user_id_idx" ON "comments"("issue_id", "user_id");

-- CreateIndex
CREATE INDEX "creditActions_user_id_organization_id_action_status_idx" ON "creditActions"("user_id", "organization_id", "action", "status");

-- CreateIndex
CREATE INDEX "documents_project_id_issue_id_creator_user_id_status_idx" ON "documents"("project_id", "issue_id", "creator_user_id", "status");

-- CreateIndex
CREATE INDEX "issues_project_id_work_plan_id_owner_user_id_creator_user_i_idx" ON "issues"("project_id", "work_plan_id", "owner_user_id", "creator_user_id", "parent_issue_id", "status");

-- CreateIndex
CREATE INDEX "organizations_subscription_tier_subscription_status_status__idx" ON "organizations"("subscription_tier", "subscription_status", "status", "stripe_customer_id");

-- CreateIndex
CREATE INDEX "payments_payer_user_id_organization_id_type_status_event_id_idx" ON "payments"("payer_user_id", "organization_id", "type", "status", "event_id");

-- CreateIndex
CREATE INDEX "projects_organization_id_creator_user_id_owner_user_id_temp_idx" ON "projects"("organization_id", "creator_user_id", "owner_user_id", "template_project_id", "team_id");

-- CreateIndex
CREATE INDEX "specialties_organization_id_name_status_idx" ON "specialties"("organization_id", "name", "status");

-- CreateIndex
CREATE INDEX "teams_organization_id_parent_team_id_idx" ON "teams"("organization_id", "parent_team_id");

-- CreateIndex
CREATE INDEX "templateDocuments_organization_id_templateIssueId_creator_u_idx" ON "templateDocuments"("organization_id", "templateIssueId", "creator_user_id");

-- CreateIndex
CREATE INDEX "templateIssues_template_project_id_creator_user_id_idx" ON "templateIssues"("template_project_id", "creator_user_id");

-- CreateIndex
CREATE INDEX "templateProjects_organization_id_creator_user_id_idx" ON "templateProjects"("organization_id", "creator_user_id");

-- CreateIndex
CREATE INDEX "users_organization_id_email_role_specialty_status_subscript_idx" ON "users"("organization_id", "email", "role", "specialty", "status", "subscription_tier");

-- CreateIndex
CREATE INDEX "workPlans_project_id_parent_work_plan_id_creator_user_id_ow_idx" ON "workPlans"("project_id", "parent_work_plan_id", "creator_user_id", "owner_user_id");
