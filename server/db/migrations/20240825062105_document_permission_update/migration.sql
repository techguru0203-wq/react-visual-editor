/*
  Warnings:

  - A unique constraint covering the columns `[document_id,email]` on the table `documentPermissions` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "DocumentPermissionStatus" AS ENUM ('ACTIVE', 'CANCELED');

-- DropForeignKey
ALTER TABLE "documentPermissions" DROP CONSTRAINT "documentPermissions_user_id_fkey";

-- DropIndex
DROP INDEX "documentPermissions_document_id_user_id_idx";

-- DropIndex
DROP INDEX "documentPermissions_document_id_user_id_key";

-- AlterTable
ALTER TABLE "documentPermissions" ADD COLUMN     "email" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "user_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "documentPermissions_document_id_email_idx" ON "documentPermissions"("document_id", "email");
