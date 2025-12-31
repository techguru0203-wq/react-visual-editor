import { Router } from 'express';
import { ApiKeyRequest } from '../../../lib/apiKeyAuth';
import { logApiUsage } from '../../../services/apiUsageService';
import { calculateCreditsFromTokens } from '../../../services/creditService';
import prisma from '../../../db/prisma';
import { GenerationMinimumCredit } from '../../../lib/constant';
import { ACTIVE_OPENAI_MODEL_ID_PROD } from '../../../services/llmService/uiux/ai_utils';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ENABLE_LLM_LOGGING } from '../../../lib/constant';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
} from '@langchain/core/messages';
import {
  searchKnowledgeBase,
  chatWithKnowledgeBase,
} from '../../../services/knowledgeSearchService';

const router = Router();

// Helper function to convert OpenAI-format messages to LangChain format
function convertMessagesToLangChain(
  messages: Array<{ role: string; content: string }>
): Array<HumanMessage | SystemMessage | AIMessage> {
  return messages.map((msg) => {
    const content =
      typeof msg.content === 'string' ? msg.content : String(msg.content);
    switch (msg.role.toLowerCase()) {
      case 'system':
        return new SystemMessage(content);
      case 'assistant':
      case 'ai':
        return new AIMessage(content);
      case 'user':
      default:
        return new HumanMessage(content);
    }
  });
}

// Helper function to initialize the appropriate LLM based on model name
function initializeLLM(
  modelName: string,
  temperature: number = 0.7,
  maxTokens: number = 10000
): BaseChatModel {
  const lowerModelName = modelName.toLowerCase();

  // Anthropic models
  if (lowerModelName.includes('claude')) {
    return new ChatAnthropic({
      modelName: modelName,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      streaming: true,
      temperature: temperature,
      maxTokens: maxTokens,
      verbose: ENABLE_LLM_LOGGING,
    });
  }

  // Google Gemini models
  if (lowerModelName.includes('gemini')) {
    return new ChatGoogleGenerativeAI({
      model: modelName,
      apiKey: process.env.GOOGLE_API_KEY,
      streaming: true,
      temperature: temperature,
      maxOutputTokens: maxTokens,
      verbose: ENABLE_LLM_LOGGING,
    });
  }

  if (lowerModelName.includes('gpt-5')) {
    return new ChatOpenAI({
      modelName: modelName,
      openAIApiKey: process.env.OPENAI_API_KEY,
      streaming: true,
      //temperature not supported in gpt-5, default to 1
      maxCompletionTokens: maxTokens,
      verbose: ENABLE_LLM_LOGGING,
    });
  }

  // Default to OpenAI
  return new ChatOpenAI({
    modelName: modelName,
    openAIApiKey: process.env.OPENAI_API_KEY,
    streaming: true,
    temperature: temperature,
    maxTokens: maxTokens,
    verbose: ENABLE_LLM_LOGGING,
  });
}

/**
 * External API endpoint for chat completions
 * POST /v1/chat
 *
 * Request body:
 * {
 *   "messages": [
 *     {"role": "user", "content": "Hello, how are you?"}
 *   ],
 *   "model": "gpt-3.5-turbo", // optional, defaults to gpt-3.5-turbo
 *   "stream": false, // optional, defaults to false
 *   "max_tokens": 1000, // optional
 *   "temperature": 0.7 // optional
 * }
 *
 * Response (non-streaming):
 * {
 *   "id": "chatcmpl-123",
 *   "object": "chat.completion",
 *   "created": 1677652288,
 *   "model": "gpt-3.5-turbo",
 *   "choices": [{
 *     "index": 0,
 *     "message": {
 *       "role": "assistant",
 *       "content": "Hello! I'm doing well, thank you for asking."
 *     },
 *     "finish_reason": "stop"
 *   }],
 *   "usage": {
 *     "prompt_tokens": 10,
 *     "completion_tokens": 20,
 *     "total_tokens": 30
 *   }
 * }
 */
