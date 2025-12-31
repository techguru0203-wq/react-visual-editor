/*
  Warnings:

  - The `status` column on the `templateDocuments` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('CREATED', 'PUBLISHED', 'CANCELED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "templateDocuments" ADD COLUMN     "images" TEXT[],
ADD COLUMN     "meta" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "parent_template_document_id" TEXT,
ADD COLUMN     "prompt_text" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sample_input_text" TEXT,
ADD COLUMN     "tags" TEXT[],
ADD COLUMN     "use_count" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "url" DROP NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "TemplateStatus" NOT NULL DEFAULT 'CREATED';

-- AddForeignKey
ALTER TABLE "templateDocuments" ADD CONSTRAINT "templateDocuments_parent_template_document_id_fkey" FOREIGN KEY ("parent_template_document_id") REFERENCES "templateDocuments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
