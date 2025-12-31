import { getDocumentApi } from '../../../documents/api/getDocumentApi';
import { getTablesList } from '../../api/databaseApi';

export interface TableInfo {
  tableName: string;
  columns: {
    name: string;
    type: string;
    nullable: boolean;
    defaultValue: string | null;
    allowedValues?: string[];
  }[];
}

export interface EnvSettings {
  DATABASE_URL?: string;
  JWT_SECRET?: string;
}

export interface DatabaseViewResult {
  settings: EnvSettings | null;
  tables: TableInfo[];
}

export async function handleViewDatabase(
  documentId: string,
  environment: 'preview' | 'production' = 'preview'
): Promise<DatabaseViewResult> {
  try {
    // Get document to check for envSettings in meta
    const document = await getDocumentApi(documentId);

    // Check if meta is a valid object and extract envSettings
    const envSettings =
      typeof document?.meta === 'object' && !Array.isArray(document?.meta)
        ? (document.meta as any).envSettings
        : undefined;

    // If we have database settings, try to fetch tables
    if (envSettings?.DATABASE_URL) {
      try {
        const tablesResponse = await getTablesList(documentId, environment);
        if (tablesResponse.success) {
          return {
            settings: envSettings as EnvSettings,
            tables: tablesResponse.data.tables,
          };
        }
      } catch (error) {
        console.error('Error fetching tables:', error);
        // If table fetch fails, still return settings but empty tables
        return {
          settings: envSettings as EnvSettings,
          tables: [],
        };
      }
    }

    // If no settings or table fetch failed, return empty result
    return {
      settings: (envSettings as EnvSettings) || null,
      tables: [],
    };
  } catch (error) {
    console.error('Error in handleViewDatabase:', error);
    throw error;
  }
}
