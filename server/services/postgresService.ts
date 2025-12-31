import postgres from 'postgres';

interface TableInfo {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  udt_name?: string; // user defined type name for enums
}

interface TableData {
  tableName: string;
  columns: {
    name: string;
    type: string;
    nullable: boolean;
    defaultValue: string | null;
    allowedValues?: string[]; // enum labels or check constraint values
  }[];
}

interface TableRow {
  [key: string]: any;
}

const createClient = (connectionString: string) => {
  return postgres(connectionString, {
    ssl: { rejectUnauthorized: false },
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
};

export const getTablesWithColumns = async (
  connectionString: string
): Promise<TableData[]> => {
  const sql = createClient(connectionString);
  try {
    const tables = await sql<TableInfo[]>`
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default,
        udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `;

    // Fetch enum labels for all enum types
    const enumRows = await sql<{ enum_type: string; enum_values: string[] }[]>`
      SELECT t.typname AS enum_type,
             array_agg(e.enumlabel ORDER BY e.enumsortorder) AS enum_values
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      GROUP BY t.typname
    `;

    const enumMap = new Map<string, string[]>(
      enumRows.map((r) => [r.enum_type, r.enum_values])
    );

    // Fetch check constraints and try to parse allowed values (IN (...))
    const checkRows = await sql<
      {
        table_name: string;
        column_name: string;
        constraint_def: string;
      }[]
    >`
      SELECT
        c.relname::text AS table_name,
        a.attname::text AS column_name,
        pg_get_constraintdef(con.oid) AS constraint_def
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN LATERAL unnest(con.conkey) AS col(attnum) ON true
      JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = col.attnum
      WHERE con.contype = 'c'
    `;

    const checkMap = new Map<string, string[]>();
    const extractAllowedFromCheck = (def: string): string[] | null => {
      if (!def) return null;
      // Prefer explicit IN ('a','b')
      const inMatch = def.match(/IN \(([^\)]+)\)/i);
      if (inMatch && inMatch[1]) {
        const values = Array.from(inMatch[1].matchAll(/'([^']+)'/g)).map(
          (m) => m[1]
        );
        if (values.length > 0) return values;
      }
      // Fallback: ARRAY['a'::text,'b'::text]
      const arrayMatch = def.match(/ARRAY\s*\[([^\]]+)\]/i);
      if (arrayMatch && arrayMatch[1]) {
        const values = Array.from(arrayMatch[1].matchAll(/'([^']+)'/g)).map(
          (m) => m[1]
        );
        if (values.length > 0) return values;
      }
      return null;
    };

    checkRows.forEach((row) => {
      const allowed = extractAllowedFromCheck(row.constraint_def);
      if (allowed && allowed.length > 0) {
        checkMap.set(`${row.table_name}.${row.column_name}`, allowed);
      }
    });

    const tableMap = new Map<string, TableData>();

    tables.forEach((row) => {
      if (!tableMap.has(row.table_name)) {
        tableMap.set(row.table_name, {
          tableName: row.table_name,
          columns: [],
        });
      }

      const table = tableMap.get(row.table_name)!;
      const enumAllowed =
        row.data_type === 'USER-DEFINED' && row.udt_name
          ? enumMap.get(row.udt_name) || undefined
          : undefined;
      const checkAllowed = checkMap.get(`${row.table_name}.${row.column_name}`);

      table.columns.push({
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === 'YES',
        defaultValue: row.column_default,
        allowedValues: enumAllowed || checkAllowed,
      });
    });

    return Array.from(tableMap.values());
  } finally {
    await sql.end();
  }
};

/**
 * Get detailed structure for a single table
 * Returns null if table doesn't exist
 */
