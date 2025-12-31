/*
  Warnings:

  - You are about to drop the column `password` on the `users` table. All the data in the column will be lost.
  - Made the column `organization_id` on table `templateDocuments` required. This step will fail if there are existing NULL values in that column.
  - Made the column `template_project_id` on table `templateIssues` required. This step will fail if there are existing NULL values in that column.
  - Made the column `organization_id` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "templateDocuments" DROP CONSTRAINT "templateDocuments_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "templateIssues" DROP CONSTRAINT "templateIssues_template_project_id_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_organization_id_fkey";

-- AlterTable
ALTER TABLE "documents" ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "description" DROP DEFAULT;

-- AlterTable
ALTER TABLE "issues" ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "description" DROP DEFAULT;

-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "description" DROP DEFAULT,
ALTER COLUMN "website" DROP NOT NULL,
ALTER COLUMN "website" DROP DEFAULT;

-- AlterTable
ALTER TABLE "projects" ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "description" DROP DEFAULT;

-- AlterTable
ALTER TABLE "teams" ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "description" DROP DEFAULT;

-- AlterTable
ALTER TABLE "templateDocuments" ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "description" DROP DEFAULT,
ALTER COLUMN "organization_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "templateIssues"
ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "description" DROP DEFAULT,
ALTER COLUMN "template_project_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "templateProjects" ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "description" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "password",
ALTER COLUMN "username" DROP DEFAULT,
ALTER COLUMN "specialty" DROP NOT NULL,
ALTER COLUMN "specialty" DROP DEFAULT,
ALTER COLUMN "velocity" DROP NOT NULL,
ALTER COLUMN "velocity" DROP DEFAULT,
ALTER COLUMN "organization_id" SET NOT NULL,
ALTER COLUMN "firstname" DROP DEFAULT,
ALTER COLUMN "lastname" DROP DEFAULT;

-- AlterTable
ALTER TABLE "workPlans" ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "description" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templateIssues" ADD CONSTRAINT "templateIssues_template_project_id_fkey" FOREIGN KEY ("template_project_id") REFERENCES "templateProjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_template_issue_id_fkey" FOREIGN KEY ("template_issue_id") REFERENCES "templateIssues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templateDocuments" ADD CONSTRAINT "templateDocuments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
