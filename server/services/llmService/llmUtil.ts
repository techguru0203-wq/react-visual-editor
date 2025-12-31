import pg, { Pool } from 'pg';

import { updateOrgCreditsAfterContentGen } from '../creditService';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import {
  Runnable,
  RunnableWithMessageHistory,
} from '@langchain/core/runnables';
import { PostgresChatMessageHistory } from '@langchain/community/stores/message/postgres';
import {
  ACTIVE_CLAUDE_MODEL_ID,
  ACTIVE_OPENAI_MODEL_ID_DEV,
  ACTIVE_OPENAI_MODEL_ID_PROD,
} from './uiux/ai_utils';
import {
  BaseMessage,
  mapStoredMessageToChatMessage,
  MessageContent,
} from '@langchain/core/messages';
import { MessageLimit } from '../../../shared/constants';
import prisma from '../../db/prisma';
import { MessageUseTypes, Prisma } from '@prisma/client';
import mixpanel from '../../services/trackingService';
import { ENABLE_LLM_LOGGING } from '../../lib/constant';

export const textCollectionName = 'text-collection';
export const orgIdColName = 'organization_id';

export const OmniflowCreditToTokenConversion = 20;

/**
 * Utility function to conditionally log LLM debug information
 * Only logs when ENABLE_LLM_LOGGING is true
 */
