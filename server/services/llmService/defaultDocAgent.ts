import { RedisCache } from '@langchain/community/caches/ioredis';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { QdrantVectorStore } from '@langchain/qdrant';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { RunnableWithMessageHistory } from '@langchain/core/runnables';
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
import { PostgresChatMessageHistory } from '@langchain/community/stores/message/postgres';
import {
  ACTIVE_OPENAI_MODEL_ID_DEV,
  ACTIVE_OPENAI_MODEL_ID_PROD,
} from './uiux/ai_utils';

// Read the prompt template from the file
const DefaultDocGenTemplatePath = path.resolve(
  __dirname,
  'llm_prompts/defaultDocGenPrompt.txt'
);
const defaultDocGenTemplate = fs.readFileSync(
  DefaultDocGenTemplatePath,
  'utf-8'
);

export interface DefaultDocGenInput {
  description: string;
  context: string;
  promptText: string;
  additionalContextFromUserFiles: string;
}

export interface GenDefaultDocData {
  chatSessionId?: string;
  description: string;
  additionalContextFromUserFiles: string;
  promptText: string;
  type: string;
  docId?: string;
  templateDocId?: string;
}
export async function genDefaultDoc(
  docData: GenDefaultDocData,
  currentUser: AuthenticatedUserWithProfile
) {
  const {
    chatSessionId,
    description,
    docId,
    templateDocId,
    type: docType,
    promptText,
    additionalContextFromUserFiles,
  } = docData;
  const { organizationId: orgId } = currentUser;
  console.log(
    'in services.llm.defaultDocGen.genDefaultDoc.start:',
    description,
    ', orgId:',
    orgId,
    ', promptText:',
    promptText,
    ', genPrompt:',
    defaultDocGenTemplate
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
      ? ACTIVE_OPENAI_MODEL_ID_DEV
      : ACTIVE_OPENAI_MODEL_ID_PROD;
  const model = new ChatOpenAI({
    // temperature: 0, // o4-mini doesn't support temperature as 0
    modelName,
    maxTokens: -1,
    verbose: ENABLE_LLM_LOGGING,
    cache: new RedisCache(RedisSingleton.getClient()) as any,
    callbacks: [
      {
        handleLLMEnd: async (output) => {
          processLLMEndCallback(output.llmOutput, modelName, {
            currentUser,
            docId,
            templateDocId,
            docType,
          });
        },
      },
    ],
  });

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', AgentSystemMessages[docType as string]],
    new MessagesPlaceholder('history'),
    ['human', defaultDocGenTemplate],
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
        promptText,
      },
      {
        configurable: {
          sessionId: chatSessionId,
        },
      }
    );
    return stream;
  } catch (err) {
    console.error('services.llm.defaultDocGen.genDefaultDoc:', err);
    throw err;
  }
}
