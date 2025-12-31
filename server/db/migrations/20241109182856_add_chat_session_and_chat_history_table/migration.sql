-- CreateEnum
CREATE TYPE "ChatSessionTargetEntityType" AS ENUM ('DOCUMENT', 'PROJECT', 'ISSUE', 'WORKPLAN');

-- CreateTable
CREATE TABLE "chatSessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "target_entity_id" TEXT NOT NULL,
    "target_entity_type" "ChatSessionTargetEntityType" NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chatSessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatHistories" (
    "id" SERIAL NOT NULL,
    "session_id" TEXT NOT NULL,
    "message" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatHistories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chatSessions_user_id_target_entity_id_target_entity_type_st_idx" ON "chatSessions"("user_id", "target_entity_id", "target_entity_type", "status");

-- CreateIndex
CREATE INDEX "chatHistories_session_id_idx" ON "chatHistories"("session_id");

-- AddForeignKey
ALTER TABLE "chatSessions" ADD CONSTRAINT "chatSessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatHistories" ADD CONSTRAINT "chatHistories_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chatSessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
