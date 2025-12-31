/*
  Warnings:

  - A unique constraint covering the columns `[document_id,user_id]` on the table `documentPermissions` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "documentPermissions_document_id_user_id_key" ON "documentPermissions"("document_id", "user_id");
