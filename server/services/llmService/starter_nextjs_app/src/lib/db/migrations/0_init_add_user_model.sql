-- Simple migration: Create Users and Uploads tables

CREATE TABLE "Users" (
    "id" TEXT PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL UNIQUE,
    "password" TEXT NOT NULL,
    "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
    "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
);
-- Create unique index on email (explicit, though UNIQUE constraint already creates one)
CREATE UNIQUE INDEX IF NOT EXISTS "Users_email_unique" ON "Users"("email");

CREATE TABLE "Uploads" (
    "id" TEXT PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "file_type" TEXT NOT NULL,
    "s3_key" TEXT NOT NULL,
    "s3_url" TEXT NOT NULL,
    "upload_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
    "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
);