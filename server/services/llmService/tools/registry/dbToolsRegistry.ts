/**
 * Database tools registered with unified Tool Registry
 */

import { z } from 'zod';
import { globalToolRegistry, ToolDefinition } from './ToolRegistry';
import { getEnvSettingsForDoc } from '../../../documentService';
import {
  getTablesWithColumns,
  getTableStructure,
  getTableData as pgGetTableData,
  queryTableData as pgQueryTableData,
  insertTableRow as pgInsertRow,
  updateTableRow as pgUpdateRow,
  upsertTableRow as pgUpsertRow,
  deleteTableRows as pgDeleteRow,
} from '../../../postgresService';
import { normalizeEnvSettings } from '../../../../lib/util';

// Shared helper
async function resolveConnectionString(docId: string): Promise<string> {
  const rawEnv = await getEnvSettingsForDoc(docId);
  // Normalize envSettings to handle both old (flat) and new (preview/production) structures
  const env = normalizeEnvSettings(rawEnv, 'preview');
  const conn = env?.DATABASE_URL || '';
  if (!conn) {
    throw new Error(
      'No database connection found on document meta.envSettings.DATABASE_URL'
    );
  }
  return conn;
}

function toJSONString(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

// db_list_tables tool
const dbListTablesTool: ToolDefinition = {
  name: 'db_list_tables',
  version: '1.0.0',
  description:
    'List tables and their columns for the database associated with the current document. Uses the document ID from context automatically.',
  inputSchema: z.object({
    docId: z
      .string()
      .optional()
      .describe(
        'Optional: Document ID whose envSettings.DATABASE_URL will be used. If not provided, uses the current document from context.'
      ),
  }),
  permissions: ['db:read'],
  metadata: {
    category: 'db',
    requiresConfirm: false,
    timeoutMs: 10000,
  },
  handler: async (args, context) => {
    const connectionString = await resolveConnectionString(
      context.docId || args.docId!
    );
    const tables = await getTablesWithColumns(connectionString);

    // Limit payload size defensively
    const limited = tables.map((t) => ({
      tableName: t.tableName,
      columns: t.columns.slice(0, 30),
    }));

    return { success: true, output: { tables: limited } };
  },
};

// db_describe_table tool
const dbDescribeTableTool: ToolDefinition = {
  name: 'db_describe_table',
  version: '1.0.0',
  description:
    'Get detailed structure for a specific table in the current document database, including columns, types, constraints, and allowed values. Use this before writing to ensure correct table name and understand the schema.',
  inputSchema: z.object({
    docId: z
      .string()
      .optional()
      .describe(
        'Optional: Document ID whose envSettings.DATABASE_URL will be used. If not provided, uses the current document from context.'
      ),
    table: z.string().describe('Target table name to describe'),
  }),
  permissions: ['db:read'],
  metadata: {
    category: 'db',
    requiresConfirm: false,
    timeoutMs: 10000,
  },
  handler: async (args, context) => {
    const { docId, table } = args;
    const connectionString = await resolveConnectionString(
      context.docId || docId!
    );

    const tableStructure = await getTableStructure(connectionString, table);

    if (!tableStructure) {
      // Table doesn't exist, suggest similar table names
      const allTables = await getTablesWithColumns(connectionString);
      const tableNames = allTables.map((t) => t.tableName);

      // Find similar table names (case-insensitive match)
      const similar = tableNames.filter(
        (name) => name.toLowerCase() === table.toLowerCase()
      );

      return {
        success: false,
        error: {
          type: 'validation_error' as const,
          message: `Table "${table}" does not exist.${
            similar.length > 0
              ? ` Did you mean: ${similar.join(', ')}?`
              : ` Available tables: ${tableNames.slice(0, 10).join(', ')}${
                  tableNames.length > 10 ? '...' : ''
                }`
          }`,
        },
      };
    }

    return { success: true, output: { table: tableStructure } };
  },
};

// db_select tool
const dbSelectTool: ToolDefinition = {
  name: 'db_select',
  version: '1.0.0',
  description:
    'Query table data from the current document database with pagination and search. Uses the document ID from context automatically.',
  inputSchema: z.object({
    docId: z
      .string()
      .optional()
      .describe(
        'Optional: Document ID whose envSettings.DATABASE_URL will be used. If not provided, uses the current document from context.'
      ),
    table: z.string().describe('Target table name'),
    page: z
      .number()
      .int()
      .min(1)
      .optional()
      .default(1)
      .describe('1-based page number'),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .default(10)
      .describe('Max 50 rows'),
    search: z
      .string()
      .optional()
      .describe('Optional text to search across columns (ILIKE)'),
    fields: z
      .array(z.string())
      .optional()
      .default([])
      .describe('Optional field list for filtering'),
  }),
  permissions: ['db:read'],
  metadata: {
    category: 'db',
    requiresConfirm: false,
    timeoutMs: 15000,
  },
  handler: async (args, context) => {
    const { docId, table, page, pageSize, search, fields } = args;
    const connectionString = await resolveConnectionString(
      context.docId || docId!
    );

    const { rows, total } =
      search && search.trim().length > 0
        ? await pgQueryTableData(
            connectionString,
            table,
            search,
            page,
            pageSize
          )
        : await pgGetTableData(connectionString, table, page, pageSize);

    const filtered =
      fields && fields.length > 0
        ? rows.map((r) =>
            Object.fromEntries(
              Object.entries(r).filter(([k]) => fields.includes(k))
            )
          )
        : rows;

    return { success: true, output: { rows: filtered, total } };
  },
};

// db_write tool
const dbWriteTool: ToolDefinition = {
  name: 'db_write',
  version: '1.0.0',
  description:
    'Perform write operations on the current document database. Supports: INSERT (add new rows), UPDATE (modify existing rows), UPSERT (insert or update), and DELETE (remove rows). All operations require user confirmation. Uses the document ID from context automatically.',
  inputSchema: z.object({
    docId: z
      .string()
      .optional()
      .describe(
        'Optional: Document ID whose envSettings.DATABASE_URL will be used. If not provided, uses the current document from context.'
      ),
    table: z.string().describe('Target table name'),
    op: z
      .enum(['insert', 'update', 'upsert', 'delete'])
      .describe(
        'Write operation type: "insert" (add new row), "update" (modify existing row), "upsert" (insert or update), "delete" (remove row by primary key)'
      ),
    data: z
      .record(z.any())
      .default({})
      .describe(
        'Row data for insert/update/upsert operations. For DELETE operations, this field is ignored and not needed.'
      ),
    primaryKey: z
      .string()
      .optional()
      .describe(
        'Primary key column name. Required for update/upsert/delete operations to identify which row(s) to modify or remove.'
      ),
    primaryKeyValue: z
      .any()
      .optional()
      .describe(
        'Value of the primary key to match. Required for update and DELETE operations to identify the specific row to modify or remove.'
      ),
    confirm: z.boolean().optional().describe('Must be true to execute'),
  }),
  permissions: ['db:write'],
  metadata: {
    category: 'db',
    requiresConfirm: true,
    timeoutMs: 20000,
  },
  handler: async (args, context) => {
    const { docId, table, op, data, primaryKey, primaryKeyValue, confirm } =
      args;

    // Always require confirmation first
    if (confirm !== true) {
      return {
        success: false,
        requiresConfirm: true,
        confirmPayload: {
          kind: 'db_write',
          title: `Confirm database ${op} on table "${table}"`,
          details: {
            op,
            table,
            affectedKeys: Object.keys(data || {}),
          },
        },
      };
    }

    const connectionString = await resolveConnectionString(
      context.docId || docId!
    );

    // Verify table exists before attempting write operation
    const tableStructure = await getTableStructure(connectionString, table);
    if (!tableStructure) {
      // Suggest similar table names
      const allTables = await getTablesWithColumns(connectionString);
      const tableNames = allTables.map((t) => t.tableName);
      const similar = tableNames.filter(
        (name) => name.toLowerCase() === table.toLowerCase()
      );

      throw new Error(
        `Table "${table}" does not exist.${
          similar.length > 0
            ? ` Did you mean: ${similar.join(
                ', '
              )}? Use db_describe_table to check the schema first.`
            : ` Available tables: ${tableNames.slice(0, 10).join(', ')}${
                tableNames.length > 10 ? '...' : ''
              }. Use db_list_tables to see all tables.`
        }`
      );
    }

    if (op === 'insert') {
      let insertData = { ...data };
      let passwordWarning: string | undefined;

      // Special handling for Users table
      if (table.toLowerCase() === 'users' && 'password' in insertData) {
        passwordWarning = `Note: Password field cannot be encrypted during insertion. The administrator must change their password in Omniflow Project Setting -> User Management before user can login.`;
      }

      const row = await pgInsertRow(connectionString, table, insertData);

      return {
        success: true,
        output: {
          row,
          ...(passwordWarning ? { warning: passwordWarning } : {}),
        },
      };
    }

    if (op === 'update') {
      if (!primaryKey || typeof primaryKeyValue === 'undefined') {
        throw new Error(
          'primaryKey and primaryKeyValue are required for update'
        );
      }
      const row = await pgUpdateRow(
        connectionString,
        table,
        primaryKey,
        primaryKeyValue,
        data
      );
      return { success: true, output: { row } };
    }

    if (op === 'upsert') {
      if (!primaryKey) {
        throw new Error('primaryKey is required for upsert');
      }
      const row = await pgUpsertRow(connectionString, table, primaryKey, data);
      return { success: true, output: { row } };
    }

    if (op === 'delete') {
      if (!primaryKey || typeof primaryKeyValue === 'undefined') {
        throw new Error(
          'primaryKey and primaryKeyValue are required for delete'
        );
      }
      const deletedCount = await pgDeleteRow(
        connectionString,
        table,
        primaryKey,
        [primaryKeyValue]
      );
      return { success: true, output: { deletedCount } };
    }

    throw new Error(`Unsupported operation: ${op}`);
  },
};

// Register all DB tools
export function registerDbTools() {
  globalToolRegistry.register(dbListTablesTool);
  globalToolRegistry.register(dbDescribeTableTool);
  globalToolRegistry.register(dbSelectTool);
  globalToolRegistry.register(dbWriteTool);
}
