import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { CodebaseManager } from './codebaseManager';

export const findMatchingFilesToolName = 'find_files_with_text';

/**
 * Schema for the find files with text tool
 */
const findMatchingFilesSchema = z.object({
  keyword: z
    .string()
    .describe(
      'Literal text string to search for in files (not a regex pattern)'
    ),
  caseSensitive: z
    .boolean()
    .nullable()
    .optional()
    .describe('Whether the search should be case sensitive'),
  directory: z
    .string()
    .nullable()
    .optional()
    .describe('Optional directory to limit search scope'),
});

/**
 * A tool that allows finding files containing specific text
 */
export class FindMatchingFilesTool extends DynamicStructuredTool {
  private codebaseManager: CodebaseManager;

  constructor(codebaseManager: CodebaseManager) {
    super({
      name: findMatchingFilesToolName,
      description: 'Finds files in the codebase that match a given keyword.',
      schema: findMatchingFilesSchema,
      func: async ({ keyword, caseSensitive, directory }) =>
        this.findFiles(keyword, caseSensitive, directory),
    });

    this.codebaseManager = codebaseManager;
  }

  /**
   * Find files containing the keyword
   */
  private async findFiles(
    keyword: string,
    caseSensitive: boolean = false,
    directory?: string
  ): Promise<string> {
    try {
      // Get all available files
      let filePaths = this.codebaseManager.getAvailableFiles();

      // Filter by directory if provided
      if (directory && directory !== '.') {
        const dirPrefix = directory.endsWith('/') ? directory : `${directory}/`;
        filePaths = filePaths.filter(
          (path) => path === directory || path.startsWith(dirPrefix)
        );
      }

      // Find files containing the keyword
      const matchingFiles = filePaths.filter((filePath) => {
        const file = this.codebaseManager.getFile(filePath);
        if (!file) return false;

        // Perform case-insensitive search by default
        if (caseSensitive) {
          return file.content.includes(keyword);
        } else {
          return file.content.toLowerCase().includes(keyword.toLowerCase());
        }
      });

      // Return formatted result
      return JSON.stringify(
        {
          keyword,
          caseSensitive: caseSensitive || false,
          matchingFiles: matchingFiles.sort(),
          count: matchingFiles.length,
        },
        null,
        2
      );
    } catch (error: any) {
      throw new Error(`Failed to find matching files: ${error.message}`);
    }
  }
}

/**
 * Creates a tool that allows finding files in the in-memory codebase
 * The manager must be initialized before calling this
 */
export function createFindMatchingFilesTool(
  codebaseManager: CodebaseManager
): FindMatchingFilesTool {
  return new FindMatchingFilesTool(codebaseManager);
}
