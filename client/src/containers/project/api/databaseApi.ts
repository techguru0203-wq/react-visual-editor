import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';
import { TableInfo } from '../components/prototype/PrototypeDataBaseHandler';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export async function getTablesList(
  documentId: string,
  environment: 'preview' | 'production' = 'preview'
): Promise<ApiResponse<{ tables: TableInfo[] }>> {
  const headers = await getHeaders();
  const result = await fetch(
    `${api_url}/api/database/${documentId}/tables?environment=${environment}`,
    {
      method: 'GET',
      headers,
      credentials: 'include',
    }
  );

  const data = await result.json();
  return data;
}

export async function getTableData(
  documentId: string,
  tableName: string,
  columns: string[],
  connectionString?: string,
  page?: number,
  pageSize?: number,
  searchQuery?: string,
  searchFields?: string[],
  sortField?: string,
  sortOrder?: 'ascend' | 'descend'
): Promise<ApiResponse<{ rows: any[]; total: number }>> {
  const headers = await getHeaders();

  const result = await fetch(
    `${api_url}/api/database/${documentId}/tables/${tableName}/data`,
    {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        columns,
        connectionString,
        page,
        pageSize,
        searchQuery,
        searchFields,
        sortField,
        sortOrder,
      }),
    }
  );

  const data = await result.json();
  return data;
}

export interface Condition {
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

export async function queryTableData(
  documentId: string,
  tableName: string,
  fields: string[],
  conditions: Array<{ field: string; operator: string; value: any }>
): Promise<ApiResponse<{ result: any[] }>> {
  const headers = await getHeaders();
  const result = await fetch(
    `${api_url}/api/database/${documentId}/tables/${tableName}/query`,
    {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ fields, conditions }),
    }
  );

  const data = await result.json();
  return data;
}

export async function saveDocumentToDatabaseApi(
  documentId: string,
  content: string
) {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/database/${documentId}/save`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ content }),
  });

  const data = await result.json();
  return data;
}

export async function createDb(
  projectName: string,
  dbType: string
): Promise<string> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/database/init-db`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ projectName, dbType }),
  });

  const { success, data, error } = await result.json();

  if (!success) {
    throw new Error(`Create DB failed: ${error}`);
  }

  const dbUrl = data?.connection_uris?.[0]?.connection_uri;

  if (!dbUrl) {
    throw new Error('No database URL returned');
  }

  console.log('✅ DB created:', dbUrl);
  return dbUrl;
}

export async function resetDatabase(
  documentId: string,
  environment: 'preview' | 'production' = 'preview'
): Promise<
  ApiResponse<{
    info: string;
    tablesDropped: number;
    tables: string[];
    filesExecuted?: number;
    migrationError?: string;
  }>
> {
  const headers = await getHeaders();
  const result = await fetch(
    `${api_url}/api/database/${documentId}/reset?environment=${environment}`,
    {
      method: 'POST',
      headers,
      credentials: 'include',
    }
  );

  const data = await result.json();
  return data;
}

export async function updateTableRow(
  documentId: string,
  tableName: string,
  primaryKey: string,
  primaryKeyValue: any,
  data: Record<string, any>,
  environment: 'preview' | 'production' = 'preview'
): Promise<ApiResponse<{ row: any }>> {
  const headers = await getHeaders();
  const result = await fetch(
    `${api_url}/api/database/${documentId}/tables/${tableName}/row?environment=${environment}`,
    {
      method: 'PUT',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        primaryKey,
        primaryKeyValue,
        data,
      }),
    }
  );

  const responseData = await result.json();
  return responseData;
}

export async function insertTableRow(
  documentId: string,
  tableName: string,
  data: Record<string, any>,
  upsertPrimaryKey?: string,
  environment: 'preview' | 'production' = 'preview'
): Promise<ApiResponse<{ row: any }>> {
  const headers = await getHeaders();
  const result = await fetch(
    `${api_url}/api/database/${documentId}/tables/${tableName}/row?environment=${environment}`,
    {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        data,
        upsertPrimaryKey,
      }),
    }
  );

  const responseData = await result.json();
  return responseData;
}

export async function batchInsertTableRows(
  documentId: string,
  tableName: string,
  dataArray: Array<Record<string, any>>,
  upsertPrimaryKey?: string,
  environment: 'preview' | 'production' = 'preview'
): Promise<
  ApiResponse<{ inserted: number; failed: number; errors: string[] }>
> {
  const headers = await getHeaders();
  const result = await fetch(
    `${api_url}/api/database/${documentId}/tables/${tableName}/batch?environment=${environment}`,
    {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        dataArray,
        upsertPrimaryKey,
      }),
    }
  );

  const responseData = await result.json();
  return responseData;
}

export async function deleteTableRowsApi(
  documentId: string,
  tableName: string,
  primaryKey: string,
  ids: Array<string | number>,
  environment: 'preview' | 'production' = 'preview'
): Promise<ApiResponse<{ deleted: number }>> {
  const headers = await getHeaders();
  const result = await fetch(
    `${api_url}/api/database/${documentId}/tables/${tableName}/rows?environment=${environment}`,
    {
      method: 'DELETE',
      headers,
      credentials: 'include',
      body: JSON.stringify({ primaryKey, ids }),
    }
  );

  const responseData = await result.json();
  return responseData;
}

export async function clearTableApi(
  documentId: string,
  tableName: string,
  environment: 'preview' | 'production' = 'preview'
): Promise<ApiResponse<{ info: string }>> {
  const headers = await getHeaders();
  const result = await fetch(
    `${api_url}/api/database/${documentId}/tables/${tableName}/clear?environment=${environment}`,
    {
      method: 'POST',
      headers,
      credentials: 'include',
    }
  );

  const responseData = await result.json();
  return responseData;
}

export async function executeSql(
  documentId: string,
  sql: string,
  environment: 'preview' | 'production' = 'preview'
): Promise<
  ApiResponse<{
    rows: any[];
    rowCount: number;
    fields: any[];
    executionTime: number;
    truncated?: boolean;
  }>
> {
  const headers = await getHeaders();
  const result = await fetch(
    `${api_url}/api/database/${documentId}/execute-sql`,
    {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ sql, environment }),
    }
  );
  return await result.json();
}

export async function getSqlHistory(
  documentId: string,
  environment: 'preview' | 'production' = 'preview',
  limit: number = 25,
  offset: number = 0
): Promise<ApiResponse<{ logs: any[]; total: number }>> {
  const headers = await getHeaders();
  const result = await fetch(
    `${api_url}/api/database/${documentId}/sql-history?environment=${environment}&limit=${limit}&offset=${offset}`,
    {
      method: 'GET',
      headers,
      credentials: 'include',
    }
  );
  return await result.json();
}
