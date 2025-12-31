/*
  Warnings:

  - The values [MILESTONE] on the enum `IssueType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `due_date` on the `issues` table. All the data in the column will be lost.
  - You are about to drop the column `end_date` on the `issues` table. All the data in the column will be lost.
  - You are about to drop the column `start_date` on the `issues` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "WorkPlanType" AS ENUM ('MILESTONE', 'SPRINT', 'KANBAN');

-- AlterEnum
BEGIN;
CREATE TYPE "IssueType_new" AS ENUM ('BUILDABLE', 'EPIC', 'STORY', 'TASK', 'SUBTASK', 'BUG');
ALTER TABLE "issues" ALTER COLUMN "type" TYPE "IssueType_new" USING ("type"::text::"IssueType_new");
ALTER TYPE "IssueType" RENAME TO "IssueType_old";
ALTER TYPE "IssueType_new" RENAME TO "IssueType";
DROP TYPE "IssueType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "issues" DROP CONSTRAINT "issues_owner_user_id_fkey";

-- DropIndex
DROP INDEX "issues_parent_issue_id_key";

-- AlterTable
ALTER TABLE "issues" DROP COLUMN "due_date",
DROP COLUMN "end_date",
DROP COLUMN "start_date",
ADD COLUMN     "actual_end_date" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "actual_start_date" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "completed_story_point" INTEGER,
ADD COLUMN     "planned_end_date" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "planned_start_date" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "work_plan_id" TEXT,
ALTER COLUMN "owner_user_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "workPlans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" "WorkPlanType" NOT NULL,
    "story_point" INTEGER,
    "completed_story_point" INTEGER,
    "planned_start_date" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "planned_end_date" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "actual_start_date" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "actual_end_date" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "status" "IssueStatus" NOT NULL DEFAULT 'CREATED',
    "meta" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "project_id" TEXT NOT NULL,
    "creator_user_id" TEXT NOT NULL,
    "owner_user_id" TEXT,

    CONSTRAINT "workPlans_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_work_plan_id_fkey" FOREIGN KEY ("work_plan_id") REFERENCES "workPlans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workPlans" ADD CONSTRAINT "workPlans_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workPlans" ADD CONSTRAINT "workPlans_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workPlans" ADD CONSTRAINT "workPlans_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
