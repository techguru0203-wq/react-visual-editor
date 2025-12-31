import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { CodebaseManager } from './codebaseManager';

export const searchReplaceToolName = 'search_replace';

/**
 * Schema for the search replace tool
 */
const searchReplaceSchema = z.object({
  replacements: z
    .array(
      z.object({
        filePath: z.string().describe('Path to the file to update'),
        oldString: z
          .string()
          .describe(
            'The exact string to replace (must match file content exactly)'
          ),
        newString: z.string().describe('The replacement string'),
        replaceAll: z
          .boolean()
          .optional()
          .default(false)
          .describe('Replace all occurrences (default: false)'),
      })
    )
    .describe('Array of replacement operations to perform'),
});

/**
 * A tool that allows searching and replacing content in files
 */
export class SearchReplaceTool extends DynamicStructuredTool {
  private codebaseManager: CodebaseManager;

  constructor(codebaseManager: CodebaseManager) {
    super({
      name: searchReplaceToolName,
      description:
        'Search and replace content in an existing file. Use this for targeted updates instead of rewriting entire files. The oldString must match the file content exactly (including whitespace and indentation).',
      schema: searchReplaceSchema,
      func: async ({ replacements }) => this.searchReplace(replacements),
    });

    this.codebaseManager = codebaseManager;
  }

  /**
   * Performs search and replace operations on files
   * Optimized to process different files in parallel while maintaining
   * sequential processing for multiple replacements in the same file
   */
  private async searchReplace(
    replacements: Array<{
      filePath: string;
      oldString: string;
      newString: string;
      replaceAll?: boolean;
    }>
  ): Promise<string> {
    // Group replacements by file path
    // Replacements for the same file must be processed sequentially
    // Replacements for different files can be processed in parallel
    const replacementsByFile = new Map<string, typeof replacements>();

    for (const replacement of replacements) {
      const filePath = replacement.filePath;
      if (!replacementsByFile.has(filePath)) {
        replacementsByFile.set(filePath, []);
      }
      replacementsByFile.get(filePath)!.push(replacement);
    }

    // Process each file's replacements in parallel (different files)
    // But process replacements for the same file sequentially
    const fileProcessingPromises = Array.from(replacementsByFile.entries()).map(
      async ([filePath, fileReplacements]) => {
        const fileResults: string[] = [];
        let currentContent = this.codebaseManager.getFileContent(filePath);

        // Process replacements for this file sequentially
        for (const {
          oldString,
          newString,
          replaceAll = false,
        } of fileReplacements) {
          try {
            if (currentContent === null) {
              fileResults.push(
                `❌ Error: File '${filePath}' not found in codebase.`
              );
              continue;
            }

            // Check if oldString exists in the file
            if (!currentContent.includes(oldString)) {
              fileResults.push(
                `❌ Error: The string to replace was not found in '${filePath}'. Please check the exact content including whitespace and indentation.`
              );
              continue;
            }

            // Count occurrences
            const occurrences = (
              currentContent.match(
                new RegExp(
                  oldString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                  'g'
                )
              ) || []
            ).length;

            if (occurrences === 0) {
              fileResults.push(
                `❌ Error: No occurrences of the search string found in '${filePath}'.`
              );
              continue;
            }

            // Perform replacement
            let newContent: string;
            if (replaceAll) {
              newContent = currentContent.replace(
                new RegExp(
                  oldString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                  'g'
                ),
                newString
              );
            } else {
              newContent = currentContent.replace(oldString, newString);
            }

            // Update currentContent for next replacement in same file
            currentContent = newContent;

            const replacedCount = replaceAll ? occurrences : 1;
            fileResults.push(
              `✅ Successfully replaced ${replacedCount} occurrence(s) in '${filePath}'.`
            );
          } catch (error) {
            fileResults.push(
              `❌ Error updating '${filePath}': ${
                error instanceof Error ? error.message : 'Unknown error'
              }`
            );
          }
        }

        // Update the file once after all replacements for this file
        if (currentContent !== null) {
          this.codebaseManager.updateFile(filePath, currentContent);
        }

        return fileResults;
      }
    );

    // Wait for all files to be processed in parallel
    const allResults = await Promise.all(fileProcessingPromises);

    // Flatten results from all files
    return allResults.flat().join('\n');
  }
}

/**
 * Creates a SearchReplaceTool instance
 */
export function createSearchReplaceTool(
  codebaseManager: CodebaseManager
): SearchReplaceTool {
  return new SearchReplaceTool(codebaseManager);
}
