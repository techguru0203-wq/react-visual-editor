import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { OpenAIEmbeddings } from '@langchain/openai';
import { QdrantVectorStore } from '@langchain/qdrant';
import { formatDocumentsAsString } from 'langchain/util/document';
import { DocumentGenerationInput } from '../../routes/types/documentTypes';
import { AuthenticatedUserWithProfile } from '../../types/authTypes';
import {
  AgentSystemMessages,
  LimitedPostgresChatMessageHistory,
  orgIdColName,
  pool,
  processLLMEndCallback,
  textCollectionName,
} from './llmUtil';
import { ACTIVE_CLAUDE_MODEL_ID } from './uiux/ai_utils';
import { improveWebDesign } from './uiux/web_design_improver';
import { generatePages } from './uiux/web_design_main';

import { MessageLimit } from '../../../shared/constants';
import { AIMessageChunk } from '@langchain/core/messages';

export async function genUIDesignAnthropic(
  docData: DocumentGenerationInput,
  currentUser: AuthenticatedUserWithProfile
): Promise<AsyncIterable<AIMessageChunk>> {
  console.log('in services.llm.genUIDesignAnthropic.start:', docData);

  const {
    type: docType,
    id: docId,
    description: description,
    contents: designHTML,
    imageBase64,
    additionalContextFromUserFiles,
    chatSessionId,
  } = docData;

  const { organizationId: orgId } = currentUser;

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

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', AgentSystemMessages[docType as string]],
    new MessagesPlaceholder('history'),
  ]);

  // Get message history
  const messageHistory = new LimitedPostgresChatMessageHistory({
    sessionId: chatSessionId || '',
    pool,
    tableName: 'chatHistories',
    escapeTableName: true,
    limit: MessageLimit, // Adjust as needed
  });

  // Get previous messages
  const historyMessages = await messageHistory.getMessages();

  // Format the input variables
  const inputVariables = {
    additionalContextFromUserFiles,
    context,
    previousDocument: designHTML,
    history: historyMessages,
  };

  // Generate the formatted prompt
  const formattedPrompt = await prompt.formatMessages(inputVariables);

  // Now you have the formatted prompt that you can use directly
  // console.log('Formatted prompt:', formattedPrompt);

  let callBackFunc = async (output: any) => {
    processLLMEndCallback(output, ACTIVE_CLAUDE_MODEL_ID, {
      currentUser,
      docId,
      docType,
      streamingMode: true,
    });
  };
  try {
    if (designHTML) {
      console.log('in services.llm.genUIDesignAnthropic: designHTML exists');
      return await improveWebDesign(
        description,
        designHTML,
        callBackFunc,
        formattedPrompt
      );
    } else {
      console.log(
        'in services.llm.genUIDesignAnthropic: designHTML does not exist'
      );
      return await generatePages(
        additionalContextFromUserFiles as string,
        true,
        description,
        imageBase64,
        callBackFunc,
        formattedPrompt
      );
    }
  } catch (err) {
    console.error('services.llm.genUIDesignAnthropic.run:', err);
    throw err;      
  }
}
