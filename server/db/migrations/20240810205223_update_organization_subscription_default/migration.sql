/*
  Warnings:

  - You are about to drop the column `subscriptionInterval` on the `organizations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "organizations" DROP COLUMN "subscriptionInterval",
ADD COLUMN     "subscription_interval" TEXT,
ALTER COLUMN "subscription_status" DROP NOT NULL,
ALTER COLUMN "subscription_status" DROP DEFAULT;
