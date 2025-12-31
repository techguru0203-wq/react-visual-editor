/*
  Warnings:

  - Added the required column `invoice_url` to the `payments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "subscriptionInterval" SET DEFAULT 'month';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "invoice_url" TEXT NOT NULL;
