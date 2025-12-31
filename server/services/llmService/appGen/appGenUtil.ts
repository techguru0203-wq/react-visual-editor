import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import path from 'path';
import * as fs from 'fs/promises';
import { prepareFinalReactCodeJson } from './prepareCode';
import { CodebaseManager } from '../tools/codebaseManager';
import { DOCTYPE } from '@prisma/client';
import prisma from '../../../db/prisma';
import { AppGenState } from '../appAgentAnthropic';

/**
 * Determines the framework (nextjs or react) based on PRD content and description
 * @param docDataDescription - The document description
 * @param prdDocDescription - The PRD document description
 * @param prdDocContent - The PRD document content
 * @returns 'nextjs' or 'react'
 */
export function determineFramework(
  docDataDescription?: string,
  prdDocDescription?: string,
  prdDocContent?: string
): 'expressjs' | 'nextjs' {
  const nextjsKeywords = [
    'nextjs',
    'next.js',
    'next js',
    'nextjs 14',
    'next.js 14',
  ];

  // Check docData description
  if (docDataDescription) {
    const lowerDesc = docDataDescription.toLowerCase();
    if (nextjsKeywords.some((keyword) => lowerDesc.includes(keyword))) {
      return 'nextjs';
    }
  }

  // Check PRD description
  if (prdDocDescription) {
    const lowerPrdDesc = prdDocDescription.toLowerCase();
    if (nextjsKeywords.some((keyword) => lowerPrdDesc.includes(keyword))) {
      return 'nextjs';
    }
  }

  // Check PRD content
  if (prdDocContent) {
    const lowerPrdContent = prdDocContent.toLowerCase();
    if (nextjsKeywords.some((keyword) => lowerPrdContent.includes(keyword))) {
      return 'nextjs';
    }
  }

  // Default to react if no Next.js keywords found
  return 'expressjs';
}
/**
 * Function to create a file structure based on parsed input
 * @param userId, docId The base directory where the "output" folder will be created
 * @param fileContent The string containing file structure and content information
 */
export async function saveAppFileStructure(
  docId: string,
  versionNumber: number,
  fileContent: string
) {
  if (!docId || !fileContent) {
    console.log('in appGenUtil.return: empty fileContent, ', docId);
    return '';
  }
  let fileUrl = '';
  try {
    // BUCKET_NAME = 'omniflow.team' for dev env, and 'omniflow-team' for prod env
    const BUCKET_NAME = process.env.BUCKET_NAME;
    // const key = `source-code/${docId}.json`;
    const key = `source-code/${docId}_v${versionNumber}.json`; // Use version number in the key
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileContent,
      ContentType: 'application/json',
    });

    const client = new S3Client({
      region: process.env.AWS_REGION,
    });
    await client.send(command);
    fileUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;
    console.log('✅ App structure created successfully:', fileUrl);
  } catch (err) {
    console.error('in appGenUtil.saveAppFileStructure error:', err);
  }
  return fileUrl;
}

/**
 * Parse file content to extract file paths and their contents
 * @param fileContent The input string containing file structure and content
 * @returns Array of objects containing file paths and their contents
 */
function parseFileContent(
  fileContent: string
): { filePath: string; content: string }[] {
  const files: { filePath: string; content: string }[] = [];
  const fileMatches = fileContent.matchAll(
    /\/\/ File: ([^\n]+)\s*\n([\s\S]*?)(?=\/\/ File:|$)/g
  );

  for (const match of fileMatches) {
    if (match.length >= 3) {
      const filePath = match[1].trim();
      const content = match[2].trim();

      if (filePath && content) {
        files.push({
          filePath,
          content,
        });
      }
    }
  }

  return files;
}

/**
 * Converts a JSON string representing files to a formatted string with file names and contents
 * @param jsonString - The JSON string containing file information
 * @returns A formatted string with file names and their contents
 */
export function convertJsonToCode(jsonString: string): string {
  try {
    // Parse the JSON string
    const parsedData = JSON.parse(jsonString);

    // Check if the expected structure exists
    if (!parsedData.files || !Array.isArray(parsedData.files)) {
      throw new Error("Invalid JSON structure: 'files' array not found");
    }

    // Initialize the output string
    let outputString = '';

    // Filter out components/ui files and iterate through remaining files
    // add a log to print the file paths of the filtered files
    parsedData.files.forEach(
      (
        file: { path: string; type: string; content: string },
        index: number
      ) => {
        // Add separator between files (except for the first file)
        if (index > 0) {
          outputString += '\n\n';
        }

        // Add the file name with a comment
        outputString += `// ${file.path}:\n`;

        // Add the file content
        if (
          file.path.includes('package-lock') ||
          file.path.includes('components/ui') ||
          file.path.includes('mock-data') ||
          file.path.includes('storage')
        ) {
          outputString += `file content omitted\n`;
        } else {
          outputString += file.content;
        }
      }
    );

    return outputString;
  } catch (error) {
    if (error instanceof Error) {
      return `Error processing JSON: ${error.message}`;
    }
    return 'An unknown error occurred while processing the JSON';
  }
}

export function mergeCode(existingCodeStr: string, newCodeStr: string) {
  let existingCode = JSON.parse(existingCodeStr);
  let newCode = JSON.parse(newCodeStr);

  // Ensure existingCode.files is an object for easy merging
  const existingFilesMap = existingCode.files.reduce(
    (acc: { [key: string]: any }, file: any) => {
      acc[file.path] = file; // Map file paths to file objects
      return acc;
    },
    {}
  );

  (newCode.files || []).forEach((file: any) => {
    // Merge new file or update existing file
    existingFilesMap[file.path] = file; // This will add or update the file
  });

  // Convert the merged files back to an array
  existingCode.files = Object.values(existingFilesMap);

  // print file paths of mergedCode
  console.log(
    'mergedCode files:',
    existingCode.files.map((file: any) => file.path)
  );

  return JSON.stringify(existingCode, null, 2);
}

