-- CreateTable
CREATE TABLE "projectPermissions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "permission" "DocumentPermissionTypes" NOT NULL DEFAULT 'VIEW',
    "status" "DocumentPermissionStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT,

    CONSTRAINT "projectPermissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projectPermissions_project_id_email_idx" ON "projectPermissions"("project_id", "email");

-- AddForeignKey
ALTER TABLE "projectPermissions" ADD CONSTRAINT "projectPermissions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projectPermissions" ADD CONSTRAINT "projectPermissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentPermissions" ADD CONSTRAINT "documentPermissions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
