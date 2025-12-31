/**
 * External file fetch tool for retrieving content from various external sources
 * Supports Google Docs, Sheets, Word docs, PRDs, images, and other file types
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export const externalFileFetchToolName = 'external_file_fetch';

export interface ExternalFileFetchTool extends DynamicStructuredTool {
  name: string;
  description: string;
}

/**
 * Fetches content from external file sources
 */
async function fetchExternalFileContent(
  url: string,
  fileType?: string
): Promise<string> {
  try {
    // Handle different file types and sources
    if (url.includes('docs.google.com/spreadsheets')) {
      return await fetchGoogleSheetsContent(url);
    } else if (url.includes('docs.google.com/document')) {
      return await fetchGoogleDocsContent(url);
    } else if (url.includes('drive.google.com')) {
      return await fetchGoogleDriveContent(url);
    } else if (fileType === 'csv' || url.endsWith('.csv')) {
      return await fetchCsvContent(url);
    } else if (fileType === 'json' || url.endsWith('.json')) {
      return await fetchJsonContent(url);
    } else if (
      fileType === 'image' ||
      /\.(jpg|jpeg|png|gif|webp)$/i.test(url)
    ) {
      return await fetchImageContent(url);
    } else if (fileType === 'pdf' || url.endsWith('.pdf')) {
      return await fetchPdfContent(url);
    } else {
      // Default to text content
      return await fetchTextContent(url);
    }
  } catch (error) {
    console.error('External file fetch error:', error);
    return `Error fetching external file content: ${
      error instanceof Error ? error.message : 'Unknown error'
    }`;
  }
}

/**
 * Fetch content from Google Sheets
 */