export async function mergeAndPrepareCode(
  existingCodeStr: string,
  newCodeStr: string
) {
  // First merge the code
  const mergedCodeJson = mergeCode(existingCodeStr, newCodeStr);
  // Then prepare the code by fixing imports and dependencies
  try {
    const mergedCodeObj = JSON.parse(mergedCodeJson);
    // add a timer to measure the time it takes to prepare the code
    const startTime = Date.now();
    const preparedCodeObj = await prepareFinalReactCodeJson(mergedCodeObj);
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(
      `in appGenUtil.mergeAndPrepareCode, time taken to prepare code: ${duration}ms`
    );
    return JSON.stringify(preparedCodeObj, null, 2);
  } catch (error) {
    console.error('in appGenUtil.mergeAndPrepareCode error:', error);
    return mergedCodeJson;
  }
}

// Recursive function to read directory
async function readDirectoryRecursive(
  dirPath: string,
  baseDir: string,
  filterComponentsUI: boolean = true
) {
  const files: { type: string; path: string; content: string }[] = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    // Skip node_modules and hidden files/folders
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
      continue;
    }

    // Skip components/ui only if filterComponentsUI is true
    if (filterComponentsUI && relativePath.includes('components/ui')) {
      continue;
    }

    // Skip mock-data and storage
    if (entry.name.includes('mock-data') || entry.name.includes('storage')) {
      continue;
    }

    // skip client side read-me
    if (entry.name.toLowerCase().includes('readme')) {
      continue;
    }

    if (entry.isDirectory()) {
      const subFiles = await readDirectoryRecursive(
        fullPath,
        baseDir,
        filterComponentsUI
      );
      files.push(...subFiles);
    } else {
      const content = await fs.readFile(fullPath, 'utf8');
      files.push({
        type: 'file',
        path: relativePath,
        content: content,
      });
    }
  }

  return files;
}

export async function defaultReactProjectCodeTemplate(
  docType: string,
  projectId: string,
  framework: 'expressjs' | 'nextjs' = 'expressjs'
) {
  // Determine if generating fullstack app based on conversion type
  const isGeneratingFullStackApp = docType === DOCTYPE.PRODUCT;

  // Choose template based on framework and app type
  let templateName: string;
  if (isGeneratingFullStackApp) {
    templateName =
      framework === 'nextjs' ? 'starter_nextjs_app' : 'starter_express_app';
  } else {
    templateName =
      framework === 'nextjs' ? 'starter_nextjs_app' : 'starter_react_app';
  }

  const templateDir = path.join(__dirname, `../${templateName}`);
  let builtUponPrototypeCode = false;
  let files = await readDirectoryRecursive(templateDir, templateDir, false);

  if (isGeneratingFullStackApp) {
    const prototypeCode = await prisma.document.findFirst({
      where: { projectId, type: DOCTYPE.PROTOTYPE },
      select: { content: true },
    });

    if (prototypeCode?.content?.length) {
      try {
        // Convert content to string and parse as JSON
        const contentString = Buffer.isBuffer(prototypeCode.content)
          ? prototypeCode.content.toString('utf8')
          : String(prototypeCode.content);
        const prototypeData = JSON.parse(contentString);
        builtUponPrototypeCode = true;
        // Create a map of existing files for easy lookup and replacement
        const filesMap = files.reduce(
          (acc: { [key: string]: any }, file: any) => {
            acc[file.path] = file;
            return acc;
          },
          {}
        );

        // Overwrite files under 'frontend' with prototype code
        if (prototypeData.files && Array.isArray(prototypeData.files)) {
          prototypeData.files.forEach((prototypeFile: any) => {
            if (
              prototypeFile.path &&
              !prototypeFile.path.toLowerCase().includes('package-lock') &&
              !prototypeFile.path.toLowerCase().includes('readme') &&
              !prototypeFile.path.toLowerCase().includes('mock-data') &&
              !prototypeFile.path.toLowerCase().includes('storage')
            ) {
              let filePath =
                framework === 'nextjs'
                  ? prototypeFile.path
                  : `frontend/${prototypeFile.path}`;
              filesMap[filePath] = {
                type: 'file',
                path: filePath,
                content: prototypeFile.content,
              };
            }
          });
        }

        // Convert back to array
        files = Object.values(filesMap);

        console.log(
          '✅ Successfully merged prototype code with frontend files'
        );
      } catch (error) {
        console.error('Error processing prototype code:', error);
        // Continue with original files if prototype processing fails
        return { files, builtUponPrototypeCode };
      }
    }
  }
  return { files, builtUponPrototypeCode };
}

/**
 * Gets Stripe-related files from the Stripe module directory
 * @returns Object containing Stripe files including migration files
 */
export async function getStripeModuleFiles(): Promise<{
  files: any[];
}> {
  const moduleDir = path.join(
    __dirname,
    '../modules/starter_express_app/stripe'
  );

  try {
    // Read all files from the stripe module
    const allFiles = await readDirectoryRecursive(moduleDir, moduleDir, false);

    // Include all files including migration files, only filter out README
    const stripeFiles = allFiles.filter(
      (file: any) => !file.path.toLowerCase().includes('readme')
    );

    console.log(
      `Found ${stripeFiles.length} Stripe module files (including migrations)`,
      stripeFiles.map((f: any) => f.path)
    );

    return { files: stripeFiles };
  } catch (error) {
    console.error('Error reading Stripe module files:', error);
    return { files: [] };
  }
}

/**
 * Intelligently merges Stripe files into existing code JSON
 * For same-path files, analyzes content and merges without breaking existing code
 * @param existingCodeJson - The existing code as JSON string
 * @param stripeFiles - Array of Stripe files to merge
 * @returns Merged code as JSON string
 */
