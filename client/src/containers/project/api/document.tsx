import { Document } from '@prisma/client';

import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';
import { FileContent } from '../../documents/components/ChatBox';
import { DocHistoryItem } from '../../documents/components/DocumentEditor';
import {
  LegacyDocumentOutput,
  RefinementGenerationInput,
  RefinementGenerationOutput,
} from '../types/projectType';

export async function upsertDocument(
  doc: Partial<Document | LegacyDocumentOutput>
): Promise<LegacyDocumentOutput> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/documents/upsert`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(doc),
  });
  const { success, data, errorMsg } = await result.json();
  if (!success) {
    throw new Error('Error upserting document: ' + errorMsg);
  }
  return data;
}

export async function uploadDocumentImage({
  id,
  history,
}: {
  id: string;
  history: DocHistoryItem;
}): Promise<{ id: string; history: DocHistoryItem }> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/documents/upload-image`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({
      id,
      history,
    }),
  });
  const { success, data, errorMsg } = await result.json();
  if (!success) {
    throw new Error('Error upserting document: ' + errorMsg);
  }
  return data;
}

export async function generateDocument(
  doc: Partial<Document> & {
    contents?: string;
    templateId?: string;
    uploadedFileContent?: FileContent[];
    chosenDocumentIds?: string;
    chatSessionId?: string;
  }
): Promise<LegacyDocumentOutput> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/documents/generate`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(doc),
  });

  const { success, data, errorMsg } = await result.json();
  if (!success) {
    throw new Error('Error upserting document: ' + errorMsg);
  }
  return data;
}

export async function generateDocumentWithSSE(
  doc: Partial<Document> & {
    contents?: string;
    templateId?: string;
    uploadedFileContent?: FileContent[];
    chosenDocumentIds?: string;
    chatSessionId?: string;
    entitySubType?: string;
    entityId?: string;
  },
  onProgress?: (data: {
    status?: { message: string };
    completed?: boolean;
    error?: string;
    docId?: string;
  }) => void
): Promise<LegacyDocumentOutput> {
  const headers = await getHeaders();
  const response = await fetch(`${api_url}/api/documents/generate`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(doc),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: LegacyDocumentOutput | null = null;
  let hasCompleted = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        // If stream ends without completion event, try to fetch the document
        if (!hasCompleted && doc.entityId) {
          try {
            // For dev plans, use the devPlan API endpoint instead of documents
            const isDevPlan = doc.entitySubType === 'DEVELOPMENT_PLAN';
            const apiPath = isDevPlan
              ? `${api_url}/api/devPlan/${doc.entityId}`
              : `${api_url}/api/documents/${doc.entityId}`;

            const finalResponse = await fetch(apiPath, {
              method: 'GET',
              headers,
              credentials: 'include',
            });
            const finalData = await finalResponse.json();
            if (finalData.success) {
              finalResult = finalData.data;
            }
          } catch (fetchError) {
            console.error('Error fetching final document:', fetchError);
          }
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines (separated by \n\n)
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || ''; // Keep incomplete chunk for next iteration

      for (const line of lines) {
        if (!line.trim()) continue;

        // Skip keep-alive pings
        if (line.trim() === ': ping' || line.startsWith(':')) {
          continue;
        }

        try {
          const parsed = JSON.parse(line);

          // Skip keepalive messages
          if (parsed.keepalive) {
            continue;
          }

          // Call progress callback if provided
          if (onProgress) {
            onProgress(parsed);
          }

          // Check for completion event (for dev plans)
          if (parsed.completed === true && parsed.docId) {
            hasCompleted = true;
            // For dev plans, use the devPlan API endpoint instead of documents
            const isDevPlan = doc.entitySubType === 'DEVELOPMENT_PLAN';
            const apiPath = isDevPlan
              ? `${api_url}/api/devPlan/${parsed.docId}`
              : `${api_url}/api/documents/${parsed.docId}`;

            try {
              const finalResponse = await fetch(apiPath, {
                method: 'GET',
                headers,
                credentials: 'include',
              });
              const finalData = await finalResponse.json();
              if (finalData.success) {
                finalResult = finalData.data;
              }
            } catch (fetchError) {
              console.error('Error fetching completed document:', fetchError);
            }
          }

          // Check for error
          if (parsed.error) {
            throw new Error(parsed.error);
          }
        } catch (e) {
          // If JSON parsing fails, it might be a keepalive or other non-JSON line
          if (e instanceof SyntaxError) {
            console.log('Non-JSON line (possibly keepalive):', line);
          } else {
            throw e;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Return result if we got one, otherwise throw error
  if (finalResult) {
    return finalResult;
  }

  // If we have an entityId, try one more time to fetch it
  if (doc.entityId) {
    try {
      // For dev plans, use the devPlan API endpoint instead of documents
      const isDevPlan = doc.entitySubType === 'DEVELOPMENT_PLAN';
      const apiPath = isDevPlan
        ? `${api_url}/api/devPlan/${doc.entityId}`
        : `${api_url}/api/documents/${doc.entityId}`;

      const finalResponse = await fetch(apiPath, {
        method: 'GET',
        headers,
        credentials: 'include',
      });
      const finalData = await finalResponse.json();
      if (finalData.success) {
        return finalData.data;
      }
    } catch (fetchError) {
      console.error('Error fetching document as fallback:', fetchError);
    }
  }

  throw new Error('No result received from server');
}

export async function generateRefinement(
  doc: RefinementGenerationInput
): Promise<RefinementGenerationOutput> {
  // The api trims spaces if doc.selection has leading or trailing spaces
  // To solve: if selection contains leading or trailing space,
  // they need to be added to the result
  const leadingSpaces = doc.selection?.match(/^(\s*)/)?.[0] ?? '';
  const trailingSpaces = doc.selection?.match(/(\s*)$/)?.[0] ?? '';

  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/documents/generate-refinement`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(doc),
  });

  const { success, data, errorMsg } = await result.json();
  if (!success) {
    throw new Error('Error generating refinement: ' + errorMsg);
  }

  let resultContent = data.contentStr;

  // If the original selection did not have a <p> tag, trim <p> and </p> tags from the result
  if (!doc.selection?.startsWith('<p>')) {
    resultContent = resultContent.replace(/^<p>/, '').replace(/<\/p>$/, '');
  }
  // If the original selection did not end with a dot, remove the trailing dot from the result content
  if (!doc.selection?.trim().endsWith('.')) {
    resultContent = resultContent.replace(/\.$/, '');
  }
  return {
    ...data,
    contentStr: `${leadingSpaces}${resultContent}${trailingSpaces}`,
  };
}

export async function requestDocumentAccess(doc: {
  documentId: string;
  message?: string;
}) {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/documents/requestAccess`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(doc),
  });

  const { success, data, errorMsg } = await result.json();
  if (!success) {
    throw new Error('Error request document access:' + errorMsg);
  }
  return data;
}

export async function resetDocument(
  documentId: string
): Promise<LegacyDocumentOutput> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/documents/${documentId}/reset`, {
    method: 'POST',
    headers,
    credentials: 'include',
  });
  const { success, data, errorMsg } = await result.json();
  if (!success) {
    throw new Error('Error resetting document: ' + errorMsg);
  }
  return data;
}