async function fetchGoogleSheetsContent(url: string): Promise<string> {
  try {
    // Convert Google Sheets URL to CSV export format
    const csvUrl = url.replace('/edit', '/export?format=csv&gid=0');

    const response = await fetch(csvUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const csvContent = await response.text();

    // Parse CSV and format as structured data
    const lines = csvContent.split('\n');
    const headers = lines[0]?.split(',').map((h) => h.trim().replace(/"/g, ''));

    if (!headers || headers.length === 0) {
      return 'No data found in Google Sheets';
    }

    const rows = lines
      .slice(1)
      .map((line) => {
        const values = line.split(',').map((v) => v.trim().replace(/"/g, ''));
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        return row;
      })
      .filter((row) => Object.values(row).some((value) => value.trim() !== ''));

    return JSON.stringify(
      {
        source: 'Google Sheets',
        url: url,
        headers: headers,
        rowCount: rows.length,
        data: rows.slice(0, 100), // Limit to first 100 rows
      },
      null,
      2
    );
  } catch (error) {
    throw new Error(
      `Failed to fetch Google Sheets content: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Fetch content from Google Docs
 */
async function fetchGoogleDocsContent(url: string): Promise<string> {
  try {
    // Convert Google Docs URL to plain text export format
    const textUrl = url.replace('/edit', '/export?format=txt');

    const response = await fetch(textUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const textContent = await response.text();

    return JSON.stringify(
      {
        source: 'Google Docs',
        url: url,
        content: textContent,
        wordCount: textContent.split(/\s+/).length,
      },
      null,
      2
    );
  } catch (error) {
    throw new Error(
      `Failed to fetch Google Docs content: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Fetch content from Google Drive files
 */
async function fetchGoogleDriveContent(url: string): Promise<string> {
  try {
    // Extract file ID from Google Drive URL
    const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
    if (!fileIdMatch) {
      throw new Error('Invalid Google Drive URL format');
    }

    const fileId = fileIdMatch[1];
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const content = await response.text();

    return JSON.stringify(
      {
        source: 'Google Drive',
        url: url,
        fileId: fileId,
        content: content.substring(0, 5000), // Limit content length
        truncated: content.length > 5000,
      },
      null,
      2
    );
  } catch (error) {
    throw new Error(
      `Failed to fetch Google Drive content: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Fetch CSV content
 */
async function fetchCsvContent(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const csvContent = await response.text();
    const lines = csvContent.split('\n');
    const headers = lines[0]?.split(',').map((h) => h.trim().replace(/"/g, ''));

    if (!headers || headers.length === 0) {
      return 'No data found in CSV file';
    }

    const rows = lines
      .slice(1)
      .map((line) => {
        const values = line.split(',').map((v) => v.trim().replace(/"/g, ''));
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        return row;
      })
      .filter((row) => Object.values(row).some((value) => value.trim() !== ''));

    return JSON.stringify(
      {
        source: 'CSV File',
        url: url,
        headers: headers,
        rowCount: rows.length,
        data: rows.slice(0, 100), // Limit to first 100 rows
      },
      null,
      2
    );
  } catch (error) {
    throw new Error(
      `Failed to fetch CSV content: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Fetch JSON content
 */
async function fetchJsonContent(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const jsonContent = await response.json();

    return JSON.stringify(
      {
        source: 'JSON File',
        url: url,
        data: jsonContent,
      },
      null,
      2
    );
  } catch (error) {
    throw new Error(
      `Failed to fetch JSON content: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Fetch image content (returns metadata and base64)
 */
async function fetchImageContent(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const contentType = response.headers.get('content-type') || 'image/unknown';

    return JSON.stringify(
      {
        source: 'Image File',
        url: url,
        contentType: contentType,
        size: arrayBuffer.byteLength,
        base64: base64.substring(0, 1000) + '...', // Truncate for display
        note: 'Base64 content truncated for display. Full content available in base64 field.',
      },
      null,
      2
    );
  } catch (error) {
    throw new Error(
      `Failed to fetch image content: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Fetch PDF content (basic text extraction)
 */
async function fetchPdfContent(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    return JSON.stringify(
      {
        source: 'PDF File',
        url: url,
        size: arrayBuffer.byteLength,
        note: 'PDF content fetched as binary data. Text extraction requires additional processing.',
        base64:
          Buffer.from(arrayBuffer).toString('base64').substring(0, 1000) +
          '...',
      },
      null,
      2
    );
  } catch (error) {
    throw new Error(
      `Failed to fetch PDF content: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Fetch text content (default)
 */
async function fetchTextContent(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const textContent = await response.text();

    return JSON.stringify(
      {
        source: 'Text File',
        url: url,
        content: textContent.substring(0, 10000), // Limit content length
        truncated: textContent.length > 10000,
        wordCount: textContent.split(/\s+/).length,
      },
      null,
      2
    );
  } catch (error) {
    throw new Error(
      `Failed to fetch text content: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Creates an external file fetch tool that allows LLMs to retrieve content from various external sources
 */
export function createExternalFileFetchTool(): ExternalFileFetchTool {
  return new DynamicStructuredTool({
    name: 'external_file_fetch',
    description:
      'Fetch content from external files and sources including Google Docs, Google Sheets, CSV files, JSON files, images, PDFs, and other web-accessible files. Use this to retrieve data from external sources for processing and analysis.',
    schema: z.object({
      url: z.string().describe('The URL of the external file to fetch'),
      fileType: z
        .string()
        .optional()
        .describe(
          'Optional file type hint (csv, json, image, pdf, etc.) to help with processing'
        ),
    }),
    func: async ({ url, fileType }) => {
      try {
        if (!url || !url.trim()) {
          return 'Error: Please provide a valid URL.';
        }

        const trimmedUrl = url.trim();

        // Basic URL validation
        try {
          new URL(trimmedUrl);
        } catch {
          return 'Error: Please provide a valid URL format.';
        }

        return await fetchExternalFileContent(trimmedUrl, fileType);
      } catch (error) {
        return `Error fetching external file: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`;
      }
    },
  });
}
