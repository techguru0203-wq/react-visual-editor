import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { CodebaseManager } from './codebaseManager';

export const getFilesContentToolName = 'get_files_content';

/**
 * Schema for the get files content tool
 */
const getFilesContentSchema = z.object({
  filePaths: z
    .array(z.string())
    .describe('Array of file paths from the codebase to read'),
});

/**
 * A tool that allows reading files from an in-memory codebase
 */
export class GetFilesContentTool extends DynamicStructuredTool {
  private codebaseManager: CodebaseManager;

  constructor(codebaseManager: CodebaseManager) {
    super({
      name: getFilesContentToolName,
      description:
        'Reads the contents of specified files from the current codebase to help understand and improve the code',
      schema: getFilesContentSchema,
      func: async ({ filePaths }) => this.readFiles(filePaths),
    });

    this.codebaseManager = codebaseManager;
  }

  /**
   * Reads files from the codebase
   */
  private async readFiles(filePaths: string[]): Promise<string> {
    try {
      const requestedFiles = filePaths.map((filePath: string) => {
        const file = this.codebaseManager.getFile(filePath);
        if (file) {
          return {
            path: filePath,
            content: file.content,
            error: null,
          };
        }
        return {
          path: filePath,
          content: null,
          error: `File not found in codebase: ${filePath}`,
        };
      });

      // Return as formatted string
      return JSON.stringify(requestedFiles, null, 2);
    } catch (error: any) {
      throw new Error(`Failed to read codebase files: ${error.message}`);
    }
  }
}

/**
 * Creates a tool that allows reading code files from the in-memory codebase
 * The manager must be initialized before calling this
 */
export function createGetFilesContentTool(
  codebaseManager: CodebaseManager
): GetFilesContentTool {
  return new GetFilesContentTool(codebaseManager);
}
