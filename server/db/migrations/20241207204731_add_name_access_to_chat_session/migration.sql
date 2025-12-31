-- AlterEnum
ALTER TYPE "ChatSessionTargetEntityType" ADD VALUE 'CHAT';

-- AlterTable
ALTER TABLE "chatSessions" ADD COLUMN     "access" "Access" NOT NULL DEFAULT 'SELF',
ADD COLUMN     "name" TEXT;
