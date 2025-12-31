-- AlterEnum
ALTER TYPE "SubscriptionStatus" ADD VALUE 'TRIAL';

-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "subscription_tier" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "subscription_tier" DROP DEFAULT;
