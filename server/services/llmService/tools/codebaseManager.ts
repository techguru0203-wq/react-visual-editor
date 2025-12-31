/**
 * Types and manager for codebase exploration and reading
 */

export interface CodeFile {
  path: string;
  content: string;
  type?: string;
}

export interface CodeFilesMap {
  [path: string]: CodeFile;
}

/**
 * Manages a shared in-memory representation of a codebase
 */
export class CodebaseManager {
  private codebaseMap: CodeFilesMap = {};

  constructor() {}

  /**
   * Updates the codebase map with new code
   * @param codebaseStr JSON string representation of the codebase
   */
  public updateCodebase(codebaseStr: string): boolean {
    try {
      const codebase = JSON.parse(codebaseStr);

      // Build a new codebase map
      this.codebaseMap = codebase.files.reduce(
        (acc: CodeFilesMap, file: CodeFile) => {
          acc[file.path] = file;
          return acc;
        },
        {}
      );

      return true;
    } catch (error) {
      console.error('Failed to update codebase:', error);
      return false;
    }
  }

  /**
   * Gets a list of available file paths in the codebase
   */
  public getAvailableFiles(): string[] {
    return Object.keys(this.codebaseMap);
  }

  /**
   * Gets the README.md content if it exists
   */
  public getReadmeContent(): string {
    return this.codebaseMap['README.md']?.content || '';
  }

  /**
   * Gets a file from the codebase by path
   */
  public getFile(filePath: string): CodeFile | null {
    return this.codebaseMap[filePath] || null;
  }

  /**
   * Gets the entire codebase map
   */
  public getCodebaseMap(): CodeFilesMap {
    return this.codebaseMap;
  }

  /**
   * Gets file content by path
   */
  public getFileContent(filePath: string): string | null {
    return this.codebaseMap[filePath]?.content || null;
  }

  /**
   * Updates a single file in the codebase
   */
  public updateFile(filePath: string, content: string): void {
    const existingFile = this.codebaseMap[filePath];
    this.codebaseMap[filePath] = {
      path: filePath,
      content: content,
      type: existingFile?.type || 'file',
    };
  }
}

/**
 * Initialize the codebase manager with code
 * This should be called before creating any tools
 *
 * @param codebaseStr JSON string representation of the codebase
 * @returns The initialized CodebaseManager instance
 */
export function initializeCodebaseManager(
  codebaseStr: string
): CodebaseManager {
  const manager = new CodebaseManager();
  manager.updateCodebase(codebaseStr);
  return manager;
}
