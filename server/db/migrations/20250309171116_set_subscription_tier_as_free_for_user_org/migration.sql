/*
  Warnings:

  - Made the column `subscription_status` on table `organizations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `subscription_tier` on table `organizations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `subscription_status` on table `users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `subscription_tier` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "subscription_status" SET NOT NULL,
ALTER COLUMN "subscription_tier" SET NOT NULL;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "subscription_status" SET NOT NULL,
ALTER COLUMN "subscription_tier" SET NOT NULL;
