/*
  Warnings:

  - You are about to drop the column `stripe_customer_id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `subscription_status` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `subscription_tier` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[stripe_customer_id]` on the table `organizations` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "users_stripe_customer_id_key";

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "stripe_customer_id" TEXT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "stripe_customer_id",
DROP COLUMN "subscription_status",
DROP COLUMN "subscription_tier";

-- CreateIndex
CREATE UNIQUE INDEX "organizations_stripe_customer_id_key" ON "organizations"("stripe_customer_id");
