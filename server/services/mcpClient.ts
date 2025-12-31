/**
 * MCP (Model Context Protocol) Client
 * Supports both HTTP and STDIO transports
 */

import { spawn, ChildProcess } from 'child_process';
import axios, { AxiosInstance } from 'axios';
import {
  McpConnectorConfig,
  McpTool,
  McpTransportType,
} from '../../shared/types/connectorTypes';

export interface McpClientConfig {
  transportType: McpTransportType;
  // For HTTP transport
  serverUrl?: string;
  customHeaders?: Record<string, string>;
  // For STDIO transport
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

export class McpClient {
  private config: McpClientConfig;
  private httpClient?: AxiosInstance;
  private stdioProcess?: ChildProcess;
  private connected: boolean = false;
  private messageId: number = 0;
  private pendingRequests: Map<
    number,
    { resolve: (value: any) => void; reject: (error: any) => void }
  > = new Map();

  constructor(config: McpClientConfig) {
    this.config = config;
  }

  /**
   * Connect to MCP server
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      if (this.config.transportType === 'http') {
        await this.connectHTTP();
      } else {
        await this.connectSTDIO();
      }
      this.connected = true;
      console.log(
        `[McpClient] Connected to MCP server (${this.config.transportType})`
      );
    } catch (error) {
      console.error('[McpClient] Failed to connect:', error);
      throw new Error(
        `Failed to connect to MCP server: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Connect via HTTP transport
   */
  private async connectHTTP(): Promise<void> {
    if (!this.config.serverUrl) {
      throw new Error('Server URL is required for HTTP transport');
    }

    // MCP HTTP transport uses a single endpoint for all JSON-RPC requests
    this.httpClient = axios.create({
      baseURL: this.config.serverUrl,
      headers: {
        'Content-Type': 'application/json',
        ...this.config.customHeaders,
      },
      timeout: 30000,
    });

    // Test connection with initialize request (POST to the base URL, not /initialize)
    try {
      const response = await this.httpClient.post('', {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '1.0',
          clientInfo: {
            name: 'omniflow-mcp-client',
            version: '1.0.0',
          },
        },
        id: this.getNextMessageId(),
      });

      console.log(
        '[McpClient] Received response:',
        JSON.stringify(response.data, null, 2)
      );

      // Parse response data (handle both direct JSON-RPC and SSE format)
      let jsonRpcResponse = response.data;

      // Check if response is SSE format (string starting with "event:" or "data:")
      if (typeof response.data === 'string') {
        jsonRpcResponse = this.parseSSEResponse(response.data);
      }

      // Check if response is valid JSON-RPC
      if (!jsonRpcResponse) {
        throw new Error('Server returned empty response');
      }

      if (jsonRpcResponse.jsonrpc !== '2.0') {
        throw new Error(
          `Server returned invalid JSON-RPC version: ${
            jsonRpcResponse.jsonrpc || 'missing'
          }. Expected "2.0". Response: ${JSON.stringify(jsonRpcResponse)}`
        );
      }

      // Check for JSON-RPC error response
      if (jsonRpcResponse.error) {
        throw new Error(
          `MCP server returned error: ${
            jsonRpcResponse.error.message ||
            JSON.stringify(jsonRpcResponse.error)
          }`
        );
      }

      // Successful connection
      console.log('[McpClient] MCP server initialized successfully');
    } catch (error: any) {
      // If error.response exists, it's an HTTP error
      if (error.response) {
        const status = error.response.status;
        console.error('[McpClient] HTTP error response:', {
          status,
          data: error.response.data,
          headers: error.response.headers,
        });

        if (status === 404) {
          throw new Error(
            `HTTP connection failed: The endpoint ${this.config.serverUrl} does not exist (404). Please verify this is a valid MCP server URL.`
          );
        } else if (status === 401 || status === 403) {
          throw new Error(
            `HTTP connection failed: Authentication required (status ${status}). Please check your credentials or API keys in custom headers.`
          );
        } else if (status >= 500) {
          throw new Error(
            `HTTP connection failed: Server error (status ${status}). The MCP server may be down or misconfigured.`
          );
        } else {
          throw new Error(
            `HTTP connection failed: Received status ${status} from ${
              this.config.serverUrl
            }. Response: ${JSON.stringify(error.response.data)}`
          );
        }
      }
      // If it's a network error
      else if (error.code === 'ECONNREFUSED') {
        throw new Error(
          `HTTP connection failed: Connection refused. The server at ${this.config.serverUrl} is not reachable.`
        );
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        throw new Error(
          `HTTP connection failed: Connection timeout. The server at ${this.config.serverUrl} did not respond in time.`
        );
      }
      // If it's our custom validation error, re-throw as is
      else if (error.message && !error.code) {
        throw error;
      }
      // Unknown error
      else {
        throw new Error(`HTTP connection failed: ${error.message}`);
      }
    }
  }

