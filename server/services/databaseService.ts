import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { Prisma } from '@prisma/client';
import { RedisSingleton } from './redis/redis';
import supabase from '../lib/supabase-helper';
import { Timestamp } from 'typeorm';
import { EnvSettings } from './documentService';
import execa from 'execa';
import { generateDeployDocId, normalizeEnvSettings } from '../lib/util';
import { createDbBackend } from './databaseUrlService';
import prisma from '../db/prisma';
import { DBTYPES } from '../lib/constant';
import { downloadMigrationsFromS3 } from '../lib/s3Upload';
import { Client } from 'pg';
import { updateDocumentMeta } from './documentMetaService';
export type MetaHistoryItem = {
  content: string;
  fileUrl: string;
};

const execAsync = promisify(exec);

interface SupabaseConfig {
  token: string;
  projectRef: string;
  databasePassword: string;
  workingDirectory: string;
}

interface Condition {
  field: string;
  operator:
    | 'eq'
    | 'neq'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'like'
    | 'ilike'
    | 'in'
    | 'is';
  value: any;
}

interface FileItem {
  path: string;
  content: string;
  type: 'file';
}

interface GenerateContent {
  files: FileItem[];
}

interface DocData {
  id: string;
  name: string;
  type: string;
  meta?: Record<string, any>;
  onProgress: (message: string) => void;
}
/**
 * Execute database migrations with Drizzle ORM
 * Refactored to use codebase files and migrationTracking instead of S3
 */
