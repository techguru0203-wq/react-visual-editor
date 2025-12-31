import { RedisCache } from '@langchain/community/caches/ioredis';
import { OpenAIEmbeddings } from '@langchain/openai';
import { QdrantVectorStore } from '@langchain/qdrant';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import {
  textCollectionName,
  orgIdColName,
  processLLMEndCallback,
  AgentSystemMessages,
  getHistoryChain,
} from './llmUtil';
import { ENABLE_LLM_LOGGING } from '../../lib/constant';
import { RedisSingleton } from '../redis/redis';
import { AuthenticatedUserWithProfile } from '../../types/authTypes';

import fs from 'fs';
import path from 'path';
import { formatDocumentsAsString } from 'langchain/util/document';

import { ACTIVE_CLAUDE_MODEL_ID } from './uiux/ai_utils';
import { ChatAnthropic } from '@langchain/anthropic';
import dayjs from 'dayjs';

// Read the prompt template from the file
const prdTemplatePath = path.resolve(__dirname, 'llm_prompts/prdGenPrompt.txt');
const prdTemplate = fs.readFileSync(prdTemplatePath, 'utf-8');

export interface PRDGenInput {
  description: string;
  context: string;
  additionalContextFromUserFiles: string;
}

export interface PRDGenDocData {
  name: string;
  description: string;
  additionalContextFromUserFiles: string;
  designReference?: string;
  type: string;
  id: string;
  chatSessionId?: string;
  contents: string;
}

export async function genPRD(
  docData: PRDGenDocData,
  currentUser: AuthenticatedUserWithProfile
) {
  const {
    description,
    id: docId,
    type: docType,
    additionalContextFromUserFiles,
    designReference,
    chatSessionId,
    contents,
    name,
  } = docData;
  const { organizationId: orgId, firstname, lastname } = currentUser;

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
      error instanceof Error ? error.message : String(error)
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

  // Get current date for system message and prompt
  const currentDate = dayjs().format('MM/DD/YYYY');

  // Add current date to system message to prevent hallucination
  const systemMessage = `${AgentSystemMessages[docType as string]}

**Current Date: ${currentDate}**
**IMPORTANT: Use this current date information when generating the PRD. Do not make up dates or use outdated information.**`;

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', systemMessage],
    new MessagesPlaceholder('history'),
    ['human', prdTemplate],
  ]);

  // Format the input variables - let the framework handle history
  const inputVariables = {
    // set userInput to empty string to avoid history chain
    // userInput: '', // this has been set to empty string to avoid chat history being entered additional unnecessary chats including empty human input n also the PRD itself
    description,
    additionalContextFromUserFiles,
    designReference: designReference,
    context,
    previousDocument: contents,
    username: `${firstname} ${lastname}`,
    currentDate: currentDate,
    projectName: name.split(' - ')[1] || name,
  };

  const chainWithHistory = await getHistoryChain({ prompt, model });
  const stream = await chainWithHistory.stream(inputVariables, {
    configurable: {
      sessionId: chatSessionId || '',
    },
  });

  return stream;
}
