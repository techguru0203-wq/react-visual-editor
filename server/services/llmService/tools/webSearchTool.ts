/**
 * Web search tool for dynamic web searches during generation
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export const webSearchToolName = 'web_search';

export interface WebSearchTool extends DynamicStructuredTool {
  name: string;
  description: string;
}

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
      organicResults.slice(0, 5).forEach((result: any, index: number) => {
        result += `${index + 1}. ${result.title}\n`;
        result += `   URL: ${result.link}\n`;
        result += `   ${result.snippet}\n\n`;
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

/**
 * Creates a web search tool that allows LLMs to search the web dynamically
 */
export function createWebSearchTool(): WebSearchTool {
  return new DynamicStructuredTool({
    name: 'web_search',
    description:
      'Search the web for current information, documentation, or examples. Use this when you need to find up-to-date information such as APIs, libraries, best practices, web pages,or any other information.',
    schema: z.object({
      query: z.string().describe('The search query to perform'),
    }),
    func: async ({ query }) => {
      try {
        const searchQuery = query.trim();

        if (!searchQuery) {
          return 'Error: Please provide a search query.';
        }

        return await performWebSearch(searchQuery);
      } catch (error) {
        return `Error performing web search: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`;
      }
    },
  });
}
