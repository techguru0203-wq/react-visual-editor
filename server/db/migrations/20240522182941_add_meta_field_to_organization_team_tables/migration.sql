-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "meta" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "meta" JSONB NOT NULL DEFAULT '{}';
