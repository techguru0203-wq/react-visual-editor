CREATE TABLE IF NOT EXISTS "public"."documents-go" (
  id SERIAL PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Enable row level security, very important
ALTER TABLE "public"."documents-go" enable row level security;