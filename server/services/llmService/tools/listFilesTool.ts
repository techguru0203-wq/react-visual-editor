import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { CodebaseManager } from './codebaseManager';

export const listFilesToolName = 'list_files';

/**
 * Schema for the list files tool
 */
const listFilesSchema = z.object({
  directory: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Directory path to list files from. If empty or '.', lists all files"
    ),
});

/**
 * A tool that allows listing files from an in-memory codebase
 */
export class ListFilesTool extends DynamicStructuredTool {
  private codebaseManager: CodebaseManager;

  constructor(codebaseManager: CodebaseManager) {
    super({
      name: listFilesToolName,
      description:
        'Lists files from the codebase, optionally filtered by directory',
      schema: listFilesSchema,
      func: async ({ directory }) => this.listFiles(directory),
    });

    this.codebaseManager = codebaseManager;
  }

  /**
   * Lists files from the codebase, optionally filtered by directory
   */
  private async listFiles(directory?: string): Promise<string> {
    try {
      let filePaths = this.codebaseManager.getAvailableFiles();

      // If directory is provided and not ".", filter the list
      if (directory && directory !== '.') {
        const dirPrefix = directory.endsWith('/') ? directory : `${directory}/`;
        filePaths = filePaths.filter(
          (path) => path === directory || path.startsWith(dirPrefix)
        );
      }

      // Return a simple sorted array of file paths
      return JSON.stringify(
        {
          files: filePaths.sort(),
        },
        null,
        2
      );
    } catch (error: any) {
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }
}

/**
 * Creates a tool that allows listing files from the in-memory codebase
 * The manager must be initialized before calling this
 */
export function createListFilesTool(
  codebaseManager: CodebaseManager
): ListFilesTool {
  return new ListFilesTool(codebaseManager);
}
