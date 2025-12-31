import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  errorMsg?: string;
}

interface StripeSettingsData {
  stripeSecretKey: string;
  stripePublishedKey: string;
}

interface DatabaseSettingsData {
  DATABASE_URL: string;
  JWT_SECRET?: string;
}

interface EnvSettingsData {
  envSettings: {
    LLM_MODEL_NAME?: string;
    DATABASE_URL?: string;
    JWT_SECRET?: string;
    [key: string]: any;
  };
}

interface KnowledgeBaseSettingsData {
  knowledgeBaseSettings: {
    knowledgeBases: Array<{
      id: string;
      name: string;
      weight: number;
    }>;
  };
}

// Allows any combination of the four settings types
type DocumentSettingsData = Partial<
  StripeSettingsData &
    DatabaseSettingsData &
    EnvSettingsData &
    KnowledgeBaseSettingsData
>;

export const updateDocumentSettings = async (
  documentId: string,
  settings: DocumentSettingsData
): Promise<ApiResponse> => {
  try {
    const headers = await getHeaders();

    // Transform the settings to match backend expectations
    const requestBody: any = {
      id: documentId, // Required for upsert to identify the document
      isSettingsUpdate: true, // Explicit flag to indicate this is a settings update
    };

    if ('stripeSecretKey' in settings || 'stripePublishedKey' in settings) {
      requestBody.stripeSecretKey = (
        settings as StripeSettingsData
      ).stripeSecretKey;
      requestBody.stripePublishedKey = (
        settings as StripeSettingsData
      ).stripePublishedKey;
    }

    if ('DATABASE_URL' in settings) {
      requestBody.databaseUrl = (settings as DatabaseSettingsData).DATABASE_URL;
      requestBody.jwtSecret = (settings as DatabaseSettingsData).JWT_SECRET;
    }

    if ('envSettings' in settings) {
      requestBody.envSettings = (settings as EnvSettingsData).envSettings;
    }

    if ('knowledgeBaseSettings' in settings) {
      requestBody.knowledgeBaseSettings = (
        settings as KnowledgeBaseSettingsData
      ).knowledgeBaseSettings;
    }

    const response = await fetch(
      `${api_url}/api/documents/${documentId}/settings`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify(requestBody),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        errorMsg: result.errorMsg || 'Failed to update document settings',
      };
    }

    return result;
  } catch (error) {
    console.error('Error updating document settings:', error);
    return {
      success: false,
      errorMsg: 'Network error occurred while updating document settings',
    };
  }
};
