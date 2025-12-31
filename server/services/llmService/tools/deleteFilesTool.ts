import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { CodebaseManager } from './codebaseManager';

export const deleteFilesToolName = 'delete_files';

/**
 * Schema for the delete files tool
 */
const deleteFilesSchema = z.object({
  filePaths: z
    .array(z.string())
    .describe('Array of file paths to delete from the codebase'),
});

/**
 * A tool that allows deleting multiple files from the in-memory codebase
 */
export class DeleteFilesTool extends DynamicStructuredTool {
  private codebaseManager: CodebaseManager;

  constructor(codebaseManager: CodebaseManager) {
    super({
      name: deleteFilesToolName,
      description:
        "Delete multiple files from the codebase. Files that don't exist will be ignored. 🚨 CRITICAL: NEVER use JSON.stringify() - pass objects directly. Format: {filePaths: ['path/to/file1.ts', 'path/to/file2.ts']}. Stringifying will cause parsing errors.",
      schema: deleteFilesSchema,
      func: async ({ filePaths }) => this.deleteFiles(filePaths),
    });

    this.codebaseManager = codebaseManager;
  }

  /**
   * Deletes multiple files from the codebase
   */
  private async deleteFiles(filePaths: unknown): Promise<string> {
    let parsedFilePaths: string[];

    try {
      // Handle multiple levels of JSON stringification
      if (typeof filePaths === 'string') {
        let currentData: any = filePaths;
        let parseAttempts = 0;
        const maxParseAttempts = 5; // Prevent infinite loops

        // Keep parsing until we get a non-string result
        while (
          typeof currentData === 'string' &&
          parseAttempts < maxParseAttempts
        ) {
          try {
            currentData = JSON.parse(currentData);
            parseAttempts++;
          } catch (parseError) {
            // If we can't parse anymore, break out of the loop
            break;
          }
        }

        // After parsing, validate the structure
        if (Array.isArray(currentData)) {
          parsedFilePaths = currentData;
        } else if (
          currentData &&
          typeof currentData === 'object' &&
          currentData.filePaths
        ) {
          // Handle case where the structure is { filePaths: [...] }
          parsedFilePaths = currentData.filePaths;
        } else {
          throw new Error(
            `Failed to parse filePaths after ${parseAttempts} parse attempts. Expected array of file paths or { filePaths: [...] } structure. Please do not stringify delete_files tool input.`
          );
        }
      } else if (Array.isArray(filePaths)) {
        parsedFilePaths = filePaths;
      } else if (
        filePaths &&
        typeof filePaths === 'object' &&
        'filePaths' in filePaths
      ) {
        // Handle case where input is { filePaths: [...] }
        parsedFilePaths = (filePaths as any).filePaths;
      } else {
        throw new Error(
          `Invalid 'filePaths' input: must be an array, JSON string, or { filePaths: [...] } object. Received type: ${typeof filePaths}. Please do not stringify delete_files tool input.`
        );
      }

      // Validate the parsed structure
      if (!Array.isArray(parsedFilePaths)) {
        throw new Error(
          'Parsed filePaths must be an array. Please do not stringify delete_files tool input.'
        );
      }

      // Validate each file path
      for (const filePath of parsedFilePaths) {
        if (typeof filePath !== 'string') {
          throw new Error(
            'Each filePath must be a string. Please do not stringify delete_files tool input.'
          );
        }
        if (filePath === '') {
          throw new Error('File path cannot be empty');
        }
      }
    } catch (e: any) {
      if (e.message.includes('stringify')) {
        throw e; // Re-throw stringification errors as-is
      }
      throw new Error(
        `Failed to parse 'filePaths': ${e.message}. Please ensure it's an array of file path strings. Do not stringify the input.`
      );
    }

    try {
      const results: string[] = [];
      const codebaseMap = this.codebaseManager.getCodebaseMap();
      const updatedFiles = new Map(Object.entries(codebaseMap));

      for (const filePath of parsedFilePaths) {
        if (updatedFiles.has(filePath)) {
          updatedFiles.delete(filePath);
          results.push(`Successfully deleted file: ${filePath}`);
        } else {
          results.push(`File not found (ignored): ${filePath}`);
        }
      }

      const codebaseStr = JSON.stringify({
        files: Array.from(updatedFiles.values()),
      });

      this.codebaseManager.updateCodebase(codebaseStr);

      return results.join('\n');
    } catch (error: any) {
      const errorContext = {
        tool: deleteFilesToolName,
        filePaths: parsedFilePaths || ['<unknown format>'],
        error: error.message,
        suggestion: error.message.includes('empty')
          ? 'Please provide valid file paths'
          : 'Check if the file paths are valid',
      };

      throw new Error(
        `Failed to delete files: ${JSON.stringify(errorContext)}`
      );
    }
  }
}

/**
 * Creates a tool that allows deleting multiple files from the in-memory codebase
 * The manager must be initialized before calling this
 */
export function createDeleteFilesTool(
  codebaseManager: CodebaseManager
): DeleteFilesTool {
  return new DeleteFilesTool(codebaseManager);
}
