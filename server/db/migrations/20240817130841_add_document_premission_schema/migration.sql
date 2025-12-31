-- CreateEnum
CREATE TYPE "DocumentPermissionTypes" AS ENUM ('VIEW', 'EDIT');

-- CreateTable
CREATE TABLE "documentPermissions" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "permission" "DocumentPermissionTypes" NOT NULL DEFAULT 'VIEW',

    CONSTRAINT "documentPermissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documentPermissions_document_id_user_id_idx" ON "documentPermissions"("document_id", "user_id");

-- AddForeignKey
ALTER TABLE "documentPermissions" ADD CONSTRAINT "documentPermissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
