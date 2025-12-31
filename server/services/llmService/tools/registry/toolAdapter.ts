import { DynamicStructuredTool } from '@langchain/core/tools';
import { ToolDefinition } from './ToolRegistry';

/**
 * Convert ToolRegistry ToolDefinition to LangChain DynamicStructuredTool.
 * We only expose schema/description for tool selection; actual execution
 * is handled by our own invoke loop, so the func here is a no-op placeholder.
 */
export function toLangChainTools(
  definitions: ToolDefinition[]
): DynamicStructuredTool[] {
  return definitions.map(
    (def) =>
      new DynamicStructuredTool({
        name: def.name,
        description: def.description,
        schema: def.inputSchema,
        // Do not execute real logic here. The agent loop will invoke via registry.
        func: async (_input: any) => {
          return JSON.stringify({
            notice: 'tool execution handled externally',
            tool: def.name,
          });
        },
      })
  );
}
