-- CreateTable
CREATE TABLE "sql_audit_logs" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'preview',
    "sql_statement" TEXT NOT NULL,
    "sql_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error_message" TEXT,
    "rows_affected" INTEGER,
    "execution_time" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sql_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sql_audit_logs_document_id_user_id_environment_created_at_idx" ON "sql_audit_logs"("document_id", "user_id", "environment", "created_at");

-- AddForeignKey
ALTER TABLE "sql_audit_logs" ADD CONSTRAINT "sql_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sql_audit_logs" ADD CONSTRAINT "sql_audit_logs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

