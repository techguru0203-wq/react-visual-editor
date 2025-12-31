-- AlterTable
ALTER TABLE "workPlans" ADD COLUMN     "parent_work_plan_id" TEXT;

-- AddForeignKey
ALTER TABLE "workPlans" ADD CONSTRAINT "workPlans_parent_work_plan_id_fkey" FOREIGN KEY ("parent_work_plan_id") REFERENCES "workPlans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