export async function executeDBMigrationWithDrizzle(
  docId: string,
  generateContent: string,
  envSettings: EnvSettings | null,
  hasSchemaChange: boolean = false,
  environment: 'preview' | 'production' = 'preview'
): Promise<{
  success: boolean;
  migrationId?: string;
  error?: string;
  failedMigrationFile?: string | null;
}> {
  if (!hasSchemaChange) {
    console.log(
      `✅ No schema change for docId: ${docId} (${environment}), skipping migration`
    );
    return { success: true };
  }

  const databaseUrl = envSettings?.DATABASE_URL;

  if (!databaseUrl || databaseUrl.length === 0) {
    console.log(
      `No DATABASE_URL found for docId: ${docId} (${environment}), skipping migration`
    );
    return { success: true };
  }

  const tempDir = path.join('/tmp', `drizzle-migration-${docId}-${Date.now()}`);
  let failedMigrationFile: string | null = null;

  try {
    // Parse and validate generateContent
    const { files } = JSON.parse(generateContent) as GenerateContent;

    if (!Array.isArray(files)) {
      throw new Error(
        'Invalid generateContent structure: files array is missing'
      );
    }

    // Find migration files from codebase
    const migrationFiles = files.filter(
      (file) =>
        (file.path.includes('backend/db/migrations/') ||
          file.path.includes('lib/db/migrations/')) &&
        file.path.endsWith('.sql')
    );

    if (migrationFiles.length === 0) {
      console.log('No migration files found in codebase');
      return { success: true };
    }

    console.log(
      `📁 Found ${migrationFiles.length} migration files in codebase:`,
      migrationFiles.map((f) => f.path)
    );

    // Get environment-specific migration tracking from document meta
    const doc = await prisma.document.findUnique({
      where: { id: docId },
      select: { meta: true },
    });
    const docMeta = (doc?.meta as any) || {};
    const migrationTracking = docMeta.migrationTracking || {};
    let envMigrations = migrationTracking[environment] || [];

    console.log(
      `📋 ${environment} environment has ${envMigrations.length} migrations applied`
    );

    // Legacy compatibility: Initialize from S3 if no tracking exists (preview only)
    let isLegacyProject = false;
    if (
      envMigrations.length === 0 &&
      databaseUrl &&
      environment === 'preview'
    ) {
      console.log(
        `🔄 No migration tracking found for preview - checking S3 for legacy migrations...`
      );

      try {
        const tempMigrationsDir = path.join(tempDir, 'migrations');
        fs.mkdirSync(tempDir, { recursive: true });
        fs.mkdirSync(tempMigrationsDir, { recursive: true });

        const s3MigrationFiles = await downloadMigrationsFromS3(
          docId,
          tempMigrationsDir
        );

        if (s3MigrationFiles.length > 0) {
          console.log(
            `📁 Found ${s3MigrationFiles.length} legacy migrations in S3`
          );
          envMigrations = s3MigrationFiles.sort();
          isLegacyProject = true;
          console.log(
            `✅ Initialized tracking from S3: ${envMigrations.length} migrations marked as applied`
          );
        }
      } catch (s3Error) {
        console.warn('⚠️ Failed to check S3 for legacy migrations:', s3Error);
      }
    }

    // Create temp directory and write migration files
    const tempMigrationsDir = path.join(tempDir, 'migrations');
    fs.mkdirSync(tempDir, { recursive: true });
    fs.mkdirSync(tempMigrationsDir, { recursive: true });

    // Get all migration file names from codebase
    const codebaseMigrationMap = new Map<string, string>();
    for (const migrationFile of migrationFiles) {
      const fileName = path.basename(migrationFile.path);
      codebaseMigrationMap.set(fileName, migrationFile.content);
      const filePath = path.join(tempMigrationsDir, fileName);
      fs.writeFileSync(filePath, migrationFile.content, 'utf8');
    }

    // Determine which migrations need to be applied
    const allMigrationFiles = Array.from(codebaseMigrationMap.keys()).sort();
    const migrationsToApply = allMigrationFiles.filter(
      (fileName) => !envMigrations.includes(fileName)
    );

    if (migrationsToApply.length === 0) {
      console.log(`✅ No new migrations needed for ${environment} environment`);

      // Update tracking if this was a legacy project initialization
      if (isLegacyProject) {
        const updatedMigrationTracking = {
          ...migrationTracking,
          [environment]: envMigrations,
        };
        await updateDocumentMeta(docId, {
          migrationTracking: updatedMigrationTracking,
        });
        console.log(
          `✅ Saved legacy migration tracking for ${environment}: ${envMigrations.length} migrations`
        );
      }

      return {
        success: true,
        migrationId: `drizzle_${docId}_${Date.now()}_no_changes`,
      };
    }

    console.log(
      `📄 ${migrationsToApply.length} migrations to apply for ${environment}:`,
      migrationsToApply
    );

    // Apply migrations with retry logic
    console.log(
      `🚀 Applying ${migrationsToApply.length} migrations to ${environment} database...`
    );
    const maxRetries = 2;
    const appliedMigrations: string[] = [];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `📤 Attempt ${attempt}/${maxRetries} - Applying migrations...`
        );

        for (const migrationFile of migrationsToApply) {
          const filePath = path.join(tempMigrationsDir, migrationFile);
          const content = fs.readFileSync(filePath, 'utf8');

          console.log(`📄 Applying migration: ${migrationFile}`);

          const migrateResult = await execa(
            'psql',
            [databaseUrl, '-c', content],
            {
              timeout: 60_000,
              stdout: 'pipe',
              stderr: 'pipe',
              buffer: true,
              reject: false,
            }
          );

          if (migrateResult.exitCode !== 0) {
            const stderrContent = migrateResult.stderr || '';
            const isAlreadyExists =
              stderrContent.includes('already exists') ||
              (stderrContent.includes('relation') &&
                stderrContent.includes('already exists'));

            if (isAlreadyExists) {
              console.log(
                `⚠️ Migration ${migrationFile} already applied, skipping`
              );
              appliedMigrations.push(migrationFile);
            } else {
              failedMigrationFile = migrationFile;
              throw new Error(
                `Migration ${migrationFile} failed: ${migrateResult.stderr}`
              );
            }
          } else {
            console.log(`✅ Migration ${migrationFile} applied successfully`);
            appliedMigrations.push(migrationFile);
          }
        }

        console.log(
          `✅ All migrations applied successfully on attempt ${attempt}`
        );
        break;
      } catch (error) {
        console.log(
          `❌ Migration failed on attempt ${attempt}/${maxRetries}:`,
          {
            error: error instanceof Error ? error.message : String(error),
            failedFile: failedMigrationFile,
          }
        );

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }

    // Update migration tracking
    if (isLegacyProject || appliedMigrations.length > 0) {
      const updatedEnvMigrations = [
        ...new Set([...envMigrations, ...appliedMigrations]),
      ];
      const updatedMigrationTracking = {
        ...migrationTracking,
        [environment]: updatedEnvMigrations,
      };

      await updateDocumentMeta(docId, {
        migrationTracking: updatedMigrationTracking,
      });

      if (isLegacyProject) {
        console.log(
          `✅ Initialized migration tracking for legacy project (${environment}): ${envMigrations.length} existing + ${appliedMigrations.length} new migrations`
        );
      } else {
        console.log(
          `✅ Updated migration tracking for ${environment}: ${appliedMigrations.length} new migrations recorded`
        );
      }
    }

    return {
      success: true,
      migrationId: `drizzle_${docId}_${Date.now()}`,
    };
  } catch (error) {
    console.error('❌ Migration error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const userFriendlyError = failedMigrationFile
      ? `Database migration failed in file "${failedMigrationFile}". Error: ${errorMessage}\n\n`
      : `Database migration failed: ${errorMessage}`;

    return {
      success: false,
      error: userFriendlyError,
      failedMigrationFile,
    };
  } finally {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log('🧹 Cleaned up temporary migration directory');
      }
    } catch (cleanupError) {
      console.warn('⚠️ Failed to clean up temp directory:', cleanupError);
    }
  }
}