export function mergeStripeFilesIntoCode(
  existingCodeJson: string,
  stripeFiles: any[]
): string {
  try {
    const existingCode = JSON.parse(existingCodeJson);

    // Create a map of existing files for easy lookup
    const filesMap = existingCode.files.reduce(
      (acc: { [key: string]: any }, file: any) => {
        acc[file.path] = file;
        return acc;
      },
      {}
    );

    // Process each Stripe file
    stripeFiles.forEach((stripeFile: any) => {
      if (filesMap[stripeFile.path]) {
        const existingFile = filesMap[stripeFile.path];

        // File exists but no Stripe content - intelligent merge needed
        console.log(`Merging Stripe content into existing: ${stripeFile.path}`);
        filesMap[stripeFile.path] = mergeFileContents(
          existingFile,
          stripeFile,
          '---Stripe Integration---'
        );
      } else {
        // New file - add directly
        console.log(`Adding new Stripe file: ${stripeFile.path}`);
        filesMap[stripeFile.path] = stripeFile;
      }
    });

    // Convert back to array
    existingCode.files = Object.values(filesMap);

    return JSON.stringify(existingCode, null, 2);
  } catch (error) {
    console.error('Error merging Stripe files:', error);
    return existingCodeJson;
  }
}

/**
 * Intelligently merges file contents, preserving existing code
 * @param existingFile - The existing file object
 * @param newFile - The new file object to merge
 * @param integrationLabel - Optional label for the merged section (e.g., 'Stripe Integration')
 * @returns Merged file object
 */
function mergeFileContents(
  existingFile: any,
  newFile: any,
  integrationLabel?: string
): any {
  const existingContent = existingFile.content || '';
  const newContent = newFile.content || '';
  const filePath = existingFile.path || '';

  // For backend server.ts, use special merge logic
  if (filePath.includes('backend/server.ts')) {
    const label = integrationLabel || 'Module';
    console.log(`Merging ${label} routes into backend server: ${filePath}`);
    return {
      ...existingFile,
      content: mergeBackendServerFile(existingContent, newContent),
    };
  }

  // For TypeScript/JavaScript files, merge imports and exports
  if (isCodeFile(filePath)) {
    return {
      ...existingFile,
      content: mergeCodeContent(
        existingContent,
        newContent,
        filePath,
        integrationLabel
      ),
    };
  }

  // For config files (package.json, etc.), merge JSON
  if (filePath.endsWith('package.json')) {
    return {
      ...existingFile,
      content: mergePackageJson(existingContent, newContent),
    };
  }

  // For schema files, intelligently merge both schemas
  if (filePath.includes('schema.ts')) {
    const label = integrationLabel || 'new';
    console.log(`Merging ${label} schema with existing schema: ${filePath}`);
    return {
      ...existingFile,
      content: mergeSchemaFiles(existingContent, newContent),
    };
  }

  // For migration files, keep both (they should be different files)
  if (filePath.includes('migrations/')) {
    const label = integrationLabel || 'new';
    console.log(`Keeping ${label} migration: ${filePath}`);
    return newFile;
  }

  // For other files, prefer existing content (don't override user's code)
  console.log(`Keeping existing content for: ${filePath}`);
  return existingFile;
}

/**
 * Merges Stripe module's backend server.ts into the starter's backend server.ts
 * Extracts imports and route mounting code from Stripe module and inserts them into the correct locations
 * @param existingContent - The existing backend server.ts content
 * @param stripeContent - The Stripe module's server.ts content
 * @returns Merged server.ts content
 */
export function mergeBackendServerFile(
  existingContent: string,
  stripeContent: string
): string {
  // Extract import statements from Stripe module
  const stripeImports = extractImports(stripeContent);

  // Extract the route mounting code (everything except imports and comments)
  const stripeLinesWithoutImports = stripeContent.split('\n').filter((line) => {
    const trimmed = line.trim();
    // Skip import lines, empty lines, and comment-only lines
    return (
      !trimmed.startsWith('import ') &&
      !trimmed.startsWith('/**') &&
      !trimmed.startsWith('*') &&
      !trimmed.startsWith('//') &&
      trimmed.length > 0
    );
  });

  // Extract the route mounting logic (the if block with app.use)
  const routeMountingCode = stripeLinesWithoutImports.join('\n');

  // Find the position to insert Stripe imports (after existing imports, before other code)
  const importInsertMarker = '// Stripe related import add here';
  let result = existingContent;

  // Insert Stripe imports at the marked location
  if (result.includes(importInsertMarker)) {
    result = result.replace(importInsertMarker, `${stripeImports.join('\n')}`);
  } else {
    // Fallback: insert after the last import
    const lastImportMatch = [...existingContent.matchAll(/^import .+;$/gm)];
    if (lastImportMatch.length > 0) {
      const lastImportIndex =
        lastImportMatch[lastImportMatch.length - 1].index! +
        lastImportMatch[lastImportMatch.length - 1][0].length;
      result =
        result.slice(0, lastImportIndex) +
        '\n\n' +
        stripeImports.join('\n') +
        result.slice(lastImportIndex);
    }
  }

  // Find the position to insert route mounting code
  const routeInsertMarker = '/**\n * Install Stripe Routes here\n */';

  if (result.includes(routeInsertMarker)) {
    result = result.replace(
      routeInsertMarker,
      `/**\n * Stripe Routes\n * Conditionally mounted based on STRIPE_SECRET_KEY availability\n */\n${routeMountingCode}`
    );
  } else {
    // Fallback: insert before the SPA fallback route
    const spaFallbackMarker = '/**\n * SPA Fallback Route';
    if (result.includes(spaFallbackMarker)) {
      result = result.replace(
        spaFallbackMarker,
        `/**\n * Stripe Routes\n * Conditionally mounted based on STRIPE_SECRET_KEY availability\n */\n${routeMountingCode}\n\n${spaFallbackMarker}`
      );
    }
  }

  console.log('✅ Successfully merged Stripe routes into backend server.ts');
  return result;
}

