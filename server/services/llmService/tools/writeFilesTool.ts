import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { CodebaseManager } from './codebaseManager';

export const writeFilesToolName = 'write_files';

/**
 * Schema for the write file tool - accepts any input to handle stringified cases
 */
const writeFileSchema = z.object({
  files: z
    .any()
    .describe(
      'Files to write - can be array, object, or string (will be parsed automatically)'
    ),
});

/**
 * A tool that allows writing multiple files in the in-memory codebase
 */
export class WriteFilesTool extends DynamicStructuredTool {
  private codebaseManager: CodebaseManager;

  constructor(codebaseManager: CodebaseManager) {
    super({
      name: writeFilesToolName,
      description:
        "Write content to multiple files (max 8 files per call). If a file doesn't exist, it will be created. If it exists, it will be overwritten. 🚨 CRITICAL: NEVER use JSON.stringify() - pass objects directly. Format: {files: [{filePath: 'path/to/file.ts', fileContent: 'file content'}]}. Stringifying will cause 'files.map is not a function' errors. 🚨 ABSOLUTE REQUIREMENT: Pass the files array as a direct JavaScript object, NOT as a stringified JSON string.",
      schema: writeFileSchema,
      func: async ({ files }) => this.writeFiles(files),
    });

    this.codebaseManager = codebaseManager;
  }

  /**
   * Writes content to multiple files
   */
  private async writeFiles(files: unknown): Promise<string> {
    // Early detection of stringification
    if (typeof files === 'string' && files.includes('"files"')) {
      throw new Error(
        `🚨 CRITICAL: Stringification detected! The files parameter is a stringified JSON. Please pass objects directly without JSON.stringify(). Expected: {files: [{filePath: "path", fileContent: "content"}]}. Received: stringified JSON. This causes "files.map is not a function" errors.`
      );
    }

    let parsedFiles: Array<{ filePath: string; fileContent: string }>;

    try {
      // Enhanced parsing logic to handle various input formats
      parsedFiles = this.parseFilesInput(files);
    } catch (e: any) {
      // Provide more helpful error messages
      if (e.message.includes('stringify')) {
        throw new Error(
          `Stringification detected: ${e.message}. Please pass objects directly without JSON.stringify(). Example: {files: [{filePath: "file.ts", fileContent: "content"}]}. This error causes "files.map is not a function" failures. 🚨 CRITICAL: Do NOT use JSON.stringify() on the files parameter. Pass the files array as a direct JavaScript object.`
        );
      }
      throw new Error(
        `Failed to parse files input: ${e.message}. Expected format: {files: [{filePath: "path", fileContent: "content"}]}. Do not stringify the input.`
      );
    }

    // Validate the parsed structure
    if (!Array.isArray(parsedFiles)) {
      throw new Error(
        'Parsed files must be an array. Please do not stringify write_files tool input.'
      );
    }

    // Limit the number of files to prevent token limit issues
    if (parsedFiles.length > 8) {
      throw new Error(
        `Too many files in single call (${parsedFiles.length}). Please write files in smaller batches of 3-8 files per call to avoid token limits.`
      );
    }

    // Validate each file object
    for (const file of parsedFiles) {
      if (!file || typeof file !== 'object') {
        throw new Error(
          'Each file must be an object with filePath and fileContent properties. Please do not stringify write_files tool input.'
        );
      }
      if (typeof file.filePath !== 'string') {
        throw new Error(
          'filePath must be a string. Please do not stringify write_files tool input.'
        );
      }
      if (typeof file.fileContent !== 'string') {
        throw new Error(
          'fileContent must be a string. Please do not stringify write_files tool input.'
        );
      }
    }

    try {
      const codebaseMap = this.codebaseManager.getCodebaseMap();
      const updatedFiles = new Map(Object.entries(codebaseMap));

      // Process all files in parallel for better performance
      // Each file operation is independent (different file paths)
      const fileProcessingPromises = parsedFiles.map(
        async ({ filePath, fileContent }) => {
          // Validate file path
          if (filePath === '') {
            throw new Error('File path cannot be empty');
          }

          // Get existing file (read operation - safe to parallelize)
          const existingFile = this.codebaseManager.getFile(filePath);

          // Create new file object
          const newFile = {
            path: filePath,
            content: fileContent,
            type: existingFile?.type || 'file',
          };

          // Return both the file data and result message
          return {
            filePath,
            file: newFile,
            result: `Successfully ${
              existingFile ? 'updated' : 'created'
            } file: ${filePath}`,
          };
        }
      );

      // Wait for all files to be processed in parallel
      const processedFiles = await Promise.all(fileProcessingPromises);

      // Update the codebase map with all processed files
      // (This is safe because each file has a unique path)
      processedFiles.forEach(({ filePath, file }) => {
        updatedFiles.set(filePath, file);
      });

      // Generate results messages
      const results = processedFiles.map(({ result }) => result);

      // Update codebase manager with all changes at once
      const codebaseStr = JSON.stringify({
        files: Array.from(updatedFiles.values()),
      });

      this.codebaseManager.updateCodebase(codebaseStr);

      return results.join('\n');
    } catch (error: any) {
      const errorContext = {
        tool: writeFilesToolName,
        files: parsedFiles?.map((f) => f.filePath) || ['<unknown format>'],
        error: error.message,
        suggestion: error.message.includes('empty')
          ? 'Please provide valid file paths'
          : 'Check if the file paths are valid and the content is properly formatted',
      };

      throw new Error(`Failed to write files: ${JSON.stringify(errorContext)}`);
    }
  }