  /**
   * Connect via STDIO transport
   */
  private async connectSTDIO(): Promise<void> {
    if (!this.config.command) {
      throw new Error('Command is required for STDIO transport');
    }

    return new Promise((resolve, reject) => {
      let isResolved = false;
      
      // Set timeout for connection
      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          if (this.stdioProcess) {
            this.stdioProcess.kill('SIGTERM');
            this.stdioProcess = undefined;
          }
          reject(new Error('STDIO connection timeout after 30 seconds'));
        }
      }, 30000);

      const cleanup = () => {
        clearTimeout(timeout);
      };

      try {
        this.stdioProcess = spawn(
          this.config.command!,
          this.config.args || [],
          {
            env: { ...process.env, ...this.config.env },
            stdio: ['pipe', 'pipe', 'pipe'],
          }
        );

        // Handle stdout messages
        let buffer = '';
        this.stdioProcess.stdout?.on('data', (data) => {
          buffer += data.toString();

          // Process complete JSON-RPC messages
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.trim()) {
              try {
                const message = JSON.parse(line);
                this.handleStdioMessage(message);
              } catch (error) {
                console.error(
                  '[McpClient] Failed to parse STDIO message:',
                  error
                );
              }
            }
          }
        });

        // Handle stderr
        this.stdioProcess.stderr?.on('data', (data) => {
          console.error('[McpClient] STDIO stderr:', data.toString());
        });

        // Handle process errors
        this.stdioProcess.on('error', (error) => {
          console.error('[McpClient] STDIO process error:', error);
          if (!isResolved) {
            isResolved = true;
            cleanup();
            if (this.stdioProcess) {
              this.stdioProcess.kill('SIGTERM');
              this.stdioProcess = undefined;
            }
            reject(error);
          }
        });

        // Handle process exit
        this.stdioProcess.on('close', (code) => {
          console.log(`[McpClient] STDIO process exited with code ${code}`);
          this.connected = false;
          if (!isResolved && code !== 0) {
            isResolved = true;
            cleanup();
            reject(new Error(`STDIO process exited with code ${code}`));
          }
        });

        // Send initialize message
        this.sendStdioMessage({
          jsonrpc: '2.0',
          method: 'initialize',
          params: {
            protocolVersion: '1.0',
            clientInfo: {
              name: 'omniflow-mcp-client',
              version: '1.0.0',
            },
          },
          id: this.getNextMessageId(),
        })
          .then(() => {
            if (!isResolved) {
              isResolved = true;
              cleanup();
              resolve();
            }
          })
          .catch((error) => {
            if (!isResolved) {
              isResolved = true;
              cleanup();
              if (this.stdioProcess) {
                this.stdioProcess.kill('SIGTERM');
                this.stdioProcess = undefined;
              }
              reject(error);
            }
          });
      } catch (error) {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          if (this.stdioProcess) {
            this.stdioProcess.kill('SIGTERM');
            this.stdioProcess = undefined;
          }
          reject(error);
        }
      }
    });
  }

  /**
   * Handle STDIO response message
   */
  private handleStdioMessage(message: any): void {
    if (message.id !== undefined) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        if (message.error) {
          pending.reject(
            new Error(message.error.message || 'MCP request failed')
          );
        } else {
          pending.resolve(message.result);
        }
      }
    }
  }

  /**
   * Send message via STDIO
   */
  private sendStdioMessage(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.stdioProcess || !this.stdioProcess.stdin) {
        reject(new Error('STDIO process not available'));
        return;
      }

      const id = message.id;
      this.pendingRequests.set(id, { resolve, reject });

      const jsonMessage = JSON.stringify(message) + '\n';
      this.stdioProcess.stdin.write(jsonMessage, (error) => {
        if (error) {
          this.pendingRequests.delete(id);
          reject(error);
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  /**
   * List available tools from MCP server
   */
  async listTools(): Promise<McpTool[]> {
    if (!this.connected) {
      throw new Error('Not connected to MCP server');
    }

    try {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: this.getNextMessageId(),
      };

      let response: any;

      if (this.config.transportType === 'http') {
        // MCP HTTP uses single endpoint - POST to base URL
        const result = await this.httpClient!.post('', request);
        // Handle SSE format if response is a string
        response =
          typeof result.data === 'string'
            ? this.parseSSEResponse(result.data)
            : result.data;
      } else {
        response = await this.sendStdioMessage(request);
      }

      if (response.error) {
        throw new Error(response.error.message || 'Failed to list tools');
      }

      return response.result?.tools || [];
    } catch (error) {
      console.error('[McpClient] Failed to list tools:', error);
      throw error;
    }
  }

  /**
   * Invoke a tool on the MCP server
   */
  async invokeTool(toolName: string, args: Record<string, any>): Promise<any> {
    if (!this.connected) {
      throw new Error('Not connected to MCP server');
    }

    try {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args,
        },
        id: this.getNextMessageId(),
      };

      let response: any;

      if (this.config.transportType === 'http') {
        // MCP HTTP uses single endpoint - POST to base URL
        const result = await this.httpClient!.post('', request);
        // Handle SSE format if response is a string
        response =
          typeof result.data === 'string'
            ? this.parseSSEResponse(result.data)
            : result.data;
      } else {
        response = await this.sendStdioMessage(request);
      }

      if (response.error) {
        throw new Error(response.error.message || 'Tool invocation failed');
      }

      return response.result;
    } catch (error) {
      console.error(`[McpClient] Failed to invoke tool ${toolName}:`, error);
      throw error;
    }
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      if (this.config.transportType === 'stdio' && this.stdioProcess) {
        this.stdioProcess.kill();
        this.stdioProcess = undefined;
      }

      this.connected = false;
      this.pendingRequests.clear();
      console.log('[McpClient] Disconnected from MCP server');
    } catch (error) {
      console.error('[McpClient] Error during disconnect:', error);
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get next message ID
   */
  private getNextMessageId(): number {
    return ++this.messageId;
  }

  /**
   * Parse SSE (Server-Sent Events) response format
   * Format: "event: message\ndata: {...}\n\n"
   */
  private parseSSEResponse(sseString: string): any {
    try {
      // Extract the data line from SSE format
      const dataMatch = sseString.match(/data:\s*({.*})/);
      if (dataMatch && dataMatch[1]) {
        return JSON.parse(dataMatch[1]);
      }

      // If no SSE format detected, try to parse as plain JSON
      return JSON.parse(sseString);
    } catch (error) {
      console.error('[McpClient] Failed to parse SSE response:', error);
      throw new Error(
        `Invalid SSE response format: ${sseString.substring(0, 200)}...`
      );
    }
  }

  /**
   * Create MCP client from connector config
   */
  static fromConnectorConfig(config: McpConnectorConfig): McpClient {
    return new McpClient({
      transportType: config.transportType,
      serverUrl: config.serverUrl,
      customHeaders: config.customHeaders,
      command: config.command,
      args: config.args,
      env: config.env,
    });
  }
}