export const getTableStructure = async (
  connectionString: string,
  tableName: string
): Promise<TableData | null> => {
  const sql = createClient(connectionString);
  try {
    // Check if table exists first
    const tableExists = await sql<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ${tableName}
      ) as exists
    `;

    if (!tableExists[0]?.exists) {
      return null;
    }

    // Fetch table columns
    const columns = await sql<TableInfo[]>`
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default,
        udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${tableName}
      ORDER BY ordinal_position
    `;

    if (columns.length === 0) {
      return null;
    }

    // Fetch enum labels
    const enumRows = await sql<{ enum_type: string; enum_values: string[] }[]>`
      SELECT t.typname AS enum_type,
             array_agg(e.enumlabel ORDER BY e.enumsortorder) AS enum_values
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      GROUP BY t.typname
    `;

    const enumMap = new Map<string, string[]>(
      enumRows.map((r) => [r.enum_type, r.enum_values])
    );

    // Fetch check constraints for this table
    const checkRows = await sql<
      {
        column_name: string;
        constraint_def: string;
      }[]
    >`
      SELECT
        a.attname::text AS column_name,
        pg_get_constraintdef(con.oid) AS constraint_def
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN LATERAL unnest(con.conkey) AS col(attnum) ON true
      JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = col.attnum
      WHERE con.contype = 'c' AND c.relname = ${tableName}
    `;

    const checkMap = new Map<string, string[]>();
    const extractAllowedFromCheck = (def: string): string[] | null => {
      if (!def) return null;
      const inMatch = def.match(/IN \(([^\)]+)\)/i);
      if (inMatch && inMatch[1]) {
        const values = Array.from(inMatch[1].matchAll(/'([^']+)'/g)).map(
          (m) => m[1]
        );
        if (values.length > 0) return values;
      }
      const arrayMatch = def.match(/ARRAY\s*\[([^\]]+)\]/i);
      if (arrayMatch && arrayMatch[1]) {
        const values = Array.from(arrayMatch[1].matchAll(/'([^']+)'/g)).map(
          (m) => m[1]
        );
        if (values.length > 0) return values;
      }
      return null;
    };

    checkRows.forEach((row) => {
      const allowed = extractAllowedFromCheck(row.constraint_def);
      if (allowed && allowed.length > 0) {
        checkMap.set(row.column_name, allowed);
      }
    });

    // Build table data
    const tableData: TableData = {
      tableName,
      columns: columns.map((col) => {
        const enumAllowed =
          col.data_type === 'USER-DEFINED' && col.udt_name
            ? enumMap.get(col.udt_name) || undefined
            : undefined;
        const checkAllowed = checkMap.get(col.column_name);

        return {
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === 'YES',
          defaultValue: col.column_default,
          allowedValues: enumAllowed || checkAllowed,
        };
      }),
    };

    return tableData;
  } finally {
    await sql.end();
  }
};

export const getTableData = async (
  connectionString: string,
  tableName: string,
  page: number = 1,
  pageSize: number = 10,
  options?: {
    searchQuery?: string;
    searchFields?: string[];
    sortField?: string;
    sortOrder?: 'ascend' | 'descend';
  }
): Promise<{ rows: TableRow[]; total: number }> => {
  const sql = createClient(connectionString);
  try {
    const offset = (page - 1) * pageSize;

    const hasSearch =
      options?.searchQuery && String(options.searchQuery).trim() !== '';
    const searchValue = hasSearch
      ? `%${String(options!.searchQuery)}%`
      : undefined;

    // Determine columns to search if needed
    let columnsToSearch: string[] | null = null;
    if (hasSearch) {
      if (options?.searchFields && options.searchFields.length > 0) {
        columnsToSearch = options.searchFields;
      } else {
        const columns = await sql<{ column_name: string }[]>`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = ${tableName}
          ORDER BY ordinal_position
        `;
        columnsToSearch = columns.map((c) => c.column_name);
      }
    }

    // Build WHERE clause if search provided (no sql.join in current library)
    let whereClause: any = null;
    if (hasSearch && columnsToSearch && columnsToSearch.length > 0) {
      const parts = columnsToSearch.map(
        (col) => sql`${sql(col)}::text ILIKE ${searchValue as string}`
      );
      whereClause = parts.reduce(
        (acc: any, part) => (acc ? sql`${acc} OR ${part}` : part),
        null as any
      );
    }

    // Build ORDER BY clause if sort provided
    const orderByClause = options?.sortField
      ? sql`ORDER BY ${sql(options.sortField)} ${
          options.sortOrder === 'descend' ? sql`DESC` : sql`ASC`
        }`
      : sql``;

    const [rows, total] = await Promise.all([
      sql<TableRow[]>`
        SELECT * FROM ${sql(tableName)}
        ${whereClause ? sql`WHERE ${whereClause}` : sql``}
        ${orderByClause}
        LIMIT ${pageSize}
        OFFSET ${offset}
      `,
      sql<{ count: number }[]>`
        SELECT COUNT(*) as count FROM ${sql(tableName)}
        ${whereClause ? sql`WHERE ${whereClause}` : sql``}
      `,
    ]);

    return {
      rows,
      total: Number(total[0].count),
    };
  } finally {
    await sql.end();
  }
};

// Backwards-compat: delegate to getTableData with search options
export const queryTableData = async (
  connectionString: string,
  tableName: string,
  query: string,
  page: number = 1,
  pageSize: number = 10
): Promise<{ rows: TableRow[]; total: number }> => {
  return getTableData(connectionString, tableName, page, pageSize, {
    searchQuery: query,
  });
};

export const updateTableRow = async (
  connectionString: string,
  tableName: string,
  primaryKey: string,
  primaryKeyValue: any,
  data: Record<string, any>
): Promise<TableRow> => {
  const sql = createClient(connectionString);
  try {
    // Filter out the primary key from updates
    const updateData = Object.keys(data)
      .filter((key) => key !== primaryKey)
      .reduce((acc, key) => {
        acc[key] = data[key];
        return acc;
      }, {} as Record<string, any>);

    const result = await sql<TableRow[]>`
      UPDATE ${sql(tableName)}
      SET ${sql(updateData)}
      WHERE ${sql(primaryKey)} = ${primaryKeyValue}
      RETURNING *
    `;

    return result[0];
  } finally {
    await sql.end();
  }
};

export const insertTableRow = async (
  connectionString: string,
  tableName: string,
  data: Record<string, any>
): Promise<TableRow> => {
  const sql = createClient(connectionString);
  try {
    const result = await sql<TableRow[]>`
      INSERT INTO ${sql(tableName)} ${sql(data)}
      RETURNING *
    `;

    return result[0];
  } finally {
    await sql.end();
  }
};

export const batchInsertTableRows = async (
  connectionString: string,
  tableName: string,
  dataArray: Array<Record<string, any>>,
  upsertPrimaryKey?: string
): Promise<{ inserted: number; failed: number; errors: string[] }> => {
  if (!dataArray || dataArray.length === 0) {
    return { inserted: 0, failed: 0, errors: [] };
  }

  const sql = createClient(connectionString);
  try {
    let inserted = 0;
    let failed = 0;
    const errors: string[] = [];

    console.log(
      `Starting batch insert: ${
        dataArray.length
      } rows, upsert: ${!!upsertPrimaryKey}`
    );

    // If upsert is needed, handle each row individually to support ON CONFLICT
    if (upsertPrimaryKey) {
      console.log(`Using upsert mode with primary key: ${upsertPrimaryKey}`);
      for (let i = 0; i < dataArray.length; i++) {
        const data = dataArray[i];
        try {
          const hasPk = Object.prototype.hasOwnProperty.call(
            data,
            upsertPrimaryKey
          );
          if (!hasPk) {
            await sql`INSERT INTO ${sql(tableName)} ${sql(data)}`;
          } else {
            const updateData = { ...data };
            delete updateData[upsertPrimaryKey];
            await sql`
              INSERT INTO ${sql(tableName)} ${sql(data)}
              ON CONFLICT (${sql(upsertPrimaryKey)}) DO UPDATE SET ${sql(
              updateData
            )}
            `;
          }
          inserted++;

          // Log progress every 10 rows
          if ((i + 1) % 10 === 0) {
            console.log(`Upsert progress: ${i + 1}/${dataArray.length}`);
          }
        } catch (error) {
          failed++;
          const errorMsg =
            error instanceof Error ? error.message : 'Unknown error';
          console.error(`Row ${i} upsert failed:`, errorMsg);
          errors.push(`Row ${i}: ${errorMsg}`);

          // Only keep first 10 errors to avoid memory issues
          if (errors.length > 10) {
            errors.push(`... and ${failed - 10} more errors`);
            break;
          }
        }
      }
    } else {
      // Batch insert without upsert - much faster
      console.log('Using batch insert mode (no upsert)');
      try {
        await sql`INSERT INTO ${sql(tableName)} ${sql(dataArray)}`;
        inserted = dataArray.length;
        console.log(`Batch insert successful: ${inserted} rows`);
      } catch (error) {
        const batchError =
          error instanceof Error ? error.message : 'Unknown error';
        console.error(
          'Batch insert failed, falling back to individual inserts:',
          batchError
        );

        // If batch insert fails, fall back to individual inserts
        for (let i = 0; i < dataArray.length; i++) {
          const data = dataArray[i];
          try {
            await sql`INSERT INTO ${sql(tableName)} ${sql(data)}`;
            inserted++;

            // Log progress every 10 rows
            if ((i + 1) % 10 === 0) {
              console.log(
                `Individual insert progress: ${i + 1}/${dataArray.length}`
              );
            }
          } catch (err) {
            failed++;
            const errorMsg =
              err instanceof Error ? err.message : 'Unknown error';
            console.error(`Row ${i} insert failed:`, errorMsg);
            errors.push(`Row ${i}: ${errorMsg}`);

            // Only keep first 10 errors
            if (errors.length > 10) {
              errors.push(`... and ${failed - 10} more errors`);
              break;
            }
          }
        }
      }
    }

    console.log(
      `Batch insert completed: inserted=${inserted}, failed=${failed}`
    );
    return { inserted, failed, errors };
  } catch (error) {
    console.error('Fatal error in batchInsertTableRows:', error);
    throw error;
  } finally {
    await sql.end();
  }
};

export const upsertTableRow = async (
  connectionString: string,
  tableName: string,
  primaryKey: string,
  data: Record<string, any>
): Promise<TableRow> => {
  const sql = createClient(connectionString);
  try {
    // If primary key value is present in data, do upsert; otherwise plain insert
    const hasPk = Object.prototype.hasOwnProperty.call(data, primaryKey);
    if (!hasPk) {
      const inserted = await sql<TableRow[]>`
        INSERT INTO ${sql(tableName)} ${sql(data)}
        RETURNING *
      `;
      return inserted[0];
    }

    // Upsert using ON CONFLICT (primaryKey) DO UPDATE SET ...
    const updateData = { ...data } as Record<string, any>;
    delete updateData[primaryKey];

    const result = await sql<TableRow[]>`
      INSERT INTO ${sql(tableName)} ${sql(data)}
      ON CONFLICT (${sql(primaryKey)}) DO UPDATE SET ${sql(updateData)}
      RETURNING *
    `;
    return result[0];
  } finally {
    await sql.end();
  }
};

export const deleteTableRows = async (
  connectionString: string,
  tableName: string,
  primaryKey: string,
  ids: Array<string | number>
): Promise<number> => {
  const sql = createClient(connectionString);
  try {
    if (!ids || ids.length === 0) return 0;
    // Use RETURNING to get count of deleted rows
    const deleted = await sql<TableRow[]>`
      DELETE FROM ${sql(tableName)}
      WHERE ${sql(primaryKey)} IN ${sql(ids)}
      RETURNING *
    `;
    return deleted.length;
  } finally {
    await sql.end();
  }
};

export const clearTable = async (
  connectionString: string,
  tableName: string
): Promise<void> => {
  const sql = createClient(connectionString);
  try {
    // Truncate table and restart identity to keep PKs clean; cascade handles FKs
    await sql`
      TRUNCATE TABLE ${sql(tableName)} RESTART IDENTITY CASCADE
    `;
  } finally {
    await sql.end();
  }
};
