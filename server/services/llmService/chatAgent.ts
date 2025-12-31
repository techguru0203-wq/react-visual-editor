import {
  Access,
  ChatSessionTargetEntityType,
  DOCTYPE,
  MessageUseTypes,
  RecordStatus,
} from '@prisma/client';
import prisma from '../../db/prisma';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import {
  AgentSystemMessages,
  processLLMEndCallback,
  LimitedPostgresChatMessageHistory,
  pool,
} from './llmUtil';
import { AuthenticatedUserWithProfile } from '../../types/authTypes';
import { extractJsonObject } from '../../lib/util';
import MixPanel from '../trackingService';
import { FileContent } from '../../routes/types/documentTypes';
import { createStreamingGPTModel } from './streamingUtil';
import { llmDebugLog, ENABLE_LLM_LOGGING } from './llmUtil';
import {
  ACTIVE_CLAUDE_MODEL_ID,
  ACTIVE_OPENAI_MODEL_ID_DEV,
  ACTIVE_OPENAI_MODEL_ID_PROD,
} from './uiux/ai_utils';
import { ChatAnthropic } from '@langchain/anthropic';
import { globalToolRegistry, initializeToolRegistry } from './tools/registry';
import { toLangChainTools } from './tools/registry/toolAdapter';
import { MessageLimit } from '../../../shared/constants';
import { getConnectorsForDocument } from '../connectorService';
import { registerConnectorTools } from './tools/registry/connectorToolsRegistry';

// Initialize tool registry
initializeToolRegistry();

/**
 * Save user message to database
 * @param sessionId - Chat session ID
 * @param content - Message content
 */
async function saveUserMessage(
  sessionId: string,
  content: string
): Promise<void> {
  await prisma.chatHistory.create({
    data: {
      sessionId: sessionId,
      message: {
        type: 'human',
        content: content,
      },
      messageUse: MessageUseTypes.BOTH,
    },
  });
  console.log(`[ChatHistory] Saved user message to session: ${sessionId}`);
}

/**
 * Save AI response to database
 * @param sessionId - Chat session ID
 * @param content - AI response content
 * @param additionalKwargs - Additional metadata
 * @param responseMetadata - Response metadata
 */
async function saveAIMessage(
  sessionId: string,
  content: string,
  additionalKwargs?: any,
  responseMetadata?: any
): Promise<void> {
  await prisma.chatHistory.create({
    data: {
      sessionId: sessionId,
      message: {
        type: 'ai',
        content: content,
        additional_kwargs: additionalKwargs || {},
        response_metadata: responseMetadata || {},
      },
      messageUse: MessageUseTypes.BOTH,
    },
  });
  console.log(`[ChatHistory] Saved AI message to session: ${sessionId}`);
}

export interface GetOrCreateChatSessionInput {
  name: string;
  userId: string;
  userEmail: string;
  chatContent: string;
  targetEntityId: string;
  targetEntityType: string;
  targetEntitySubType: string;
}

export interface CreateChatSessionInput {
  name: string;
  access: string;
  userId: string;
  userEmail: string;
  targetEntityId: string;
  targetEntityType: string;
  targetEntitySubType: string;
}

export interface GenerateChatResponseInput {
  chatContent: string;
  sessionId: string;
  currentUser: AuthenticatedUserWithProfile;
  docId: string;
  targetEntityType: string; // DOCUMENT, OR PROJECT ETC.
  docType: string;
  uploadedFileContent: FileContent[];
  chosenDocumentIds: string;
  previousDocument: string;
  handleStreamToken?: (token: string) => void;
}

