import { RedisCache } from '@langchain/community/caches/ioredis';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { RedisSingleton } from '../redis/redis';
import { OpenAIEmbeddings } from '@langchain/openai';
import { AuthenticatedUserWithProfile } from '../../types/authTypes';
import fs from 'fs';
import path from 'path';

import {
  textCollectionName,
  orgIdColName,
  processLLMEndCallback,
  getHistoryChain,
  AgentSystemMessages,
  ENABLE_LLM_LOGGING,
} from './llmUtil';
import { formatDocumentsAsString } from 'langchain/util/document';
import { QdrantVectorStore } from '@langchain/qdrant';
import { ACTIVE_CLAUDE_MODEL_ID } from './uiux/ai_utils';
import { ChatAnthropic } from '@langchain/anthropic';
import dayjs from 'dayjs';

// Read the prompt template from the file
const qaPlanTemplatePath = path.resolve(
  __dirname,
  'llm_prompts/qaPlanGenPrompt.txt'
);
const qaPlanTemplate = fs.readFileSync(qaPlanTemplatePath, 'utf-8');
// const qaPlanPrompt = PromptTemplate.fromTemplate(qaPlanTemplate);

// Run is a convenience method for chains with prompts that require one input and one output.

interface QAGenInput {
  description: string;
  additionalContextFromUserFiles: string;
}

export async function genQAPlan(
  docData: any,
  currentUser: AuthenticatedUserWithProfile
) {
  const { organizationId: orgId } = currentUser;
  const {
    type: docType,
    id: docId,
    description,
    additionalContextFromUserFiles,
    chatSessionId,
  } = docData;
  const { firstname, lastname } = currentUser;

  console.log(
    'in services.llm.qaAgent.start:',
    additionalContextFromUserFiles,
    description,
    ', genPrompt:',
    qaPlanTemplate
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
    temperature: 0,
    modelName,
    maxTokens: 40000,
    streaming: true,
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
    ['human', qaPlanTemplate],
  ]);

  // Format the input variables - let the framework handle history
  const inputVariables = {
    description,
    additionalContextFromUserFiles,
    context,
    username: `${firstname} ${lastname}`,
    currentDate: dayjs().format('MM/DD/YYYY'),
    docName: docData.name || '',
  };

  const chainWithHistory = await getHistoryChain({ prompt, model });
  const stream = await chainWithHistory.stream(inputVariables, {
    configurable: {
      sessionId: chatSessionId || '',
    },
  });
  return stream;
}
