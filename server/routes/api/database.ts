import { Router, Request, Response } from 'express';
import {
  getTablesWithColumns,
  getTableData,
  updateTableRow,
  insertTableRow,
  batchInsertTableRows,
  upsertTableRow,
  deleteTableRows,
  clearTable,
} from '../../services/postgresService';
import { runMigrationFiles } from '../../services/databaseService';
import {
  validateSqlStatement,
  executeSql,
} from '../../services/sqlValidationService';
import { Client } from 'pg';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import prisma from '../../db/prisma';
import { Prisma, DocumentPermissionTypes } from '@prisma/client';
import {
  EnvSettings,
  getEnvSettingsForDoc,
} from '../../services/documentService';
import { normalizeEnvSettings } from '../../lib/util';
import { checkProjectAccess } from '../../services/projectService';
import { Environment } from '../../../shared/types';
import { updateDocumentMeta } from '../../services/documentMetaService';

const router = Router();

/**
 * Check if the current user has permission to modify database configuration
 * Only project creators (admin) can modify database settings
 */
async function checkDatabaseConfigPermission(
  documentId: string,
  userId: string,
  email: string,
  organizationId: string
): Promise<{ hasPermission: boolean; error?: string }> {
  // Get document with project info
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      project: true,
    },
  });

  if (!document) {
    return { hasPermission: false, error: 'Document not found' };
  }

  if (!document.project) {
    return {
      hasPermission: false,
      error: 'Project not found for this document',
    };
  }

  // Check project access using existing service
  const { hasAccess, projectPermission } = await checkProjectAccess(
    document.project,
    email,
    userId,
    organizationId
  );

  // Only creators (with EDIT permission) can modify database configuration
  if (!hasAccess || projectPermission !== DocumentPermissionTypes.EDIT) {
    return {
      hasPermission: false,
      error: 'Only project creators can modify database configuration',
    };
  }

  return { hasPermission: true };
}

