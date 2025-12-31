# Local PostgreSQL Database Setup Guide

This guide will help you switch from AWS/remote database to a local PostgreSQL database.

## Step 1: Install PostgreSQL

### Windows:
1. Download PostgreSQL from: https://www.postgresql.org/download/windows/
2. Run the installer
3. During installation:
   - Remember the password you set for the `postgres` superuser
   - Default port is `5432` (keep this unless you have a conflict)
   - Default installation location is usually `C:\Program Files\PostgreSQL\<version>`

### Verify Installation:
Open PowerShell and run:
```powershell
psql --version
```

## Step 2: Create a Local Database

1. Open PowerShell or Command Prompt
2. Connect to PostgreSQL (you'll be prompted for the password you set during installation):
```powershell
psql -U postgres
```

3. Once connected, create a new database for your project:
```sql
CREATE DATABASE willy;
```

4. (Optional) Create a dedicated user for the project (recommended):
```sql
CREATE USER willy_user WITH PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE willy TO willy_user;
\q
```

5. Test connection with the new user (if you created one):
```powershell
psql -U willy_user -d willy
```

## Step 3: Update Environment Variables

1. Open or create `.env` file in the project root directory (`C:\Users\bharg\Desktop\demo_task\New folder\willy\.env`)

2. Update or add the `DATABASE_URL` with your local PostgreSQL connection string:

   **If using the default postgres user:**
   ```
   DATABASE_URL="postgresql://postgres:your_postgres_password@localhost:5432/willy"
   ```

   **If using a dedicated user:**
   ```
   DATABASE_URL="postgresql://willy_user:your_secure_password_here@localhost:5432/willy"
   ```

   **Format breakdown:**
   - `postgresql://` - protocol
   - `username` - your PostgreSQL username
   - `password` - your PostgreSQL password
   - `localhost` - database host (local)
   - `5432` - default PostgreSQL port
   - `willy` - database name

3. **Important:** Make sure `.env` is in your `.gitignore` file to avoid committing credentials

## Step 4: Generate Prisma Client

Run this command to generate the Prisma client based on your schema:
```powershell
npx prisma generate
```

## Step 5: Run Database Migrations

Apply all existing migrations to create the database schema:
```powershell
npx prisma migrate deploy
```

Or if you want to reset and start fresh (⚠️ **WARNING: This will delete all data**):
```powershell
npx prisma migrate reset
```

## Step 6: (Optional) Seed the Database

If you have seed data, you can populate the database:
```powershell
npx prisma db seed
```

## Step 7: Verify the Connection

Test that everything works by starting the server:
```powershell
npm run server
```

If there are no database connection errors, you're all set!

## Step 8: Verify Database Tables

You can verify that all tables were created by connecting to your database:
```powershell
psql -U postgres -d willy
```

Then list all tables:
```sql
\dt
```

You should see all the tables from your Prisma schema.

## Troubleshooting

### Connection Refused Error
- Make sure PostgreSQL service is running:
  - Open Services (Win + R, type `services.msc`)
  - Find "postgresql-x64-XX" service
  - Right-click and select "Start" if it's stopped

### Authentication Failed
- Double-check your username and password in the `DATABASE_URL`
- Make sure you're using the correct user that has access to the `willy` database

### Port Already in Use
- If port 5432 is already in use, you can:
  1. Change PostgreSQL port in `postgresql.conf` (usually in `C:\Program Files\PostgreSQL\<version>\data\`)
  2. Update your `DATABASE_URL` to use the new port

### Migration Errors
- If migrations fail, you can try:
  ```powershell
  npx prisma migrate reset
  ```
  This will drop the database, recreate it, and apply all migrations.

## Notes

- **Local vs Remote:** The main application database (used by Prisma) is now local. Some features in the app may still use remote databases for document-specific databases (those are configured separately in the UI).
- **SSL:** Local PostgreSQL doesn't require SSL, so your connection string doesn't need SSL parameters.
- **Backup:** Make sure to regularly backup your local database if you have important data:
  ```powershell
  pg_dump -U postgres willy > backup.sql
  ```

## Quick Reference Commands

```powershell
# Connect to database
psql -U postgres -d willy

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Reset database (deletes all data!)
npx prisma migrate reset

# View database in Prisma Studio (GUI)
npx prisma studio
```




























