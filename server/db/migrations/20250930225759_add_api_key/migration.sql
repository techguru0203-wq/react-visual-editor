-- CreateTable
CREATE TABLE "apiKeys" (
    "id" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_used_at" TIMESTAMP(3),
    "meta" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "document_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "creator_user_id" TEXT NOT NULL,

    CONSTRAINT "apiKeys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "apiKeys_key_hash_key" ON "apiKeys"("key_hash");

-- CreateIndex
CREATE UNIQUE INDEX "apiKeys_document_id_key" ON "apiKeys"("document_id");

-- CreateIndex
CREATE INDEX "apiKeys_document_id_organization_id_idx" ON "apiKeys"("document_id", "organization_id");

-- CreateIndex
CREATE INDEX "apiKeys_key_hash_idx" ON "apiKeys"("key_hash");

-- AddForeignKey
ALTER TABLE "apiKeys" ADD CONSTRAINT "apiKeys_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apiKeys" ADD CONSTRAINT "apiKeys_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apiKeys" ADD CONSTRAINT "apiKeys_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
