/*
  Warnings:

  - You are about to drop the `subscriptions` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `invoice_id` to the `payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `payment_method` to the `payments` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_payment_id_fkey";

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_subscriber_user_id_fkey";

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "subscriptionInterval" TEXT DEFAULT 'monthly';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "invoice_id" TEXT NOT NULL,
ADD COLUMN     "organization_id" TEXT NOT NULL,
ADD COLUMN     "payment_method" TEXT NOT NULL;

-- DropTable
DROP TABLE "subscriptions";

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
