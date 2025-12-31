import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

export default defineConfig({
  schema: './backend/db/schema.ts',
  out: './backend/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL as string,
    ssl: { rejectUnauthorized: false },
  },
  migrations: {
    prefix: 'timestamp',
  },
  verbose: true,
  strict: true,
});
