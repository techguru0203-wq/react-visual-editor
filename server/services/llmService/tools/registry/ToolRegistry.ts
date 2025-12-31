/**
 * Unified Tool Registry with JSON Schema validation
 * Aligned with OpenAI and Anthropic tool calling standards
 */

import { z } from 'zod';

export interface ToolDefinition {
  name: string;
  version: string;
  description: string;
  inputSchema: z.ZodType<any>;
  permissions?: string[];
  metadata?: {
    category?: 'db' | 'web' | 'code' | 'system';
    requiresConfirm?: boolean;
    maxRetries?: number;
    timeoutMs?: number;
  };
  handler: (args: any, context: ToolContext) => Promise<ToolResult>;
}

export interface ToolContext {
  docId?: string;
  userId: string;
  organizationId: string;
  connectors?: any[]; // Available connectors for this document
}

export interface ToolResult {
  success: boolean;
  output?: any;
  error?: {
    type: 'validation_error' | 'transient_error' | 'fatal_error';
    message: string;
    retryable?: boolean;
  };
  requiresConfirm?: boolean;
  confirmPayload?: any;
}

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
    console.log(
      `[ToolRegistry] Registered tool: ${tool.name} v${tool.version}`
    );
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(filters?: {
    category?: string;
    permissions?: string[];
  }): ToolDefinition[] {
    let result = Array.from(this.tools.values());

    if (filters?.category) {
      result = result.filter((t) => t.metadata?.category === filters.category);
    }

    if (filters?.permissions) {
      result = result.filter((t) =>
        filters.permissions!.some((p) => t.permissions?.includes(p))
      );
    }

    return result;
  }

  /**
   * Invoke a tool with validation and error handling
   */
  async invoke(
    name: string,
    args: any,
    context: ToolContext
  ): Promise<ToolResult> {
    const tool = this.get(name);

    if (!tool) {
      return {
        success: false,
        error: {
          type: 'fatal_error',
          message: `Tool not found: ${name}`,
          retryable: false,
        },
      };
    }

    // JSON Schema validation
    const parseResult = tool.inputSchema.safeParse(args);
    if (!parseResult.success) {
      return {
        success: false,
        error: {
          type: 'validation_error',
          message: `Invalid arguments for ${name}: ${parseResult.error.message}`,
          retryable: false,
        },
      };
    }

    try {
      const startTime = Date.now();
      const result = await tool.handler(parseResult.data, context);
      const elapsedMs = Date.now() - startTime;

      console.log(`[ToolRegistry] Tool ${name} executed in ${elapsedMs}ms`);

      return result;
    } catch (e: any) {
      console.error(`[ToolRegistry] Tool ${name} failed:`, e);
      return {
        success: false,
        error: {
          type: 'transient_error',
          message: e.message || 'Unknown error',
          retryable: true,
        },
      };
    }
  }

  /**
   * Get tool count
   */
  count(): number {
    return this.tools.size;
  }

  /**
   * Clear all tools (for testing)
   */
  clear(): void {
    this.tools.clear();
  }
}

// Global singleton instance
export const globalToolRegistry = new ToolRegistry();
