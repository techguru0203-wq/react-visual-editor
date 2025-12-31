/**
 * Web Search tool registered with unified Tool Registry
 */

import { z } from 'zod';
import { globalToolRegistry, ToolDefinition } from './ToolRegistry';

/**
 * Performs a web search using SerpAPI
 */
async function performWebSearch(query: string): Promise<string> {
  const apiKey = process.env.SERPAPI_API_KEY;

  if (!apiKey) {
    return 'Error: SERPAPI_API_KEY is not configured. Please set the API key in your environment variables.';
  }

  try {
    const searchUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(
      query
    )}&api_key=${apiKey}`;

    const response = await fetch(searchUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`SerpAPI error: ${data.error}`);
    }

    // Extract and format search results
    const organicResults = data.organic_results || [];
    const knowledgeGraph = data.knowledge_graph;
    const answerBox = data.answer_box;

    let result = `Web search results for "${query}":\n\n`;

    // Add knowledge graph if available
    if (knowledgeGraph) {
      result += `📚 Knowledge Graph:\n${knowledgeGraph.title}\n${knowledgeGraph.description}\n\n`;
    }

    // Add answer box if available
    if (answerBox) {
      result += `💡 Quick Answer:\n${answerBox.answer}\n\n`;
    }

    // Add organic search results
    if (organicResults.length > 0) {
      result += `🔍 Search Results:\n`;
      organicResults.slice(0, 5).forEach((item: any, index: number) => {
        result += `${index + 1}. ${item.title}\n`;
        result += `   URL: ${item.link}\n`;
        result += `   ${item.snippet}\n\n`;
      });
    } else {
      result += `No search results found for "${query}".\n`;
    }

    return result;
  } catch (error) {
    console.error('Web search error:', error);
    return `Error performing web search: ${
      error instanceof Error ? error.message : 'Unknown error'
    }`;
  }
}

// web_search tool
const webSearchTool: ToolDefinition = {
  name: 'web_search',
  version: '1.0.0',
  description:
    'Search the web for current information, documentation, or examples. Use this when you need to find up-to-date information such as APIs, libraries, best practices, or any other web content.',
  inputSchema: z.object({
    query: z.string().min(1).describe('The search query to perform'),
  }),
  permissions: ['web:search'],
  metadata: {
    category: 'web',
    requiresConfirm: false,
    timeoutMs: 30000,
    maxRetries: 2,
  },
  handler: async (args, context) => {
    const { query } = args;

    if (!query || !query.trim()) {
      return {
        success: false,
        error: {
          type: 'validation_error',
          message: 'Please provide a non-empty search query',
          retryable: false,
        },
      };
    }

    const searchResult = await performWebSearch(query.trim());

    // Check if result is an error message
    if (searchResult.startsWith('Error')) {
      return {
        success: false,
        error: {
          type: 'transient_error',
          message: searchResult,
          retryable: true,
        },
      };
    }

    return { success: true, output: searchResult };
  },
};

// Register web search tool
export function registerWebSearchTool() {
  globalToolRegistry.register(webSearchTool);
}