// Simplified function to run migration SQL files directly
export async function runMigrationFiles(
  connectionString: string,
  generateContent: string
): Promise<{ success: boolean; error?: string; filesExecuted: number }> {
  try {
    // Parse the generateContent to get the files
    const { files } = JSON.parse(generateContent);

    if (!Array.isArray(files)) {
      return {
        success: false,
        error: 'Invalid generateContent format',
        filesExecuted: 0,
      };
    }

    // Filter for migration SQL files
    const migrationFiles = files.filter(
      (file: any) =>
        file.path &&
        file.path.includes('migrations/') &&
        file.path.endsWith('.sql')
    );

    if (migrationFiles.length === 0) {
      return {
        success: true,
        error: 'No migration files found',
        filesExecuted: 0,
      };
    }

    // Sort migration files by timestamp number to ensure correct order
    migrationFiles.sort((a: any, b: any) => {
      const getTimestamp = (filePath: string) => {
        const parts = filePath.split('_');
        const timestamp = parts[0];
        return parseInt(timestamp, 10) || 0;
      };

      return getTimestamp(a.path) - getTimestamp(b.path);
    });

    const client = new Client({ connectionString });
    await client.connect();

    let executedCount = 0;
    for (const file of migrationFiles) {
      try {
        console.log(`🔄 Executing migration: ${file.path}`);
        await client.query(file.content);
        executedCount++;
      } catch (error) {
        console.error(`❌ Failed to execute migration ${file.path}:`, error);
        await client.end();
        return {
          success: false,
          error: `Failed to execute ${file.path}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
          filesExecuted: executedCount,
        };
      }
    }

    await client.end();
    console.log(`✅ Successfully executed ${executedCount} migration files`);
    return { success: true, filesExecuted: executedCount };
  } catch (error) {
    console.error('❌ Error running migration files:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      filesExecuted: 0,
    };
  }
}

export async function getTablesByDocumentId(documentId: string) {
  try {
    const prefix = `${documentId}_`;
    const { data, error } = await supabase.rpc('get_tables_with_columns', {
      prefix_name: prefix,
    });

    if (error) {
      console.error('Error fetching tables:', error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }

    // await saveDocumentToDatabase(documentId, '', metaObj);
    return {
      success: true,
      message: 'Tables fetched successfully',
      data,
    };
  } catch (error) {
    console.error('Error in getTablesByProjectId:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      data: null,
    };
  }
}

export async function executeSupabaseCommands(config: SupabaseConfig) {
  const { token, projectRef, databasePassword, workingDirectory } = config;

  try {
    // Change to the working directory
    process.chdir(workingDirectory);
    console.log('Changed to working directory:', workingDirectory);

    // Execute Supabase login
    const loginCommand = `supabase login --no-browser --token ${token}`;
    console.log('Executing login command...');
    await execAsync(loginCommand);

    // Execute Supabase link
    const linkCommand = `supabase link --project-ref ${projectRef} -p ${databasePassword}`;
    console.log('Executing link command...');
    const { stdout: linkOutput } = await execAsync(linkCommand);
    console.log('Link output:', linkOutput);

    // Execute Supabase db push
    const pushCommand = `supabase db push -p ${databasePassword}`;
    console.log('Executing db push command...');
    const { stdout: pushOutput } = await execAsync(pushCommand);
    console.log('Push output:', pushOutput);

    return {
      success: true,
      message: 'Supabase commands executed successfully',
    };
  } catch (error) {
    console.error('Error executing Supabase commands:', error);
    return {
      success: false,
      message: `Failed to execute Supabase commands: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    };
  }
}

export async function getTableData(
  documentId: string,
  tableName: string,
  columns: string[]
) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select(columns.join(','));

    if (error) {
      console.error('Error fetching table data:', error);
      return {
        success: false,
        message: error.message,
        data: null,
        columns: null,
      };
    }

    console.log('Table data:', data);

    return {
      success: true,
      message: 'Table data fetched successfully',
      data,
      // columns: tableInfo,
    };
  } catch (error) {
    console.error('Error in getTableData:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      data: null,
      columns: null,
    };
  }
}

