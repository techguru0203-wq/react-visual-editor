import axios from 'axios';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatCompletionRequest {
  messages: ChatMessage[];
  model?: string;
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
  appLink?: string;
}

interface SpeechToTextRequest {
  model?: string;
  language?: string;
  prompt?: string;
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  temperature?: number;
  appLink?: string;
}

interface SpeechToTextResponse {
  text: string;
}

interface SearchResult {
  text: string;
  score: number;
  fileId: string;
  fileName: string;
  metadata?: any;
  knowledgeBaseId?: string;
}

interface KnowledgeBaseConfig {
  id: string;
  weight: number;
}

interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface StreamingChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      content?: string;
    };
    finish_reason: string | null;
  }>;
}

class AIService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.OMNIFLOW_API_KEY;
    this.baseUrl =
      process.env.OMNIFLOW_API_BASE_URL || 'https://app.omniflow.team/api';
  }

  /**
   * Make a non-streaming chat completion request
   */
  async chatCompletion(
    request: ChatCompletionRequest
  ): Promise<ChatCompletionResponse> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/v1/chat`,
        {
          ...request,
          stream: false,
          modelName: process.env.LLM_MODEL_NAME,
          appLink: request.appLink,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('AI Service Error:', error);
      throw new Error(`AI service request failed: ${error}`);
    }
  }

  /**
   * Make a streaming chat completion request
   */
  async *chatCompletionStream(
    request: ChatCompletionRequest
  ): AsyncGenerator<string, void, unknown> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/v1/chat`,
        {
          ...request,
          stream: true,
          modelName: process.env.LLM_MODEL_NAME,
          appLink: request.appLink,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          responseType: 'stream',
        }
      );

      const stream = response.data;
      let buffer = '';

      for await (const chunk of stream) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return;
            }

            try {
              const parsed: StreamingChunk = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch (parseError) {
              console.warn('Failed to parse streaming chunk:', parseError);
            }
          }
        }
      }
    } catch (error) {
      console.error('AI Service Streaming Error:', error);
      throw new Error(`AI service streaming request failed: ${error}`);
    }
  }

  /**
   * Simple chat method for basic conversations (non-streaming)
   * Automatically uses knowledge base if configured
   */
  async chat(
    message: string,
    systemPrompt?: string,
    appLink?: string,
    topK?: number
  ): Promise<string> {
    let enhancedSystemPrompt = systemPrompt;

    // Auto-enable knowledge base if configured
    const kbConfig = this.getKnowledgeBaseConfig();
    if (kbConfig && kbConfig.length > 0) {
      const searchResults = await this.searchKnowledgeBase(message, {
        topK: topK || 5,
        appLink,
      });

      const context = searchResults
        .map((result, idx) => `[${idx + 1}] ${result.text}`)
        .join('\n\n');

      enhancedSystemPrompt = `${systemPrompt || 'You are a helpful assistant.'}\n\nUse the following information from the knowledge base to answer the question:\n\n${context}\n\nIf the information provided doesn't contain the answer, say so clearly.`;
    }

    const messages: ChatMessage[] = [];

    if (enhancedSystemPrompt) {
      messages.push({ role: 'system', content: enhancedSystemPrompt });
    }

    messages.push({ role: 'user', content: message });

    const response = await this.chatCompletion({ messages, appLink });
    return response.choices[0]?.message?.content || '';
  }

  /**
   * Default chat method that returns streaming response
   * This is the recommended method for user-facing chat
   */
  async *chatDefault(
    message: string,
    systemPrompt?: string,
    appLink?: string,
    topK?: number
  ): AsyncGenerator<string, void, unknown> {
    yield* this.chatStream(message, systemPrompt, appLink, topK);
  }

  /**
   * Chat with conversation history
   */
  async chatWithHistory(messages: ChatMessage[]): Promise<string> {
    const response = await this.chatCompletion({ messages });
    return response.choices[0]?.message?.content || '';
  }

  /**
   * Streaming chat method
   * Automatically uses knowledge base if configured
   */
  async *chatStream(
    message: string,
    systemPrompt?: string,
    appLink?: string,
    topK?: number
  ): AsyncGenerator<string, void, unknown> {
    let enhancedSystemPrompt = systemPrompt;

    // Auto-enable knowledge base if configured
    const kbConfig = this.getKnowledgeBaseConfig();
    if (kbConfig && kbConfig.length > 0) {
      const searchResults = await this.searchKnowledgeBase(message, {
        topK: topK || 5,
        appLink,
      });

      const context = searchResults
        .map((result, idx) => `[${idx + 1}] ${result.text}`)
        .join('\n\n');

      enhancedSystemPrompt = `${systemPrompt || 'You are a helpful assistant.'}\n\nUse the following information from the knowledge base to answer the question:\n\n${context}\n\nIf the information provided doesn't contain the answer, say so clearly.`;
    }

    const messages: ChatMessage[] = [];

    if (enhancedSystemPrompt) {
      messages.push({ role: 'system', content: enhancedSystemPrompt });
    }

    messages.push({ role: 'user', content: message });

    yield* this.chatCompletionStream({ messages, appLink });
  }

  /**
   * Convert speech to text using Whisper API
   * @param audioFile - File object, Buffer, or path to audio file
   * @param options - Optional configuration for transcription
   * @returns Transcribed text
   */
  async speechToText(
    audioFile: File | Buffer | Blob,
    options?: SpeechToTextRequest
  ): Promise<string> {
    try {
      const FormData = require('form-data');
      const formData = new FormData();

      // Handle different input types
      if (audioFile instanceof File) {
        // Convert File to Buffer for Node.js form-data compatibility
        const arrayBuffer = await audioFile.arrayBuffer();
        formData.append('file', Buffer.from(arrayBuffer), audioFile.name);
      } else if (audioFile instanceof Buffer) {
        formData.append('file', audioFile, 'audio.mp3');
      } else if (audioFile instanceof Blob) {
        const buffer = await audioFile.arrayBuffer();
        formData.append('file', Buffer.from(buffer), 'audio.mp3');
      }

      // Add optional parameters
      if (options?.model) formData.append('model', options.model);
      if (options?.language) formData.append('language', options.language);
      if (options?.prompt) formData.append('prompt', options.prompt);
      if (options?.response_format)
        formData.append('response_format', options.response_format);
      if (options?.temperature !== undefined)
        formData.append('temperature', options.temperature.toString());
      if (options?.appLink) formData.append('appLink', options.appLink);

      const response = await axios.post(
        `${this.baseUrl}/v1/speech-to-text`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            ...formData.getHeaders(),
          },
        }
      );

      return response.data.text;
    } catch (error) {
      console.error('Speech-to-text Error:', error);
      throw new Error(`Speech-to-text request failed: ${error}`);
    }
  }

  /**
   * Get knowledge base configuration from environment
   */
  private getKnowledgeBaseConfig(): KnowledgeBaseConfig[] | null {
    try {
      const configStr = process.env.KNOWLEDGE_BASE_CONFIG;
      if (!configStr) {
        return null;
      }
      const config = JSON.parse(configStr);
      return config.knowledgeBases || [];
    } catch (error) {
      console.error('Error parsing knowledge base config:', error);
      return null;
    }
  }

  /**
   * Search a single knowledge base
   * @param knowledgeBaseId - Knowledge base ID
   * @param query - Search query
   * @param options - Search options
   * @returns Search results
   */
  private async searchSingleKnowledgeBase(
    knowledgeBaseId: string,
    query: string,
    options?: {
      topK?: number;
      appLink?: string;
    }
  ): Promise<SearchResult[]> {
    const response = await axios.post(
      `${this.baseUrl}/v1/knowledge-base/${knowledgeBaseId}/search`,
      {
        query,
        topK: options?.topK || 5,
        appLink: options?.appLink,
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // API response format: { success: true, data: { results: [...] } }
    return response.data.data?.results || [];
  }

  /**
   * Search multiple knowledge bases and merge results by weight
   * @param query - Search query
   * @param options - Search options
   * @returns Merged and sorted search results
   */
  async searchKnowledgeBase(
    query: string,
    options?: {
      topK?: number;
      appLink?: string;
    }
  ): Promise<SearchResult[]> {
    try {
      const topK = options?.topK || 5;

      // Search all configured knowledge bases
      const kbConfig = this.getKnowledgeBaseConfig();
      if (!kbConfig || kbConfig.length === 0) {
        throw new Error('No knowledge base configured for this application');
      }

      // Search all knowledge bases in parallel
      const searchPromises = kbConfig.map(async (kb) => {
        try {
          const results = await this.searchSingleKnowledgeBase(kb.id, query, {
            topK,
            appLink: options?.appLink,
          });
          // Apply weight to scores
          return results.map((result) => ({
            ...result,
            score: result.score * kb.weight,
            knowledgeBaseId: kb.id,
          }));
        } catch (error) {
          console.warn(`Failed to search KB ${kb.id}:`, error);
          return [];
        }
      });

      const allResults = await Promise.all(searchPromises);
      const mergedResults = allResults.flat();

      // Sort by weighted score (descending) and return top K
      mergedResults.sort((a, b) => b.score - a.score);
      return mergedResults.slice(0, topK);
    } catch (error) {
      console.error('Knowledge base search error:', error);
      throw new Error(`Knowledge base search failed: ${error}`);
    }
  }
}

// Factory function to create AI service instance
export function createAIService(): AIService {
  return new AIService();
}

export default AIService;
export type {
  ChatMessage,
  ChatCompletionRequest,
  ChatCompletionResponse,
  SpeechToTextRequest,
  SpeechToTextResponse,
};
