/*
  Warnings:

  - You are about to drop the column `api_key` on the `documents` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "organizations_subscription_tier_subscription_status_status__idx";

-- AlterTable
ALTER TABLE "documents" DROP COLUMN "api_key";

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "api_key" TEXT;

-- CreateIndex
CREATE INDEX "organizations_subscription_tier_subscription_status_status__idx" ON "organizations"("subscription_tier", "subscription_status", "status", "api_key", "stripe_customer_id");
