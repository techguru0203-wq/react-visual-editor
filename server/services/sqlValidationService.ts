import { Client } from 'pg';

export enum SqlType {
  SELECT = 'SELECT',
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  UNKNOWN = 'UNKNOWN',
}

const ALLOWED_SQL_TYPES = [
  SqlType.SELECT,
  SqlType.INSERT,
  SqlType.UPDATE,
  SqlType.DELETE,
];

export function detectSqlType(sql: string): SqlType {
  const trimmed = sql.trim().toUpperCase();
  if (trimmed.startsWith('SELECT')) return SqlType.SELECT;
  if (trimmed.startsWith('INSERT')) return SqlType.INSERT;
  if (trimmed.startsWith('UPDATE')) return SqlType.UPDATE;
  if (trimmed.startsWith('DELETE')) return SqlType.DELETE;
  return SqlType.UNKNOWN;
}

// Remove comments and quoted literals so keyword scanning won't produce
// false positives (e.g. CREATE inside identifiers like created_at, or in
// strings/quoted identifiers/comments).
function stripLiteralsAndComments(sql: string): string {
  let s = sql;
  // Line comments: -- comment
  s = s.replace(/--.*$/gm, ' ');
  // Block comments: /* comment */
  s = s.replace(/\/\*[\s\S]*?\*\//g, ' ');
  // Dollar-quoted strings (PostgreSQL): $$...$$ or $tag$...$tag$
  s = s.replace(/\$\$[\s\S]*?\$\$/g, ' ');
  s = s.replace(
    /\$[A-Za-z_][A-Za-z0-9_]*\$[\s\S]*?\$[A-Za-z_][A-Za-z0-9_]*\$/g,
    ' '
  );
  // Single-quoted strings: '...'
  s = s.replace(/'(?:[^'\\]|\\.|'')*'/g, ' ');
  // Double-quoted identifiers: "..."
  s = s.replace(/"(?:[^"\\]|\\.|"")*"/g, ' ');
  // Backtick-quoted identifiers (for compatibility): `...`
  s = s.replace(/`(?:[^`\\]|\\.)*`/g, ' ');
  return s;
}

function containsDangerousKeyword(sql: string, keyword: string): boolean {
  const sanitized = stripLiteralsAndComments(sql);
  // Match keyword as a whole word (letters/digits/underscore boundaries)
  const regex = new RegExp(`\\b${keyword}\\b`, 'i');
  return regex.test(sanitized);
}

export function validateSqlStatement(sql: string): {
  valid: boolean;
  sqlType: SqlType;
  error?: string;
} {
  if (!sql || sql.trim().length === 0) {
    return {
      valid: false,
      sqlType: SqlType.UNKNOWN,
      error: 'SQL statement is empty',
    };
  }

  const sqlType = detectSqlType(sql);

  if (!ALLOWED_SQL_TYPES.includes(sqlType)) {
    return {
      valid: false,
      sqlType,
      error: 'Only SELECT, INSERT, UPDATE, and DELETE statements are allowed',
    };
  }

  // Additional security checks using safer keyword detection
  const dangerousKeywords = [
    'DROP',
    'TRUNCATE',
    'ALTER',
    'CREATE',
    'GRANT',
    'REVOKE',
  ];
  for (const keyword of dangerousKeywords) {
    if (containsDangerousKeyword(sql, keyword)) {
      return {
        valid: false,
        sqlType,
        error: `Dangerous keyword "${keyword}" is not allowed`,
      };
    }
  }

  return { valid: true, sqlType };
}

export async function executeSql(
  connectionString: string,
  sql: string,
  timeout: number = 30000
): Promise<{ rows: any[]; rowCount: number; fields: any[] }> {
  const client = new Client({ connectionString, statement_timeout: timeout });

  try {
    await client.connect();

    // Use array row mode to keep column order and prevent key collisions
    const result = await client.query({ text: sql, rowMode: 'array' as const });

    const fields: any[] = result.fields || [];

    // Count occurrences of column names to detect duplicates
    const nameCounts = new Map<string, number>();
    for (const f of fields) {
      nameCounts.set(f.name, (nameCounts.get(f.name) || 0) + 1);
    }

    // Lookup real table names for involved table oids
    const tableIds = Array.from(
      new Set<number>(
        fields
          .map((f: any) => f.tableID)
          .filter((id: number) => typeof id === 'number' && id > 0)
      )
    );

    const tableNameByOid = new Map<number, string>();
    if (tableIds.length > 0) {
      const tableRes = await client.query(
        `
          SELECT c.oid::int AS oid, n.nspname AS schema, c.relname AS name
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.oid = ANY($1::oid[])
        `,
        [tableIds]
      );
      for (const r of tableRes.rows) {
        tableNameByOid.set(Number(r.oid), r.name);
      }
    }

    // Build unique field names (prefix duplicates with table name when possible)
    const usedNames = new Map<string, number>();
    const uniqueNames: string[] = fields.map((f: any) => {
      const base = String(f.name);
      const isDuplicate = (nameCounts.get(base) || 0) > 1;
      let candidate = base;
      if (isDuplicate) {
        const tableName = f.tableID ? tableNameByOid.get(f.tableID) : undefined;
        // Use double underscore instead of dot to avoid Ant Design dataIndex path parsing
        candidate = tableName ? `${tableName}_${base}` : base;
      }
      // Ensure uniqueness even in edge cases (e.g., same column selected twice)
      const count = (usedNames.get(candidate) || 0) + 1;
      usedNames.set(candidate, count);
      return count === 1 ? candidate : `${candidate}_${count}`;
    });

    // Remap array rows to objects with the unique field names
    const rowsAsObjects = (result.rows || []).map((row: any[]) => {
      const obj: Record<string, any> = {};
      for (let i = 0; i < uniqueNames.length; i += 1) {
        obj[uniqueNames[i]] = row[i];
      }
      return obj;
    });

    // Update field metadata with new names and attach resolved table name (optional)
    const updatedFields = fields.map((f: any, i: number) => ({
      ...f,
      name: uniqueNames[i],
      tableName: f.tableID ? tableNameByOid.get(f.tableID) : undefined,
    }));

    return {
      rows: rowsAsObjects,
      rowCount: result.rowCount || 0,
      fields: updatedFields,
    };
  } finally {
    await client.end();
  }
}