router.post('/chat', async (req: ApiKeyRequest, res) => {
  try {
    const {
      messages,
      appLink,
      modelName = ACTIVE_OPENAI_MODEL_ID_PROD,
      stream = true,
      temperature = 0.7,
      max_tokens = 10000,
    } = req.body;

    console.log('in api/v1/chat: request received - ', req.body);
    // Validate request
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'Messages array is required and must not be empty',
      });
    }

    // Check if organization has sufficient credits
    const organization = await prisma.organization.findUnique({
      where: { id: req.apiKey!.organizationId },
    });

    if (!organization) {
      return res.status(500).json({
        success: false,
        error: 'Organization not found',
      });
    }

    if (organization.credits < GenerationMinimumCredit) {
      return res.status(402).json({
        success: false,
        error: 'Insufficient credits',
        message:
          'Your organization does not have sufficient credits to make this request',
      });
    }

    const startTime = Date.now();

    // Initialize the appropriate LLM
    const llm = initializeLLM(modelName, temperature, max_tokens);

    if (stream) {
      // Handle streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');

      let fullResponse = '';
      let promptTokens = 0;
      let completionTokens = 0;

      try {
        // Convert messages to LangChain format
        const langchainMessages = convertMessagesToLangChain(messages);
        const langchainStream = await llm.stream(langchainMessages);

        for await (const chunk of langchainStream) {
          const content =
            typeof chunk.content === 'string' ? chunk.content : '';
          if (content) {
            fullResponse += content;
          }

          // Extract token usage from chunk if available
          // Different models return usage_metadata in different formats
          if ((chunk as any).usage_metadata) {
            const usageMetadata = (chunk as any).usage_metadata;
            promptTokens =
              usageMetadata.input_tokens || usageMetadata.prompt_tokens || 0;
            completionTokens =
              usageMetadata.output_tokens ||
              usageMetadata.completion_tokens ||
              0;
          } else if ((chunk as any).response_metadata?.usage) {
            const usage = (chunk as any).response_metadata.usage;
            promptTokens = usage.prompt_tokens || usage.input_tokens || 0;
            completionTokens =
              usage.completion_tokens || usage.output_tokens || 0;
          }

          // Extract finish reason from chunk
          const finishReason =
            (chunk as any).response_metadata?.finish_reason ||
            (chunk as any).finish_reason ||
            null;

          res.write(
            `data: ${JSON.stringify({
              id: `chatcmpl-${Date.now()}`,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: modelName,
              choices: [
                {
                  index: 0,
                  delta: { content },
                  finish_reason: finishReason,
                },
              ],
            })}\n\n`
          );
        }

        // Send final chunk with finish_reason
        res.write(
          `data: ${JSON.stringify({
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: modelName,
            choices: [
              {
                index: 0,
                delta: {},
                finish_reason: 'stop',
              },
            ],
          })}\n\n`
        );

        res.write('data: [DONE]\n\n');
        res.end();

        // Log usage after streaming completes
        const duration = Date.now() - startTime;
        const creditsUsed = calculateCreditsFromTokens(
          promptTokens,
          completionTokens,
          0, // cacheReadTokens
          0, // cacheWriteTokens
          modelName
        );
        await logApiUsage({
          organizationId: req.apiKey!.organizationId,
          endpoint: '/v1/chat',
          appLink,
          requestSize: Buffer.byteLength(JSON.stringify(req.body), 'utf8'),
          responseSize: Buffer.byteLength(fullResponse, 'utf8'),
          creditsUsed,
          statusCode: 200,
          duration,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          meta: {
            model: modelName,
            stream: true,
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
          },
        });

        // Deduct credits
        await prisma.organization.update({
          where: { id: req.apiKey!.organizationId },
          data: { credits: { decrement: creditsUsed } },
        });
      } catch (error) {
        console.error('Streaming chat error:', error);
        res.write(
          `data: ${JSON.stringify({
            error: {
              message: 'An error occurred while processing your request',
              type: 'server_error',
            },
          })}`
        );
        res.end();
      }
    } else {
      // Handle non-streaming response
      try {
        // Convert messages to LangChain format
        const langchainMessages = convertMessagesToLangChain(messages);
        const result = await llm.invoke(langchainMessages);

        const response =
          typeof result.content === 'string' ? result.content : '';

        // Extract token usage from response metadata if available
        let promptTokens = 0;
        let completionTokens = 0;

        if ((result as any).usage_metadata) {
          const usageMetadata = (result as any).usage_metadata;
          promptTokens =
            usageMetadata.input_tokens || usageMetadata.prompt_tokens || 0;
          completionTokens =
            usageMetadata.output_tokens || usageMetadata.completion_tokens || 0;
        } else if ((result as any).response_metadata?.usage) {
          const usage = (result as any).response_metadata.usage;
          promptTokens = usage.prompt_tokens || usage.input_tokens || 0;
          completionTokens =
            usage.completion_tokens || usage.output_tokens || 0;
        }

        const creditsUsed = calculateCreditsFromTokens(
          promptTokens,
          completionTokens,
          0, // cacheReadTokens
          0, // cacheWriteTokens
          modelName
        );
        const duration = Date.now() - startTime;

        // Format response similar to streaming format for consistent frontend parsing
        const apiResponse = {
          id: `chatcmpl-${Date.now()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: modelName,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: response,
              },
              delta: {
                content: response,
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: promptTokens + completionTokens,
          },
        };

        console.log('api/v1/chat: apiResponse: ', apiResponse);
        res.json(apiResponse);

        // Log usage
        await logApiUsage({
          organizationId: req.apiKey!.organizationId,
          endpoint: '/v1/chat',
          appLink,
          requestSize: Buffer.byteLength(JSON.stringify(req.body), 'utf8'),
          responseSize: Buffer.byteLength(JSON.stringify(apiResponse), 'utf8'),
          creditsUsed,
          statusCode: 200,
          duration,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          meta: {
            model: modelName,
            stream: false,
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
          },
        });

        // Deduct credits
        await prisma.organization.update({
          where: { id: req.apiKey!.organizationId },
          data: { credits: { decrement: creditsUsed } },
        });
      } catch (error) {
        console.error('Chat completion error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          message: 'An error occurred while processing your request',
        });
      }
    }
  } catch (error) {
    console.error('API chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'An unexpected error occurred',
    });
  }
});

router.post('/knowledge-base/:id/search', async (req: ApiKeyRequest, res) => {
  try {
    const { id } = req.params;
    const { query, topK, appLink } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        errorMsg: 'Query is required',
      });
    }

    // Verify that the knowledge base belongs to the organization
    const kb = await prisma.knowledgeBase.findUnique({
      where: { id },
      select: { organizationId: true },
    });

    if (!kb) {
      return res.status(404).json({
        success: false,
        errorMsg: 'Knowledge base not found',
      });
    }

    if (kb.organizationId !== req.apiKey?.organizationId) {
      return res.status(403).json({
        success: false,
        errorMsg: 'Access denied to this knowledge base',
      });
    }

    const results = await searchKnowledgeBase(id, query, topK);

    res.status(200).json({
      success: true,
      data: { results },
    });
  } catch (error: any) {
    console.error('Error in POST /api/v1/knowledge-base/:id/search:', error);
    res.status(500).json({
      success: false,
      errorMsg: error.message || 'Failed to search knowledge base',
    });
  }
});

router.post('/knowledge-base/:id/chat', async (req: ApiKeyRequest, res) => {
  try {
    const { id } = req.params;
    const { message, systemPrompt, chatSessionId, appLink } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        errorMsg: 'Message is required',
      });
    }

    // Verify that the knowledge base belongs to the organization
    const kb = await prisma.knowledgeBase.findUnique({
      where: { id },
      select: { organizationId: true },
    });

    if (!kb) {
      return res.status(404).json({
        success: false,
        errorMsg: 'Knowledge base not found',
      });
    }

    if (kb.organizationId !== req.apiKey?.organizationId) {
      return res.status(403).json({
        success: false,
        errorMsg: 'Access denied to this knowledge base',
      });
    }

    // Use organization ID as user ID for public API calls
    const response = await chatWithKnowledgeBase({
      knowledgeBaseId: id,
      userMessage: message,
      userId: req.apiKey!.organizationId,
      chatSessionId,
      systemPrompt,
    });

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error: any) {
    console.error('Error in POST /api/v1/knowledge-base/:id/chat:', error);
    res.status(500).json({
      success: false,
      errorMsg: error.message || 'Failed to generate response',
    });
  }
});

/**
 * Health check endpoint
 * GET /v1/health
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

module.exports = {
  className: 'v1',
  routes: router,
};
