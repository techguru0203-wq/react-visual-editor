import { RedisCache } from '@langchain/community/caches/ioredis';
import { OpenAIEmbeddings } from '@langchain/openai';
import { RedisSingleton } from '../redis/redis';
import { AuthenticatedUserWithProfile } from '../../types/authTypes';
import {
  orgIdColName,
  processLLMEndCallback,
  pool,
  textCollectionName,
  AgentSystemMessages,
  ENABLE_LLM_LOGGING,
} from './llmUtil';
import fs from 'fs';
import path from 'path';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { RunnableWithMessageHistory } from '@langchain/core/runnables';
import { PostgresChatMessageHistory } from '@langchain/community/stores/message/postgres';
import { QdrantVectorStore } from '@langchain/qdrant';
import { formatDocumentsAsString } from 'langchain/util/document';
import { ChatAnthropic } from '@langchain/anthropic';
import { ACTIVE_CLAUDE_MODEL_ID } from './uiux/ai_utils';
import dayjs from 'dayjs';

const releasePlanTemplatePath = path.resolve(
  __dirname,
  'llm_prompts/releasePlanGenPrompt.txt'
);
const releasePlanTemplate = fs.readFileSync(releasePlanTemplatePath, 'utf-8');

interface releaseGenInput {
  description: string;
  additionalContextFromUserFiles: string;
  chatSessionId?: string;
}

export async function genReleasePlan(
  docData: any,
  currentUser: AuthenticatedUserWithProfile
) {
  const { organizationId: orgId } = currentUser;
  const { firstname, lastname } = currentUser;
  const {
    type: docType,
    id: docId,
    description,
    additionalContextFromUserFiles,
    chatSessionId,
  } = docData;

  console.log(
    'in services.llm.releasePlanAgent.start:',
    additionalContextFromUserFiles,
    description,
    ', genPrompt:',
    releasePlanTemplate
  );

  // Try to retrieve context from legacy vector store, fallback to empty string if not available
  let context = '';
  try {
    const vectorStore = await QdrantVectorStore.fromExistingCollection(
      new OpenAIEmbeddings(),
      {
        url: process.env.QDRANT_DATABASE_URL,
        apiKey: process.env.QDRANT_API_KEY,
        collectionName: textCollectionName,
      }
    );
    const retriever = vectorStore.asRetriever({
      filter: {
        must: [
          {
            key: orgIdColName,
            match: { value: orgId },
          },
        ],
      },
    });
    context = await retriever.invoke(description).then(formatDocumentsAsString);
    console.log('Successfully retrieved context from legacy vector store');
  } catch (error) {
    console.log('Legacy vector store not available, proceeding without context:', error.message);
  }

  // build chat model
  const modelName =
    process.env.NODE_ENV === 'development'
      ? ACTIVE_CLAUDE_MODEL_ID
      : ACTIVE_CLAUDE_MODEL_ID;
  const model = new ChatAnthropic({
    // temperature: 0,
    modelName,
    maxTokens: 40000,
    verbose: ENABLE_LLM_LOGGING,
    cache: new RedisCache(RedisSingleton.getClient()) as any,
    clientOptions: {
      defaultHeaders: {
        'X-Api-Key': process.env.ANTHROPIC_API_KEY as string,
      },
    },
    callbacks: [
      {
        handleLLMEnd: async (output) => {
          processLLMEndCallback(output.llmOutput, modelName, {
            currentUser,
            docId,
            docType,
          });
        },
      },
    ],
  });

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', AgentSystemMessages[docType as string]],
    new MessagesPlaceholder('history'),
    ['human', releasePlanTemplate],
  ]);

  const chain = prompt.pipe(model);
  const chainWithHistory = new RunnableWithMessageHistory({
    runnable: chain,
    inputMessagesKey: 'description',
    historyMessagesKey: 'history',
    getMessageHistory: async (sessionId) => {
      const chatHistory = new PostgresChatMessageHistory({
        sessionId,
        pool,
        tableName: 'chatHistories',
        escapeTableName: true,
      });
      // TODO: fix below in a more elegant way since PostgresChatMessageHistory auto add message
      chatHistory.addMessage = async (message) => {
        return;
      };
      return chatHistory;
    },
  });

  try {
    const stream = await chainWithHistory.stream(
      {
        description,
        additionalContextFromUserFiles,
        context,
        username: `${firstname} ${lastname}`,
        currentDate: dayjs().format('MM/DD/YYYY'),
        docName: docData.name || '',
      },
      {
        configurable: {
          sessionId: chatSessionId,
        },
      }
    );
    return stream;
  } catch (err) {
    console.error('services.llm.releasePlanAgent.genReleasePlan:', err);
    throw err;
  }
}