export async function generateChatResponse({
  chatContent,
  sessionId,
  currentUser,
  docId,
  docType,
  uploadedFileContent,
  chosenDocumentIds,
  previousDocument,
}: GenerateChatResponseInput) {
  docType = docType || 'CHAT';
  console.log(
    'llmServices.chatAgent.generateChatResponse:',
    docId,
    docType,
    chatContent,
    sessionId
  );

  // build chat model
  const modelName =
    process.env.NODE_ENV === 'development'
      ? ACTIVE_CLAUDE_MODEL_ID
      : ACTIVE_CLAUDE_MODEL_ID;
  const model = new ChatAnthropic({
    modelName,
    temperature: 0,
    verbose: ENABLE_LLM_LOGGING,
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

  const hasImage = uploadedFileContent.some(
    (item) => item.fileType === 'image'
  );

  const previousDocumentExists = previousDocument.length > 0 ? 'true' : '';
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', `${AgentSystemMessages[docType as string]}`],
    new MessagesPlaceholder('history'),
    [
      'human',
      docType === DOCTYPE.PROTOTYPE || docType === DOCTYPE.PRODUCT
        ? ` 
      Analyze the following user request to determine if the user's intent is to create/update an app, or ask for more information. Return the output in JSON format by following the instructions below:

      **CRITICAL LINKED DOCUMENT HANDLING:**
      - If 'linked_document' below is not empty, a linked PRD document exists with complete product specifications
      - The linked PRD contains all necessary information: target audience, features, requirements, user stories, etc.
      - **ABSOLUTELY DO NOT ask questions about product details when a linked PRD exists**
      - **ALWAYS proceed to app generation when a linked PRD is provided**
      - Use the information from the linked PRD to understand the product requirements

      **INTENT DECISION RULES:**
      - if the user is seeking information, asking casual questions, or you need to clarify questions with the user, set JSON property "intent" to "REPLY", property "message" to your complete reply to the user.
      - if the user wants to create or update an app, set JSON property "intent" to "DOCUMENT", property "message" to a message that mentions the app is being generated.
      - CRITICAL CODE MODIFICATION DETECTION: if the user asks to add/enable/implement/install/setup/integrate/configure any feature or library (e.g., "integrate stripe payment", "add payments", "接入/集成/安装 支付/Stripe/结账/订阅"), ALWAYS set "intent" to "DOCUMENT" so code changes can be applied.
      - **CRITICAL**: If 'linked_document' below is not empty AND user is requesting initial app creation, set "intent" to "DOCUMENT" immediately - do not ask any questions
      - **CRITICAL**: If the app already exists (conversation history shows app was generated), ONLY set "intent" to "DOCUMENT" when user explicitly requests changes/updates/features. Simple greetings or questions should return "REPLY".
      - If the user explicitly mentions modifying/updating/changing the existing code, codebase or app, set JSON property "intent" to "DOCUMENT", property "message" to a message that mentions the app is being updated.
      - **FEATURE/INTEGRATION DETECTION**: If the user requests to add/implement/integrate/install/setup a feature (e.g., authentication, payments/Stripe, APIs), set JSON property "intent" to "DOCUMENT", property "message" to a message that mentions the feature is being added to the app.
      - If user request involves changing something related to an uploaded/attached image, and <has_image> tag below is set to true, then set JSON property "intent" to "DOCUMENT" with a proper message. Otherwise, set "intent" to "REPLY" with message to remind user to attach image.
      - **NEVER ask product questions when a linked PRD document exists AND it's initial app creation**
      - **CRITICAL**: Do NOT use emojis, icons, or special Unicode characters (like ✨, 🚀, 🤖, etc.) in your "message" field. Keep responses simple with only standard text characters, letters, numbers, and common punctuation marks.
      
      **NOTE:** The linked_document IDs below are for reference only. Database tools automatically use the current document's database.
      
      <has_image>{hasImage}</has_image>
      <user_request>{userInput}</user_request>
      <linked_document>{chosenDocumentIds}</linked_document>
      `
        : ` 
      Analyze the following user request to determine if the user's intent is to create/update a document, or ask for more information. Return the output in JSON format by following the instructions below:
      **CRITICAL SUFFICIENT INFORMATION CRITERIA FOR PRD:**
      - **CONSIDER FULL CONVERSATION HISTORY**: Analyze the entire conversation context, not just the current message
      - If the user has provided ANY of the following (in current message OR previous messages), consider information sufficient and proceed to document generation:
        * Target audience (e.g., "daily commuters", "elderly drivers", "delivery drivers")
        * Core problem (e.g., "forgetting turns", "finding optimal routes", "remembering routes")
        * Key features (e.g., "route recommendation", "voice reminders", "offline access")
        * Business goals (e.g., "user engagement", "reduced travel time", "monetization")
      - If the user has provided 2 or more of these elements (across the entire conversation), ALWAYS proceed to document generation
      - If the user has provided 1 element AND additional context, proceed to document generation
      - **CRITICAL**: If the user has answered previous questions in the conversation history, consider that information when making intent decisions

      **INTENT DECISION RULES:**
      - if the user is seeking information, asking casual questions (e.g., "hi", "hello", "how are you"), or you need to clarify questions with the user, set JSON property "intent" to "REPLY", property "message" to your complete reply to the user.
      - if the user wants to create or update a document and has provided sufficient information (see criteria above), set JSON property "intent" to "DOCUMENT", property "message" to a message that mentions the document is being generated.
      - CRITICAL CODE MODIFICATION DETECTION: when the user requests changes to the application/codebase or to add/enable/implement/install/setup/integrate/configure features (e.g., payments/Stripe/checkout/订阅/支付), ALWAYS set "intent" to "DOCUMENT" so the system can modify code accordingly.
      - ONLY ask clarifying questions if the work description is completely unclear AND missing ALL essential information.
      - If the user has provided a clear work description with any target audience, problem, features, or goals, proceed directly to document generation.
      - **CRITICAL**: If a document already exists (previous_document_exists is true), ONLY set "intent" to "DOCUMENT" when user explicitly requests changes/updates. Simple greetings or questions should return "REPLY".
      - **NEVER mention internal technical details** like appGenState, framework names, or implementation details to the user
      - **NEVER expose technology stack** like "Next.js", "React", "Vercel", "Node.js" in user-facing messages
      - **ONLY mention user-facing features and functionality** in responses
      - **CRITICAL**: Do NOT use emojis, icons, or special Unicode characters (like ✨, 🚀, 🤖, etc.) in your "message" field. Keep responses simple with only standard text characters, letters, numbers, and common punctuation marks.
      - **CRITICAL**: If the user has answered previous questions and provided additional information, proceed to document generation.
      - **CRITICAL**: When linked_document exists AND it's initial document creation (no previous_document_exists), proceed to document generation. But if previous_document_exists is true, only regenerate when user explicitly requests changes.
      - **CRITICAL**: NEVER include the actual document content in your response. Only return the JSON with intent and message. The document generation will be handled separately.
      - If the user request or assistant reply indicates creating/updating an app/document, or adding/installing/integrating/configuring a feature/library, intent = "DOCUMENT".
      - If the assistant reply already perfectly answers the user request, intent = "REPLY" and "message" must be exactly the assistant reply (return it directly to the user).

      **NOTE:** The linked_document IDs below are for reference only. Database tools automatically use the current document's database.

      <has_image>{hasImage}</has_image>
      <user_request>{userInput}</user_request>
      <additional_context>{additionalContextFromUserFiles}</additional_context>
      <linked_document>{chosenDocumentIds}</linked_document>
      <previous_document_exists>{previousDocumentExists}</previous_document_exists>
      `,
    ],
  ]);

  let additionalContextFromUserFiles = '';

  if (uploadedFileContent.length > 0) {
    uploadedFileContent.forEach((item) => {
      if (item.fileType !== 'image') {
        additionalContextFromUserFiles += item.fileContent + '\n';
      }
    });
  }

  console.log(
    'in chatAgent.generateChatResponse:',
    additionalContextFromUserFiles
  );

  // Build formatted prompt with system, history, and variables
  const historyStore = new LimitedPostgresChatMessageHistory({
    sessionId,
    pool,
    tableName: 'chatHistories',
    escapeTableName: true,
    limit: MessageLimit,
  });
  const historyMessages = await historyStore.getMessages();

  let messages: any[] = await prompt.formatMessages({
    history: historyMessages,
    userInput: chatContent,
    hasImage: hasImage ? 'true' : '',
    additionalContextFromUserFiles,
    chosenDocumentIds,
    previousDocumentExists,
  });

  // Save current user message to database (after building messages to avoid duplication)
  await saveUserMessage(sessionId, chatContent);

  // Invoke the model directly to get the response
  const response = await model.invoke(messages);
  const responseContent = response.content as string;

  // Parse JSON from response
  const json = extractJsonObject(responseContent);

  // Validate JSON format - must have intent and message fields
  if (
    json &&
    typeof json === 'object' &&
    'intent' in json &&
    'message' in json &&
    (json.intent === 'DOCUMENT' || json.intent === 'REPLY')
  ) {
    // Save AI response to database
    await saveAIMessage(
      sessionId,
      responseContent,
      response.additional_kwargs,
      response.response_metadata
    );
    return json;
  }

  // Invalid JSON format - return default error response
  const defaultResponse = {
    intent: 'REPLY' as const,
    message: 'There is a network hiccup. Please resend you message',
  };

  // Save AI response to database
  await saveAIMessage(
    sessionId,
    responseContent,
    response.additional_kwargs,
    response.response_metadata
  );

  return defaultResponse;
}

