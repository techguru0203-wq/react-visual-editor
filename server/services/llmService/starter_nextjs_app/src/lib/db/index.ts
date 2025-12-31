import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

// Ensure environment variables are loaded
config();

// Initialize database connection only if DATABASE_URL is provided
let db: PostgresJsDatabase<Record<string, never>> | null = null;

if (process.env.DATABASE_URL) {
  // Database connection with connection pooling
  const client = postgres(process.env.DATABASE_URL, {
    ssl: { rejectUnauthorized: false },
    max: 10, // Set pool size
    idle_timeout: 20, // Idle connection timeout in seconds
    connect_timeout: 10, // Connection timeout in seconds
  });

  db = drizzle(client);
}

export { db };
