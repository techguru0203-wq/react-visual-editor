import { RedisCache } from '@langchain/community/caches/ioredis';
import { OpenAIEmbeddings } from '@langchain/openai';
import { QdrantVectorStore } from '@langchain/qdrant';

import {
  textCollectionName,
  orgIdColName,
  processLLMEndCallback,
  pool,
  AgentSystemMessages,
  ENABLE_LLM_LOGGING,
} from './llmUtil';
import { RedisSingleton } from '../redis/redis';
import { AuthenticatedUserWithProfile } from '../../types/authTypes';
import fs from 'fs';
import path from 'path';
import { formatDocumentsAsString } from 'langchain/util/document';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { RunnableWithMessageHistory } from '@langchain/core/runnables';
import { PostgresChatMessageHistory } from '@langchain/community/stores/message/postgres';
import { ACTIVE_CLAUDE_MODEL_ID } from './uiux/ai_utils';
import { ChatAnthropic } from '@langchain/anthropic';
import dayjs from 'dayjs';

// Read the prompt template from the file
const techDesignTemplatePath = path.resolve(
  __dirname,
  'llm_prompts/techDesignGenPrompt.txt'
);
const techDesignTemplate = fs.readFileSync(techDesignTemplatePath, 'utf-8');

interface TechDesignGenInput {
  description: string;
  additionalContextFromUserFiles: string;
}

export interface TechDesignGenDocData {
  name: string;
  description: string;
  additionalContextFromUserFiles: string;
  type: string;
  id: string;
  chatSessionId?: string;
}

export async function genTechDesign(
  docData: TechDesignGenDocData,
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
    'in services.llm.genTechDesign.start:',
    additionalContextFromUserFiles,
    description,
    ', genPrompt:',
    techDesignTemplate
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
    console.log(
      'Legacy vector store not available, proceeding without context:',
      error.message
    );
  }

  // build chat model
  const modelName =
    process.env.NODE_ENV === 'development'
      ? ACTIVE_CLAUDE_MODEL_ID
      : ACTIVE_CLAUDE_MODEL_ID;
  const model = new ChatAnthropic({
    temperature: 0,
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
    ['human', techDesignTemplate],
  ]);

  const chain = prompt.pipe(model);
  const chainWithHistory = new RunnableWithMessageHistory({
    runnable: chain,
    inputMessagesKey: 'description',
    historyMessagesKey: 'history',
    getMessageHistory: (async (sessionId: string) => {
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
    }) as any,
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
    console.error('services.llm.techDesignAgent.genTechDesign:', err);
    throw err;
  }
}
