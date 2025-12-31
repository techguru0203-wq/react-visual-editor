-- AlterTable
ALTER TABLE "issues" ADD COLUMN     "completed_work_percentage" INTEGER,
ADD COLUMN     "key" TEXT;

-- AlterTable
ALTER TABLE "workPlans" ADD COLUMN     "key" TEXT;
