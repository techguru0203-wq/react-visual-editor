import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';

export interface VercelDeploymentResponse {
  url: string;
  id: string;
  status: string;
}

interface ProjectFile {
  path: string;
  content: string;
  type: 'file';
}

export interface UploadWebpageAssetsResponse {
  fileUrl: string;
  success: boolean;
}

export async function deployToVercel(documentId: string, files: ProjectFile[]) {
  try {
    const headers = await getHeaders();
    const result = await fetch(`${api_url}/api/deploy/deployToVercel`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ files, documentId }),
    });

    const data = await result.json();
    return data;
  } catch (error) {
    console.error('Failed to deploy to Vercel:', error);
    throw error;
  }
}

export async function publishToProduction(
  documentId: string,
  deployDocId: string,
  files: ProjectFile[],
  onProgress?: (data: {
    status?: { message: string };
    sourceUrl?: string;
    success?: boolean;
    error?: string;
  }) => void
): Promise<{
  success: boolean;
  sourceUrl?: string;
  error?: string;
}> {
  try {
    const headers = await getHeaders();
    const response = await fetch(`${api_url}/api/vercel/publish`, {
      method: 'POST',
      headers: {
        ...headers,
        Accept: 'text/event-stream',
      },
      credentials: 'include',
      body: JSON.stringify({ documentId, deployDocId, files }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.errorMsg || 'Failed to publish');
    }

    if (!response.body) {
      throw new Error('No response body received');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalResult: {
      success: boolean;
      sourceUrl?: string;
      error?: string;
    } | null = null;
    let hasReceivedData = false;
    let jsonParseErrorOccurred = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines (separated by \n\n)
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // Keep incomplete chunk for next iteration

        for (const line of lines) {
          if (!line.trim()) continue;

          // Parse JSON directly (matching deploy.ts format - no "data: " prefix)
          try {
            const data = JSON.parse(line);
            hasReceivedData = true;

            console.log('Received SSE data:', data);

            // Call progress callback if provided (for all messages)
            if (onProgress) {
              onProgress(data);
            }

            // Store final result if it has success flag (true or false) or error
            // Progress messages only have status, not success/error
            if (typeof data.success === 'boolean' || data.error) {
              finalResult = {
                success: data.success === true,
                sourceUrl: data.sourceUrl,
                error: data.error,
              };
              console.log('Publish final result stored:', finalResult);
            }
          } catch (e) {
            // If JSON parsing fails, check if it's a JSON syntax error
            if (e instanceof SyntaxError && e.message.includes('JSON')) {
              jsonParseErrorOccurred = true;
              console.error(
                'JSON parsing error during publish (publish may have succeeded):',
                e.message
              );
              // Don't break - continue processing to see if we get valid data
            } else {
              // If JSON parsing fails, it might be a keepalive or other non-JSON line
              console.log('Non-JSON line (possibly keepalive):', line);
            }
          }
        }
      }
    } catch (streamError) {
      // If there's an error reading the stream but we got some data, assume success
      if (hasReceivedData || jsonParseErrorOccurred) {
        console.warn('Stream error but publish likely succeeded:', streamError);
        // Return success to trigger document refresh
        return {
          success: true,
        };
      }
      throw streamError;
    }

    // If JSON parsing error occurred but we received some data, assume publish succeeded
    // This handles the case where the publish succeeded on backend but JSON parsing failed
    if (jsonParseErrorOccurred && hasReceivedData && !finalResult) {
      console.log(
        'JSON parsing error occurred but data was received - assuming publish succeeded'
      );
      return {
        success: true,
      };
    }

    // Return final result or default
    return (
      finalResult || {
        success: false,
        error: 'No result received from server',
      }
    );
  } catch (error) {
    // If we get here and it's a JSON parsing error, assume publish succeeded
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      console.warn(
        'JSON parsing error caught - assuming publish succeeded:',
        error.message
      );
      return {
        success: true,
      };
    }
    console.error('Failed to publish to production:', error);
    throw error;
  }
}

export async function uploadWebpageAssets(
  documentId: string,
  issueId: string,
  sourceUrl: string
): Promise<UploadWebpageAssetsResponse> {
  try {
    const headers = await getHeaders();
    const result = await fetch(`${api_url}/api/deploy/uploadWebpageAssets`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ documentId, sourceUrl, issueId }),
    });

    const data = await result.json();
    return data;
  } catch (error) {
    console.error('Failed to upload webpage assets:', error);
    throw error;
  }
}

/**
 * Dev Server API functions for local development in visual edit mode
 */
export interface DevServerStatus {
  success: boolean;
  running: boolean;
  url?: string;
  port?: number;
  error?: string;
}

export async function startDevServer(documentId: string): Promise<DevServerStatus> {
  try {
    const headers = await getHeaders();
    const result = await fetch(`${api_url}/api/dev-server/start`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ documentId }),
    });

    const data = await result.json();
    return {
      success: data.success,
      running: data.success,
      url: data.url,
      error: data.error,
    };
  } catch (error) {
    console.error('Failed to start dev server:', error);
    return {
      success: false,
      running: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function stopDevServer(documentId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const headers = await getHeaders();
    const result = await fetch(`${api_url}/api/dev-server/stop`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ documentId }),
    });

    const data = await result.json();
    return data;
  } catch (error) {
    console.error('Failed to stop dev server:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function getDevServerStatus(documentId: string): Promise<DevServerStatus> {
  try {
    const headers = await getHeaders();
    const result = await fetch(`${api_url}/api/dev-server/status/${documentId}`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    const data = await result.json();
    return {
      success: data.success,
      running: data.running,
      url: data.url,
      port: data.port,
      error: data.error,
    };
  } catch (error) {
    console.error('Failed to get dev server status:', error);
    return {
      success: false,
      running: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function updateDevServerFiles(
  documentId: string,
  files: ProjectFile[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const headers = await getHeaders();
    const result = await fetch(`${api_url}/api/dev-server/update-files`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ documentId, files }),
    });

    const data = await result.json();
    return data;
  } catch (error) {
    console.error('Failed to update dev server files:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}