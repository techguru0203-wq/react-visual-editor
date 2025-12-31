-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPERADMIN', 'ADMIN', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'DEACTIVATED', 'READ');

-- CreateEnum
CREATE TYPE "Department" AS ENUM ('Product', 'Engineering', 'Sales', 'Marketing', 'Operation');

-- CreateEnum
CREATE TYPE "ACCESS" AS ENUM ('SELF', 'TEAM', 'DEPARTMENT', 'ORGANIZATION', 'PUBLIC');

-- CreateEnum
CREATE TYPE "PERMISSION" AS ENUM ('READ', 'EDIT', 'USE');

-- CreateEnum
CREATE TYPE "CATEGORY" AS ENUM ('EDIT', 'USE');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('CREATED', 'STARTED', 'PAUSED', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('CREATED', 'STARTED', 'INREVIEW', 'APPROVED', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "IssueType" AS ENUM ('BUILDABLE', 'MILESTONE', 'EPIC', 'STORY', 'TASK', 'SUBTASK', 'BUG');

-- CreateEnum
CREATE TYPE "DOCTYPE" AS ENUM ('PRD', 'UI_DESIGN', 'TECH_DESIGN', 'DEVELOPMENT_PLAN', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('CREATED', 'INREVIEW', 'APPROVED', 'PUBLISHED', 'CANCELED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "username" TEXT NOT NULL DEFAULT '',
    "department" "Department",
    "role" "UserRole" NOT NULL DEFAULT 'EMPLOYEE',
    "specialty" TEXT NOT NULL DEFAULT '',
    "velocity" INTEGER NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "meta" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "organization_id" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "website" TEXT NOT NULL DEFAULT '',
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "organization_id" TEXT NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "userTeams" (
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "meta" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,

    CONSTRAINT "userTeams_pkey" PRIMARY KEY ("user_id","team_id")
);

-- CreateTable
CREATE TABLE "templateProjects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "rating" INTEGER NOT NULL DEFAULT 0,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "access" "ACCESS" NOT NULL DEFAULT 'ORGANIZATION',
    "permission" "PERMISSION" NOT NULL DEFAULT 'USE',
    "meta" JSONB DEFAULT '{}',
    "status" "ProjectStatus" NOT NULL DEFAULT 'CREATED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "organization_id" TEXT NOT NULL,
    "creator_user_id" TEXT NOT NULL,

    CONSTRAINT "templateProjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templateIssues" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "depth" INTEGER NOT NULL DEFAULT 1,
    "fields" JSONB DEFAULT '{}',
    "status" "IssueStatus" NOT NULL DEFAULT 'CREATED',
    "meta" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "template_project_id" TEXT,
    "creator_user_id" TEXT NOT NULL,

    CONSTRAINT "templateIssues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templateIssueDependencies" (
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "meta" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "dependsOnTemplateIssueId" TEXT NOT NULL,
    "dependedByTemplateIssueId" TEXT NOT NULL,

    CONSTRAINT "templateIssueDependencies_pkey" PRIMARY KEY ("dependsOnTemplateIssueId","dependedByTemplateIssueId")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "story_point" INTEGER,
    "due_date" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "progress" INTEGER DEFAULT 0,
    "access" "ACCESS" NOT NULL DEFAULT 'ORGANIZATION',
    "status" "ProjectStatus" NOT NULL DEFAULT 'CREATED',
    "meta" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "organization_id" TEXT NOT NULL,
    "template_project_id" TEXT,
    "creator_user_id" TEXT NOT NULL,
    "team_id" TEXT,
    "owner_user_id" TEXT,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issues" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "story_point" INTEGER,
    "start_date" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "end_date" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "due_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "type" "IssueType" NOT NULL,
    "status" "IssueStatus" NOT NULL DEFAULT 'CREATED',
    "meta" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "project_id" TEXT NOT NULL,
    "template_issue_id" TEXT,
    "parent_issue_id" TEXT,
    "creator_user_id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,

    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issueDependencies" (
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "meta" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "dependsOnIssueId" TEXT NOT NULL,
    "dependedByIssueId" TEXT NOT NULL,

    CONSTRAINT "issueDependencies_pkey" PRIMARY KEY ("dependsOnIssueId","dependedByIssueId")
);

-- CreateTable
CREATE TABLE "templateDocuments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" "DOCTYPE" NOT NULL,
    "url" TEXT NOT NULL,
    "access" "ACCESS" NOT NULL DEFAULT 'ORGANIZATION',
    "permission" "PERMISSION" NOT NULL DEFAULT 'USE',
    "status" "DocumentStatus" NOT NULL DEFAULT 'CREATED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "organization_id" TEXT,
    "creator_user_id" TEXT NOT NULL,
    "templateIssueId" TEXT,

    CONSTRAINT "templateDocuments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "content" BYTEA DEFAULT '\x',
    "type" "DOCTYPE" NOT NULL,
    "url" TEXT NOT NULL,
    "access" "ACCESS" NOT NULL DEFAULT 'ORGANIZATION',
    "permission" "PERMISSION" NOT NULL DEFAULT 'USE',
    "status" "DocumentStatus" NOT NULL DEFAULT 'CREATED',
    "meta" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "project_id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "creator_user_id" TEXT NOT NULL,
    "template_document_id" TEXT,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_name_key" ON "organizations"("name");

-- CreateIndex
CREATE UNIQUE INDEX "teams_name_key" ON "teams"("name");

-- CreateIndex
CREATE UNIQUE INDEX "issues_parent_issue_id_key" ON "issues"("parent_issue_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "userTeams" ADD CONSTRAINT "userTeams_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "userTeams" ADD CONSTRAINT "userTeams_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templateProjects" ADD CONSTRAINT "templateProjects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templateProjects" ADD CONSTRAINT "templateProjects_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templateIssues" ADD CONSTRAINT "templateIssues_template_project_id_fkey" FOREIGN KEY ("template_project_id") REFERENCES "templateProjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templateIssues" ADD CONSTRAINT "templateIssues_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templateIssueDependencies" ADD CONSTRAINT "templateIssueDependencies_dependsOnTemplateIssueId_fkey" FOREIGN KEY ("dependsOnTemplateIssueId") REFERENCES "templateIssues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templateIssueDependencies" ADD CONSTRAINT "templateIssueDependencies_dependedByTemplateIssueId_fkey" FOREIGN KEY ("dependedByTemplateIssueId") REFERENCES "templateIssues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_template_project_id_fkey" FOREIGN KEY ("template_project_id") REFERENCES "templateProjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_parent_issue_id_fkey" FOREIGN KEY ("parent_issue_id") REFERENCES "issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issueDependencies" ADD CONSTRAINT "issueDependencies_dependsOnIssueId_fkey" FOREIGN KEY ("dependsOnIssueId") REFERENCES "issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issueDependencies" ADD CONSTRAINT "issueDependencies_dependedByIssueId_fkey" FOREIGN KEY ("dependedByIssueId") REFERENCES "issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templateDocuments" ADD CONSTRAINT "templateDocuments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templateDocuments" ADD CONSTRAINT "templateDocuments_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templateDocuments" ADD CONSTRAINT "templateDocuments_templateIssueId_fkey" FOREIGN KEY ("templateIssueId") REFERENCES "templateIssues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_template_document_id_fkey" FOREIGN KEY ("template_document_id") REFERENCES "templateDocuments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