/**
 * Checks if file is a code file that needs smart merging
 */
function isCodeFile(filePath: string): boolean {
  return (
    /\.(ts|tsx|js|jsx)$/.test(filePath) && !filePath.endsWith('package.json')
  );
}

/**
 * Intelligently merge schema files to preserve both existing and new tables
 */
export function mergeSchemaFiles(
  existingContent: string,
  newContent: string
): string {
  // Extract imports from both files
  const existingImports = extractImports(existingContent);
  const newImports = extractImports(newContent);

  // Merge unique imports
  const importMap = new Map<string, string>();

  // Add existing imports
  existingImports.forEach((imp) => {
    const fromMatch = imp.match(/from\s+['"](.+?)['"]/);
    if (fromMatch) {
      const source = fromMatch[1];
      // Normalize import statement (remove extra whitespace/newlines)
      const normalizedImport = imp.replace(/\s+/g, ' ').trim();
      importMap.set(source, normalizedImport);
    }
  });

  // Add new imports (merge if same source)
  newImports.forEach((imp) => {
    const fromMatch = imp.match(/from\s+['"](.+?)['"]/);
    if (fromMatch) {
      const source = fromMatch[1];
      const normalizedImport = imp.replace(/\s+/g, ' ').trim();
      const existing = importMap.get(source);

      if (existing) {
        // Merge imports from the same source
        const merged = mergeImportStatements(existing, normalizedImport);
        importMap.set(source, merged);
      } else {
        importMap.set(source, normalizedImport);
      }
    }
  });

  const allImports = Array.from(importMap.values());

  // Remove imports from content before extracting other elements
  const existingContentNoImports = removeImports(existingContent);
  const newContentNoImports = removeImports(newContent);

  // Add missing imports that are commonly needed
  // Check if we need to add sql import from drizzle-orm
  const needsSqlImport =
    existingContentNoImports.includes('sql`') ||
    newContentNoImports.includes('sql`');
  const hasSqlImport = allImports.some(
    (imp) => imp.includes("from 'drizzle-orm'") && imp.includes('sql')
  );

  if (needsSqlImport && !hasSqlImport) {
    // Find drizzle-orm import and add sql to it
    const drizzleIndex = allImports.findIndex((imp) =>
      imp.includes("from 'drizzle-orm'")
    );
    if (drizzleIndex >= 0) {
      const drizzleImport = allImports[drizzleIndex];
      if (!drizzleImport.includes('sql')) {
        // Add sql to existing drizzle-orm import
        allImports[drizzleIndex] = drizzleImport.replace(
          /from\s+['"]drizzle-orm['"]/,
          ", sql from 'drizzle-orm'"
        );
      }
    } else {
      // Add new import for sql
      allImports.push("import { sql } from 'drizzle-orm';");
    }
  }

  // Check if we need to add z import from zod
  const needsZodImport =
    existingContentNoImports.includes('z.') ||
    newContentNoImports.includes('z.');
  const hasZodImport = allImports.some((imp) => imp.includes("from 'zod'"));

  if (needsZodImport && !hasZodImport) {
    allImports.push("import { z } from 'zod';");
  }

  // Extract enum definitions from new content
  const newEnums = extractEnumDefinitions(newContentNoImports);

  // Extract table definitions (excluding the users table which may exist in both)
  const existingTables = extractTableDefinitions(existingContentNoImports, [
    'users',
  ]);
  const newTables = extractTableDefinitions(newContentNoImports, ['users']);

  // Extract schema validation definitions
  const existingSchemas = extractSchemaValidations(existingContentNoImports);
  const newSchemas = extractSchemaValidations(newContentNoImports);

  // Extract type exports from both files
  const existingTypeExports = extractTypeExports(existingContentNoImports);
  const newTypeExports = extractTypeExports(newContentNoImports);

  // Build the merged schema file with proper structure
  const sections = [
    // 1. All imports at the top
    allImports.join('\n'),
    '',
    // 2. Enums (must come before tables that reference them)
    newEnums ? `// Additional enums\n${newEnums}` : '',
    '',
    // 3. Users table (from existing schema)
    '// Users table',
    extractUsersTable(existingContentNoImports),
    '',
    // 4. Existing application tables
    existingTables ? `// Application tables\n${existingTables}` : '',
    '',
    // 5. New tables
    newTables ? `// Additional tables\n${newTables}` : '',
    '',
    // 6. Validation schemas
    existingSchemas ? `// Validation schemas\n${existingSchemas}` : '',
    newSchemas ? `\n// Additional validation schemas\n${newSchemas}` : '',
    '',
    // 7. Type exports
    existingTypeExports ? `// Type exports\n${existingTypeExports}` : '',
    newTypeExports ? `\n// Additional type exports\n${newTypeExports}` : '',
  ];

  // Filter out empty sections and join
  const mergedContent = sections
    .filter((section) => section.trim().length > 0)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n'); // Replace multiple newlines with double newlines

  return mergedContent;
}

/**
 * Extract enum definitions from content
 */
function extractEnumDefinitions(content: string): string {
  const enumRegex = /export\s+const\s+\w+Enum\s*=\s*pgEnum[\s\S]*?\]\s*\);/g;
  const matches = content.match(enumRegex);
  return matches ? matches.join('\n\n') : '';
}

/**
 * Extract table definitions from content, excluding specified tables
 */
function extractTableDefinitions(
  content: string,
  excludeTables: string[] = []
): string {
  // Match table definitions
  const tableRegex =
    /export\s+const\s+(\w+)\s*=\s*pgTable\([^)]+\)[\s\S]*?\}\);/g;
  const tables: string[] = [];
  let match;

  while ((match = tableRegex.exec(content)) !== null) {
    const tableName = match[1];
    if (!excludeTables.includes(tableName)) {
      tables.push(match[0]);
    }
  }

  return tables.join('\n\n');
}

/**
 * Extract the users table definition
 */
