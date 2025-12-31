-- CreateEnum
CREATE TYPE "MessageUseTypes" AS ENUM ('CHAT', 'GENERATION', 'BOTH', 'NONE');

-- AlterTable
ALTER TABLE "chatHistories" ADD COLUMN     "messageUse" "MessageUseTypes" NOT NULL DEFAULT 'BOTH';
