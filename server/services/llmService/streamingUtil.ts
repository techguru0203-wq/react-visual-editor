import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { AuthenticatedUserWithProfile } from '../../types/authTypes';
import { AIMessageChunk } from '@langchain/core/messages';
import { RedisSingleton } from '../redis/redis';
import { RedisCache } from '@langchain/community/caches/ioredis';
import { LLMResult } from '@langchain/core/outputs';
import { ENABLE_LLM_LOGGING } from '../../lib/constant';

export interface StreamingConfig {
  modelName: string;
  temperature?: number;
  verbose?: boolean;
  currentUser?: AuthenticatedUserWithProfile;
  docId?: string;
  docType?: string;
  maxTokens?: number;
  thinking?: {
    type: 'enabled';
    budget_tokens: number;
  };
}

export interface StreamingCallbacks {
  onToken?: (token: string) => void;
  onLLMEnd?: (output: any) => void;
  onChainEnd?: (output: any) => void;
}

export function createStreamingGPTModel(
  config: StreamingConfig,
  callbacks: StreamingCallbacks = {}
) {
  return new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    modelName: config.modelName,
    temperature: config.temperature ?? 1,
    verbose: config.verbose ?? ENABLE_LLM_LOGGING,
    streaming: true,
    streamUsage: true,
    cache: new RedisCache(RedisSingleton.getClient()) as any,
    callbacks: [
      {
        handleLLMEnd: async (output: LLMResult) => {
          if (callbacks.onLLMEnd) {
            if (ENABLE_LLM_LOGGING) {
              console.log(
                'in streamingUtil.createStreamingGPTModel.callback:',
                output
              );
            }
            const generation = output.generations[0][0] as unknown as {
              message: AIMessageChunk;
            };
            const usage = generation.message.usage_metadata;
            if (ENABLE_LLM_LOGGING) {
              console.log('createStreamingGPTModel.Token.usage:', usage);
              console.log('createStreamingGPTModel.Cache.stats:', {
                cache_read: usage?.input_token_details?.cache_read || 0,
                cache_creation: usage?.input_token_details?.cache_creation || 0,
                total_tokens: usage?.total_tokens || 0,
              });
            }
            await callbacks.onLLMEnd(usage);
          }
        },
      },
    ],
  });
}

export function createStreamingClaudeModel(
  config: StreamingConfig,
  callbacks: StreamingCallbacks = {}
) {
  // Build beta headers based on enabled features
  const betaFeatures = [
    'context-1m-2025-08-07',
    'extended-cache-ttl-2025-04-11',
  ];

  // Build base model configuration
  const modelConfig: any = {
    model: config.modelName,
    maxTokens: config.maxTokens ?? 40_000,
    temperature: config.temperature ?? 0,
    verbose: config.verbose ?? ENABLE_LLM_LOGGING,
    streaming: true,
    streamUsage: true,
    cache: new RedisCache(RedisSingleton.getClient()),
    clientOptions: {
      defaultHeaders: {
        'X-Api-Key': process.env.ANTHROPIC_API_KEY as string,
        'anthropic-beta': betaFeatures.join(','),
      },
    },
  };

  if (config.thinking) {
    modelConfig.thinking = config.thinking;
    // Temperature is still supported with thinking mode, but with constraints
    modelConfig.temperature = config.temperature ?? 1.0;
    // LangChain requires topP/topK to be explicitly disabled when thinking is enabled
    // See: "topP is not supported when thinking is enabled" error from ChatAnthropic
    // Using -1 signals "do not apply this sampler" in LangChain's Anthropic integration
    modelConfig.topP = -1;
    modelConfig.topK = -1;
  } else {
    // When thinking is disabled, we can use normal sampling parameters
    modelConfig.temperature = config.temperature ?? 0;
    // Note: Not setting topP/top_p to maintain existing behavior
    // Add topP here if needed in the future: modelConfig.topP = 0.9;
  }

  modelConfig.callbacks = [
    {
      handleLLMStart: async () => {
        if (ENABLE_LLM_LOGGING) {
          console.log('Starting LLM request with cache enabled');
          if (config.thinking) {
            console.log(
              'Extended thinking enabled with budget:',
              config.thinking.budget_tokens
            );
          }
        }
      },
      handleLLMEnd: async (output: LLMResult) => {
        if (callbacks.onLLMEnd) {
          if (ENABLE_LLM_LOGGING) {
            console.log(
              'createStreamingClaudeModel.Calling onLLMEnd callback',
              output
            );
          }
          const generation = output.generations[0][0] as unknown as {
            message: AIMessageChunk;
          };
          const usage = generation.message.usage_metadata;
          if (ENABLE_LLM_LOGGING) {
            console.log('createStreamingClaudeModel.Token.usage:', usage);
            console.log('createStreamingClaudeModel.Cache.stats:', {
              cache_read: usage?.input_token_details?.cache_read || 0,
              cache_creation: usage?.input_token_details?.cache_creation || 0,
              total_tokens: usage?.total_tokens || 0,
            });
          }
          await callbacks.onLLMEnd(usage);
        }
      },
    },
  ];

  return new ChatAnthropic(modelConfig as any);
}
