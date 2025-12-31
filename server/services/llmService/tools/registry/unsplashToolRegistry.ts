/**
 * Unsplash Image Search tool registered with unified Tool Registry
 */

import { z } from 'zod';
import { globalToolRegistry, ToolDefinition } from './ToolRegistry';

interface UnsplashPhoto {
  id: string;
  description: string | null;
  alt_description: string | null;
  width: number;
  height: number;
  urls: {
    raw?: string;
    full?: string;
    regular?: string;
    small?: string;
    thumb?: string;
  };
  links: {
    html?: string;
    download_location?: string;
  };
  user: {
    name?: string;
    links?: {
      html?: string;
    };
  };
}

interface UnsplashSearchResponse {
  total: number;
  total_pages: number;
  results: UnsplashPhoto[];
}

interface UnsplashSearchInput {
  query: string;
  orientation?: 'landscape' | 'portrait' | 'squarish';
  per_page?: number;
  order_by?: 'relevant' | 'latest';
  color_hint?: string;
}

/**
 * Performs an Unsplash image search
 */
async function performUnsplashSearch(
  args: UnsplashSearchInput
): Promise<string> {
  const { query, orientation, per_page = 5, order_by = 'relevant' } = args;

  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    return 'Error: UNSPLASH_ACCESS_KEY environment variable is not configured. Please set it in your environment settings.';
  }

  try {
    const url = new URL('https://api.unsplash.com/search/photos');
    url.searchParams.set('query', query);
    if (orientation) {
      url.searchParams.set('orientation', orientation);
    }
    url.searchParams.set('per_page', String(per_page));
    url.searchParams.set('order_by', order_by);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Unsplash API error (${response.status}): ${errorText}`);
    }

    const data: UnsplashSearchResponse = await response.json();

    // Normalize response for easier consumption
    const normalizedResults = (data.results || []).map((photo) => ({
      id: photo.id,
      title: photo.description || photo.alt_description || 'Untitled',
      photographer: {
        name: photo.user?.name || 'Unknown',
        profile_url: photo.user?.links?.html || '',
      },
      dimensions: {
        width: photo.width,
        height: photo.height,
      },
      urls: {
        small: photo.urls?.small || '',
        regular: photo.urls?.regular || '',
        full: photo.urls?.full || photo.urls?.raw || '',
      },
      html_page: photo.links?.html || '',
      download_location: photo.links?.download_location || '',
      attribution: `Photo by ${photo.user?.name || 'Unknown'} on Unsplash`,
    }));

    const result = {
      query_used: query,
      total: data.total,
      results: normalizedResults,
      message: `Found ${normalizedResults.length} images for "${query}". Use the 'regular' or 'small' URL for display in your prototype.`,
    };

    return JSON.stringify(result, null, 2);
  } catch (error: any) {
    console.error('Unsplash search error:', error);
    return `Error performing Unsplash search: ${
      error instanceof Error ? error.message : 'Unknown error'
    }`;
  }
}

// unsplash_search tool
const unsplashSearchTool: ToolDefinition = {
  name: 'unsplash_search',
  version: '1.0.0',
  description:
    "Search high-quality photos on Unsplash by semantic intent and style constraints. Use this to find realistic, professional images that match your app's theme and enhance the prototype's visual appeal. Returns image URLs that can be directly used in <img> tags. Always include attribution for the photographer.",
  inputSchema: z.object({
    query: z
      .string()
      .min(1)
      .describe(
        'English keywords joined by comma, e.g. "future city, neon, night, rain"'
      ),
    orientation: z
      .enum(['landscape', 'portrait', 'squarish'])
      .optional()
      .describe(
        'Choose based on use case: cover/banner=landscape, mobile/story=portrait, logo/card=squarish'
      ),
    per_page: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(5)
      .describe('Number of images to fetch'),
    order_by: z
      .enum(['relevant', 'latest'])
      .default('relevant')
      .describe('Sort by relevance or latest'),
    color_hint: z
      .string()
      .optional()
      .describe(
        'Optional color hint like "warm", "cool", "monochrome" to refine query'
      ),
  }),
  permissions: ['web:unsplash'],
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

    const searchResult = await performUnsplashSearch(args);

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

// Register Unsplash search tool
export function registerUnsplashSearchTool() {
  globalToolRegistry.register(unsplashSearchTool);
}
