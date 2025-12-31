import { jest } from '@jest/globals';
import { CodebaseManager, initializeCodebaseManager } from '../codebaseManager';
import { ListFilesTool, createListFilesTool } from '../listFilesTool';
import {
  GetFilesContentTool,
  createGetFilesContentTool,
} from '../getFilesContentTool';
import {
  FindMatchingFilesTool,
  createFindMatchingFilesTool,
} from '../findMatchingFilesTool';
import { WriteFileTool, createWriteFileTool } from '../writeFilesTool';

// Sample codebase for testing
const sampleCodebase = {
  files: [
    {
      path: 'src/App.tsx',
      content:
        'export default function App() { return <div>Hello World</div>; }',
      type: 'tsx',
    },
    {
      path: 'src/components/Button.tsx',
      content: 'export function Button() { return <button>Click me</button>; }',
      type: 'tsx',
    },
    {
      path: 'src/auth/Login.tsx',
      content:
        'export function Login() { const handleLogin = () => console.log("login"); return <form onSubmit={handleLogin}>Login Form</form>; }',
      type: 'tsx',
    },
    {
      path: 'src/auth/Auth.ts',
      content:
        'export const isAuthenticated = () => true; export const handleLogin = (username, password) => { /* login logic */ };',
      type: 'ts',
    },
    {
      path: 'README.md',
      content: '# Sample Project\nThis is a sample project for testing.',
      type: 'md',
    },
    {
      path: 'package.json',
      content: '{"name":"sample-project","version":"1.0.0"}',
      type: 'json',
    },
  ],
};

describe('CodebaseManager', () => {
  let manager: CodebaseManager;

  beforeEach(() => {
    // Reset the singleton instance before each test
    // @ts-ignore - accessing private static member for testing
    CodebaseManager.instance = undefined;
    manager = CodebaseManager.getInstance();
  });

  test('getInstance should return the singleton instance', () => {
    const instance1 = CodebaseManager.getInstance();
    const instance2 = CodebaseManager.getInstance();
    expect(instance1).toBe(instance2);
  });

  test('updateCodebase should update the codebase map', () => {
    const result = manager.updateCodebase(JSON.stringify(sampleCodebase));
    expect(result).toBe(true);

    // Verify files were added correctly
    const files = manager.getAvailableFiles();
    expect(files).toHaveLength(6);
    expect(files).toContain('src/App.tsx');
    expect(files).toContain('src/components/Button.tsx');
    expect(files).toContain('src/auth/Login.tsx');
    expect(files).toContain('src/auth/Auth.ts');
    expect(files).toContain('README.md');
    expect(files).toContain('package.json');
  });

  test('updateCodebase should handle invalid JSON', () => {
    const result = manager.updateCodebase('invalid json');
    expect(result).toBe(false);

    // Verify no files were added
    const files = manager.getAvailableFiles();
    expect(files).toHaveLength(0);
  });

  test('getFile should return the correct file', () => {
    manager.updateCodebase(JSON.stringify(sampleCodebase));

    const file = manager.getFile('src/App.tsx');
    expect(file).toEqual({
      path: 'src/App.tsx',
      content:
        'export default function App() { return <div>Hello World</div>; }',
      type: 'tsx',
    });
  });

  test('getFile should return null for non-existent files', () => {
    manager.updateCodebase(JSON.stringify(sampleCodebase));

    const file = manager.getFile('non-existent.tsx');
    expect(file).toBeNull();
  });

  test('getReadmeContent should return README content if available', () => {
    manager.updateCodebase(JSON.stringify(sampleCodebase));

    const readmeContent = manager.getReadmeContent();
    expect(readmeContent).toBe(
      '# Sample Project\nThis is a sample project for testing.'
    );
  });

  test('getReadmeContent should return empty string if README is not available', () => {
    // Create a codebase without README.md
    const noReadmeCodebase = {
      files: [
        {
          path: 'src/App.tsx',
          content:
            'export default function App() { return <div>Hello World</div>; }',
          type: 'tsx',
        },
      ],
    };

    manager.updateCodebase(JSON.stringify(noReadmeCodebase));

    const readmeContent = manager.getReadmeContent();
    expect(readmeContent).toBe('');
  });

  test('initializeCodebaseManager should initialize and return the manager', () => {
    const initializedManager = initializeCodebaseManager(
      JSON.stringify(sampleCodebase)
    );
    expect(initializedManager).toBe(manager);

    // Verify files were added correctly
    const files = initializedManager.getAvailableFiles();
    expect(files).toHaveLength(6);
  });

  test('manager.updateCodebase method should update the manager', () => {
    const result = manager.updateCodebase(JSON.stringify(sampleCodebase));
    expect(result).toBe(true);

    // Verify files were added correctly
    const files = manager.getAvailableFiles();
    expect(files).toHaveLength(6);
  });
});

