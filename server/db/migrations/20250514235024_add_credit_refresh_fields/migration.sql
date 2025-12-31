-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "lastFreeCreditRunOutDate" TIMESTAMP(3),
ADD COLUMN     "monthFreeCreditUsed" INTEGER NOT NULL DEFAULT 0;