// Read operation
export async function queryTableData(
  tableName: string,
  fields: string[],
  conditions: Condition[]
) {
  try {
    let query = supabase.from(tableName).select(fields.join(','));

    // Apply all conditions
    conditions.forEach((condition) => {
      switch (condition.operator) {
        case 'eq':
          query = query.eq(condition.field, condition.value);
          break;
        case 'neq':
          query = query.neq(condition.field, condition.value);
          break;
        case 'gt':
          query = query.gt(condition.field, condition.value);
          break;
        case 'gte':
          query = query.gte(condition.field, condition.value);
          break;
        case 'lt':
          query = query.lt(condition.field, condition.value);
          break;
        case 'lte':
          query = query.lte(condition.field, condition.value);
          break;
        case 'like':
          query = query.like(condition.field, `%${condition.value}%`);
          break;
        case 'ilike':
          query = query.ilike(condition.field, `%${condition.value}%`);
          break;
        case 'in':
          query = query.in(condition.field, condition.value);
          break;
        case 'is':
          query = query.is(condition.field, condition.value);
          break;
      }
    });

    const { data, error } = await query;

    if (error) {
      console.error('Error querying data:', error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }

    return {
      success: true,
      message: 'Data queried successfully',
      data,
    };
  } catch (error) {
    console.error('Error in queryTableData:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      data: null,
    };
  }
}

export async function executeDBMigration(
  generateContent: string,
  metaObj: Prisma.JsonObject
) {
  const existingMigrationsForProj =
    (metaObj?.migrations as Record<string, boolean>) || {};

  // Parse generateContent to get FileItem array
  const { files } = JSON.parse(generateContent);

  // Get all SQL files from the parsed content
  // file name: /src/supabase/timestamp_docid.sql
  const allSqlFiles = files.filter((file: FileItem) =>
    file.path.endsWith('.sql')
  );

  console.log(
    'All SQL files:',
    allSqlFiles.map((f: FileItem) => f.path)
  );

  if (allSqlFiles.length === 0) {
    return existingMigrationsForProj;
  }
  // Call Supabase Edge Function to get applied migrations
  console.log('Fetching applied migrations from Supabase...');
  const { data: appliedData, error: appliedError } =
    await supabase.functions.invoke('get-applied-migrations', {
      body: {},
    });

  if (appliedError) {
    console.error('Error fetching applied migrations:', appliedError);
    return existingMigrationsForProj;
  }

  // Get applied migration names (extract 'name' from each applied migration)
  const appliedMigrationNames = appliedData.migrations.map(
    (migration: { name: string; created_at: Timestamp }) => migration.name
  );
  console.log('Applied migrations:', appliedMigrationNames);

  // Find SQL files that don't exist in migration keys
  const newSqlFiles = allSqlFiles.filter(
    (file: FileItem) =>
      !appliedMigrationNames.hasOwnProperty(path.parse(file.path).name)
  );

  console.log(
    'New SQL files to process:',
    newSqlFiles.map((f: FileItem) => f.path)
  );

  console.log(`Found ${newSqlFiles.length} new SQL files to apply`);

  // Apply each new migration
  for (const file of newSqlFiles) {
    const migrationName = path.parse(file.path).name;
    const sql = file.content;

    console.log(`Applying migration: ${migrationName}`, sql);

    // Call Supabase Edge Function to apply migration
    const { data, error } = await supabase.functions.invoke('apply-migration', {
      body: {
        name: migrationName,
        sql: sql,
      },
    });

    if (error) {
      console.error(`Error applying migration ${file.path}:`, error);
    } else {
      console.log(`Successfully applied migration: ${migrationName}`);
      existingMigrationsForProj[migrationName] = true;
    }
  }

  console.log(
    'All new migrations applied successfully:',
    existingMigrationsForProj
  );
  return existingMigrationsForProj;
}

export async function saveDocumentToDatabase(
  generateContent: string,
  metaObj: Prisma.JsonObject
) {
  // TODO - Stop DB migration for now
  return {};
  // Get existing migration keys
  const existingMigrationsForProj =
    (metaObj?.migrations as Record<string, boolean>) || {};
  const DBMigrationKey = 'SupabaseDBMigrations';
  // redis data shape: {SupbaseDBMigratins: {generated_sql_file_name: true }}
  const migratedRecords = JSON.parse(
    (await RedisSingleton.getData(DBMigrationKey)) || '{}'
  );

  console.log('Existing migrations:', migratedRecords);

  try {
    // Parse generateContent to get FileItem array
    const { files } = JSON.parse(generateContent);

    // Get all SQL files from the parsed content
    // file name: /src/supabase/timestamp_docid.sql
    const allSqlFiles = files.filter((file: FileItem) =>
      file.path.endsWith('.sql')
    );

    console.log(
      'All SQL files:',
      allSqlFiles.map((f: FileItem) => f.path)
    );

    // Find SQL files that don't exist in migration keys
    const newSqlFiles = allSqlFiles.filter(
      (file: FileItem) =>
        !migratedRecords.hasOwnProperty(file.path.split('/').pop())
    );

    console.log(
      'New SQL files to process:',
      newSqlFiles.map((f: FileItem) => f.path)
    );

    if (newSqlFiles.length === 0) {
      return existingMigrationsForProj;
    }

    // Create migrations directory
    const migrationsDir = path.join(
      process.env.SUPABASE_WORKING_DIR || '',
      'migrations'
    );

    // Ensure migrations directory exists
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true });
    }

    // Write all SQL files to migrations directory and store file mappings
    newSqlFiles.forEach((sqlFile: FileItem) => {
      const fileName = sqlFile.path.split('/').pop() as string;
      const filePath = path.join(migrationsDir, fileName);
      fs.writeFileSync(filePath, sqlFile.content);
      console.log(`Created migration file: ${fileName}`);
    });

    // Execute Supabase commands
    const result = await executeSupabaseCommands({
      token: process.env.SUPABASE_TOKEN || '',
      projectRef: process.env.SUPABASE_PROJECT_ID || '',
      databasePassword: process.env.SUPABASE_DATABASE_PWD || '',
      workingDirectory: process.env.SUPABASE_WORKING_DIR || '',
    });

    if (result.success) {
      console.log('migrations result:', result.success);

      // Update migration mappings in metaObj
      const updatedMigrationRecords: Record<string, boolean> = {
        ...migratedRecords,
      };

      // Add new mappings for SQL files
      newSqlFiles.forEach((sqlFile: FileItem) => {
        const fileName = sqlFile.path.split('/').pop() as string;
        updatedMigrationRecords[fileName] = true;
        existingMigrationsForProj[fileName] = true;
        console.log(`Added file to migration records: ${fileName}`);
      });

      // Update metaObj with new migrations
      console.log('Updated migration mappings:', updatedMigrationRecords);
      RedisSingleton.setData({
        key: DBMigrationKey,
        val: JSON.stringify(updatedMigrationRecords),
        expireInSec: 100 * 365 * 24 * 3600, // 100 years in seconds
      });
    }
    return existingMigrationsForProj;
  } catch (error) {
    console.error('Error in saveDocumentToDatabase:', error);
    return existingMigrationsForProj;
  }
}

