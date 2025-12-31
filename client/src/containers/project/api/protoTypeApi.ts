import { api_url } from '../../../lib/constants';

// get uploaded file content
export async function getUploadedFileContent(docId: string) {
  try {
    const response = await fetch(`${api_url}/api/pub/proxy-download/${docId}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch file content: ${response.statusText}`);
    }

    const { success, data, errorMsg } = await response.json();
    if (success) {
      return data;
    } else {
      throw new Error('Error fetching file content: ' + errorMsg);
    }
  } catch (error) {
    console.error('Error in getUploadedFileContent:', error);
    throw error;
  }
}
