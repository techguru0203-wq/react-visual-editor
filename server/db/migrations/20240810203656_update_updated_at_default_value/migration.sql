-- AlterTable
ALTER TABLE "creditActions" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "specialties" ALTER COLUMN "updated_at" DROP DEFAULT;