// generate full chat response with streaming
export async function generateStreamingChatResponse({
  chatContent,
  sessionId,
  currentUser,
  docId,
  docType,
  uploadedFileContent,
  chosenDocumentIds,
  handleStreamToken,
}: GenerateChatResponseInput) {
  docType = docType || 'CHAT';
  console.log(
    'llmServices.chatAgent.generateStreamingChatResponse:',
    docId,
    docType,
    chatContent,
    sessionId,
    'streaming:',
    !!handleStreamToken
  );

  // Load and register connector tools if docId is available
  if (docId) {
    try {
      const connectors = await getConnectorsForDocument(docId, 'preview');
      const previewConnectors = connectors.preview || [];

      if (previewConnectors.length > 0) {
        await registerConnectorTools(previewConnectors);
        console.log(
          `[ChatAgent Streaming] Registered tools for ${previewConnectors.length} connector(s)`
        );
      }
    } catch (error) {
      console.log(
        '[ChatAgent Streaming] Could not load connector tools:',
        error
      );
    }
  }

  // Get all registered tools and convert to LangChain format
  const registeredTools = globalToolRegistry.list();
  const langchainTools = toLangChainTools(registeredTools);
  console.log(
    `[ChatAgent Streaming] Using ${registeredTools.length} tools:`,
    registeredTools.map((t) => t.name)
  );

  // build chat model using shared utility
  const modelName =
    process.env.NODE_ENV === 'development'
      ? ACTIVE_OPENAI_MODEL_ID_DEV
      : ACTIVE_OPENAI_MODEL_ID_PROD;
  let callBackFunc = async (output: any) => {
    llmDebugLog('chatAgent.generateStreamingChatResponse.callback:', output);
    processLLMEndCallback(output, modelName, {
      currentUser,
      docId,
      docType,
      streamingMode: true,
    });
  };
  const model = createStreamingGPTModel(
    {
      modelName,
      currentUser,
      docId,
      docType,
    },
    {
      onLLMEnd: callBackFunc,
    }
  ).bindTools(langchainTools);

  // Process uploaded files and chosen documents
  let additionalContextFromUserFiles = '';

  if (uploadedFileContent.length > 0) {
    uploadedFileContent.forEach((item) => {
      if (item.fileType !== 'image') {
        additionalContextFromUserFiles += item.fileContent + '\n';
      }
    });
  }

  if (chosenDocumentIds.trim() !== '') {
    const ids = chosenDocumentIds.split(',').map((idStr) => idStr.trim());
    const docs = await prisma.document.findMany({
      where: {
        id: {
          in: ids,
        },
      },
      select: {
        content: true,
        description: true,
      },
    });
    const docDescription =
      docs.length >= 1
        ? docs
            .map((item) => item.content?.toString('utf-8') as string)
            .join(',')
        : '';

    additionalContextFromUserFiles += docDescription + '\n';
    console.log('docDescription: ', docDescription);
  }

  console.log(
    'in chatAgent.generateStreamingChatResponse:',
    additionalContextFromUserFiles
  );

  const hasImage = uploadedFileContent.some(
    (item) => item.fileType === 'image'
  );

  // Build streaming prompt from template with history and variables
  const streamPrompt = ChatPromptTemplate.fromMessages([
    ['system', `${AgentSystemMessages[docType as string]}`],
    new MessagesPlaceholder('history'),
    [
      'human',
      `Analyze the user request below and create a detailed, professional reply using any helpful tools when beneficial.

<has_image>{hasImage}</has_image>
<user_request>{userInput}</user_request>
<additional_context>{additionalContextFromUserFiles}</additional_context>
<linked_document>{chosenDocumentIds}</linked_document>`,
    ],
  ]);

  const historyStore = new LimitedPostgresChatMessageHistory({
    sessionId,
    pool,
    tableName: 'chatHistories',
    escapeTableName: true,
    limit: MessageLimit,
  });
  const historyMessages = await historyStore.getMessages();

  let messages: any[] = await streamPrompt.formatMessages({
    history: historyMessages,
    userInput: chatContent,
    hasImage: hasImage ? 'true' : '',
    additionalContextFromUserFiles,
    chosenDocumentIds,
  });

  // Save current user message to database (after building messages to avoid duplication)
  await saveUserMessage(sessionId, chatContent);

  // Tool calling loop for streaming mode
  const MAX_TOOL_ITERATIONS = 40;
  let iteration = 0;
  let finalResult = '';
  let toolContext = {
    docId: docId,
    userId: currentUser.userId,
    organizationId: currentUser.organizationId || '',
  };

  while (iteration < MAX_TOOL_ITERATIONS) {
    iteration++;
    console.log(
      `[ChatAgent Streaming] Iteration ${iteration}/${MAX_TOOL_ITERATIONS}`
    );

    // Check if the model wants to call a tool (invoke once to check)
    const checkResult = await model.invoke(messages);

    console.log('[ChatAgent Streaming] AI Response:', checkResult);

    const toolCalls =
      checkResult.tool_calls || checkResult.additional_kwargs?.tool_calls;

    if (!toolCalls || toolCalls.length === 0) {
      // No tool calls, stream the final response
      console.log(
        '[ChatAgent Streaming] No tool calls, streaming final response'
      );

      // Stream the response using the same messages array (real streaming)
      const stream = await model.stream(messages);

      for await (const chunk of stream) {
        const content = typeof chunk.content === 'string' ? chunk.content : '';
        finalResult += content;
        handleStreamToken && handleStreamToken(content);
      }

      // Save AI response to database (using shared utility)
      await saveAIMessage(
        sessionId,
        finalResult,
        checkResult.additional_kwargs,
        checkResult.response_metadata
      );

      break;
    }

    console.log(
      `[ChatAgent Streaming] Processing ${toolCalls.length} tool call(s)`
    );

    // Notify user that tools are being executed
    if (handleStreamToken) {
      handleStreamToken(`\n🔧 Using tools...\n`);
    }

    // Add AI message with tool calls to in-memory messages
    messages.push({
      role: 'assistant',
      content: checkResult.content || '',
      tool_calls: toolCalls,
      additional_kwargs: checkResult.additional_kwargs || {},
    });

    // Execute all tool calls and add results to in-memory messages
    for (const toolCall of toolCalls) {
      const toolName = (toolCall as any).name;
      const toolArgs = (toolCall as any).args || {};

      console.log(
        `[ChatAgent Streaming] Executing tool: ${toolName}`,
        toolArgs
      );

      if (handleStreamToken) {
        handleStreamToken(`\n• Calling: ${toolName}\n`);
      }

      // Execute tool using our registry
      const toolResult = await globalToolRegistry.invoke(
        toolName,
        toolArgs,
        toolContext
      );

      console.log(`[ChatAgent Streaming] Tool result:`, toolResult);

      if (handleStreamToken) {
        const statusIcon = toolResult.success ? '✓' : '✗';
        handleStreamToken(`${statusIcon} ${toolName} completed\n`);
      }

      // Add tool message to in-memory messages only (not saved to database)
      messages.push({
        role: 'tool',
        content: toolResult.success
          ? JSON.stringify(toolResult.output)
          : `Error: ${toolResult.error?.message || 'Unknown error'}`,
        tool_call_id: toolCall.id,
        name: toolName,
      });
    }
  }

  if (iteration >= MAX_TOOL_ITERATIONS) {
    console.warn('[ChatAgent Streaming] Reached max tool iterations');
    if (handleStreamToken) {
      handleStreamToken('\n⚠️ Maximum tool call iterations reached\n');
    }
  }

  console.log(
    'llmServices.chatAgent.generateStreamingChatResponse.result:',
    finalResult
  );
  return finalResult;
}

