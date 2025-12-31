-- CreateEnum
CREATE TYPE "KBFileStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterEnum
ALTER TYPE "ChatSessionTargetEntityType" ADD VALUE 'KNOWLEDGE_BASE';

-- CreateTable
CREATE TABLE "knowledgeBases" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "organization_id" TEXT NOT NULL,
    "creator_user_id" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "meta" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_bases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledgeBaseFiles" (
    "id" TEXT NOT NULL,
    "knowledge_base_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "s3_key" TEXT NOT NULL,
    "s3_url" TEXT NOT NULL,
    "processing_status" "KBFileStatus" NOT NULL DEFAULT 'PENDING',
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "qdrant_ids" TEXT[],
    "error_message" TEXT,
    "uploaded_by" TEXT NOT NULL,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_base_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledgeBaseProjectLinks" (
    "id" TEXT NOT NULL,
    "knowledge_base_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_base_project_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_bases_organization_id_status_idx" ON "knowledgeBases"("organization_id", "status");

-- CreateIndex
CREATE INDEX "knowledge_base_files_knowledge_base_id_processing_status_idx" ON "knowledgeBaseFiles"("knowledge_base_id", "processing_status");

-- CreateIndex
CREATE INDEX "knowledge_base_project_links_project_id_idx" ON "knowledgeBaseProjectLinks"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_base_project_links_knowledge_base_id_project_id_key" ON "knowledgeBaseProjectLinks"("knowledge_base_id", "project_id");

-- AddForeignKey
ALTER TABLE "knowledgeBases" ADD CONSTRAINT "knowledge_bases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledgeBases" ADD CONSTRAINT "knowledge_bases_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledgeBaseFiles" ADD CONSTRAINT "knowledge_base_files_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledgeBases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledgeBaseFiles" ADD CONSTRAINT "knowledge_base_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledgeBaseProjectLinks" ADD CONSTRAINT "knowledge_base_project_links_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledgeBases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledgeBaseProjectLinks" ADD CONSTRAINT "knowledge_base_project_links_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