function extractUsersTable(content: string): string {
  const usersTableRegex =
    /export\s+const\s+users\s*=\s*pgTable\([^)]+\)[\s\S]*?\}\);/;
  const match = content.match(usersTableRegex);
  return match ? match[0] : '';
}

/**
 * Extract schema validation definitions
 */
function extractSchemaValidations(content: string): string {
  // Match zod schema definitions
  const schemaRegex =
    /export\s+const\s+\w+Schema\s*=\s*z\.(object|union|array)[\s\S]*?;\s*$/gm;
  const schemas = content.match(schemaRegex);
  return schemas ? schemas.join('\n\n') : '';
}

/**
 * Extract type export definitions
 */
function extractTypeExports(content: string): string {
  // Match type exports (export type ... = ...)
  const typeExportRegex = /^export\s+type\s+\w+\s*=[\s\S]*?;/gm;
  const typeExports = content.match(typeExportRegex);
  return typeExports ? typeExports.join('\n') : '';
}

/**
 * Extract route definitions from App.tsx content
 */
function extractRoutes(content: string): string[] {
  const routes: string[] = [];
  let pos = 0;

  while ((pos = content.indexOf('<Route', pos)) !== -1) {
    let i = pos + 6;
    let braceDepth = 0;
    let inQuote = false;
    let quoteChar = '';

    // Scan until we find the closing /> at depth 0
    while (i < content.length) {
      const char = content[i];
      const prev = content[i - 1];

      // Handle quotes
      if ((char === '"' || char === "'") && prev !== '\\') {
        if (!inQuote) {
          inQuote = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuote = false;
        }
      }

      // Track brace depth when not in quotes
      if (!inQuote) {
        if (char === '{') braceDepth++;
        else if (char === '}') braceDepth--;
        else if (braceDepth === 0 && char === '/' && content[i + 1] === '>') {
          routes.push(content.substring(pos, i + 2).trim());
          pos = i + 2;
          break;
        }
      }
      i++;
    }
    if (i >= content.length) break;
  }

  // Deduplicate by path
  const routeMap = new Map<string, string>();
  routes.forEach((route) => {
    const pathMatch = route.match(/path="([^"]*)"/);
    if (pathMatch && !routeMap.has(pathMatch[1])) {
      routeMap.set(pathMatch[1], route);
    }
  });

  return Array.from(routeMap.values());
}

/**
 * Extract page component imports from App.tsx
 */
function extractPageImports(content: string): string[] {
  // Match imports that look like page imports (containing 'pages' or specific page names)
  const pageImportRegex =
    /^import\s+\w+\s+from\s+['"].*\/(pages?|components?)\/[^'"]+['"];?$/gm;
  const matches = content.match(pageImportRegex);

  // Also match specific Stripe page imports
  const stripePageRegex =
    /^import\s+(Pricing|Subscription|PaymentSuccess|PaymentCancel)\s+from\s+['"][^'"]+['"];?$/gm;
  const stripeMatches = content.match(stripePageRegex);

  const allPageImports = [];
  if (matches) allPageImports.push(...matches);
  if (stripeMatches) allPageImports.push(...stripeMatches);

  return allPageImports;
}

/**
 * Merges code content by combining imports and exports intelligently
 * @param existingContent - The existing file content
 * @param newContent - The new content to merge
 * @param filePath - The file path (optional, for context-aware merging)
 * @param integrationLabel - Optional label for the merged section (e.g., 'Stripe Integration')
 */