export async function getOrCreateChatSession(
  input: GetOrCreateChatSessionInput
) {
  const {
    name,
    userId,
    userEmail,
    chatContent,
    targetEntityId,
    targetEntityType,
    targetEntitySubType,
  } = input;
  console.log(
    'services.llmService.chatAgent:',
    name,
    userId,
    userEmail,
    chatContent,
    targetEntityId,
    targetEntityType,
    targetEntitySubType
  );
  // Check for an existing active session for the user
  const existingSession = await prisma.chatSession.findFirst({
    where: {
      userId,
      targetEntityId,
      status: RecordStatus.ACTIVE,
    },
    orderBy: { updatedAt: 'desc' }, // Get the latest session
  });

  if (existingSession) {
    console.log(
      'services.llmService.chat.existingSession.found:',
      existingSession.id
    );
    return existingSession;
  }

  // No active session found, create a new one
  const newSession = await prisma.chatSession.create({
    data: {
      name,
      userId,
      targetEntityId,
      targetEntityType: targetEntityType as ChatSessionTargetEntityType,
    },
  });
  // track unique chat session
  MixPanel.track('ChatSession', {
    distinct_id: newSession.id,
    name,
    userId,
    userEmail,
    chatContent,
    targetEntitySubType,
    targetEntityId,
  });

  console.log(
    'llmService.chat.getOrCreateChatSession:',
    targetEntityId,
    newSession.id
  );
  return newSession;
}

export async function createChatSession(input: CreateChatSessionInput) {
  const {
    name,
    access,
    userId,
    userEmail,
    targetEntityId,
    targetEntityType,
    targetEntitySubType,
  } = input;
  console.log(
    'services.llmService.chatAgent:',
    name,
    access,
    userId,
    userEmail,
    targetEntityId,
    targetEntityType,
    targetEntitySubType
  );

  // No active session found, create a new one
  const newSession = await prisma.chatSession.create({
    data: {
      name,
      access: (access || Access.SELF) as Access,
      userId,
      targetEntityId,
      targetEntityType: targetEntityType as ChatSessionTargetEntityType,
    },
  });
  // track unique chat session
  MixPanel.track('ChatSession', {
    distinct_id: newSession.id,
    name,
    userId,
    userEmail,
    targetEntitySubType,
    targetEntityId,
  });

  console.log('services.llmService.chat.createChatSession:', newSession.id);
  return newSession;
}
