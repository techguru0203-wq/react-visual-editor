-- CreateEnum
CREATE TYPE "Access" AS ENUM ('SELF', 'TEAM', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "TemplateAccess" AS ENUM ('SELF', 'ORGANIZATION', 'PUBLIC');

-- AlterTable
ALTER TABLE "documents" RENAME COLUMN "access" TO "access_old";
ALTER TABLE "documents" ADD COLUMN "access" "Access" NOT NULL DEFAULT 'ORGANIZATION';
UPDATE "documents" SET "access_old" = 'ORGANIZATION' WHERE "access_old" IN ('PUBLIC', 'DEPARTMENT');
UPDATE "documents" SET "access" = "access_old"::TEXT::"Access";
ALTER TABLE "documents"
  DROP COLUMN "access_old",
  DROP COLUMN "permission";

-- AlterTable
ALTER TABLE "projects" RENAME COLUMN "access" TO "access_old";
ALTER TABLE "projects" ADD COLUMN "access" "Access" NOT NULL DEFAULT 'ORGANIZATION';
UPDATE "projects" SET "access_old" = 'ORGANIZATION' WHERE "access_old" IN ('PUBLIC', 'DEPARTMENT');
UPDATE "projects" SET "access" = "access_old"::TEXT::"Access";
ALTER TABLE "projects" DROP COLUMN "access_old";

-- AlterTable
ALTER TABLE "teams" ADD COLUMN "parent_team_id" TEXT;

-- AlterTable
ALTER TABLE "templateDocuments" RENAME COLUMN "access" TO "access_old";
ALTER TABLE "templateDocuments" ADD COLUMN "access" "TemplateAccess" NOT NULL DEFAULT 'ORGANIZATION';
UPDATE "templateDocuments" SET "access_old" = 'ORGANIZATION' WHERE "access_old" IN ('TEAM', 'DEPARTMENT');
UPDATE "templateDocuments" SET "access" = "access_old"::TEXT::"TemplateAccess";
ALTER TABLE "templateDocuments"
  DROP COLUMN "access_old",
  DROP COLUMN "permission";

-- AlterTable
ALTER TABLE "templateProjects" RENAME COLUMN "access" TO "access_old";
ALTER TABLE "templateProjects" ADD COLUMN "access" "TemplateAccess" NOT NULL DEFAULT 'ORGANIZATION';
UPDATE "templateProjects" SET "access_old" = 'ORGANIZATION' WHERE "access_old" IN ('TEAM', 'DEPARTMENT');
UPDATE "templateProjects" SET "access" = "access_old"::TEXT::"TemplateAccess";
ALTER TABLE "templateProjects"
  DROP COLUMN "access_old",
  DROP COLUMN "permission";

-- DropEnum
DROP TYPE "ACCESS";

-- DropEnum
DROP TYPE "CATEGORY";

-- DropEnum
DROP TYPE "PERMISSION";

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_parent_team_id_fkey" FOREIGN KEY ("parent_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
