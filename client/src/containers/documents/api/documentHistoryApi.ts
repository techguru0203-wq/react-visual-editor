import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';
import { ProjectFile } from '../../project/components/prototype/PrototypeEditor';

export interface DocumentHistoryItem {
  id: string;
  documentId: string;
  versionNumber: number;
  description: string;
  fileUrl?: string | null;
  currentVersionUrl?: string | null;
  content?: string | null;
  chosenDocumentIds?: string | null;
  rating?: any;
  creatorUserId: string;
  creatorEmail: string;
  createdAt: string;
}

/**
 * Fetch document history list
 */
export async function getDocumentHistoryApi(
  documentId: string,
  options?: { limit?: number; offset?: number }
): Promise<DocumentHistoryItem[]> {
  const headers = await getHeaders();
  const queryParams = new URLSearchParams();

  if (options?.limit) queryParams.append('limit', options.limit.toString());
  if (options?.offset) queryParams.append('offset', options.offset.toString());

  const url = `${api_url}/api/documents/${documentId}/history${
    queryParams.toString() ? `?${queryParams.toString()}` : ''
  }`;

  const response = await fetch(url, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  const result = await response.json();

  if (result.success) {
    return result.data;
  }

  throw new Error(result.errorMsg || 'Failed to fetch document history');
}

/**
 * Fetch a specific version of document history
 */
export async function getDocumentHistoryVersionApi(
  documentId: string,
  versionNumber: number
): Promise<DocumentHistoryItem> {
  const headers = await getHeaders();
  const url = `${api_url}/api/documents/${documentId}/history/${versionNumber}`;

  const response = await fetch(url, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  const result = await response.json();

  if (result.success) {
    return result.data;
  }

  throw new Error(
    result.errorMsg || 'Failed to fetch document history version'
  );
}

/**
 * Update rating for a document history version
 */
export async function updateDocumentHistoryRatingApi(
  documentId: string,
  versionNumber: number,
  rating: any
): Promise<DocumentHistoryItem> {
  const headers = await getHeaders();
  const url = `${api_url}/api/documents/${documentId}/history/${versionNumber}/rating`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ rating }),
  });

  const result = await response.json();

  if (result.success) {
    return result.data;
  }

  throw new Error(result.errorMsg || 'Failed to update rating');
}

export interface DocumentHistorySourceCode {
  versionNumber: number;
  fileUrl: string;
  sourceCode: {
    files: ProjectFile[];
  };
  createdAt: string;
}

/**
 * Fetch source code from document history (for code diff comparison)
 * Backend returns a presigned URL for secure S3 access
 */
export async function getDocumentHistorySourceCodeApi(
  documentId: string,
  versionNumber?: number
): Promise<DocumentHistorySourceCode> {
  const headers = await getHeaders();
  const queryParams = new URLSearchParams();

  if (versionNumber !== undefined) {
    queryParams.append('versionNumber', versionNumber.toString());
  }

  const url = `${api_url}/api/documents/${documentId}/history/source-code${
    queryParams.toString() ? `?${queryParams.toString()}` : ''
  }`;

  // Step 1: Get presigned URL from backend
  const response = await fetch(url, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(
      result.errorMsg || 'Failed to fetch source code from history'
    );
  }

  const { fileUrl, versionNumber: returnedVersion, createdAt } = result.data;

  // Step 2: Fetch source code using presigned URL
  try {
    const s3Response = await fetch(fileUrl);

    if (!s3Response.ok) {
      const errorText = await s3Response.text();
      throw new Error(
        `Failed to fetch from S3: ${s3Response.status} ${s3Response.statusText}`
      );
    }

    // Check Content-Type to ensure it's JSON
    const contentType = s3Response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const responseText = await s3Response.text();
      // If it's HTML, it's likely an S3 error page
      if (
        responseText.trim().startsWith('<!DOCTYPE') ||
        responseText.trim().startsWith('<html')
      ) {
        throw new Error(
          'S3 returned an error page. The file may not exist or the URL may be invalid.'
        );
      }
      throw new Error(`Expected JSON but got ${contentType}`);
    }

    const sourceCode = await s3Response.json();

    return {
      versionNumber: returnedVersion,
      fileUrl,
      sourceCode,
      createdAt,
    };
  } catch (error) {
    console.error('Error fetching source code from S3:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch source code from storage');
  }
}
