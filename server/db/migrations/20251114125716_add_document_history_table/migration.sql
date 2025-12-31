-- CreateTable
CREATE TABLE "documentHistories" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "file_url" TEXT,
    "current_version_url" TEXT,
    "content" TEXT,
    "chosen_document_ids" TEXT,
    "rating" JSONB,
    "creator_user_id" TEXT NOT NULL,
    "creator_email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentHistories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documentHistories_document_id_version_number_key" ON "documentHistories"("document_id", "version_number");

-- CreateIndex
CREATE INDEX "documentHistories_document_id_version_number_idx" ON "documentHistories"("document_id", "version_number");

-- CreateIndex
CREATE INDEX "documentHistories_document_id_created_at_idx" ON "documentHistories"("document_id", "created_at");

-- AddForeignKey
ALTER TABLE "documentHistories" ADD CONSTRAINT "documentHistories_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

