/*
  Warnings:

  - You are about to drop the column `team_id` on the `payments` table. All the data in the column will be lost.
  - Changed the type of `amount` on the `payments` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "available_seats" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "subscription_end" TIMESTAMP(3),
ADD COLUMN     "subscription_start" TIMESTAMP(3),
ADD COLUMN     "subscription_status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "subscription_tier" "SubscriptionTier" DEFAULT 'STARTER',
ADD COLUMN     "total_seats" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "team_id",
ADD COLUMN     "meta" JSONB NOT NULL DEFAULT '{}',
DROP COLUMN "amount",
ADD COLUMN     "amount" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "meta" JSONB NOT NULL DEFAULT '{}';
