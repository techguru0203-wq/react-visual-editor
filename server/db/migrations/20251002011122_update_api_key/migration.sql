/*
  Warnings:

  - You are about to drop the `apiKeys` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "apiKeys" DROP CONSTRAINT "apiKeys_creator_user_id_fkey";

-- DropForeignKey
ALTER TABLE "apiKeys" DROP CONSTRAINT "apiKeys_document_id_fkey";

-- DropForeignKey
ALTER TABLE "apiKeys" DROP CONSTRAINT "apiKeys_organization_id_fkey";

-- DropIndex
DROP INDEX "creditActions_user_id_organization_id_action_status_idx";

-- AlterTable
ALTER TABLE "creditActions" ADD COLUMN     "document_id" TEXT;

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "api_key" TEXT;

-- DropTable
DROP TABLE "apiKeys";

-- CreateIndex
CREATE INDEX "creditActions_user_id_organization_id_action_document_id_st_idx" ON "creditActions"("user_id", "organization_id", "action", "document_id", "status");
