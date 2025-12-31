import { ProjectFile } from '../components/prototype/PrototypeEditor';

/**
 * Compare current files with saved files to detect modifications
 * @param currentFiles - Current file list (with user modifications)
 * @param savedFiles - Saved file list (checkpoint from localStorage)
 * @returns Object containing modified file paths and comparison maps
 */
export function compareFiles(
  currentFiles: ProjectFile[],
  savedFiles: ProjectFile[] | null
): {
  modifiedFiles: string[];
  hasChanges: boolean;
  currentMap: Map<string, string>;
  savedMap: Map<string, string>;
} {
  if (!savedFiles) {
    return {
      modifiedFiles: [],
      hasChanges: true, // No saved version means changes exist (allow creating first checkpoint)
      currentMap: new Map(),
      savedMap: new Map(),
    };
  }

  const currentMap = new Map(currentFiles.map((f) => [f.path, f.content]));
  const savedMap = new Map(savedFiles.map((f) => [f.path, f.content]));
  const modified: string[] = [];

  // Check for modified or new files
  currentFiles.forEach((file) => {
    const savedContent = savedMap.get(file.path);
    if (savedContent !== file.content) {
      modified.push(file.path);
    }
  });

  // Check for deleted files
  savedFiles.forEach((file) => {
    if (!currentMap.has(file.path)) {
      modified.push(file.path);
    }
  });

  return {
    modifiedFiles: modified,
    hasChanges: modified.length > 0,
    currentMap,
    savedMap,
  };
}