export async function saveDatabaseSettingsToDoc(
  documentId: string,
  envSettings: { DATABASE_URL: string; JWT_SECRET: string },
  environment: 'preview' | 'production' = 'preview'
) {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });

  if (!doc) throw new Error(`Document with id ${documentId} not found`);

  const prevMeta = (doc.meta as any) || {};
  const existingEnvSettings = prevMeta.envSettings || {};

  // Check if using new structure (has preview or production keys)
  const isNewStructure =
    existingEnvSettings.preview || existingEnvSettings.production;

  let updatedEnvSettings;
  if (isNewStructure) {
    // Update specific environment in new structure
    updatedEnvSettings = {
      ...existingEnvSettings,
      [environment]: {
        ...(existingEnvSettings[environment] || {}),
        ...envSettings,
      },
    };
  } else if (environment === 'preview') {
    // For old flat structure, only update if it's preview
    updatedEnvSettings = envSettings;
  } else {
    // Migrate to new structure when saving production for the first time
    updatedEnvSettings = {
      preview: existingEnvSettings,
      production: envSettings,
    };
  }

  // Use partial update to preserve other meta fields
  await updateDocumentMeta(documentId, {
    envSettings: updatedEnvSettings,
  });

  // Return updated document for compatibility
  return await prisma.document.findUnique({
    where: { id: documentId },
  });
}

