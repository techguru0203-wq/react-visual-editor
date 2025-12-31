-- CreateEnum
CREATE TYPE "WorkPlanStatus" AS ENUM ('CREATED', 'STARTED', 'OVERWRITTEN', 'COMPLETED', 'CANCELED');

-- AlterTable
ALTER TABLE "issues" DROP COLUMN "key";

-- AlterTable
UPDATE "workPlans" SET "status" = 'CREATED' WHERE "status" = 'INREVIEW' OR "status" = 'APPROVED';
ALTER TABLE "workPlans" DROP COLUMN "key";
ALTER TABLE "workPlans" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "workPlans" ALTER COLUMN "status" TYPE "WorkPlanStatus" USING ("status"::text::"WorkPlanStatus");
ALTER TABLE "workPlans" ALTER COLUMN "status" SET DEFAULT 'CREATED';
