-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'OVERDUE', 'EXPIRED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELED', 'REFUNDED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "googleAuthId" TEXT,
ADD COLUMN     "subscription_status" "SubscriptionStatus",
ADD COLUMN     "subscription_tier" "SubscriptionTier";

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "payer_user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "subscription_tier" "SubscriptionTier" NOT NULL,
    "seats" INTEGER NOT NULL DEFAULT 1,
    "amount" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "subscriber_user_id" TEXT NOT NULL,
    "subscription_tier" "SubscriptionTier" NOT NULL,
    "subscription_status" "SubscriptionStatus" NOT NULL,
    "payment_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_payer_user_id_fkey" FOREIGN KEY ("payer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_subscriber_user_id_fkey" FOREIGN KEY ("subscriber_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