export function llmDebugLog(message: string, ...args: any[]): void {
  if (ENABLE_LLM_LOGGING) {
    console.log(`[LLM] ${message}`, ...args);
  }
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function getHistoryChain({
  prompt,
  model,
}: {
  prompt: ChatPromptTemplate;
  model: Runnable;
}) {
  const chain = prompt.pipe(model);
  const chainWithHistory = new RunnableWithMessageHistory({
    runnable: chain,
    inputMessagesKey: 'userInput',
    historyMessagesKey: 'history',
    getMessageHistory: async (sessionId) => {
      const chatHistory = new LimitedPostgresChatMessageHistory({
        sessionId,
        pool,
        tableName: 'chatHistories',
        escapeTableName: true,
        limit: MessageLimit,
      });
      return chatHistory;
    },
  });
  return chainWithHistory;
}
export async function processLLMEndCallback(
  output: any,
  modelName: string,
  input: any,
  skipCreditDeduction: boolean = false
) {
  console.log(`in ${modelName} callback:`, output);
  const { currentUser, docId, templateDocId, docType, streamingMode } = input;
  let tokenUsageJson;
  if (streamingMode) {
    if (modelName === ACTIVE_CLAUDE_MODEL_ID) {
      tokenUsageJson = {
        completionTokens: output.output_tokens,
        promptTokens: output.input_tokens,
        totalTokens: output.total_tokens,
        cacheReadTokens: output.input_token_details?.cache_read,
        cacheWriteTokens: output.input_token_details?.cache_creation,
      };
    } else {
      const usageMeta = output.generations?.[0]?.[0]?.message?.usage_metadata;
      if (usageMeta) {
        tokenUsageJson = {
          promptTokens: usageMeta.input_tokens,
          completionTokens: usageMeta.output_tokens,
          totalTokens: usageMeta.total_tokens,
          cacheReadTokens: usageMeta.input_token_details?.cache_read ?? 0,
        };
      }
    }
  } else {
    if (modelName === ACTIVE_OPENAI_MODEL_ID_DEV) {
      const usageMeta = output.generations?.[0]?.[0]?.message?.usage_metadata;
      if (usageMeta) {
        tokenUsageJson = {
          promptTokens: usageMeta.input_tokens,
          completionTokens: usageMeta.output_tokens,
          totalTokens: usageMeta.total_tokens,
          cacheReadTokens: usageMeta.input_token_details?.cache_read ?? 0,
        };
      }
      // console.log('in llmUtil.processLLMEndCallback:', tokenUsageJson);
    } else if (modelName === ACTIVE_OPENAI_MODEL_ID_PROD) {
      const usageMeta = output.generations?.[0]?.[0]?.message?.usage_metadata;
      if (usageMeta) {
        tokenUsageJson = {
          promptTokens: usageMeta.input_tokens,
          completionTokens: usageMeta.output_tokens,
          totalTokens: usageMeta.total_tokens,
          cacheReadTokens: usageMeta.input_token_details?.cache_read ?? 0,
        };
      }
      // console.log('in llmUtil.processLLMEndCallback:', tokenUsageJson);
    } else if (modelName === ACTIVE_CLAUDE_MODEL_ID) {
      try {
        if (output?.usage) {
          const { output_tokens, input_tokens } = output.usage;
          // Handle different cache structures
          let cacheReadTokens = 0;
          let cacheWriteTokens = 0;

          if (output.input_token_details?.cache_read !== undefined) {
            cacheReadTokens = output.input_token_details?.cache_read;
          } else if (output.usage?.cache_read_input_tokens !== undefined) {
            cacheReadTokens = output.usage.cache_read_input_tokens;
          }

          if (output.input_token_details?.cache_creation !== undefined) {
            cacheWriteTokens = output.input_token_details?.cache_creation;
          } else if (output.usage?.cache_creation_input_tokens !== undefined) {
            cacheWriteTokens = output.usage.cache_creation_input_tokens;
          }

          tokenUsageJson = {
            completionTokens: output_tokens,
            promptTokens: input_tokens,
            totalTokens: output_tokens + input_tokens,
            cacheReadTokens,
            cacheWriteTokens,
          };
        } else if (output?.tokenUsage) {
          const { promptTokens, completionTokens, totalTokens } =
            output.tokenUsage;
          tokenUsageJson = {
            completionTokens,
            promptTokens,
            totalTokens,
          };
        } else {
          console.log(
            'in llmUtil.processLLMEndCallback: output token use is undeinfed is undefined for Claude model',
            output
          );
        }
      } catch (error) {
        console.log(
          'in llmUtil.processLLMEndCallback.error, output.usage not found:',
          error
        );
      }
    }
  }
  if (!tokenUsageJson) {
    console.log(
      'in llmUtil.processLLMEndCallback.error: No tokenUsage JSON found.'
    );
    return;
  }

  // update org token next
  if (!skipCreditDeduction) {
    await updateOrgCreditsAfterContentGen(
      currentUser,
      docType,
      tokenUsageJson,
      docId,
      templateDocId,
      modelName
    );
  } else {
    console.log(
      'in llmUtil.processLLMEndCallback.skipCreditDeduction: Skipping credit deduction.',
      modelName,
      tokenUsageJson,
      docType
    );
    mixpanel.track('Skip_credit_deduction_failure_retry', {
      modelName,
      tokenUsageJson,
      docType,
    });
  }
}

// Define OpenAI-style message type
export type OpenAIMessage = {
  type: 'system' | 'user' | 'assistant';
  content: MessageContent;
};

// Function to convert BaseMessage[] to OpenAI-style chat format
export function convertToOpenAIFormat(
  messages: BaseMessage[]
): OpenAIMessage[] {
  return messages.map((msg) => {
    let type: OpenAIMessage['type'];

    switch (msg._getType()) {
      case 'system':
        type = 'system';
        break;
      case 'human':
        type = 'user';
        break;
      case 'ai':
        type = 'assistant';
        break;
      default:
        type = 'user'; // Fallback to user role
    }

    return {
      type,
      content: msg.content,
    };
  });
}

export class LimitedPostgresChatMessageHistory extends PostgresChatMessageHistory {
  private limit: number;

  constructor({
    sessionId,
    pool,
    tableName,
    escapeTableName,
    limit,
  }: {
    sessionId: string;
    pool: Pool;
    tableName: string;
    escapeTableName: boolean;
    limit: number;
  }) {
    super({ sessionId, pool, tableName, escapeTableName });
    this.limit = limit;
  }

  async getMessages(): Promise<BaseMessage[]> {
    const rows = await prisma.chatHistory.findMany({
      where: {
        sessionId: this.sessionId,
        messageUse: {
          in: [MessageUseTypes.BOTH, MessageUseTypes.GENERATION],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: this.limit,
    });

    const chatMessages = rows.reverse().map((row, index) => {
      const message = row.message as Prisma.JsonObject;
      const mapped = mapStoredMessageToChatMessage({
        type: message.type as string,
        data: {
          content: message.content as string,
          additional_kwargs: message.additional_kwargs as Record<string, any>,
          role: message.role as string,
          name: message.name as string,
          tool_call_id: message.tool_call_id as string,
          tool_calls: message.tool_calls as any[],
        },
      });

      // console.log(`Mapped row ${index}:`, {
      //   original: message,
      //   mapped,
      // });

      return mapped;
    });
    return chatMessages;
  }

  async addMessage(message: BaseMessage): Promise<void> {
    // Check if message content contains JSON with intent field
    const content = (message as any).content || '';
    let messageUse: MessageUseTypes = MessageUseTypes.BOTH; // Default to BOTH

    if (typeof content === 'string') {
      // Look for JSON pattern with intent field
      const jsonMatch = content.match(
        /(?:```json\s*)?\{[\s\S]*?"intent"\s*:\s*"[^"]*"[\s\S]*?\}(?:\s*```)?/
      );
      if (jsonMatch) {
        messageUse = MessageUseTypes.CHAT;
      }
    }

    await prisma.chatHistory.create({
      data: {
        sessionId: this.sessionId,
        message: {
          type: (message as any)._getType?.() || 'ai',
          content,
          additional_kwargs: (message as any).additional_kwargs || {},
          response_metadata: (message as any).response_metadata || {},
          // Save tool-related fields for tool messages
          tool_call_id: (message as any).tool_call_id,
          name: (message as any).name,
          role: (message as any).role,
          // Save tool_calls array for AI messages that invoke tools
          tool_calls: (message as any).tool_calls,
        },
        messageUse,
      },
    });
  }
}

// Common guidelines shared by all agents
const COMMON_RESPONSE_GUIDELINES = `
**RESPONSE GUIDELINES:**
- Reply in clear, friendly plain text or markdown format only—do not include code, or technical details.
- If you used tools, summarize findings conversationally.
- Give concise, direct, and positive answers.
- Keep a relaxed, optimistic, and approachable tone.
- Use positive, optimistic language that keeps Joy feeling like a solutions-oriented space.
- **CRITICAL**: Do NOT use emojis, icons, or special Unicode characters (like ✨, 🚀, 🤖, etc.) in your responses. Keep responses simple with only standard text characters, letters, numbers, and common punctuation marks.`;

const COMMON_TOOL_USAGE = `
**TOOL USAGE:**
You have access to powerful tools to help answer user questions:
- Use web_search when users ask about current trends, technologies, APIs, or need up-to-date information
- Use database query tools when users need to check existing data, projects, or documents
- Always consider if a tool can help provide better answers before responding
- **CRITICAL**: When presenting tool results to users, NEVER show raw data, code, or technical details. Always translate findings into natural, user-friendly language`;

const COMMON_INTERACTION_STYLE = `You interact with users as needed, ask proper questions before giving professional, engaging, and thoughtful replies. Keep intermediate reasoning messages brief and focused (max 2-3 sentences). Use the same language as the user request.`;

export const AgentSystemMessages: Record<string, string> = {
  PRD: `Your name is Joy and you are an expert product manager and coach. You help users create high quality product requirement documents(PRDs) by asking the right questions and gathering requirements. ${COMMON_INTERACTION_STYLE} When you have sufficient information, you will indicate that a PRD can be generated, but you will not write the actual PRD content in the chat.
${COMMON_RESPONSE_GUIDELINES}
${COMMON_TOOL_USAGE}`,
  UI_DESIGN: `You are a great UI and UX Designer. You create high quality UI design based on product description. ${COMMON_INTERACTION_STYLE}
${COMMON_RESPONSE_GUIDELINES}
${COMMON_TOOL_USAGE}`,
  PROTOTYPE: `You are an amazing fullstack engineer with design skills that understand how to build a product. You define key features based on user description, craft the design and build out the codebase. ${COMMON_INTERACTION_STYLE} Maintain project context across sessions.
${COMMON_RESPONSE_GUIDELINES}
${COMMON_TOOL_USAGE}`,
  TECH_DESIGN: `You are a strong technical lead. You are great at creating software technical design documents based on a given product requirement document. ${COMMON_INTERACTION_STYLE}
${COMMON_RESPONSE_GUIDELINES}
${COMMON_TOOL_USAGE}`,
  DEVELOPMENT_PLAN: `You are an expert scrum master. You are great at breaking down product requirements into development issues for your team. ${COMMON_INTERACTION_STYLE}
${COMMON_RESPONSE_GUIDELINES}
${COMMON_TOOL_USAGE}`,
  QA_PLAN: `You are an expert QA lead. You create a well articulated QA test plan based on product requirements. ${COMMON_INTERACTION_STYLE}
${COMMON_RESPONSE_GUIDELINES}
${COMMON_TOOL_USAGE}`,
  RELEASE_PLAN: `You are an expert Release Engineer. You instruct teams to create release plan for a given product. ${COMMON_INTERACTION_STYLE}
${COMMON_RESPONSE_GUIDELINES}
${COMMON_TOOL_USAGE}`,
  SUPPORT: `You are a great customer support advocate. You create detailed, professional support documents. ${COMMON_INTERACTION_STYLE}
${COMMON_RESPONSE_GUIDELINES}
${COMMON_TOOL_USAGE}`,
  MARKETING: `You are a great marketing person. You write well-crafted marketing documents to help with customer needs. ${COMMON_INTERACTION_STYLE}
${COMMON_RESPONSE_GUIDELINES}
${COMMON_TOOL_USAGE}`,
  SALES: `You are a professional sales person. You write well-defined sales related documents to help with customer needs. ${COMMON_INTERACTION_STYLE}
${COMMON_RESPONSE_GUIDELINES}
${COMMON_TOOL_USAGE}`,
  BUSINESS: `You are a professional business person. You write professional, business related documents. ${COMMON_INTERACTION_STYLE}
${COMMON_RESPONSE_GUIDELINES}
${COMMON_TOOL_USAGE}`,
  PRODUCT: `Your name is Joy and you are an expert product manager. You write high quality product requirement documents(PRDs). ${COMMON_INTERACTION_STYLE}
${COMMON_RESPONSE_GUIDELINES}
${COMMON_TOOL_USAGE}`,
  ENGINEERING: `You are a strong engineer. ${COMMON_INTERACTION_STYLE}
${COMMON_RESPONSE_GUIDELINES}
${COMMON_TOOL_USAGE}`,
  PROPOSAL: `You write high quality project proposal for your team or customers. ${COMMON_INTERACTION_STYLE}
${COMMON_RESPONSE_GUIDELINES}
${COMMON_TOOL_USAGE}`,
  OTHER: `You are an expert content writer. You write high quality content based on user needs. ${COMMON_INTERACTION_STYLE}
${COMMON_RESPONSE_GUIDELINES}
${COMMON_TOOL_USAGE}`,
  CHAT: `Your name is Joy and you are an expert coach for product development. You offer great insights on product, technology and process related questions. ${COMMON_INTERACTION_STYLE}
${COMMON_RESPONSE_GUIDELINES}
${COMMON_TOOL_USAGE}`,
};
