/**
 * MCP Connector Service
 * Manages MCP client lifecycle, connection pooling, and health checks
 */

import { McpClient } from './mcpClient';
import { McpConnectorConfig } from '../../shared/types/connectorTypes';

interface McpClientPoolEntry {
  client: McpClient;
  connector: McpConnectorConfig;
  lastUsed: number;
  healthCheckInterval?: NodeJS.Timeout;
  reconnectFailures: number;
}

export class McpConnectorService {
  private clientPool: Map<string, McpClientPoolEntry> = new Map();
  private readonly IDLE_TIMEOUT = 10 * 60 * 1000; // 10 minutes
  private readonly HEALTH_CHECK_INTERVAL = 60 * 1000; // 1 minute
  private readonly MAX_RECONNECT_FAILURES = 3; // Max reconnection attempts
  private cleanupInterval?: NodeJS.Timeout;

  constructor() {
    // Start cleanup interval
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupIdleClients();
    }, 60 * 1000); // Run cleanup every minute
  }

  /**
   * Get or create MCP client for a connector
   */
  async getClient(connector: McpConnectorConfig): Promise<McpClient> {
    const poolKey = this.getPoolKey(connector);

    // Check if client already exists and is connected
    const existing = this.clientPool.get(poolKey);
    if (existing) {
      if (existing.client.isConnected()) {
        existing.lastUsed = Date.now();
        return existing.client;
      } else {
        // Client disconnected, remove from pool
        await this.removeClient(poolKey);
      }
    }

    // Create new client
    const client = McpClient.fromConnectorConfig(connector);
    await client.connect();

    // Add to pool
    const entry: McpClientPoolEntry = {
      client,
      connector,
      lastUsed: Date.now(),
      reconnectFailures: 0,
    };

    // Set up health check
    entry.healthCheckInterval = setInterval(async () => {
      try {
        if (!client.isConnected()) {
          if (entry.reconnectFailures >= this.MAX_RECONNECT_FAILURES) {
            console.error(
              `[McpConnectorService] Max reconnection attempts (${this.MAX_RECONNECT_FAILURES}) reached for ${connector.name}, removing client`
            );
            await this.removeClient(poolKey);
            return;
          }

          console.warn(
            `[McpConnectorService] Health check failed for ${
              connector.name
            }, attempting reconnect (attempt ${entry.reconnectFailures + 1}/${
              this.MAX_RECONNECT_FAILURES
            })...`
          );
          await client.connect();
          entry.reconnectFailures = 0; // Reset on successful reconnection
        }
      } catch (error) {
        entry.reconnectFailures++;
        console.error(
          `[McpConnectorService] Reconnection failed for ${connector.name} (${entry.reconnectFailures}/${this.MAX_RECONNECT_FAILURES}):`,
          error
        );

        if (entry.reconnectFailures >= this.MAX_RECONNECT_FAILURES) {
          console.error(
            `[McpConnectorService] Max reconnection attempts reached, removing client for ${connector.name}`
          );
          await this.removeClient(poolKey);
        }
      }
    }, this.HEALTH_CHECK_INTERVAL);

    this.clientPool.set(poolKey, entry);

    console.log(
      `[McpConnectorService] Created new MCP client for ${connector.name}`
    );

    return client;
  }

  /**
   * Get list of tools from MCP connector
   */
  async getTools(connector: McpConnectorConfig) {
    const client = await this.getClient(connector);
    return await client.listTools();
  }

  /**
   * Invoke tool on MCP connector
   */
  async invokeTool(
    connector: McpConnectorConfig,
    toolName: string,
    args: Record<string, any>
  ) {
    const client = await this.getClient(connector);
    return await client.invokeTool(toolName, args);
  }

  /**
   * Remove client from pool
   */
  private async removeClient(poolKey: string): Promise<void> {
    const entry = this.clientPool.get(poolKey);
    if (!entry) {
      return;
    }

    // Clear health check interval
    if (entry.healthCheckInterval) {
      clearInterval(entry.healthCheckInterval);
    }

    // Disconnect client
    try {
      await entry.client.disconnect();
    } catch (error) {
      console.error('[McpConnectorService] Error disconnecting client:', error);
    }

    this.clientPool.delete(poolKey);
    console.log(
      `[McpConnectorService] Removed MCP client for ${entry.connector.name}`
    );
  }

  /**
   * Cleanup idle clients
   */
  private async cleanupIdleClients(): Promise<void> {
    const now = Date.now();

    for (const [poolKey, entry] of this.clientPool.entries()) {
      if (now - entry.lastUsed > this.IDLE_TIMEOUT) {
        console.log(
          `[McpConnectorService] Cleaning up idle client for ${entry.connector.name}`
        );
        await this.removeClient(poolKey);
      }
    }
  }

  /**
   * Test MCP connection
   */
  async testConnection(
    connector: McpConnectorConfig
  ): Promise<{ success: boolean; message: string; tools?: any[] }> {
    try {
      const client = McpClient.fromConnectorConfig(connector);
      await client.connect();

      const tools = await client.listTools();

      await client.disconnect();

      return {
        success: true,
        message: `Successfully connected to MCP server. Found ${tools.length} tool(s).`,
        tools,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
      };
    }
  }

  /**
   * Get pool key for connector
   */
  private getPoolKey(connector: McpConnectorConfig): string {
    // Use connector ID as pool key
    return connector.id;
  }

  /**
   * Disconnect all clients
   */
  async disconnectAll(): Promise<void> {
    console.log('[McpConnectorService] Disconnecting all MCP clients...');

    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Disconnect all clients
    const disconnectPromises: Promise<void>[] = [];
    for (const poolKey of this.clientPool.keys()) {
      disconnectPromises.push(this.removeClient(poolKey));
    }

    await Promise.all(disconnectPromises);

    console.log('[McpConnectorService] All MCP clients disconnected');
  }

  /**
   * Get client count
   */
  getClientCount(): number {
    return this.clientPool.size;
  }
}

// Global singleton instance
export const mcpConnectorService = new McpConnectorService();

// Cleanup on process exit
process.on('SIGTERM', async () => {
  await mcpConnectorService.disconnectAll();
});

process.on('SIGINT', async () => {
  await mcpConnectorService.disconnectAll();
});