  /**
   * Enhanced parsing method to handle various input formats
   */
  private parseFilesInput(
    input: unknown
  ): Array<{ filePath: string; fileContent: string }> {
    // Handle string input (stringified JSON)
    if (typeof input === 'string') {
      // First, try to detect if this is a stringified JSON object
      if (input.trim().startsWith('{') && input.trim().endsWith('}')) {
        try {
          const parsed = JSON.parse(input);
          if (parsed.files && Array.isArray(parsed.files)) {
            console.log('Successfully parsed stringified JSON object');
            return parsed.files;
          }
        } catch (e) {
          console.log(
            'Failed to parse as JSON object, trying stringified input parser'
          );
        }
      }
      return this.parseStringifiedInput(input);
    }

    // Handle direct object input { files: [...] }
    if (input && typeof input === 'object' && 'files' in input) {
      const files = (input as any).files;
      if (Array.isArray(files)) {
        return files;
      }
      throw new Error('files property must be an array');
    }

    // Handle direct array input
    if (Array.isArray(input)) {
      return input;
    }

    // Handle other object formats
    if (input && typeof input === 'object') {
      // Try to extract files from various possible structures
      const obj = input as any;

      // Check if it's already in the correct format
      if (obj.filePath && obj.fileContent) {
        return [obj];
      }

      // Check for common variations
      if (obj.files && Array.isArray(obj.files)) {
        return obj.files;
      }

      // Check if it's an array-like object
      if (Array.isArray(obj)) {
        return obj;
      }
    }

    throw new Error(
      `Unsupported input format. Expected: {files: [{filePath: "path", fileContent: "content"}]}. Received: ${typeof input}`
    );
  }

  /**
   * Parse stringified JSON input with multiple fallback strategies
   */
  private parseStringifiedInput(
    input: string
  ): Array<{ filePath: string; fileContent: string }> {
    let currentData: any = input;
    let parseAttempts = 0;
    const maxParseAttempts = 5; // Reasonable limit to prevent infinite loops

    // Try to parse the string multiple times to handle nested stringification
    while (
      typeof currentData === 'string' &&
      parseAttempts < maxParseAttempts
    ) {
      try {
        currentData = JSON.parse(currentData);
        parseAttempts++;
        console.log(`Parse attempt ${parseAttempts} successful`);
      } catch (parseError) {
        console.warn(
          `Failed to parse after ${parseAttempts} attempts:`,
          parseError
        );

        // Try to handle escaped JSON strings
        if (parseAttempts === 0) {
          try {
            // Handle double-escaped strings (common in LLM output)
            const unescaped = currentData
              .replace(/\\n/g, '\n')
              .replace(/\\t/g, '\t')
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\');
            currentData = JSON.parse(unescaped);
            parseAttempts++;
            console.log(
              `Parse attempt ${parseAttempts} successful with unescaping`
            );
            continue;
          } catch (unescapeError) {
            console.warn('Unescaping also failed:', unescapeError);
          }
        }
        break;
      }
    }

    // After parsing, extract the files array
    if (Array.isArray(currentData)) {
      console.log(
        `Successfully parsed files array after ${parseAttempts} attempts`
      );
      return currentData;
    }

    if (currentData && typeof currentData === 'object') {
      // Handle { files: [...] } structure
      if (currentData.files && Array.isArray(currentData.files)) {
        console.log(
          `Successfully parsed files object after ${parseAttempts} attempts`
        );
        return currentData.files;
      }

      // Handle single file object
      if (currentData.filePath && currentData.fileContent) {
        console.log(
          `Successfully parsed single file object after ${parseAttempts} attempts`
        );
        return [currentData];
      }
    }

    // If we still have a string, try one more aggressive parsing approach
    if (typeof currentData === 'string' && parseAttempts === 0) {
      try {
        // Look for JSON-like structure in the string
        const jsonMatch = currentData.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const extractedJson = jsonMatch[0];
          const parsed = JSON.parse(extractedJson);
          if (parsed.files && Array.isArray(parsed.files)) {
            console.log('Successfully extracted and parsed JSON from string');
            return parsed.files;
          }
        }
      } catch (extractError) {
        console.warn('JSON extraction failed:', extractError);
      }
    }

    throw new Error(
      `Failed to parse stringified input after ${parseAttempts} attempts. ` +
        `Expected format: {files: [{filePath: "path", fileContent: "content"}]}. ` +
        `Please do not stringify the input.`
    );
  }
}

/**
 * Creates a tool that allows writing multiple files in the in-memory codebase
 * The manager must be initialized before calling this
 */
export function createWriteFilesTool(
  codebaseManager: CodebaseManager
): WriteFilesTool {
  return new WriteFilesTool(codebaseManager);
}
