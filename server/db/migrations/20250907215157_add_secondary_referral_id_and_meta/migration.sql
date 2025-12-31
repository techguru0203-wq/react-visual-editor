-- DropIndex
DROP INDEX "referrals_referrer_user_id_idx";

-- DropIndex
DROP INDEX "referrals_referrer_user_id_referee_user_id_key";

-- AlterTable
ALTER TABLE "referrals" ADD COLUMN     "meta" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "secondary_referrer_user_id" TEXT;

-- CreateIndex
CREATE INDEX "referrals_referrer_user_id_secondary_referrer_user_id_idx" ON "referrals"("referrer_user_id", "secondary_referrer_user_id");

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_secondary_referrer_user_id_fkey" FOREIGN KEY ("secondary_referrer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