/**
 * Execute all pending migrations for a specific environment
 * Refactored to use codebase files from document.content instead of S3
 */
export async function executeAllPendingMigrations(
  docId: string,
  envSettings: EnvSettings | null,
  environment: 'preview' | 'production' = 'production'
): Promise<{
  success: boolean;
  error?: string;
  migrationsApplied?: number;
  failedMigrationFile?: string | null;
}> {
  const databaseUrl = envSettings?.DATABASE_URL;

  if (!databaseUrl || databaseUrl.length === 0) {
    console.log(
      `No DATABASE_URL found for docId: ${docId} (${environment}), skipping migration`
    );
    return { success: false, error: 'No DATABASE_URL configured' };
  }

  const tempDir = path.join('/tmp', `migration-${docId}-${Date.now()}`);
  let failedMigrationFile: string | null = null;

  try {
    // Get document content which contains the codebase
    const doc = await prisma.document.findUnique({
      where: { id: docId },
      select: { content: true, meta: true },
    });

    if (!doc?.content) {
      console.log(`No document content found for docId: ${docId}`);
      return { success: false, error: 'Document content not found' };
    }

    // Parse document content to get migration files
    const contentString = doc.content.toString('utf-8');
    let files: FileItem[] = [];

    try {
      const parsedContent = JSON.parse(contentString) as GenerateContent;
      files = parsedContent.files || [];
    } catch (parseError) {
      console.error('Failed to parse document content:', parseError);
      return { success: false, error: 'Invalid document content format' };
    }

    // Find migration files from codebase
    const migrationFiles = files.filter(
      (file) =>
        (file.path.includes('backend/db/migrations/') ||
          file.path.includes('lib/db/migrations/')) &&
        file.path.endsWith('.sql')
    );

    if (migrationFiles.length === 0) {
      console.log(`No migration files found in codebase for docId: ${docId}`);
      return { success: true, migrationsApplied: 0 };
    }

    console.log(
      `📁 Found ${migrationFiles.length} migration files in codebase for ${environment}`
    );

    // Get environment-specific migration tracking
    const docMeta = (doc.meta as any) || {};
    const migrationTracking = docMeta.migrationTracking || {};
    let envMigrations = migrationTracking[environment] || [];

    console.log(
      `📋 ${environment} environment has ${envMigrations.length} migrations applied`
    );

    // Legacy compatibility: Initialize from S3 if no tracking exists (preview only)
    let isLegacyProject = false;
    if (envMigrations.length === 0 && environment === 'preview') {
      console.log(
        `🔄 No migration tracking found for preview - checking S3 for legacy migrations...`
      );

      try {
        const tempMigrationsDir = path.join(tempDir, 'migrations');
        fs.mkdirSync(tempDir, { recursive: true });
        fs.mkdirSync(tempMigrationsDir, { recursive: true });

        const s3MigrationFiles = await downloadMigrationsFromS3(
          docId,
          tempMigrationsDir
        );

        if (s3MigrationFiles.length > 0) {
          console.log(
            `📁 Found ${s3MigrationFiles.length} legacy migrations in S3`
          );
          envMigrations = s3MigrationFiles.sort();
          isLegacyProject = true;
          console.log(
            `✅ Initialized tracking from S3: ${envMigrations.length} migrations marked as applied`
          );
        }
      } catch (s3Error) {
        console.warn('⚠️ Failed to check S3 for legacy migrations:', s3Error);
      }
    }

    // Create temp directory and write migration files
    const tempMigrationsDir = path.join(tempDir, 'migrations');
    fs.mkdirSync(tempDir, { recursive: true });
    fs.mkdirSync(tempMigrationsDir, { recursive: true });

    // Map migration files from codebase
    const codebaseMigrationMap = new Map<string, string>();
    for (const migrationFile of migrationFiles) {
      const fileName = path.basename(migrationFile.path);
      codebaseMigrationMap.set(fileName, migrationFile.content);
      const filePath = path.join(tempMigrationsDir, fileName);
      fs.writeFileSync(filePath, migrationFile.content, 'utf8');
    }

    // Determine which migrations need to be applied
    const allMigrationFiles = Array.from(codebaseMigrationMap.keys()).sort();
    const migrationsToApply = allMigrationFiles.filter(
      (fileName) => !envMigrations.includes(fileName)
    );

    if (migrationsToApply.length === 0) {
      console.log(
        `✅ All migrations already applied for ${environment} environment`
      );

      // Update tracking if this was a legacy project initialization
      if (isLegacyProject) {
        const updatedMigrationTracking = {
          ...migrationTracking,
          [environment]: envMigrations,
        };
        await updateDocumentMeta(docId, {
          migrationTracking: updatedMigrationTracking,
        });
        console.log(
          `✅ Saved legacy migration tracking for ${environment}: ${envMigrations.length} migrations`
        );
      }

      return { success: true, migrationsApplied: 0 };
    }

    console.log(
      `📄 ${migrationsToApply.length} migrations to apply for ${environment}:`,
      migrationsToApply
    );

    // Apply migrations with retry logic
    const appliedMigrations: string[] = [];
    const maxRetries = 2;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `📤 Attempt ${attempt}/${maxRetries} - Applying migrations...`
        );

        for (const migrationFile of migrationsToApply) {
          const filePath = path.join(tempMigrationsDir, migrationFile);
          const content = fs.readFileSync(filePath, 'utf8');

          console.log(`📄 Applying migration: ${migrationFile}`);

          const migrateResult = await execa(
            'psql',
            [databaseUrl, '-c', content],
            {
              timeout: 60_000,
              stdout: 'pipe',
              stderr: 'pipe',
              buffer: true,
              reject: false,
            }
          );

          if (migrateResult.exitCode !== 0) {
            const stderrContent = migrateResult.stderr || '';
            const isAlreadyExists =
              stderrContent.includes('already exists') ||
              (stderrContent.includes('relation') &&
                stderrContent.includes('already exists'));

            if (isAlreadyExists) {
              console.log(
                `⚠️ Migration ${migrationFile} already applied, skipping`
              );
              appliedMigrations.push(migrationFile);
            } else {
              failedMigrationFile = migrationFile;
              throw new Error(
                `Migration ${migrationFile} failed: ${migrateResult.stderr}`
              );
            }
          } else {
            console.log(`✅ Migration ${migrationFile} applied successfully`);
            appliedMigrations.push(migrationFile);
          }
        }

        console.log(
          `✅ All migrations applied successfully on attempt ${attempt}`
        );
        break;
      } catch (error) {
        console.log(
          `❌ Migration failed on attempt ${attempt}/${maxRetries}:`,
          {
            error: error instanceof Error ? error.message : String(error),
            failedFile: failedMigrationFile,
          }
        );

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }

    // Update migration tracking
    if (isLegacyProject || appliedMigrations.length > 0) {
      const updatedEnvMigrations = [
        ...new Set([...envMigrations, ...appliedMigrations]),
      ];
      const updatedMigrationTracking = {
        ...migrationTracking,
        [environment]: updatedEnvMigrations,
      };

      await updateDocumentMeta(docId, {
        migrationTracking: updatedMigrationTracking,
      });

      if (isLegacyProject) {
        console.log(
          `✅ Initialized migration tracking for legacy ${environment} environment: ${envMigrations.length} existing + ${appliedMigrations.length} new migrations`
        );
      } else {
        console.log(
          `✅ Updated migration tracking for ${environment}: ${appliedMigrations.length} migrations recorded`
        );
      }
    }

    return { success: true, migrationsApplied: appliedMigrations.length };
  } catch (error) {
    console.error(`❌ Migration error for ${environment}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const userFriendlyError = failedMigrationFile
      ? `Database migration failed in file "${failedMigrationFile}". Error: ${errorMessage}\n\n`
      : `Database migration failed: ${errorMessage}`;

    return {
      success: false,
      error: userFriendlyError,
      migrationsApplied: 0,
      failedMigrationFile,
    };
  } finally {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log('🧹 Cleaned up temporary migration directory');
      }
    } catch (cleanupError) {
      console.warn('⚠️ Failed to clean up temp directory:', cleanupError);
    }
  }
}

export async function autoCreateDatabaseIfMissing(
  docData: DocData,
  environment: 'preview' | 'production' = 'preview'
) {
  const rawEnvSettings = docData.meta?.envSettings || {};
  // Normalize envSettings to handle both old (flat) and new (preview/production) structures
  const envSettings = normalizeEnvSettings(rawEnvSettings, environment);
  const dbUrl = envSettings.DATABASE_URL;
  const jwt = envSettings.JWT_SECRET;
  const isMissing = !dbUrl || (dbUrl.includes('supabase') && !jwt);

  if (!isMissing) {
    console.log(`✅ Database exists for ${environment} environment`);
    return envSettings;
  }

  try {
    console.log(`🔧 Creating database for ${environment} environment...`);
    const deployDocId = generateDeployDocId(
      docData?.name || '',
      docData?.type || '',
      docData.id
    );
    const createdDbUrl = await createDbBackend(deployDocId, DBTYPES.NEON);

    if (!createdDbUrl) {
      throw new Error('No database URL returned from createDb');
    }

    const newEnvSettings = {
      DATABASE_URL: createdDbUrl,
      JWT_SECRET: '',
    };

    // Save to specific environment
    await saveDatabaseSettingsToDoc(docData.id, newEnvSettings, environment);

    console.log(
      `✅ Database created successfully for ${environment} environment`
    );

    return { ...envSettings, ...newEnvSettings };
  } catch (err) {
    console.error(`❌ Backend DB setup failed for ${environment}:`, err);
    docData.onProgress?.(
      JSON.stringify({
        status: {
          message: `Database creation failed for ${environment} environment`,
        },
      })
    );
    throw err;
  }
}
