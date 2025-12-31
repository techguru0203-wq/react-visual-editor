-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "subscription_status" SET DEFAULT 'ACTIVE',
ALTER COLUMN "subscription_tier" SET DEFAULT 'FREE';

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "subscription_status" SET DEFAULT 'ACTIVE',
ALTER COLUMN "subscription_tier" SET DEFAULT 'FREE';