describe('ListFilesTool', () => {
  let listFilesTool: ListFilesTool;

  beforeEach(() => {
    // Reset the CodebaseManager singleton instance
    // @ts-ignore - accessing private static member for testing
    CodebaseManager.instance = undefined;

    // Initialize with sample data
    initializeCodebaseManager(JSON.stringify(sampleCodebase));

    // Create the tool
    listFilesTool = createListFilesTool();
  });

  test('should list all files when no directory is provided', async () => {
    const result = await listFilesTool.invoke({ directory: undefined });
    const parsedResult = JSON.parse(result);

    expect(parsedResult.files).toHaveLength(6);
    expect(parsedResult.files).toContain('src/App.tsx');
    expect(parsedResult.files).toContain('src/components/Button.tsx');
    expect(parsedResult.files).toContain('src/auth/Login.tsx');
    expect(parsedResult.files).toContain('src/auth/Auth.ts');
    expect(parsedResult.files).toContain('README.md');
    expect(parsedResult.files).toContain('package.json');
  });

  test('should list all files when directory is "."', async () => {
    const result = await listFilesTool.invoke({ directory: '.' });
    const parsedResult = JSON.parse(result);

    expect(parsedResult.files).toHaveLength(6);
  });

  test('should filter files by directory', async () => {
    const result = await listFilesTool.invoke({ directory: 'src' });
    const parsedResult = JSON.parse(result);

    expect(parsedResult.files).toHaveLength(4);
    expect(parsedResult.files).toContain('src/App.tsx');
    expect(parsedResult.files).toContain('src/components/Button.tsx');
    expect(parsedResult.files).toContain('src/auth/Login.tsx');
    expect(parsedResult.files).toContain('src/auth/Auth.ts');
  });

  test('should filter files by subdirectory', async () => {
    const result = await listFilesTool.invoke({ directory: 'src/components' });
    const parsedResult = JSON.parse(result);

    expect(parsedResult.files).toHaveLength(1);
    expect(parsedResult.files).toContain('src/components/Button.tsx');
  });

  test('should return empty array for non-existent directory', async () => {
    const result = await listFilesTool.invoke({ directory: 'non-existent' });
    const parsedResult = JSON.parse(result);

    expect(parsedResult.files).toHaveLength(0);
  });

  test('should handle directory paths with or without trailing slash', async () => {
    const resultWithSlash = await listFilesTool.invoke({ directory: 'src/' });
    const resultWithoutSlash = await listFilesTool.invoke({ directory: 'src' });

    expect(JSON.parse(resultWithSlash).files).toEqual(
      JSON.parse(resultWithoutSlash).files
    );
  });
});

