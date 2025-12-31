import { getHeaders } from '../util/apiHeaders';
import { api_url } from '../../lib/constants';

export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  organizationId: string;
  creatorUserId: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    files: number;
  };
}

export interface KnowledgeBaseConfig {
  id: string;
  name: string;
  weight: number;
}

/**
 * Get list of knowledge bases for an organization
 */
export async function getKnowledgeBaseList(): Promise<KnowledgeBase[]> {
  try {
    const headers = await getHeaders();
    const response = await fetch(`${api_url}/api/knowledge-base`, {
      method: 'GET',
      headers,
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.errorMsg || 'Failed to fetch knowledge bases');
    }

    return result.data || [];
  } catch (error) {
    console.error('Error fetching knowledge bases:', error);
    throw error;
  }
}


