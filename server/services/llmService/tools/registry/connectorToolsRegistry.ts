/**
 * Connector Tools Registry
 * Dynamically registers tools from connectors (custom APIs, MCP servers)
 */

import { z } from 'zod';
import { globalToolRegistry, ToolDefinition } from './ToolRegistry';
import {
  ConnectorConfig,
  CustomApiConnectorConfig,
  McpConnectorConfig,
} from '../../../../../shared/types/connectorTypes';
import { mcpConnectorService } from '../../../mcpConnectorService';
import axios from 'axios';

/**
 * Register tools from all connectors for a document
 */
export async function registerConnectorTools(connectors: ConnectorConfig[]): Promise<void> {
  for (const connector of connectors) {
    try {
      if (connector.type === 'custom_api') {
        registerCustomApiTools(connector as CustomApiConnectorConfig);
      } else if (connector.type === 'mcp') {
        await registerMcpTools(connector as McpConnectorConfig);
      }
    } catch (error) {
      console.error(`[ConnectorToolsRegistry] Failed to register tools for ${connector.name}:`, error);
    }
  }
}

/**
 * Register tools for custom API connectors
 */
function registerCustomApiTools(connector: CustomApiConnectorConfig): void {
  const toolName = `custom_api_${connector.id}`.replace(/-/g, '_');

  // Generic custom API call tool
  const customApiTool: ToolDefinition = {
    name: toolName,
    version: '1.0.0',
    description: connector.description || `Call custom API: ${connector.name}`,
    inputSchema: z.object({
      url: z.string().describe('API endpoint URL'),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).describe('HTTP method'),
      headers: z.record(z.string()).optional().describe('Additional headers'),
      body: z.any().optional().describe('Request body for POST/PUT/PATCH'),
      params: z.record(z.string()).optional().describe('Query parameters'),
    }),
    permissions: ['api:call'],
    metadata: {
      category: 'web',
      requiresConfirm: false,
    },
    handler: async (args) => {
      try {
        // Merge connector env vars as headers
        const headers: Record<string, string> = {
          ...connector.envVars,
          ...args.headers,
        };

        const response = await axios({
          method: args.method,
          url: args.url,
          headers,
          data: args.body,
          params: args.params,
          timeout: 30000,
        });

        return {
          success: true,
          output: {
            status: response.status,
            data: response.data,
            headers: response.headers,
          },
        };
      } catch (error: any) {
        return {
          success: false,
          error: {
            type: 'transient_error',
            message: `Custom API error: ${error.response?.data?.message || error.message}`,
            retryable: true,
          },
        };
      }
    },
  };

  globalToolRegistry.register(customApiTool);
}

/**
 * Register tools from MCP server
 */
async function registerMcpTools(connector: McpConnectorConfig): Promise<void> {
  try {
    // Get tools from MCP server
    const mcpTools = await mcpConnectorService.getTools(connector);

    // Register each MCP tool
    for (const mcpTool of mcpTools) {
      const toolName = `mcp_${connector.id}_${mcpTool.name}`.replace(/-/g, '_');

      const toolDef: ToolDefinition = {
        name: toolName,
        version: '1.0.0',
        description: `${mcpTool.description} (MCP: ${connector.name})`,
        inputSchema: mcpTool.inputSchema ? z.any() : z.object({}), // Use MCP's JSON schema
        permissions: ['mcp:invoke'],
        metadata: {
          category: 'system',
          requiresConfirm: false,
        },
        handler: async (args) => {
          try {
            const result = await mcpConnectorService.invokeTool(
              connector,
              mcpTool.name,
              args
            );

            return {
              success: true,
              output: result,
            };
          } catch (error: any) {
            return {
              success: false,
              error: {
                type: 'transient_error',
                message: `MCP tool error: ${error.message}`,
                retryable: true,
              },
            };
          }
        },
      };

      globalToolRegistry.register(toolDef);
    }

    console.log(`[ConnectorToolsRegistry] Registered ${mcpTools.length} tools from MCP server ${connector.name}`);
  } catch (error) {
    console.error(`[ConnectorToolsRegistry] Failed to register MCP tools for ${connector.name}:`, error);
  }
}

/**
 * Unregister all connector tools
 */
export function unregisterConnectorTools(): void {
  // This is a simple implementation - in production, you'd want to track registered tool names
  // and only unregister connector tools, not built-in tools
  console.log('[ConnectorToolsRegistry] Unregistering connector tools...');
}

