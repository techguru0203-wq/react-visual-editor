import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { CodebaseManager } from './codebaseManager';

export const planFilesToolName = 'plan_files';

/**
 * Schema for the plan_files tool - accepts any input to handle stringified cases
 */
const planFilesSchema = z.object({
  files: z
    .any()
    .describe(
      'Files to plan - can be array, object, or string (will be parsed automatically)'
    ),
});

/**
 * A tool that records planned file writes without actually writing them.
 */
export class PlanFilesTool extends DynamicStructuredTool {
  private codebaseManager: CodebaseManager;

  constructor(codebaseManager: CodebaseManager) {
    super({
      name: planFilesToolName,
      description:
        "List the files you plan to create or modify, with a brief description of each change using the present participle form. Only focus on the core initial features but don't add any additional features including user auth etc. Does not perform any writing. 🚨 CRITICAL: NEVER use JSON.stringify() - pass objects directly. Format: {files: [{filePath: 'path/to/file.ts', purpose: 'description'}]}. Stringifying will cause parsing errors.",
      schema: planFilesSchema,
      func: async ({ files }) => this.planFiles(files),
    });

    this.codebaseManager = codebaseManager;
  }

  /**
   * Outputs the list of planned file changes
   */
  private async planFiles(files: unknown): Promise<string> {
    let parsedFiles: Array<{
      filePath: string;
      purpose: string;
      description?: string;
    }>;

    try {
      // Enhanced parsing logic to handle various input formats
      parsedFiles = this.parseFilesInput(files);
    } catch (e: any) {
      // Provide more helpful error messages
      if (e.message.includes('stringify')) {
        throw new Error(
          `Stringification detected: ${e.message}. Please pass objects directly without JSON.stringify(). Example: {files: [{filePath: "file.ts", purpose: "description"}]}. This error causes parsing failures.`
        );
      }
      throw new Error(
        `Failed to parse plan_files input: ${e.message}. Expected format: {files: [{filePath: "path", purpose: "description"}]}. Do not stringify the input.`
      );
    }

    // Validate the parsed structure
    if (!Array.isArray(parsedFiles)) {
      throw new Error(
        'Parsed files must be an array. Please do not stringify plan_files tool input.'
      );
    }

    // Validate each file object
    for (const file of parsedFiles) {
      if (!file || typeof file !== 'object') {
        throw new Error(
          'Each file must be an object with filePath and purpose/description properties. Please do not stringify plan_files tool input.'
        );
      }
      if (typeof file.filePath !== 'string') {
        throw new Error(
          'filePath must be a string. Please do not stringify plan_files tool input.'
        );
      }
      if (
        typeof file.purpose !== 'string' &&
        typeof file.description !== 'string'
      ) {
        throw new Error(
          'purpose or description must be a string. Please do not stringify plan_files tool input.'
        );
      }
    }

    if (parsedFiles.length === 0) {
      return 'No files planned.';
    }

    return [
      '### Files to be created or modified:',
      ...parsedFiles.map(
        (f) =>
          `- \`${f.filePath}\`: ${
            f.purpose || f.description || 'No description provided'
          }`
      ),
    ].join('\n');
  }

  /**
   * Enhanced parsing method to handle various input formats
   */
  private parseFilesInput(
    input: unknown
  ): Array<{ filePath: string; purpose: string; description?: string }> {
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
      // Normalize each item to ensure purpose field is set
      return input.map((item: any) => ({
        filePath: item.filePath,
        purpose: item.purpose || item.description,
        description: item.description,
      }));
    }

    // Handle other object formats
    if (input && typeof input === 'object') {
      // Try to extract files from various possible structures
      const obj = input as any;

      // Check if it's already in the correct format
      if (obj.filePath && (obj.purpose || obj.description)) {
        // Normalize to use 'purpose' field
        return [
          {
            filePath: obj.filePath,
            purpose: obj.purpose || obj.description,
            description: obj.description,
          },
        ];
      }

      // Check for common variations
      if (obj.files && Array.isArray(obj.files)) {
        // Normalize each item to ensure purpose field is set
        return obj.files.map((item: any) => ({
          filePath: item.filePath,
          purpose: item.purpose || item.description,
          description: item.description,
        }));
      }

      // Check if it's an array-like object
      if (Array.isArray(obj)) {
        return obj;
      }
    }

    throw new Error(
      `Unsupported input format. Expected: {files: [{filePath: "path", purpose: "description"}]}. Received: ${typeof input}`
    );
  }

  /**
   * Parse stringified JSON input with multiple fallback strategies
   */
  private parseStringifiedInput(
    input: string
  ): Array<{ filePath: string; purpose: string; description?: string }> {
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
      // Normalize each item to ensure purpose field is set
      return currentData.map((item: any) => ({
        filePath: item.filePath,
        purpose: item.purpose || item.description,
        description: item.description,
      }));
    }

    if (currentData && typeof currentData === 'object') {
      // Handle { files: [...] } structure
      if (currentData.files && Array.isArray(currentData.files)) {
        console.log(
          `Successfully parsed files object after ${parseAttempts} attempts`
        );
        // Normalize each item to ensure purpose field is set
        return currentData.files.map((item: any) => ({
          filePath: item.filePath,
          purpose: item.purpose || item.description,
          description: item.description,
        }));
      }

      // Handle single file object
      if (
        currentData.filePath &&
        (currentData.purpose || currentData.description)
      ) {
        console.log(
          `Successfully parsed single file object after ${parseAttempts} attempts`
        );
        return [
          {
            filePath: currentData.filePath,
            purpose: currentData.purpose || currentData.description,
            description: currentData.description,
          },
        ];
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
        `Expected format: {files: [{filePath: "path", purpose: "description"}]}. ` +
        `Please do not stringify the input.`
    );
  }
}

/**
 * Creates the plan_files tool
 */
export function createPlanFilesTool(
  codebaseManager: CodebaseManager
): PlanFilesTool {
  return new PlanFilesTool(codebaseManager);
}