// Get tables endpoint
router.get('/:documentId/tables', async (request, response) => {
  const { documentId } = request.params;
  const environment: Environment =
    request.query.environment === 'production' ? 'production' : 'preview';

  const rawEnvSettings = await getEnvSettingsForDoc(documentId);
  const envSettings = normalizeEnvSettings(rawEnvSettings, environment);
  let connectionString = envSettings?.DATABASE_URL as string;
  if (!connectionString) {
    return response.status(400).json({
      success: false,
      data: {
        info: 'Connection string is required',
        error: 'Missing connection string',
      },
    });
  }

  try {
    const tables = await getTablesWithColumns(connectionString);
    return response.status(200).json({
      success: true,
      data: { info: 'Tables fetched successfully', tables },
    });
  } catch (error) {
    console.error('Error fetching tables:', error);
    return response.status(500).json({
      success: false,
      data: {
        info: 'Failed to fetch tables',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

// Get table data endpoint
router.post(
  '/:connectionId/tables/:tableName/data',
  async (request, response) => {
    const { connectionId, tableName } = request.params;
    const {
      connectionString,
      page = 1,
      pageSize = 10,
      searchQuery,
      searchFields,
      sortField,
      sortOrder,
    } = request.body;

    if (!connectionString || typeof connectionString !== 'string') {
      return response.status(400).json({
        success: false,
        data: {
          info: 'Connection string is required',
          error: 'Missing connection string',
        },
      });
    }

    try {
      const { rows, total } = await getTableData(
        connectionString,
        tableName,
        page,
        pageSize,
        {
          searchQuery,
          searchFields,
          sortField,
          sortOrder,
        }
      );
      return response.status(200).json({
        success: true,
        data: {
          info: 'Table data fetched successfully',
          rows,
          total,
        },
      });
    } catch (error) {
      console.error('Error fetching table data:', error);
      return response.status(500).json({
        success: false,
        data: {
          info: 'Failed to fetch table data',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

// Query data endpoint
// Deprecated: query route kept for compatibility; delegates to data endpoint semantics
router.post(
  '/:connectionId/tables/:tableName/query',
  async (request, response) => {
    const { connectionId, tableName } = request.params;
    const { connectionString, query, page = 1, pageSize = 10 } = request.body;

    if (!connectionString || typeof connectionString !== 'string') {
      return response.status(400).json({
        success: false,
        data: {
          info: 'Connection string is required',
          error: 'Missing connection string',
        },
      });
    }

    try {
      const { rows, total } = await getTableData(
        connectionString,
        tableName,
        page,
        pageSize,
        {
          searchQuery: query,
        }
      );
      return response.status(200).json({
        success: true,
        data: {
          info: 'Data queried successfully',
          rows,
          total,
        },
      });
    } catch (error) {
      console.error('Error querying data:', error);
      return response.status(500).json({
        success: false,
        data: {
          info: 'Failed to query data',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

// Update table row endpoint
router.put('/:documentId/tables/:tableName/row', async (request, response) => {
  const { documentId, tableName } = request.params;
  const { primaryKey, primaryKeyValue, data } = request.body;
  const environment: Environment =
    request.query.environment === 'production' ? 'production' : 'preview';

  if (!primaryKey || primaryKeyValue === undefined || !data) {
    return response.status(400).json({
      success: false,
      data: {
        info: 'Primary key, primary key value, and data are required',
        error: 'Missing required parameters',
      },
    });
  }

  try {
    const rawEnvSettings = await getEnvSettingsForDoc(documentId);
    const envSettings = normalizeEnvSettings(rawEnvSettings, environment);
    const connectionString = envSettings?.DATABASE_URL as string;

    if (!connectionString) {
      return response.status(400).json({
        success: false,
        data: {
          info: 'Connection string is required',
          error: 'Missing connection string',
        },
      });
    }

    const updatedRow = await updateTableRow(
      connectionString,
      tableName,
      primaryKey,
      primaryKeyValue,
      data
    );

    return response.status(200).json({
      success: true,
      data: {
        info: 'Row updated successfully',
        row: updatedRow,
      },
    });
  } catch (error) {
    console.error('Error updating row:', error);
    return response.status(500).json({
      success: false,
      data: {
        info: 'Failed to update row',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

// Insert table row endpoint
router.post('/:documentId/tables/:tableName/row', async (request, response) => {
  const { documentId, tableName } = request.params;
  const { data, upsertPrimaryKey } = request.body;
  const environment: Environment =
    request.query.environment === 'production' ? 'production' : 'preview';

  if (!data) {
    return response.status(400).json({
      success: false,
      data: {
        info: 'Data is required',
        error: 'Missing required parameters',
      },
    });
  }

  try {
    const rawEnvSettings = await getEnvSettingsForDoc(documentId);
    const envSettings = normalizeEnvSettings(rawEnvSettings, environment);
    const connectionString = envSettings?.DATABASE_URL as string;

    if (!connectionString) {
      return response.status(400).json({
        success: false,
        data: {
          info: 'Connection string is required',
          error: 'Missing connection string',
        },
      });
    }

    let newRow;
    if (
      upsertPrimaryKey &&
      typeof upsertPrimaryKey === 'string' &&
      data &&
      data[upsertPrimaryKey] !== undefined
    ) {
      newRow = await upsertTableRow(
        connectionString,
        tableName,
        upsertPrimaryKey,
        data
      );
    } else {
      newRow = await insertTableRow(connectionString, tableName, data);
    }

    return response.status(201).json({
      success: true,
      data: {
        info: 'Row inserted successfully',
        row: newRow,
      },
    });
  } catch (error) {
    console.error('Error inserting row:', error);
    return response.status(500).json({
      success: false,
      data: {
        info: 'Failed to insert row',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

// Batch insert rows endpoint
router.post(
  '/:documentId/tables/:tableName/batch',
  async (request, response) => {
    const { documentId, tableName } = request.params;
    const { dataArray, upsertPrimaryKey } = request.body as {
      dataArray?: Array<Record<string, any>>;
      upsertPrimaryKey?: string;
    };
    const environment: Environment =
      request.query.environment === 'production' ? 'production' : 'preview';

    if (!dataArray || !Array.isArray(dataArray) || dataArray.length === 0) {
      return response.status(400).json({
        success: false,
        data: {
          info: 'Data array is required and must be non-empty',
          error: 'Missing or invalid data array',
        },
      });
    }

    // Limit batch size to prevent abuse
    const MAX_BATCH_SIZE = 1000;
    if (dataArray.length > MAX_BATCH_SIZE) {
      return response.status(400).json({
        success: false,
        data: {
          info: `Batch size exceeds maximum of ${MAX_BATCH_SIZE}`,
          error: 'Batch too large',
        },
      });
    }

    try {
      const rawEnvSettings = await getEnvSettingsForDoc(documentId);
      const envSettings = normalizeEnvSettings(rawEnvSettings, environment);
      const connectionString = envSettings?.DATABASE_URL as string;

      if (!connectionString) {
        return response.status(400).json({
          success: false,
          data: {
            info: 'Connection string is required',
            error: 'Missing connection string',
          },
        });
      }

      console.log(
        `Batch insert starting: ${dataArray.length} rows into ${tableName}`
      );
      const startTime = Date.now();

      const result = await batchInsertTableRows(
        connectionString,
        tableName,
        dataArray,
        upsertPrimaryKey
      );

      const duration = Date.now() - startTime;
      console.log(
        `Batch insert completed in ${duration}ms: inserted=${result.inserted}, failed=${result.failed}`
      );

      return response.status(201).json({
        success: true,
        data: {
          info: 'Batch insert completed',
          inserted: result.inserted,
          failed: result.failed,
          errors: result.errors,
        },
      });
    } catch (error) {
      console.error('Error batch inserting rows:', error);
      return response.status(500).json({
        success: false,
        data: {
          info: 'Failed to batch insert rows',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

// Delete multiple rows endpoint
router.delete(
  '/:documentId/tables/:tableName/rows',
  async (request, response) => {
    const { documentId, tableName } = request.params;
    const { primaryKey, ids } = request.body as {
      primaryKey?: string;
      ids?: Array<string | number>;
    };
    const environment: Environment =
      request.query.environment === 'production' ? 'production' : 'preview';

    if (!primaryKey || !ids || !Array.isArray(ids) || ids.length === 0) {
      return response.status(400).json({
        success: false,
        data: {
          info: 'Primary key and non-empty ids array are required',
          error: 'Missing required parameters',
        },
      });
    }

    try {
      const rawEnvSettings = await getEnvSettingsForDoc(documentId);
      const envSettings = normalizeEnvSettings(rawEnvSettings, environment);
      const connectionString = envSettings?.DATABASE_URL as string;

      if (!connectionString) {
        return response.status(400).json({
          success: false,
          data: {
            info: 'Connection string is required',
            error: 'Missing connection string',
          },
        });
      }

      const deleted = await deleteTableRows(
        connectionString,
        tableName,
        primaryKey,
        ids
      );

      return response.status(200).json({
        success: true,
        data: {
          info: 'Rows deleted successfully',
          deleted,
        },
      });
    } catch (error) {
      console.error('Error deleting rows:', error);
      return response.status(500).json({
        success: false,
        data: {
          info: 'Failed to delete rows',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

// Clear table endpoint (truncate)
router.post(
  '/:documentId/tables/:tableName/clear',
  async (request, response) => {
    const { documentId, tableName } = request.params;
    const environment: Environment =
      request.query.environment === 'production' ? 'production' : 'preview';

    try {
      const rawEnvSettings = await getEnvSettingsForDoc(documentId);
      const envSettings = normalizeEnvSettings(rawEnvSettings, environment);
      const connectionString = envSettings?.DATABASE_URL as string;

      if (!connectionString) {
        return response.status(400).json({
          success: false,
          data: {
            info: 'Connection string is required',
            error: 'Missing connection string',
          },
        });
      }

      await clearTable(connectionString, tableName);
      return response.status(200).json({
        success: true,
        data: {
          info: 'Table cleared successfully',
        },
      });
    } catch (error) {
      console.error('Error clearing table:', error);
      return response.status(500).json({
        success: false,
        data: {
          info: 'Failed to clear table',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

router.post('/init-db', async (req, res) => {
  const { projectName, dbType } = req.body;

  if (!projectName || !dbType) {
    return res
      .status(400)
      .json({ success: false, error: 'projectName and dbType are required' });
  }

  try {
    let response;
    let data;

    switch (dbType) {
      case 'neon':
        response = await fetch('https://console.neon.tech/api/v2/projects', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.NEON_API_KEY}`, //  用你的 NEON DEV token
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            project: {
              name: projectName,
              region_id: 'aws-us-east-2',
            },
          }),
        });
        data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to create Neon project');
        }

        break;

      default:
        return res
          .status(400)
          .json({ success: false, error: `Unsupported dbType: ${dbType}` });
    }

    res.json({ success: true, data });
  } catch (err: any) {
    console.error('Database creation error:', err);
    res
      .status(500)
      .json({ success: false, error: err.message ?? 'Unknown error' });
  }
});

// Reset database endpoint - drops all tables and reruns migrations
router.post('/:documentId/reset', async (request, response) => {
  const { documentId } = request.params;
  const environment: Environment =
    request.query.environment === 'production' ? 'production' : 'preview';

  // Check permission - only project creators can reset database
  const currentUser = response.locals.currentUser;
  if (!currentUser) {
    return response.status(401).json({
      success: false,
      data: {
        info: 'Unauthorized',
        error: 'User not authenticated',
      },
    });
  }

  const permissionCheck = await checkDatabaseConfigPermission(
    documentId,
    currentUser.userId,
    currentUser.email,
    currentUser.organizationId
  );

  if (!permissionCheck.hasPermission) {
    return response.status(403).json({
      success: false,
      data: {
        info: 'Forbidden',
        error:
          permissionCheck.error ||
          'You do not have permission to reset this database',
      },
    });
  }

  // Fetch document data (includes content and meta with env settings)
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { content: true, meta: true },
  });

  if (!document) {
    return response.status(404).json({
      success: false,
      data: {
        info: 'Document not found',
        error: 'Document with the specified ID does not exist',
      },
    });
  }

  // Extract environment settings from document meta and normalize for the target environment
  const docMeta = document.meta as Prisma.JsonObject;
  const rawEnvSettings = docMeta.envSettings as EnvSettings;
  const envSettings = normalizeEnvSettings(rawEnvSettings, environment);
  let connectionString = envSettings?.DATABASE_URL as string;
  if (!connectionString) {
    return response.status(400).json({
      success: false,
      data: {
        info: 'Connection string is required',
        error: 'Missing connection string',
      },
    });
  }

  const client = new Client({
    connectionString: connectionString,
  });

  try {
    await client.connect();

    // Get all table names
    const tablesResult = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `);

    const tableNames = tablesResult.rows.map((row) => row.tablename);

    // Drop all tables (CASCADE to handle foreign key constraints)
    for (const tableName of tableNames) {
      await client.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
    }

    await client.end();

    // Now rerun migrations to recreate the database
    console.log('🔄 Rerunning migrations after table drop...');
    const generateContent = document.content
      ? document.content.toString('utf8')
      : '{}';

    const migrationResult = await runMigrationFiles(
      connectionString,
      generateContent
    );

    if (!migrationResult.success) {
      console.warn('⚠️ Migration rerun failed:', migrationResult.error);
      // Still return success for the table drop, but note migration issue
      return response.status(200).json({
        success: true,
        data: {
          info: 'Tables dropped successfully, but migration rerun failed',
          tablesDropped: tableNames.length,
          tables: tableNames,
          migrationError: migrationResult.error,
          filesExecuted: migrationResult.filesExecuted,
        },
      });
    }

    // Update migration tracking after successful reset and migration rerun
    try {
      console.log(`🔄 Resetting migration tracking for ${environment}...`);

      // Parse generateContent to get migration file names
      const { files } = JSON.parse(generateContent);
      const migrationFileNames = files
        .filter(
          (file: any) =>
            file.path &&
            file.path.includes('migrations/') &&
            file.path.endsWith('.sql')
        )
        .map((file: any) => {
          const pathParts = file.path.split('/');
          return pathParts[pathParts.length - 1]; // Get filename only
        })
        .sort(); // Sort to ensure correct order

      // Get current migration tracking
      const currentDoc = await prisma.document.findUnique({
        where: { id: documentId },
        select: { meta: true },
      });

      const currentMeta = (currentDoc?.meta as any) || {};
      const migrationTracking = currentMeta.migrationTracking || {};

      // Reset the tracking for this environment with the executed migrations
      const updatedMigrationTracking = {
        ...migrationTracking,
        [environment]: migrationFileNames,
      };

      // Use partial update to preserve other meta fields
      await updateDocumentMeta(documentId, {
        migrationTracking: updatedMigrationTracking,
      });

      console.log(
        `✅ Migration tracking reset for ${environment}: ${migrationFileNames.length} migrations recorded`
      );
    } catch (trackingError) {
      console.error('⚠️ Failed to update migration tracking:', trackingError);
      // Don't fail the reset operation just because tracking update failed
    }

    return response.status(200).json({
      success: true,
      data: {
        info: 'Database reset and migrations rerun successfully',
        tablesDropped: tableNames.length,
        tables: tableNames,
        filesExecuted: migrationResult.filesExecuted,
      },
    });
  } catch (error) {
    console.error('Error resetting database:', error);
    await client.end();
    return response.status(500).json({
      success: false,
      data: {
        info: 'Failed to reset database',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

// User management endpoints for generated app database
// List users (exclude password)
router.get(
  '/:documentId/users',
  async (request: Request, response: Response) => {
    const { documentId } = request.params;
    const environment: Environment =
      request.query.environment === 'production' ? 'production' : 'preview';

    try {
      const rawEnvSettings = await getEnvSettingsForDoc(documentId);
      const envSettings = normalizeEnvSettings(rawEnvSettings, environment);
      const connectionString = envSettings?.DATABASE_URL as string;
      if (!connectionString) {
        return response.status(400).json({
          success: false,
          data: {
            info: 'Connection string is required',
            error: 'Missing connection string',
          },
        });
      }

      const sql = postgres(connectionString, {
        ssl: { rejectUnauthorized: false },
        max: 10,
        idle_timeout: 20,
        connect_timeout: 10,
      });
      try {
        const rows = await sql<
          {
            id: string;
            name: string;
            email: string;
            created_at: string;
            updated_at: string;
          }[]
        >`
        SELECT id, name, email, created_at, updated_at
        FROM "Users"
        ORDER BY created_at DESC
      `;
        return response.status(200).json({
          success: true,
          data: { users: rows },
        });
      } finally {
        await sql.end();
      }
    } catch (error) {
      console.error('Error listing users:', error);
      return response.status(500).json({
        success: false,
        data: {
          info: 'Failed to list users',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

// Create user (hash password with bcrypt before insert)
router.post(
  '/:documentId/users',
  async (request: Request, response: Response) => {
    const { documentId } = request.params;
    const environment: Environment =
      request.query.environment === 'production' ? 'production' : 'preview';
    const { name, email, password, confirmPassword } = request.body || {};

    if (!name || !email || !password || !confirmPassword) {
      return response.status(400).json({
        success: false,
        data: {
          info: 'name, email, password and confirmPassword are required',
          error: 'Missing required fields',
        },
      });
    }
    if (typeof email !== 'string' || !email.includes('@')) {
      return response.status(400).json({
        success: false,
        data: {
          info: 'Invalid email',
          error: 'Invalid email',
        },
      });
    }
    if (password !== confirmPassword) {
      return response.status(400).json({
        success: false,
        data: {
          info: 'Passwords do not match',
          error: 'Passwords do not match',
        },
      });
    }
    if (String(password).length < 6) {
      return response.status(400).json({
        success: false,
        data: {
          info: 'Password must be at least 6 characters',
          error: 'Weak password',
        },
      });
    }

    try {
      const rawEnvSettings = await getEnvSettingsForDoc(documentId);
      const envSettings = normalizeEnvSettings(rawEnvSettings, environment);
      const connectionString = envSettings?.DATABASE_URL as string;
      if (!connectionString) {
        return response.status(400).json({
          success: false,
          data: {
            info: 'Connection string is required',
            error: 'Missing connection string',
          },
        });
      }

      const sql = postgres(connectionString, {
        ssl: { rejectUnauthorized: false },
        max: 10,
        idle_timeout: 20,
        connect_timeout: 10,
      });

      try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const rows = await sql<
          {
            id: string;
            name: string;
            email: string;
            created_at: string;
            updated_at: string;
          }[]
        >`
        INSERT INTO "Users" (name, email, password)
        VALUES (${name}, ${email}, ${hashedPassword})
        RETURNING id, name, email, created_at, updated_at
      `;
        const user = rows[0];
        return response.status(201).json({
          success: true,
          data: { user },
        });
      } catch (e: any) {
        if (e && e.code === '23505') {
          // unique_violation
          return response.status(400).json({
            success: false,
            data: {
              info: 'Email already exists',
              error: 'Email already exists',
            },
          });
        }
        throw e;
      } finally {
        await sql.end();
      }
    } catch (error) {
      console.error('Error creating user:', error);
      return response.status(500).json({
        success: false,
        data: {
          info: 'Failed to create user',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

// Update user (optionally hash password if provided, always update updated_at)
router.put(
  '/:documentId/users/:userId',
  async (request: Request, response: Response) => {
    const { documentId, userId } = request.params;
    const environment: Environment =
      request.query.environment === 'production' ? 'production' : 'preview';
    const { name, email, password, confirmPassword } = request.body || {};

    if (
      (password !== undefined || confirmPassword !== undefined) &&
      password !== confirmPassword
    ) {
      return response.status(400).json({
        success: false,
        data: {
          info: 'Passwords do not match',
          error: 'Passwords do not match',
        },
      });
    }

    try {
      const rawEnvSettings = await getEnvSettingsForDoc(documentId);
      const envSettings = normalizeEnvSettings(rawEnvSettings, environment);
      const connectionString = envSettings?.DATABASE_URL as string;
      if (!connectionString) {
        return response.status(400).json({
          success: false,
          data: {
            info: 'Connection string is required',
            error: 'Missing connection string',
          },
        });
      }

      const sql = postgres(connectionString, {
        ssl: { rejectUnauthorized: false },
        max: 10,
        idle_timeout: 20,
        connect_timeout: 10,
      });

      try {
        const updateData: Record<string, any> = {};
        if (name !== undefined) updateData.name = name;
        if (email !== undefined) updateData.email = email;
        if (password) {
          updateData.password = await bcrypt.hash(password, 10);
        }

        // Always update 'updated_at' to NOW
        updateData.updated_at = sql`NOW()`;

        // Remove updated_at from field count so logic still blocks no-op updates
        const keysWithoutUpdatedAt = Object.keys(updateData).filter(
          (key) => key !== 'updated_at'
        );
        if (keysWithoutUpdatedAt.length === 0) {
          return response.status(400).json({
            success: false,
            data: { info: 'No fields to update', error: 'No-op' },
          });
        }

        const rows = await sql<
          {
            id: string;
            name: string;
            email: string;
            created_at: string;
            updated_at: string;
          }[]
        >`
          UPDATE "Users"
          SET ${sql(updateData)}
          WHERE id = ${userId}
          RETURNING id, name, email, created_at, updated_at
        `;

        const user = rows[0];
        if (!user) {
          return response.status(404).json({
            success: false,
            data: { info: 'User not found', error: 'Not found' },
          });
        }

        return response.status(200).json({ success: true, data: { user } });
      } catch (e: any) {
        if (e && e.code === '23505') {
          return response.status(400).json({
            success: false,
            data: {
              info: 'Email already exists',
              error: 'Email already exists',
            },
          });
        }
        throw e;
      } finally {
        await sql.end();
      }
    } catch (error) {
      console.error('Error updating user:', error);
      return response.status(500).json({
        success: false,
        data: {
          info: 'Failed to update user',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

// Delete user
router.delete(
  '/:documentId/users/:userId',
  async (request: Request, response: Response) => {
    const { documentId, userId } = request.params;
    const environment: Environment =
      request.query.environment === 'production' ? 'production' : 'preview';

    try {
      const rawEnvSettings = await getEnvSettingsForDoc(documentId);
      const envSettings = normalizeEnvSettings(rawEnvSettings, environment);
      const connectionString = envSettings?.DATABASE_URL as string;
      if (!connectionString) {
        return response.status(400).json({
          success: false,
          data: {
            info: 'Connection string is required',
            error: 'Missing connection string',
          },
        });
      }

      const sql = postgres(connectionString, {
        ssl: { rejectUnauthorized: false },
        max: 10,
        idle_timeout: 20,
        connect_timeout: 10,
      });

      try {
        const result = await sql`
          DELETE FROM "Users" WHERE id = ${userId}
        `;
        // result.count not provided; treat as success regardless
        return response
          .status(200)
          .json({ success: true, data: { id: userId } });
      } finally {
        await sql.end();
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      return response.status(500).json({
        success: false,
        data: {
          info: 'Failed to delete user',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

// Execute SQL query
// Note: User authentication is handled by authenticatedRequestHandler middleware
router.post('/:documentId/execute-sql', async (request, response) => {
  const { documentId } = request.params;
  const { sql, environment = 'preview' } = request.body;
  const userId = response.locals.currentUser.userId;

  if (!sql || typeof sql !== 'string') {
    return response.status(400).json({
      success: false,
      error: 'SQL statement is required',
      message: 'Missing or invalid SQL statement',
    });
  }

  const startTime = Date.now();
  let sqlType = 'UNKNOWN';
  let status = 'ERROR';
  let errorMessage: string | null = null;
  let rowsAffected: number | null = null;

  try {
    // Validate SQL
    const validation = validateSqlStatement(sql);
    sqlType = validation.sqlType;

    if (!validation.valid) {
      errorMessage = validation.error || 'Invalid SQL statement';
      await prisma.sqlAuditLog.create({
        data: {
          documentId,
          userId,
          environment,
          sqlStatement: sql,
          sqlType,
          status: 'ERROR',
          errorMessage,
          executionTime: Date.now() - startTime,
        },
      });

      return response.status(400).json({
        success: false,
        error: errorMessage,
        message: 'SQL validation failed',
      });
    }

    // Get connection string
    const rawEnvSettings = await getEnvSettingsForDoc(documentId);
    const envSettings = normalizeEnvSettings(rawEnvSettings, environment);
    const connectionString = envSettings?.DATABASE_URL as string;

    if (!connectionString) {
      throw new Error('Database connection not configured');
    }

    // Execute SQL with timeout (30 seconds)
    const result = await executeSql(connectionString, sql, 30000);

    status = 'SUCCESS';
    rowsAffected = result.rowCount;
    const executionTime = Date.now() - startTime;

    // Log audit
    await prisma.sqlAuditLog.create({
      data: {
        documentId,
        userId,
        environment,
        sqlStatement: sql,
        sqlType,
        status,
        rowsAffected,
        executionTime,
      },
    });

    // Limit result size for SELECT queries
    const maxRows = 1000;
    const rows = result.rows.slice(0, maxRows);
    const truncated = result.rows.length > maxRows;

    return response.status(200).json({
      success: true,
      data: {
        rows,
        rowCount: result.rowCount,
        fields: result.fields,
        executionTime,
        truncated,
      },
    });
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const executionTime = Date.now() - startTime;

    // Log error to audit
    await prisma.sqlAuditLog.create({
      data: {
        documentId,
        userId,
        environment,
        sqlStatement: sql,
        sqlType,
        status: 'ERROR',
        errorMessage,
        executionTime,
      },
    });

    return response.status(500).json({
      success: false,
      error: errorMessage,
      message: 'SQL execution failed',
    });
  }
});

// Get SQL execution history
router.get('/:documentId/sql-history', async (request, response) => {
  const { documentId } = request.params;
  const environment = (request.query.environment as string) || 'preview';
  const limit = parseInt(request.query.limit as string) || 50;
  const offset = parseInt(request.query.offset as string) || 0;

  try {
    const [logs, total] = await Promise.all([
      prisma.sqlAuditLog.findMany({
        where: { documentId, environment },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: { id: true, email: true, username: true },
          },
        },
      }),
      prisma.sqlAuditLog.count({
        where: { documentId, environment },
      }),
    ]);

    return response.status(200).json({
      success: true,
      data: { logs, total },
    });
  } catch (error) {
    return response.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to fetch SQL history',
    });
  }
});

module.exports = {
  className: 'database',
  routes: router,
};
