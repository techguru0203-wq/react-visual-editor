/**
 * Dev Server Manager Service
 * Manages local development servers for visual edit mode
 * Creates temporary directories, installs dependencies, and runs dev servers
 * 
 * NOTE: When stopping a dev server, only the process is killed.
 * Temp directories are preserved so you can resume or inspect the generated code.
 * Manual cleanup functions are available if needed (see cleanupPendingDirectories).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn, ChildProcess, exec } from 'child_process';
import { ProjectFile } from '../../shared/types/supabaseTypes';
import { injectVisualEditSupport } from './visualEditInjector';

interface DevServerInfo {
  docId: string;
  process: ChildProcess;
  port: number;
  url: string;
  tempDir: string;
  startTime: Date;
}

// Map of documentId -> DevServerInfo
const runningServers = new Map<string, DevServerInfo>();

// Track temp directories to cleanup later (avoids Windows EBUSY errors)
const pendingCleanupDirs = new Set<string>();

// Map of documentId -> port (for persistent port allocation)
const docIdToPort = new Map<string, number>();

// Port range for dev servers
const MIN_PORT = 5173;
const MAX_PORT = 6000;

// Cleanup interval (runs every 5 minutes)
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Kill a process and all its children (process tree)
 * On Windows, uses taskkill to ensure child processes are terminated
 */
function killProcessTree(process: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (!process.pid) {
      resolve();
      return;
    }

    const pid = process.pid;
    const isWindows = os.platform() === 'win32';

    if (isWindows) {
      // On Windows, use taskkill to kill the entire process tree
      exec(`taskkill /pid ${pid} /T /F`, (error) => {
        if (error) {
          console.log(`[DevServer] taskkill error (process may have already exited):`, error.message);
        }
        // Wait for child processes to fully terminate and release resources
        // This gives time for the process tree to clean up and release ports
        setTimeout(() => {
          resolve();
        }, 2000); // 2 second should be enough for most cases
      });
    } else {
      // On Unix-like systems, kill the process group
      try {
        process.kill('SIGTERM');
        setTimeout(() => {
          if (!process.killed) {
            process.kill('SIGKILL');
          }
          // Additional wait for child processes to clean up
          setTimeout(() => {
            resolve();
          }, 500);
        }, 2000);
      } catch (error) {
        console.log(`[DevServer] Kill error:`, error);
        resolve();
      }
    }
  });
}

/**
 * Find an available port, preferring previously assigned port for this docId.
 * This ensures the same document always gets the same port when restarted.
 */
function findAvailablePort(docId: string): number {
  // Get currently used ports by OTHER documents
  const usedPorts = Array.from(runningServers.values())
    .filter(info => info.docId !== docId)  // Exclude current docId
    .map(s => s.port);
  
  // Try to reuse the same port this docId had before
  const previousPort = docIdToPort.get(docId);
  if (previousPort !== undefined && !usedPorts.includes(previousPort)) {
    console.log(`[DevServer] Reusing port ${previousPort} for docId ${docId}`);
    return previousPort;
  }
  
  // Find the lowest available port starting from MIN_PORT
  for (let port = MIN_PORT; port < MAX_PORT; port++) {
    if (!usedPorts.includes(port)) {
      docIdToPort.set(docId, port);  // Remember for next time
      console.log(`[DevServer] Assigned new port ${port} to docId ${docId}`);
      return port;
    }
  }
  
  throw new Error(`No available ports in range ${MIN_PORT}-${MAX_PORT}`);
}

/**
 * Write project files to a temporary directory
 */
function writeProjectFiles(tempDir: string, files: ProjectFile[]): void {
  // Create directory structure
  for (const file of files) {
    const filePath = path.join(tempDir, file.path);
    const dirPath = path.dirname(filePath);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    // Write file
    fs.writeFileSync(filePath, file.content, 'utf8');
  }
}

/**
 * Check if project uses Vite
 */
function isViteProject(files: ProjectFile[]): boolean {
  return files.some(f => 
    f.path === 'vite.config.ts' || 
    f.path === 'vite.config.js' ||
    f.path === 'package.json' && f.content.includes('vite')
  );
}

/**
 * Get persistent temp directory path for a docId (without timestamp)
 */
function getPersistentTempDir(docId: string): string {
  return path.join(os.tmpdir(), `willy-dev-server-${docId}`);
}

/**
 * Check if project already exists for this docId
 */
function projectExists(docId: string): boolean {
  const tempDir = getPersistentTempDir(docId);
  return fs.existsSync(tempDir) && fs.existsSync(path.join(tempDir, 'node_modules'));
}


