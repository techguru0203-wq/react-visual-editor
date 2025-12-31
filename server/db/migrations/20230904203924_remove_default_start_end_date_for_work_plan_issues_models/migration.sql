-- AlterTable
ALTER TABLE "issues" ALTER COLUMN "actual_end_date" DROP DEFAULT,
ALTER COLUMN "actual_start_date" DROP DEFAULT,
ALTER COLUMN "planned_end_date" DROP DEFAULT,
ALTER COLUMN "planned_start_date" DROP DEFAULT;

-- AlterTable
ALTER TABLE "workPlans" ALTER COLUMN "planned_start_date" DROP DEFAULT,
ALTER COLUMN "planned_end_date" DROP DEFAULT,
ALTER COLUMN "actual_start_date" DROP DEFAULT,
ALTER COLUMN "actual_end_date" DROP DEFAULT;
