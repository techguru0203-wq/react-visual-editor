/*
  Warnings:

  - You are about to drop the column `document_id` on the `creditActions` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "creditActions_user_id_organization_id_action_document_id_st_idx";

-- DropIndex
DROP INDEX "organizations_subscription_tier_subscription_status_status__idx";

-- AlterTable
ALTER TABLE "creditActions" DROP COLUMN "document_id";

-- CreateIndex
CREATE INDEX "creditActions_user_id_organization_id_action_status_idx" ON "creditActions"("user_id", "organization_id", "action", "status");

-- CreateIndex
CREATE INDEX "organizations_subscription_tier_subscription_status_api_key_idx" ON "organizations"("subscription_tier", "subscription_status", "api_key", "status", "stripe_customer_id");