describe('GetFilesContentTool', () => {
  let getFilesContentTool: GetFilesContentTool;

  beforeEach(() => {
    // Reset the CodebaseManager singleton instance
    // @ts-ignore - accessing private static member for testing
    CodebaseManager.instance = undefined;

    // Initialize with sample data
    initializeCodebaseManager(JSON.stringify(sampleCodebase));

    // Create the tool
    getFilesContentTool = createGetFilesContentTool();
  });

  test('should return content of requested files', async () => {
    const result = await getFilesContentTool.invoke({
      filePaths: ['src/App.tsx', 'README.md'],
    });
    const parsedResult = JSON.parse(result);

    expect(parsedResult).toHaveLength(2);

    // Check the first file
    expect(parsedResult[0].path).toBe('src/App.tsx');
    expect(parsedResult[0].content).toBe(
      'export default function App() { return <div>Hello World</div>; }'
    );
    expect(parsedResult[0].error).toBeNull();

    // Check the second file
    expect(parsedResult[1].path).toBe('README.md');
    expect(parsedResult[1].content).toBe(
      '# Sample Project\nThis is a sample project for testing.'
    );
    expect(parsedResult[1].error).toBeNull();
  });

  test('should handle non-existent files', async () => {
    const result = await getFilesContentTool.invoke({
      filePaths: ['src/App.tsx', 'non-existent.js'],
    });
    const parsedResult = JSON.parse(result);

    expect(parsedResult).toHaveLength(2);

    // Check the existing file
    expect(parsedResult[0].path).toBe('src/App.tsx');
    expect(parsedResult[0].content).toBe(
      'export default function App() { return <div>Hello World</div>; }'
    );
    expect(parsedResult[0].error).toBeNull();

    // Check the non-existent file
    expect(parsedResult[1].path).toBe('non-existent.js');
    expect(parsedResult[1].content).toBeNull();
    expect(parsedResult[1].error).toBe(
      'File not found in codebase: non-existent.js'
    );
  });

  test('should return empty array when no files are requested', async () => {
    const result = await getFilesContentTool.invoke({ filePaths: [] });
    const parsedResult = JSON.parse(result);

    expect(parsedResult).toHaveLength(0);
  });

  test('should handle errors gracefully', async () => {
    // Mock the getFile method to throw an error
    const manager = CodebaseManager.getInstance();
    const originalGetFile = manager.getFile;

    jest.spyOn(manager, 'getFile').mockImplementation(() => {
      throw new Error('Test error');
    });

    try {
      await expect(
        getFilesContentTool.invoke({
          filePaths: ['src/App.tsx'],
        })
      ).rejects.toThrow('Failed to read codebase files: Test error');
    } finally {
      // Restore the original method
      jest.spyOn(manager, 'getFile').mockImplementation(originalGetFile);
    }
  });
});

describe('FindMatchingFilesTool', () => {
  let findMatchingFilesTool: FindMatchingFilesTool;

  beforeEach(() => {
    // Reset the CodebaseManager singleton instance
    // @ts-ignore - accessing private static member for testing
    CodebaseManager.instance = undefined;

    // Initialize with sample data
    initializeCodebaseManager(JSON.stringify(sampleCodebase));

    // Create the tool
    findMatchingFilesTool = createFindMatchingFilesTool();
  });

  test('should find files containing the keyword (case insensitive by default)', async () => {
    const result = await findMatchingFilesTool.invoke({
      keyword: 'handlelogin',
    });
    const parsedResult = JSON.parse(result);

    expect(parsedResult.count).toBe(2);
    expect(parsedResult.matchingFiles).toContain('src/auth/Login.tsx');
    expect(parsedResult.matchingFiles).toContain('src/auth/Auth.ts');
    expect(parsedResult.caseSensitive).toBe(false);
  });

  test('should respect case sensitivity when specified', async () => {
    // Case-sensitive search should only find exact matches
    const result = await findMatchingFilesTool.invoke({
      keyword: 'handleLogin',
      caseSensitive: true,
    });
    const parsedResult = JSON.parse(result);

    // Only the Login.tsx file has handleLogin with exact casing
    expect(parsedResult.count).toBe(2);
    expect(parsedResult.matchingFiles).toContain('src/auth/Login.tsx');
    expect(parsedResult.matchingFiles).toContain('src/auth/Auth.ts');
    expect(parsedResult.caseSensitive).toBe(true);
  });

  test('should limit search to specific directory when specified', async () => {
    const result = await findMatchingFilesTool.invoke({
      keyword: 'return',
      directory: 'src/components',
    });
    const parsedResult = JSON.parse(result);

    expect(parsedResult.count).toBe(1);
    expect(parsedResult.matchingFiles).toContain('src/components/Button.tsx');
    expect(parsedResult.matchingFiles).not.toContain('src/App.tsx');
    expect(parsedResult.matchingFiles).not.toContain('src/auth/Login.tsx');
  });

  test('should return empty array when no matches found', async () => {
    const result = await findMatchingFilesTool.invoke({
      keyword: 'nonexistentKeyword',
    });
    const parsedResult = JSON.parse(result);

    expect(parsedResult.count).toBe(0);
    expect(parsedResult.matchingFiles).toEqual([]);
  });

  test('should handle errors gracefully', async () => {
    // Mock the getFile method to throw an error
    const manager = CodebaseManager.getInstance();
    const originalGetFile = manager.getFile;

    jest.spyOn(manager, 'getFile').mockImplementation(() => {
      throw new Error('Test error');
    });

    try {
      await expect(
        findMatchingFilesTool.invoke({
          keyword: 'test',
        })
      ).rejects.toThrow('Failed to find matching files: Test error');
    } finally {
      // Restore the original method
      jest.spyOn(manager, 'getFile').mockImplementation(originalGetFile);
    }
  });
});

