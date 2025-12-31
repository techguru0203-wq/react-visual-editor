-- AlterEnum
ALTER TYPE "SubscriptionStatus" ADD VALUE 'CANCELED_YET_ACTIVE';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "subscription_status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE';