function normalizeDevServerHostPrefix(hostPrefix: string, port: number): string {
  if (hostPrefix.includes('localhost')) {
    return hostPrefix;
  }

  const iframeDomain = process.env.IFRAME_SERVE_DOMAIN;

  const ipPattern = /^https?:\/\/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::(\d+))?/;
  const match = hostPrefix.match(ipPattern);
  if (match) {
    const urlPort = match[2] || port;
    return `https://${urlPort}.${iframeDomain}`;
  }

  try {
    const url = new URL(hostPrefix);
    const ipv4Pattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    if (ipv4Pattern.test(url.hostname)) {
      const urlPort = url.port || port;
      return `https://${urlPort}.${iframeDomain}`;
    }
  } catch {
  }
  return hostPrefix;
}

/**
 * Start a dev server for a document
 */
export async function startDevServer(
  docId: string,
  files: ProjectFile[]
): Promise<{ success: boolean; url?: string; error?: string }> {
  // Check if server is already running
  if (runningServers.has(docId)) {
    const existing = runningServers.get(docId)!;
    return {
      success: true,
      url: existing.url,
    };
  }

  try {
    const port = findAvailablePort(docId);
    
    const rawHostPrefix = process.env.DEV_SERVER_HOST_PREFIX || 'http://localhost';
    const devServerHostPrefix = normalizeDevServerHostPrefix(rawHostPrefix, port);
    

    let url: string;
    if (devServerHostPrefix.startsWith('https')) {
      try {
        const urlObj = new URL(devServerHostPrefix);
        urlObj.port = ''; 
        url = urlObj.toString().replace(/\/$/, ''); 
      } catch {
        url = devServerHostPrefix.replace(/:\d+(\/|$)/, '$1').replace(/\/$/, '');
      }
    } else if (devServerHostPrefix.includes('localhost')) {
      url = `${devServerHostPrefix}:${port}`;
    } else {
      url = `${devServerHostPrefix}:${port}`;
    }

    const filesWithVisualEdit = injectVisualEditSupport(files, devServerHostPrefix, port);

    const tempDir = getPersistentTempDir(docId);
    const isFirstTime = !projectExists(docId);

    if (isFirstTime) {
      console.log(`[DevServer] First time setup for docId ${docId}, creating project...`);
      // Create directory
      fs.mkdirSync(tempDir, { recursive: true });
    } else {
      console.log(`[DevServer] Project already exists for docId ${docId}, reusing...`);
    }

    // Always update project files to ensure latest code
    writeProjectFiles(tempDir, filesWithVisualEdit);

    const baseEnv: Record<string, string> = {};
    
    // Copy existing env vars if process.env is available
    if (typeof process !== 'undefined' && process.env) {
      try {
        Object.assign(baseEnv, process.env);
      } catch (error) {
        console.warn('[DevServer] Failed to copy process.env, using minimal env:', error);
      }
    }
    
    // Set required environment variables
    const spawnEnv: Record<string, string> = {
      ...baseEnv,
      PORT: String(port),
      NODE_ENV: 'development',
      PATH: baseEnv.PATH || (typeof process !== 'undefined' && process.env?.PATH) || '',
    };

    // Install dependencies only if it's the first time
    if (isFirstTime) {
      console.log(`[DevServer] Installing dependencies for docId ${docId}...`);
      const installProcess = spawn('npm', ['install', '--legacy-peer-deps'], {
        cwd: tempDir,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: spawnEnv,
      });

      // Capture stderr for debugging
      let installError = '';
      installProcess.stderr?.on('data', (data) => {
        installError += data.toString();
      });

      // Wait for npm install to complete
      await new Promise<void>((resolve, reject) => {
        installProcess.on('exit', (code) => {
          if (code === 0) {
            console.log(`[DevServer] Dependencies installed for docId ${docId}`);
            resolve();
          } else {
            console.error(`[DevServer] npm install failed with code ${code}:`, installError);
            reject(new Error(`npm install failed with code ${code}: ${installError.substring(0, 200)}`));
          }
        });
        
        installProcess.on('error', (error) => {
          console.error(`[DevServer] npm install process error:`, error);
          reject(error);
        });
      });
    } else {
      console.log(`[DevServer] Skipping dependency installation (project already exists)`);
    }

    // Check if it's a Vite project
    const isVite = isViteProject(filesWithVisualEdit);

    // Start dev server
    let devServerProcess: ChildProcess;

    if (isVite) {
      // For Vite projects, run: npm run dev -- --port <port> --host
      devServerProcess = spawn('npm', ['run', 'dev', '--', '--port', String(port), '--host'], {
        cwd: tempDir,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: spawnEnv,
      });
    } else {
      // For other projects, try npm start or npm run dev
      // Check package.json for scripts
      const packageJsonFile = filesWithVisualEdit.find(f => f.path === 'package.json');
      let startCommand = 'dev';
      
      if (packageJsonFile) {
        try {
          const pkg = JSON.parse(packageJsonFile.content);
          if (pkg.scripts?.start) {
            startCommand = 'start';
          } else if (pkg.scripts?.dev) {
            startCommand = 'dev';
          }
        } catch {
          // Use default
        }
      }

      devServerProcess = spawn('npm', ['run', startCommand], {
        cwd: tempDir,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: spawnEnv,
      });
    }

    // Store server info
    const serverInfo: DevServerInfo = {
      docId,
      process: devServerProcess,
      port,
      url,
      tempDir,
      startTime: new Date(),
    };

    runningServers.set(docId, serverInfo);

    // Capture stdout and stderr for debugging
    let processOutput = '';
    let processError = '';
    devServerProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      processOutput += output;
      // Log HMR WebSocket connection status
      if (output.includes('WebSocket') || output.includes('HMR') || output.includes('ws://') || output.includes('wss://')) {
        console.log(`[DevServer] HMR WebSocket info for docId ${docId}:`, output.substring(0, 300));
      } else {
        console.log(`[DevServer] stdout for docId ${docId}:`, output.substring(0, 200));
      }
    });
    devServerProcess.stderr?.on('data', (data) => {
      const error = data.toString();
      processError += error;
      // Log WebSocket/HMR errors specifically
      if (error.includes('WebSocket') || error.includes('HMR') || error.includes('ws://') || error.includes('wss://') || error.includes('ECONNREFUSED')) {
        console.error(`[DevServer] HMR WebSocket error for docId ${docId}:`, error.substring(0, 300));
      } else {
        console.error(`[DevServer] stderr for docId ${docId}:`, error.substring(0, 200));
      }
    });

    // Handle process exit
    devServerProcess.on('exit', (code) => {
      console.log(`[DevServer] Process exited for docId ${docId} with code ${code}`);
      if (code !== 0 && code !== null) {
        console.error(`[DevServer] Process error output:`, processError);
      }
      // Keep temp directory for future use - only remove from running servers
      runningServers.delete(docId);
    });

    devServerProcess.on('error', (error) => {
      console.error(`[DevServer] Process error for docId ${docId}:`, error);
      console.error(`[DevServer] Process error output:`, processError);
      // Keep temp directory for future use - only remove from running servers
      runningServers.delete(docId);
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Check if process is still running
    if (devServerProcess.killed || devServerProcess.exitCode !== null) {
      return {
        success: false,
        error: 'Dev server failed to start',
      };
    }

    return {
      success: true,
      url,
    };
  } catch (error) {
    console.error(`[DevServer] Error starting server for docId ${docId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function stopDevServer(docId: string): Promise<{ success: boolean; error?: string }> {
  const serverInfo = runningServers.get(docId);
  
  if (!serverInfo) {
    return {
      success: false,
      error: 'Dev server not running',
    };
  }

  try {
    // Kill the process tree (including all child processes)
    if (!serverInfo.process.killed) {
      console.log(`[DevServer] Stopping dev server for docId ${docId} (PID: ${serverInfo.process.pid})`);
      await killProcessTree(serverInfo.process);
      
      // Additional wait to ensure port is fully released
      // This helps with TIME_WAIT states and ensures child processes have fully exited
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log(`[DevServer] Successfully stopped dev server for docId ${docId}`);
    }

    return { success: true };
  } catch (error) {
    console.error(`[DevServer] Error stopping server for docId ${docId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export function getDevServerStatus(docId: string): {
  running: boolean;
  url?: string;
  port?: number;
} {
  const serverInfo = runningServers.get(docId);
  
  if (!serverInfo || serverInfo.process.killed || serverInfo.process.exitCode !== null) {
    return { running: false };
  }

  return {
    running: true,
    url: serverInfo.url,
    port: serverInfo.port,
  };
}

/**
 * Mark a dev server directory for cleanup instead of deleting immediately.
 * This avoids Windows EBUSY errors by deferring deletion until files are not in use.
 */
function markForCleanup(docId: string): void {
  const serverInfo = runningServers.get(docId);
  
  if (!serverInfo) {
    return;
  }

  // Add to pending cleanup
  pendingCleanupDirs.add(serverInfo.tempDir);
  console.log(`[DevServer] Marked temp directory for cleanup: ${serverInfo.tempDir}`);
  
  // Remove from running servers
  runningServers.delete(docId);
}

/**
 * Attempt to cleanup pending directories. Silently fails if files are still locked.
 * This is called periodically and on server startup.
 */
function cleanupPendingDirectories(): void {
  const toRemove: string[] = [];
  
  for (const tempDir of pendingCleanupDirs) {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 0 });
        console.log(`[DevServer] Successfully cleaned up: ${tempDir}`);
        toRemove.push(tempDir);
      } else {
        toRemove.push(tempDir);
      }
    } catch (error) {
      // Silently ignore - will retry later
      // Only log in development for debugging
      if (process.env.NODE_ENV === 'development') {
        console.debug(`[DevServer] Cleanup deferred (file in use): ${path.basename(tempDir)}`);
      }
    }
  }
  
  // Remove successfully cleaned directories
  toRemove.forEach(dir => pendingCleanupDirs.delete(dir));
}

