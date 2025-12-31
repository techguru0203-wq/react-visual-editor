import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { CodebaseManager } from "./codebaseManager";

export const writeFileToolName = 'write_file';

/**
 * Schema for the write file tool
 */
const writeFileSchema = z.object({
  filePath: z.string().describe("The path to the file to write"),
  fileContent: z.string().describe("The content to write to the file"),
});

/**
 * A tool that allows writing files in the in-memory codebase
 */
export class WriteFileTool extends DynamicStructuredTool {
  private codebaseManager: CodebaseManager;
  
  constructor() {
    super({
      name: writeFileToolName,
      description: "Write content to a file. If the file doesn't exist, it will be created. If it exists, it will be overwritten.",
      schema: writeFileSchema,
      func: async ({ filePath, fileContent }) => this.writeFile(filePath, fileContent),
    });
    
    this.codebaseManager = CodebaseManager.getInstance();
  }
  
  /**
   * Writes content to a file, creating it if it doesn't exist or overwriting if it does
   */
  private async writeFile(filePath: string, fileContent: string): Promise<string> {
    try {
      // Input validation
      if (filePath === "") {
        throw new Error("File path cannot be empty");
      }

      // Create or update the file
      const newFile = {
        path: filePath,
        content: fileContent,
        type: 'file'
      };
      
      // Update the codebase map
      const codebaseStr = JSON.stringify({
        files: Object.values(this.codebaseManager.getCodebaseMap()).map(f => 
          f.path === filePath ? newFile : f
        ).concat(
          // If file didn't exist, this will add it. If it did, this won't affect the result
          this.codebaseManager.getFile(filePath) ? [] : [newFile]
        )
      });
      
      this.codebaseManager.updateCodebase(codebaseStr);
      
      return `Successfully ${this.codebaseManager.getFile(filePath) ? 'updated' : 'created'} file: ${filePath}`;
    } catch (error: any) {
      // Provide detailed error context
      const errorContext = {
        tool: writeFileToolName,
        filePath,
        error: error.message,
        suggestion: error.message.includes('empty') ? 
          'Please provide a valid file path' :
          'Check if the file path is valid and the content is properly formatted'
      };
      
      throw new Error(`Failed to write file: ${JSON.stringify(errorContext, null, 2)}`);
    }
  }
}

/**
 * Creates a tool that allows writing files in the in-memory codebase
 * The manager must be initialized before calling this
 */
export function createWriteFileTool(): WriteFileTool {
  return new WriteFileTool();
} 