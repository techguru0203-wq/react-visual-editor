/**
 * Codebase exploration and management tools
 * These tools allow an LLM to browse and read files from a codebase
 */

import { CodebaseManager } from './codebaseManager';
import {
  createGetFilesContentTool,
  GetFilesContentTool,
} from './getFilesContentTool';
import { createListFilesTool, ListFilesTool } from './listFilesTool';
import {
  createFindMatchingFilesTool,
  FindMatchingFilesTool,
} from './findMatchingFilesTool';
import { createWriteFilesTool, WriteFilesTool } from './writeFilesTool';
import { createPlanFilesTool, PlanFilesTool } from './planFilesTool';
import { createDeleteFilesTool, DeleteFilesTool } from './deleteFilesTool';
import {
  createSearchReplaceTool,
  SearchReplaceTool,
} from './searchReplaceTool';
import { createWebSearchTool, WebSearchTool } from './webSearchTool';
import {
  createExternalFileFetchTool,
  ExternalFileFetchTool,
} from './externalFileFetchTool';

// Export from manager
export {
  CodebaseManager,
  initializeCodebaseManager,
  type CodeFile,
  type CodeFilesMap,
} from './codebaseManager';

// Export from reader tool - use the correct filename casing
export {
  GetFilesContentTool,
  createGetFilesContentTool,
  getFilesContentToolName,
} from './getFilesContentTool';

// Export from list files tool
export {
  ListFilesTool,
  createListFilesTool,
  listFilesToolName,
} from './listFilesTool';

// Export from find matching files tool
export {
  FindMatchingFilesTool,
  createFindMatchingFilesTool,
  findMatchingFilesToolName,
} from './findMatchingFilesTool';

// Export from edit file tool
export {
  WriteFilesTool,
  createWriteFilesTool,
  writeFilesToolName,
} from './writeFilesTool';

// Export from plan file tool
export {
  PlanFilesTool,
  createPlanFilesTool,
  planFilesToolName,
} from './planFilesTool';

// Export from delete file tool
export {
  DeleteFilesTool,
  createDeleteFilesTool,
  deleteFilesToolName,
} from './deleteFilesTool';

// Export from search replace tool
export {
  SearchReplaceTool,
  createSearchReplaceTool,
  searchReplaceToolName,
} from './searchReplaceTool';

// Export from web search tool
export {
  createWebSearchTool,
  webSearchToolName,
  type WebSearchTool,
} from './webSearchTool';

// Export from external file fetch tool
export {
  createExternalFileFetchTool,
  externalFileFetchToolName,
  type ExternalFileFetchTool,
} from './externalFileFetchTool';

// Export convenient function to create both tools
/**
 * Creates all codebase tools
 * The manager must be initialized before calling this
 */
export function createCodebaseTools(
  codebaseManager: CodebaseManager
): [
  GetFilesContentTool,
  ListFilesTool,
  FindMatchingFilesTool,
  WriteFilesTool,
  PlanFilesTool,
  DeleteFilesTool,
  SearchReplaceTool,
  WebSearchTool,
  ExternalFileFetchTool
] {
  return [
    createGetFilesContentTool(codebaseManager),
    createListFilesTool(codebaseManager),
    createFindMatchingFilesTool(codebaseManager),
    createWriteFilesTool(codebaseManager),
    createPlanFilesTool(codebaseManager),
    createDeleteFilesTool(codebaseManager),
    createSearchReplaceTool(codebaseManager),
    createWebSearchTool(),
    createExternalFileFetchTool(),
  ];
}