describe('WriteFileTool', () => {
  let writeFileTool: WriteFileTool;

  beforeEach(() => {
    // Reset the CodebaseManager singleton instance
    // @ts-ignore - accessing private static member for testing
    CodebaseManager.instance = undefined;

    // Initialize with sample data
    initializeCodebaseManager(JSON.stringify(sampleCodebase));

    // Create the tool
    writeFileTool = createWriteFileTool();
  });

  test('should write new file content', async () => {
    const newContent =
      'export default function App() { return <div>Hello Universe</div>; }';
    const result = await writeFileTool.invoke({
      filePath: 'src/App.tsx',
      fileContent: newContent,
    });

    expect(result).toBe('Successfully updated file: src/App.tsx');

    // Verify the file was updated
    const manager = CodebaseManager.getInstance();
    const file = manager.getFile('src/App.tsx');
    expect(file?.content).toBe(newContent);
  });

  test('should create new file when file does not exist', async () => {
    const newContent =
      'export function NewComponent() { return <div>New</div>; }';
    const result = await writeFileTool.invoke({
      filePath: 'src/NewComponent.tsx',
      fileContent: newContent,
    });

    expect(result).toBe('Successfully created file: src/NewComponent.tsx');

    // Verify the file was created
    const manager = CodebaseManager.getInstance();
    const file = manager.getFile('src/NewComponent.tsx');
    expect(file).toBeTruthy();
    expect(file?.content).toBe(newContent);
    expect(file?.type).toBe('file'); // New files always get type 'file'
  });

  test('should error when file path is empty', async () => {
    await expect(
      writeFileTool.invoke({
        filePath: '',
        fileContent: 'Some content',
      })
    ).rejects.toThrow(
      'Failed to write file: {"tool":"write_file","filePath":"","error":"File path cannot be empty","suggestion":"Please provide a valid file path"}'
    );
  });

  test('should handle multiple files in codebase correctly', async () => {
    // Write to one file
    const appContent =
      'export default function App() { return <div>Hello Universe</div>; }';
    await writeFileTool.invoke({
      filePath: 'src/App.tsx',
      fileContent: appContent,
    });

    // Write to another file
    const buttonContent =
      'export function Button() { return <button>Press me</button>; }';
    await writeFileTool.invoke({
      filePath: 'src/components/Button.tsx',
      fileContent: buttonContent,
    });

    // Verify both files were updated correctly
    const manager = CodebaseManager.getInstance();
    const appFile = manager.getFile('src/App.tsx');
    const buttonFile = manager.getFile('src/components/Button.tsx');

    expect(appFile?.content).toBe(appContent);
    expect(buttonFile?.content).toBe(buttonContent);
  });

  test('should overwrite existing file content completely', async () => {
    const newContent = '// This is completely new content';
    await writeFileTool.invoke({
      filePath: 'src/App.tsx',
      fileContent: newContent,
    });

    const manager = CodebaseManager.getInstance();
    const file = manager.getFile('src/App.tsx');

    expect(file?.content).toBe(newContent);
  });

  test('should preserve file type when overwriting existing file', async () => {
    const newContent =
      'export default function App() { return <div>New Content</div>; }';
    await writeFileTool.invoke({
      filePath: 'src/App.tsx',
      fileContent: newContent,
    });

    const manager = CodebaseManager.getInstance();
    const file = manager.getFile('src/App.tsx');

    expect(file?.path).toBe('src/App.tsx');
    expect(file?.type).toBe('tsx'); // Original type should be preserved
  });
});