function mergeCodeContent(
  existingContent: string,
  newContent: string,
  filePath: string = '',
  integrationLabel?: string
): string {
  // For specific files, use different merge strategies
  const fileName = filePath.split('/').pop() || '';

  // Extract imports from both
  const existingImports = extractImports(existingContent);
  const newImports = extractImports(newContent);

  // Combine unique imports (deduplicate)
  const importMap = new Map<string, string>();

  // Add existing imports
  existingImports.forEach((imp) => {
    const fromMatch = imp.match(/from\s+['"](.+?)['"]/);
    if (fromMatch) {
      importMap.set(fromMatch[1], imp);
    }
  });

  // Add new imports (merge if same source)
  newImports.forEach((imp) => {
    const fromMatch = imp.match(/from\s+['"](.+?)['"]/);
    if (fromMatch) {
      const source = fromMatch[1];
      const existing = importMap.get(source);

      // If there's an existing import from same source, merge them
      if (existing) {
        importMap.set(source, mergeImportStatements(existing, imp));
      } else {
        importMap.set(source, imp);
      }
    }
  });

  const allImports = Array.from(importMap.values());

  // Remove imports from both contents
  const existingCodeWithoutImports = removeImports(existingContent);
  const newCodeWithoutImports = removeImports(newContent);

  // Prepare separator comment if label provided
  const separator = integrationLabel ? `\n\n// ${integrationLabel}\n` : '\n\n';

  // For router/controller files, append new routes/handlers
  if (
    existingContent.includes('express.Router()') ||
    existingContent.includes('app.use(') ||
    existingContent.includes('export default router')
  ) {
    // This is a router file - append new routes
    const mergedContent =
      allImports.join('\n') +
      '\n\n' +
      existingCodeWithoutImports +
      separator +
      newCodeWithoutImports;
    return mergedContent;
  }

  // Default: Combine imports and append new code
  const mergedContent =
    allImports.join('\n') +
    '\n\n' +
    existingCodeWithoutImports +
    separator +
    newCodeWithoutImports;

  return mergedContent;
}

/**
 * Merge two import statements from the same source
 */
function mergeImportStatements(existing: string, newImport: string): string {
  // Extract imported items from multi-line or single-line imports
  const extractImportedItems = (importStr: string) => {
    // Handle different import types
    const namedImportMatch = importStr.match(/import\s+\{([\s\S]*?)\}\s*from/);
    const defaultImportMatch = importStr.match(/import\s+(\w+)\s+from/);
    const namespaceImportMatch = importStr.match(
      /import\s+\*\s+as\s+(\w+)\s+from/
    );
    const mixedImportMatch = importStr.match(
      /import\s+(\w+)\s*,\s*\{([\s\S]*?)\}\s*from/
    );

    return {
      namedImports: namedImportMatch
        ? namedImportMatch[1]
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s)
        : [],
      defaultImport: mixedImportMatch
        ? mixedImportMatch[1].trim()
        : defaultImportMatch && !namedImportMatch
        ? defaultImportMatch[1].trim()
        : null,
      namespaceImport: namespaceImportMatch
        ? namespaceImportMatch[1].trim()
        : null,
    };
  };

  const existingParts = extractImportedItems(existing);
  const newParts = extractImportedItems(newImport);

  // Get the source module
  const source = existing.match(/from\s+['"](.+?)['"]/)?.[1];
  if (!source) return newImport;

  // Merge all import types
  const allNamedImports = [
    ...new Set([...existingParts.namedImports, ...newParts.namedImports]),
  ];
  const defaultImport = existingParts.defaultImport || newParts.defaultImport;
  const namespaceImport =
    existingParts.namespaceImport || newParts.namespaceImport;

  // Build the merged import statement
  let importStatement = 'import ';

  if (namespaceImport) {
    importStatement += `* as ${namespaceImport}`;
  } else {
    const parts: string[] = [];
    if (defaultImport) {
      parts.push(defaultImport);
    }
    if (allNamedImports.length > 0) {
      parts.push(`{ ${allNamedImports.join(', ')} }`);
    }
    importStatement += parts.join(', ');
  }

  importStatement += ` from '${source}';`;
  return importStatement;
}

/**
 * Extracts import statements from code (including multi-line imports)
 */
function extractImports(content: string): string[] {
  const imports: string[] = [];

  // More accurate regex that handles multi-line imports properly
  // This regex matches:
  // - import { ... } from '...'
  // - import * as X from '...'
  // - import X from '...'
  // - import X, { ... } from '...'
  // And handles multi-line cases
  const importRegex =
    /import\s+(?:(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*\{[^}]*\})?)\s+from\s+['"][^'"]+['"];?/gs;

  // Special handling for multi-line imports with curly braces
  const multiLineImportRegex =
    /import\s+(?:type\s+)?\{\s*[\s\S]*?\}\s*from\s+['"][^'"]+['"];?/g;

  // First find all standard imports
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[0]);
  }

  // Then find multi-line imports that might have been missed
  content.replace(multiLineImportRegex, (importMatch) => {
    // Check if this import is already captured
    const isDuplicate = imports.some(
      (imp) =>
        imp.replace(/\s+/g, ' ').trim() ===
        importMatch.replace(/\s+/g, ' ').trim()
    );

    if (!isDuplicate) {
      imports.push(importMatch);
    }
    return importMatch;
  });

  // Remove duplicates and return
  return [...new Set(imports)];
}

/**
 * Removes import statements from code (including multi-line imports)
 */
function removeImports(content: string): string {
  // Match both single-line and multi-line import statements
  const fullImportRegex =
    /import\s+(?:(?:\{[\s\S]*?\})|(?:\*\s+as\s+\w+)|(?:\w+))?\s*(?:,\s*(?:\{[\s\S]*?\}|\w+))?\s*from\s+['"][^'"]+['"];?\s*\n?/g;
  return content.replace(fullImportRegex, '').trim();
}

/**
 * Merges package.json files, combining dependencies
 */
function mergePackageJson(
  existingContent: string,
  stripeContent: string
): string {
  try {
    const existing = JSON.parse(existingContent);
    const stripe = JSON.parse(stripeContent);

    // Merge dependencies
    if (stripe.dependencies) {
      existing.dependencies = {
        ...existing.dependencies,
        ...stripe.dependencies,
      };
    }

    // Merge devDependencies
    if (stripe.devDependencies) {
      existing.devDependencies = {
        ...existing.devDependencies,
        ...stripe.devDependencies,
      };
    }

    return JSON.stringify(existing, null, 2);
  } catch (error) {
    console.error('Error merging package.json:', error);
    return existingContent;
  }
}

/**
 * Check if Stripe module is already integrated in the code
 * @param code - The code as JSON string
 * @returns true if Stripe files are found in the code
 */
function isStripeAlreadyInCode(code: string): boolean {
  try {
    const parsedCode = JSON.parse(code);
    if (!parsedCode.files || !Array.isArray(parsedCode.files)) {
      return false;
    }

    // Check for key Stripe files that indicate module is installed
    const stripeIndicatorFiles = [
      'backend/routes/stripe.ts',
      'backend/routes/webhook/stripeWebhook.ts', //old stripe module
      'backend/services/stripeService.ts',
      'backend/repositories/stripe.ts',
      'shared/config/stripe-product.ts',
      'frontend/src/lib/stripe.ts',
    ];

    const foundStripeFiles = parsedCode.files.filter((file: any) =>
      stripeIndicatorFiles.some((indicator) => file.path === indicator)
    );

    // If we found at least 3 of the 6 key files, consider Stripe as installed
    const isInstalled = foundStripeFiles.length >= 3;

    if (isInstalled) {
      console.log(
        `🔍 Detected ${foundStripeFiles.length} Stripe indicator files in code:`,
        foundStripeFiles.map((f: any) => f.path)
      );
    }

    return isInstalled;
  } catch (error) {
    console.error('Error checking Stripe in code:', error);
    return false;
  }
}

/**
 * Handles Stripe module integration based on user request
 * @param originalCode - The original code as JSON string
 * @param appGenState - The current app generation state (STARTER or IMPROVE)
 * @param stripeFeatureRequested - Whether user requested Stripe/payment features
 * @param docMeta - Document metadata to check if Stripe already installed
 * @returns Object with merged code and flag indicating if Stripe was integrated
 *
 * Integration logic:
 * - If already installed: Skip (prevent duplicates)
 * - If requested by user: Install in ANY state (STARTER or IMPROVE)
 * - If not requested: Skip installation
 */
export async function handleStripeFiles(
  originalCode: string,
  appGenState: string,
  stripeFeatureRequested: boolean = false,
  docMeta?: any
): Promise<{ code: string; stripeIntegrated: boolean }> {
  console.log(
    `🔍 handleStripeFiles called - appGenState: ${appGenState}, stripeFeatureRequested: ${stripeFeatureRequested}`
  );

  // Check if Stripe module is already installed in metadata
  const stripeAlreadyInstalled = docMeta?.stripeModuleInstalled === true;

  if (stripeAlreadyInstalled) {
    console.log(
      '✅ Stripe module already installed (from metadata) - skipping integration'
    );
    return { code: originalCode, stripeIntegrated: false };
  }

  // Check if Stripe files already exist in the code (prevents duplicate merging)
  const stripeInCode = isStripeAlreadyInCode(originalCode);

  if (stripeInCode) {
    console.log(
      '✅ Stripe module already present in code - skipping duplicate integration'
    );
    return { code: originalCode, stripeIntegrated: false };
  }

  // If user requested Stripe features, integrate regardless of app state
  if (stripeFeatureRequested) {
    const stateLabel =
      appGenState === AppGenState.STARTER
        ? 'initial generation'
        : 'regeneration';
    console.log(
      `🔄 Integrating Stripe module during ${stateLabel} as requested by user`
    );

    try {
      const { files: stripeFiles } = await getStripeModuleFiles();

      if (stripeFiles.length > 0) {
        const mergedCode = mergeStripeFilesIntoCode(originalCode, stripeFiles);
        console.log(
          `✅ Integrated ${stripeFiles.length} Stripe module files (including migrations)`
        );
        return { code: mergedCode, stripeIntegrated: true };
      } else {
        console.log('⚠️  No Stripe module files found');
      }
    } catch (error) {
      console.error('❌ Error integrating Stripe module:', error);
    }
  } else {
    console.log('Stripe feature not requested - skipping integration');
  }

  return { code: originalCode, stripeIntegrated: false };
}

export const defaultProjectCodeTemplate = {
  files: [
    {
      type: 'file',
      content:
        '{\n  "name": "",\n  "private": true,\n  "version": "0.0.1",\n  "type": "module",\n  "scripts": {\n    "dev": "vite",\n    "build": "tsc && vite build",\n    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",\n    "preview": "vite preview"\n  },\n  "dependencies": {\n    "@radix-ui/react-accordion": "^1.2.0",\n    "@radix-ui/react-alert-dialog": "^1.1.1",\n    "@radix-ui/react-aspect-ratio": "^1.1.0",\n    "@radix-ui/react-avatar": "^1.1.0",\n    "@radix-ui/react-checkbox": "^1.1.1",\n    "@radix-ui/react-collapsible": "^1.1.0",\n    "@radix-ui/react-context-menu": "^2.2.1",\n    "@radix-ui/react-dialog": "^1.1.2",\n    "@radix-ui/react-dropdown-menu": "^2.1.1",\n    "@radix-ui/react-hover-card": "^1.1.1",\n    "@radix-ui/react-icons": "^1.1.0",\n    "@radix-ui/react-label": "^2.1.0",\n    "@radix-ui/react-menubar": "^1.1.1",\n    "@radix-ui/react-navigation-menu": "^1.2.0",\n    "@radix-ui/react-popover": "^1.1.1",\n    "@radix-ui/react-progress": "^1.1.0",\n    "@radix-ui/react-radio-group": "^1.2.0",\n    "@radix-ui/react-scroll-area": "^1.1.0",\n    "@radix-ui/react-select": "^2.1.1",\n    "@radix-ui/react-separator": "^1.1.0",\n    "@radix-ui/react-slider": "^1.2.0",\n    "@radix-ui/react-slot": "^1.1.0",\n    "@radix-ui/react-switch": "^1.1.0",\n    "@radix-ui/react-tabs": "^1.1.0",\n    "@radix-ui/react-toast": "^1.2.1",\n    "@radix-ui/react-toggle": "^1.1.0",\n    "@radix-ui/react-toggle-group": "^1.1.0",\n    "@radix-ui/react-tooltip": "^1.1.4",\n    "class-variance-authority": "^0.7.1",\n    "clsx": "^2.1.1",\n    "cmdk": "^1.0.0",\n    "date-fns": "^3.6.0",\n    "embla-carousel-react": "^8.3.0",\n    "framer-motion": "^10.16.5",\n    "input-otp": "^1.2.4",\n    "lucide-react": "^0.462.0",\n    "next-themes": "^0.3.0",\n    "react": "^18.3.1",\n    "react-day-picker": "^8.10.1",\n    "react-dom": "^18.3.1",\n    "react-hook-form": "^7.53.0",\n    "react-resizable-panels": "^2.1.3",\n    "react-router-dom": "^6.30.0",\n    "recharts": "^2.12.7",\n    "sonner": "^1.5.0",\n    "tailwind-merge": "^2.5.2",\n    "tailwindcss-animate": "^1.0.7",\n    "vaul": "^0.9.3",\n    "zod": "^3.23.8",\n    "zustand": "^4.5.6"\n  },\n  "devDependencies": {\n    "@types/node": "^20.11.26",\n    "@types/react": "^18.2.56",\n    "@types/react-dom": "^18.2.19",\n    "@typescript-eslint/eslint-plugin": "^7.0.2",\n    "@typescript-eslint/parser": "^7.0.2",\n    "@vitejs/plugin-react": "^4.2.1",\n    "autoprefixer": "^10.4.17",\n    "eslint": "^8.56.0",\n    "eslint-plugin-react-hooks": "^4.6.0",\n    "eslint-plugin-react-refresh": "^0.4.5",\n    "postcss": "^8.4.35",\n    "tailwindcss": "^3.4.1",\n    "typescript": "^5.2.2",\n    "vite": "^5.1.4"\n  }\n}',
      path: 'package.json',
    },
    {
      type: 'file',
      content:
        '{\n  "compilerOptions": {\n    "target": "ES2020",\n    "useDefineForClassFields": true,\n    "lib": ["ES2020", "DOM", "DOM.Iterable"],\n    "module": "ESNext",\n    "skipLibCheck": true,\n\n    /* Bundler mode */\n    "moduleResolution": "bundler",\n    "allowImportingTsExtensions": true,\n    "resolveJsonModule": true,\n    "isolatedModules": true,\n    "noEmit": true,\n    "jsx": "react-jsx",\n\n    /* Linting */\n    "strict": true,\n    "noImplicitAny":false,\n   "noUnusedLocals": false,\n    "noUnusedParameters": false,\n    "noFallthroughCasesInSwitch": true,\n    "baseUrl": ".",\n    "paths": {\n      "@/*": ["./src/*"]\n    }\n  },\n  "include": ["src"],\n  "references": [{ "path": "./tsconfig.node.json" }]\n}',
      path: 'tsconfig.json',
    },
    {
      type: 'file',
      content:
        '{\n  "compilerOptions": {\n    "composite": true,\n    "skipLibCheck": true,\n    "module": "ESNext",\n    "moduleResolution": "bundler",\n    "allowSyntheticDefaultImports": true,\n    "types": ["node", "vite/client"]\n  },\n  "include": ["vite.config.ts"]\n}',
      path: 'tsconfig.node.json',
    },
    {
      type: 'file',
      content:
        "/// <reference types=\"vite/client\" />\n\nimport { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\nimport path from 'path'\n\n// https://vitejs.dev/config/\nexport default defineConfig({\n  plugins: [react()],\n  resolve: {\n    alias: {\n      '@': path.resolve(__dirname, './src'),\n    },\n  },\n  server: {\n    host: '0.0.0.0',\n  },\n})",
      path: 'vite.config.ts',
    },
    {
      type: 'file',
      content:
        'export default {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n}',
      path: 'postcss.config.js',
    },
    {
      type: 'file',
      content:
        '/** @type {import(\'tailwindcss\').Config} */\nexport default {\n  darkMode: ["class"],\n  content: [\n    \'./pages/**/*.{ts,tsx}\',\n    \'./components/**/*.{ts,tsx}\',\n    \'./app/**/*.{ts,tsx}\',\n    \'./src/**/*.{ts,tsx}\',\n  ],\n  prefix: "",\n  theme: {\n    container: {\n      center: true,\n      padding: "2rem",\n      screens: {\n        "2xl": "1400px",\n      },\n    },\n    extend: {\n      colors: {\n        border: "hsl(var(--border))",\n        input: "hsl(var(--input))",\n        ring: "hsl(var(--ring))",\n        background: "hsl(var(--background))",\n        foreground: "hsl(var(--foreground))",\n        primary: {\n          DEFAULT: "hsl(var(--primary))",\n          foreground: "hsl(var(--primary-foreground))",\n        },\n        secondary: {\n          DEFAULT: "hsl(var(--secondary))",\n          foreground: "hsl(var(--secondary-foreground))",\n        },\n        destructive: {\n          DEFAULT: "hsl(var(--destructive))",\n          foreground: "hsl(var(--destructive-foreground))",\n        },\n        muted: {\n          DEFAULT: "hsl(var(--muted))",\n          foreground: "hsl(var(--muted-foreground))",\n        },\n        accent: {\n          DEFAULT: "hsl(var(--accent))",\n          foreground: "hsl(var(--accent-foreground))",\n        },\n        popover: {\n          DEFAULT: "hsl(var(--popover))",\n          foreground: "hsl(var(--popover-foreground))",\n        },\n        card: {\n          DEFAULT: "hsl(var(--card))",\n          foreground: "hsl(var(--card-foreground))",\n        },\n      },\n      borderRadius: {\n        lg: "var(--radius)",\n        md: "calc(var(--radius) - 2px)",\n        sm: "calc(var(--radius) - 4px)",\n      },\n      keyframes: {\n        "accordion-down": {\n          from: { height: "0" },\n          to: { height: "var(--radix-accordion-content-height)" },\n        },\n        "accordion-up": {\n          from: { height: "var(--radix-accordion-content-height)" },\n          to: { height: "0" },\n        },\n      },\n      animation: {\n        "accordion-down": "accordion-down 0.2s ease-out",\n        "accordion-up": "accordion-up 0.2s ease-out",\n      },\n    },\n  },\n  plugins: [require("tailwindcss-animate")],\n}',
      path: 'tailwind.config.js',
    },
    {
      type: 'file',
      content:
        '/// <reference types="vite/client" />\n\ninterface ImportMetaEnv {\n  readonly VITE_SUPABASE_URL: string; \n  readonly VITE_SUPABASE_ANON_KEY: string; \n  // Add any other environment variables you\'re using\n}\n\ninterface ImportMeta {\n  readonly env: ImportMetaEnv;\n}',
      path: 'src/vite-env.d.ts',
    },
  ],
};

export async function processCodeForDeployment(
  codebaseManager: CodebaseManager
): Promise<string> {
  const codebaseMap = codebaseManager.getCodebaseMap();
  let generateContent = JSON.stringify({ files: Object.values(codebaseMap) });

  try {
    const codeObj = JSON.parse(generateContent);
    const processedCodeObj = await prepareFinalReactCodeJson(codeObj);
    generateContent = JSON.stringify(processedCodeObj);

    // Update the codebase manager with the processed code
    codebaseManager.updateCodebase(generateContent);
  } catch (error) {
    console.error('Error processing code:', error);
    // Continue with unprocessed code if processing fails
  }

  return generateContent;
}