/**
 * Cleanup all old willy dev server temp directories on startup.
 * This handles leftover directories from previous runs.
 * Now with persistent directories, only cleanup timestamped directories (old format)
 * and very old persistent directories (7+ days old)
 */
export function initializeDevServerCleanup(): void {
  const tmpDir = os.tmpdir();
  const prefix = 'willy-dev-server-';
  
  try {
    const entries = fs.readdirSync(tmpDir);
    let cleanedCount = 0;
    
    for (const entry of entries) {
      if (entry.startsWith(prefix)) {
        const fullPath = path.join(tmpDir, entry);
        try {
          const stats = fs.statSync(fullPath);
          const ageInHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
          
          // Check if it's an old timestamped directory (has timestamp in name)
          const hasTimestamp = /willy-dev-server-.+-\d+$/.test(entry);
          
          if (hasTimestamp && ageInHours > 1) {
            // Cleanup old timestamped directories (old format) after 1 hour
            fs.rmSync(fullPath, { recursive: true, force: true, maxRetries: 0 });
            cleanedCount++;
          } else if (!hasTimestamp && ageInHours > 168) {
            // Cleanup persistent directories only if older than 7 days
            fs.rmSync(fullPath, { recursive: true, force: true, maxRetries: 0 });
            cleanedCount++;
          }
        } catch (error) {
          // If we can't delete it, add to pending cleanup
          pendingCleanupDirs.add(fullPath);
        }
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[DevServer] Cleaned up ${cleanedCount} old temp directories on startup`);
    }
  } catch (error) {
    console.warn('[DevServer] Failed to cleanup old temp directories:', error);
  }
  
  // Start periodic cleanup (every 5 minutes)
  if (!cleanupInterval) {
    cleanupInterval = setInterval(() => {
      cleanupPendingDirectories();
    }, 5 * 60 * 1000);
    
    // Don't prevent server from shutting down
    cleanupInterval.unref();
  }
}

export function updateDevServerFiles(docId: string, files: ProjectFile[]): {
  success: boolean;
  error?: string;
} {
  const serverInfo = runningServers.get(docId);
  
  if (!serverInfo || serverInfo.process.killed) {
    return {
      success: false,
      error: 'Dev server not running',
    };
  }

  try {
    const rawHostPrefix = process.env.DEV_SERVER_HOST_PREFIX || 'http://localhost';
    const devServerHostPrefix = normalizeDevServerHostPrefix(rawHostPrefix, serverInfo.port);
    
    // Inject visual edit support with dev server host prefix and dev server port
    const filesWithVisualEdit = injectVisualEditSupport(files, devServerHostPrefix, serverInfo.port);
    
    writeProjectFiles(serverInfo.tempDir, filesWithVisualEdit);
    
    return { success: true };
  } catch (error) {
    console.error(`[DevServer] Error updating files for docId ${docId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function cleanupAllDevServers(): Promise<void> {
  const docIds = Array.from(runningServers.keys());
  const promises = docIds.map(docId => stopDevServer(docId));
  await Promise.all(promises);
}

/**
 * Manually delete the persistent project directory for a specific docId
 * Useful for forcing a fresh installation or cleanup
 */
export async function deleteProject(docId: string): Promise<{ success: boolean; error?: string }> {
  const serverInfo = runningServers.get(docId);
  
  // Stop the server first if it's running
  if (serverInfo) {
    await stopDevServer(docId);
  }

  const tempDir = getPersistentTempDir(docId);
  
  if (!fs.existsSync(tempDir)) {
    return {
      success: false,
      error: 'Project directory does not exist',
    };
  }

  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log(`[DevServer] Deleted project directory for docId ${docId}`);
    return { success: true };
  } catch (error) {
    console.error(`[DevServer] Error deleting project for docId ${docId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

