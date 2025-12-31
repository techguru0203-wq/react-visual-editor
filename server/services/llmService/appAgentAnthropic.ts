import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { OpenAIEmbeddings } from '@langchain/openai';
import { QdrantVectorStore } from '@langchain/qdrant';
import { formatDocumentsAsString } from 'langchain/util/document';
import { MessageLimit } from '../../../shared/constants';
import { AuthenticatedUserWithProfile } from '../../types/authTypes';
import {
  AgentSystemMessages,
  LimitedPostgresChatMessageHistory,
  orgIdColName,
  pool,
  textCollectionName,
  processLLMEndCallback,
} from './llmUtil';
import {
  renderTemplate,
  ACTIVE_CLAUDE_CHEAPER_MODEL_ID,
} from './uiux/ai_utils';

import * as path from 'path';
import dayjs from 'dayjs';
import {
  BaseMessage,
  HumanMessage,
  AIMessageChunk,
  SystemMessage,
} from '@langchain/core/messages';
import { createStreamingClaudeModel } from './streamingUtil';
import { DOCTYPE } from '@prisma/client';
import { getConnectorsForDocument } from '../connectorService';
// Add enum for app generation states
export enum AppGenState {
  STARTER = 'starter',
  FIX = 'fix',
  IMPROVE = 'improve',
}

// Interface for image data containing both visual content and URL reference
export interface ImageData {
  base64DataUrl: string; // Base64 data URL for LLM to view the image
  publicUrl?: string; // S3 public URL for code generation reference
}

// Interface for buildInitialMessages parameters
export interface BuildInitialMessagesParams {
  // Core parameters required for all states
  appGenState: AppGenState;
  docId: string;
  docType: string;
  currentUser: AuthenticatedUserWithProfile;
  chatSessionId: string | undefined;

  // Optional media/reference content
  refImage: string | null;
  imageData?: ImageData[]; // Images with base64 for viewing + optional S3 URL for code reference

  // Code-related parameters
  starterCode: string; // Required for STARTER state, empty string for others
  availableFiles: string[]; // Required for IMPROVE/FIX states, empty array for STARTER
  readmeContent: string; // Required for IMPROVE/FIX states, empty string for STARTER

  // Framework selection
  framework?: 'expressjs' | 'nextjs'; // Default to 'expressjs' if not specified
  envSettings: any;

  // Extracted context for separate handling
  defaultDesignStyle?: string;
  prdContent?: string;
}

type ThinkingPlanBillingContext = {
  currentUser: AuthenticatedUserWithProfile;
  docId: string;
  docType: string;
};

// Helper function to enhance system prompt with feature module context
async function enhanceSystemPromptWithFeatureModule(
  baseSystemPrompt: string,
  featureModuleContent?: string
): Promise<string> {
  if (!featureModuleContent) {
    return baseSystemPrompt;
  }

  return (
    baseSystemPrompt +
    `\n\n## 🔧 FEATURE MODULE INSTRUCTIONS\n${featureModuleContent}`
  );
}

// Helper function to build connector context for LLM
function buildConnectorContext(connectors: any[]): string {
  const envVarsList: string[] = [];
  const descriptions: string[] = [];

  for (const connector of connectors) {
    if (connector.type === 'app') {
      const appName = connector.name || connector.provider;
      descriptions.push(
        `- **${appName}**: ${connector.description || 'OAuth app connector'}`
      );
      envVarsList.push(`${connector.provider.toUpperCase()}_ACCESS_TOKEN`);
    } else if (connector.type === 'custom_api') {
      descriptions.push(
        `- **${connector.name}**: ${
          connector.description || 'Custom API connector'
        }`
      );
      const envVars = Object.keys(connector.envVars || {});
      envVarsList.push(...envVars);
    } else if (connector.type === 'mcp') {
      descriptions.push(
        `- **${connector.name}** (MCP): ${
          connector.description || 'MCP server connector'
        }`
      );
    }
  }

  return `## 🔌 AVAILABLE CONNECTORS

The following third-party integrations are configured and available for use in the generated application:

${descriptions.join('\n')}

**Environment Variables Available:**
The following environment variables contain API credentials and can be used in your backend code:
${envVarsList.map((v) => `- \`${v}\``).join('\n')}

**Usage Instructions:**
- Access these variables using \`process.env.VARIABLE_NAME\` in your backend code
- These credentials are already configured and authenticated
- Do NOT hardcode any API keys - always use environment variables
- Example: \`const apiKey = process.env.GMAIL_ACCESS_TOKEN;\`
`;
}

// Collect all feature modules that have been added throughout the conversation
async function collectAllFeatureModules(
  historyMessages: any[],
  isGeneratingFullStackApp: boolean,
  framework: 'expressjs' | 'nextjs'
): Promise<string[]> {
  const featureModules: string[] = [];
  const processedFeatures = new Set<string>(); // Track unique features to avoid duplicates

  // Scan through all human messages to find feature injection requests
  for (const message of historyMessages) {
    if (message.constructor.name === 'HumanMessage') {
      const messageContent = message.content;
      const messageText =
        typeof messageContent === 'string' ? messageContent : '';

      if (detectFeatureInjection(messageText)) {
        const featureTemplateName = selectFeatureTemplate(
          messageText,
          isGeneratingFullStackApp,
          framework
        );

        if (
          featureTemplateName &&
          !processedFeatures.has(featureTemplateName)
        ) {
          try {
            const featureModuleContent = await renderTemplate(
              path.join(__dirname, 'appGen', 'prompts', featureTemplateName),
              {}
            );
            featureModules.push(featureModuleContent);
            processedFeatures.add(featureTemplateName);
          } catch (error) {
            console.warn('Failed to load feature module template:', error);
          }
        }
      }
    }
  }

  return featureModules;
}

// Robust feature injection detection using separate verb and noun matching
function detectFeatureInjection(messageText: string): boolean {
  if (!messageText || typeof messageText !== 'string') {
    return false;
  }

  const text = messageText.toLowerCase().trim();

  // Common verbs that indicate feature addition/implementation
  const featureVerbs = [
    'add',
    'implement',
    'create',
    'build',
    'integrate',
    'setup',
    'set up',
    'install',
    'configure',
    'enable',
    'include',
    'incorporate',
    'introduce',
    'deploy',
    'establish',
    'develop',
    'construct',
    'generate',
    'provision',
    'activate',
    'initiate',
    'launch',
    'start',
    'begin',
    'commence',
  ];

  // Key nouns/features that can be added
  const featureNouns = [
    'authentication',
    'auth',
    'login',
    'signin',
    'sign-in',
    'signup',
    'sign-up',
    'register',
    'registration',
    // Payment related keywords - trigger Stripe module
    'payment',
    'payments',
    'pay',
    'billing',
    'stripe',
    'checkout',
    'subscription',
    'subscriptions',
    'accounts',
    'admin',
    'oauth',
    'sso',
    '2fa',
    'mfa',
    'integration',
  ];

  // Check if the message contains any feature verb
  const hasFeatureVerb = featureVerbs.some((verb) => {
    // Use word boundary regex to avoid partial matches
    const verbRegex = new RegExp(`\\b${verb}\\b`, 'i');
    return verbRegex.test(text);
  });

  // Check if the message contains any feature noun
  const hasFeatureNoun = featureNouns.some((noun) => {
    // Use word boundary regex to avoid partial matches
    const nounRegex = new RegExp(`\\b${noun}\\b`, 'i');
    return nounRegex.test(text);
  });

  // Feature injection detected if both a verb and noun are present
  return hasFeatureVerb && hasFeatureNoun;
}

// Get the base template name based on app type and framework
function getBaseTemplateName(
  isGeneratingFullStackApp: boolean,
  framework: 'expressjs' | 'nextjs'
): string {
  if (isGeneratingFullStackApp) {
    return framework === 'nextjs'
      ? 'fullstack_nextjs.txt'
      : 'fullstack_express.txt';
  } else {
    return framework === 'nextjs'
      ? 'frontend_nextjs.txt'
      : 'frontend_react.txt';
  }
}

// Select appropriate feature template based on detected features
function selectFeatureTemplate(
  messageText: string,
  isGeneratingFullStackApp: boolean,
  framework: 'expressjs' | 'nextjs'
): string {
  const text = messageText.toLowerCase();

  // Define feature categories and their associated keywords
  const featureCategories = [
    {
      keywords: [
        'authentication',
        'auth',
        'login',
        'signin',
        'sign-in',
        'signup',
        'sign-up',
        'register',
        'registration',
        'jwt',
        'oauth',
        'sso',
        '2fa',
        'mfa',
      ],
      template: 'features/auth_module.txt',
    },
    {
      keywords: [
        'payment',
        'payments',
        'pay',
        'billing',
        'stripe',
        'paypal',
        'checkout',
        'subscription',
        'subscriptions',
        'credit card',
        'debit card',
      ],
      template: 'features/payment_module.txt',
    },
    {
      keywords: [
        'integration',
        'apis',
        'endpoint',
        'endpoints',
        'rest',
        'graphql',
        'webhook',
        'webhooks',
      ],
      template: 'features/api_integration_module.txt',
    },
    /*
    {
      keywords: [
        'database',
        'db',
        'postgres',
        'mysql',
        'mongodb',
        'sqlite',
        'redis',
      ],
      template: 'features/database_module.txt',
    },
    {
      keywords: [
        'email',
        'emails',
        'smtp',
        'mail',
        'notification',
        'notifications',
      ],
      template: 'features/email_module.txt',
    },
    {
      keywords: [
        'file',
        'files',
        'upload',
        'uploads',
        'storage',
        's3',
        'cloudinary',
      ],
      template: 'features/file_upload_module.txt',
    },
    {
      keywords: ['admin', 'administration', 'dashboard', 'panel', 'management'],
      template: 'features/admin_module.txt',
    },
    {
      keywords: ['search', 'filtering', 'pagination', 'sorting'],
      template: 'features/search_module.txt',
    },
    {
      keywords: ['analytics', 'tracking', 'metrics', 'logging', 'monitoring'],
      template: 'features/analytics_module.txt',
    },
    {
      keywords: [
        'testing',
        'tests',
        'unit',
        'integration',
        'e2e',
        'cypress',
        'jest',
      ],
      template: 'features/testing_module.txt',
    },*/
  ];

  // Find the first matching feature category (case-insensitive)
  const lowerText = text.toLowerCase();
  for (const category of featureCategories) {
    if (category.keywords.some((keyword) => lowerText.includes(keyword))) {
      return category.template;
    }
  }

  // Fallback to default templates if no specific feature is detected
  return '';
}

// Build human content with appropriate context
async function buildHumanContent(
  appGenState: AppGenState,
  starterCode?: string,
  readmeContent?: string,
  prdContent?: string,
  defaultDesignStyle?: string,
  imageData?: ImageData[]
): Promise<string> {
  const contentParts: string[] = [];

  // Add starter code context for STARTER state
  if (appGenState === AppGenState.STARTER && starterCode?.trim()) {
    contentParts.push(
      `Use initial project starter code structure as reference: <starter_code>${starterCode}</starter_code>.`
    );
  }

  // Add readme content for IMPROVE/FIX states
  if (appGenState !== AppGenState.STARTER && readmeContent?.trim()) {
    contentParts.push(
      `## Current readme file: \n\n <read_me>${readmeContent}</read_me>.`
    );
  }

  // Add PRD content if provided
  if (prdContent && prdContent.trim()) {
    contentParts.push(
      `## Product Requirements Document (PRD)\n\nBuild the app based on the following PRD:\n\n${prdContent}`
    );
  }

  // Add image reference URLs if provided (for code generation)
  if (imageData && imageData.length > 0) {
    // Extract public URLs for code reference
    const publicUrls = imageData
      .map((item) => item.publicUrl)
      .filter((url): url is string => url !== null && url !== undefined);

    if (publicUrls.length > 0) {
      const imageUrlsSection = publicUrls
        .map((url, index) => `  ${index + 1}. ${url}`)
        .join('\n');
      contentParts.push(
        [
          '## 🖼️ Available Image URLs for Code Generation',
          '',
          'You can see the images attached to this message. Additionally, these images are available at the following public URLs:',
          imageUrlsSection,
          '',
          'Instructions:',
          '- Analyze the attached images to understand the design/content.',
          '- When generating code that needs to display these images, use the public URLs above.',
          `- For example: \`<img src="${publicUrls[0]}" alt="..." />\` or in CSS: \`background-image: url('${publicUrls[0]}');\``,
        ].join('\n')
      );
    }
  }

  // Add default design style if provided
  if (defaultDesignStyle && defaultDesignStyle.trim()) {
    contentParts.push(
      `## Design Style Requirements\n\nMake the frontend look like the UI description.\n\n${defaultDesignStyle}`
    );
  }

  return contentParts.join('\n\n');
}

// Build initial messages for the conversation
export async function buildInitialMessages({
  // Core parameters
  appGenState,
  docId,
  docType,
  currentUser,
  chatSessionId,

  // Optional media
  refImage,
  imageData,

  // Code-related
  starterCode,
  availableFiles,
  readmeContent,

  // Framework selection
  framework = 'expressjs',

  // Environment settings
  envSettings,

  // Extracted context
  defaultDesignStyle,
  prdContent,
}: BuildInitialMessagesParams): Promise<BaseMessage[]> {
  console.log('buildInitialMessages called with framework:', framework);
  let messages: BaseMessage[] = [];

  // Determine if generating fullstack app based on conversion type
  const isGeneratingFullStackApp = docType === DOCTYPE.PRODUCT;

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

  // Collect all feature modules that have been added throughout the conversation
  const allFeatureModules = await collectAllFeatureModules(
    historyMessages,
    isGeneratingFullStackApp,
    framework
  );

  // Get the base template name (same for both STARTER and IMPROVE/FIX states)
  const templateName = getBaseTemplateName(isGeneratingFullStackApp, framework);

  console.log(`${appGenState} Template selection:`, {
    isGeneratingFullStackApp,
    framework,
    selectedTemplate: templateName,
    envSettings,
  });

  // Generate current timestamp in format: YYYYMMDDHHMMSSmmm (with milliseconds)
  const currentTimestamp = dayjs().format('YYYYMMDDHHmmssSSS');

  // Render the system prompt
  let systemPrompt = await renderTemplate(
    path.join(__dirname, 'appGen', 'prompts', templateName),
    {
      appGenState,
      currentTimestamp,
    }
  );

  // Enhance system prompt with all feature modules that have been added
  if (allFeatureModules.length > 0) {
    const combinedFeatureModules = allFeatureModules.join('\n\n---\n\n');
    systemPrompt = await enhanceSystemPromptWithFeatureModule(
      systemPrompt,
      combinedFeatureModules
    );
  }

  // Inject connector context if available
  if (docId) {
    try {
      const connectors = await getConnectorsForDocument(docId, 'preview');
      const previewConnectors = connectors.preview || [];

      if (previewConnectors.length > 0) {
        const connectorContext = buildConnectorContext(previewConnectors);
        systemPrompt += `\n\n${connectorContext}`;
      }
    } catch (error) {
      console.log(
        '[buildInitialMessages] Could not load connector context:',
        error
      );
    }
  }

  // Build human content with appropriate context
  const humanContent = await buildHumanContent(
    appGenState,
    starterCode,
    readmeContent,
    prdContent,
    defaultDesignStyle,
    imageData
  );

  // Add system message
  messages.push(
    new SystemMessage({
      content: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
    })
  );

  // Only add human message when humanContent is not empty
  // Anthropic API requires text content blocks to be non-empty
  if (humanContent.trim()) {
    const messageContent: any[] = [
      {
        type: 'text',
        text: humanContent,
      },
    ];

    // Add images for Claude to analyze
    // LangChain handles base64 data URLs automatically
    if (imageData && imageData.length > 0) {
      imageData.forEach((item) => {
        // Add image to message content for LLM to view
        messageContent.push({
          type: 'image_url',
          image_url: { url: item.base64DataUrl },
        });
      });
    }

    messages.push(new HumanMessage({ content: messageContent }));
  }

  // Merge consecutive human messages in historyMessages first
  if (
    historyMessages.length > 1 &&
    historyMessages[historyMessages.length - 1].constructor.name ===
      'HumanMessage'
  ) {
    // Find the longest sequence of consecutive human messages from the end
    const humanMessageSequence: any[] = [];
    for (let i = historyMessages.length - 1; i >= 0; i--) {
      const isHumanMessage =
        historyMessages[i].constructor.name === 'HumanMessage';

      if (isHumanMessage) {
        humanMessageSequence.unshift(historyMessages[i]); // Add to beginning to maintain order
      } else {
        break; // Stop when we hit a non-human message
      }
    }

    if (humanMessageSequence.length > 1) {
      // Merge all human messages in the sequence into a single message
      const mergedContent = humanMessageSequence
        .map((msg: any) => {
          if (typeof msg.content === 'string') {
            return msg.content;
          } else if (Array.isArray(msg.content)) {
            return msg.content
              .filter((item: any) => item.type === 'text')
              .map((item: any) => item.text)
              .join(' ');
          }
          return '';
        })
        .filter((content: string) => content.trim().length > 0)
        .join('\n\n');

      // Create a merged human message
      const mergedHumanMessage = new HumanMessage({
        content: mergedContent,
      });

      // Remove the original human messages and add the merged one
      historyMessages.splice(
        historyMessages.length - humanMessageSequence.length,
        humanMessageSequence.length
      );
      historyMessages.push(mergedHumanMessage);

      console.log(
        `Merged ${humanMessageSequence.length} consecutive human messages into one`
      );
    }
  }
  // Append the processed historyMessages to messages - it already has the latest message user inputted
  messages.push(...historyMessages);

  return messages;
}

// Build chat history (BaseMessage[]) prompt for Claude app agent
export async function buildAppClaudeChatHistory({
  docType,
  additionalContextFromUserFiles,
  appCode,
  userFeedback,
  chatSessionId,
  currentUser,
}: {
  docType: string;
  additionalContextFromUserFiles: string;
  appCode: string | undefined;
  userFeedback: string;
  chatSessionId: string | undefined;
  currentUser: AuthenticatedUserWithProfile;
}): Promise<BaseMessage[]> {
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
    context = await retriever
      .invoke(userFeedback)
      .then(formatDocumentsAsString);
    console.log('Successfully retrieved context from legacy vector store');
  } catch (error) {
    console.log(
      'Legacy vector store not available, proceeding without context:',
      error instanceof Error ? error.message : String(error)
    );
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
    additionalContextFromUserFiles, // Any extra context provided by the user (e.g., uploaded files, selected documents)
    context, // Context from the vector store
    previousDocument: appCode, // The previous document (code)
    history: historyMessages, // The actual chat history messages (including the latest one) fetched from the database
  };

  // Generate the formatted prompt (chat history)
  const formattedPrompt = await prompt.formatMessages(inputVariables);
  return formattedPrompt;
}

export async function genAppClaudeV2(
  modelName: string,
  callBackFunc: (output: any) => void,
  tools: DynamicStructuredTool[],
  messages: BaseMessage[] = [],
  enableThinking: boolean = true
): Promise<AsyncIterable<AIMessageChunk>> {
  // Thinking + tool-calling is currently unstable with Anthropic's requirements
  // (tool_result ↔ tool_use pairing and hidden thinking blocks).
  // To avoid losing tool results between iterations (which was causing repeated
  // plan_files / unsplash_search calls), we disable thinking whenever tools
  // are bound to the model.
  const hasTools = Array.isArray(tools) && tools.length > 0;
  const thinkingEnabled = enableThinking && !hasTools;

  const isCheaperModel = modelName === ACTIVE_CLAUDE_CHEAPER_MODEL_ID;
  const maxTokens = isCheaperModel ? 8192 : 64_000;
  const thinkingConfig = thinkingEnabled
    ? {
        type: 'enabled' as const,
        // Ensure budget_tokens is within Anthropic's allowed range and <= maxTokens
        budget_tokens: Math.max(1024, Math.min(10_000, maxTokens - 1024)),
      }
    : undefined;

  const model = createStreamingClaudeModel(
    {
      modelName,
      maxTokens,
      // Enable extended thinking for better code generation when requested
      thinking: thinkingConfig,
    },
    {
      onLLMEnd: callBackFunc,
    }
  );
  try {
    // When thinking is enabled without tools, we could sanitize history here if needed.
    // For now, thinking is only used for non-tool flows, so we keep the full message
    // history to preserve context.
    const finalMessages = messages;

    // If tools are provided, bind them to the model
    // Tool binding logs removed - enable ENABLE_LLM_LOGGING env var for verbose logs
    const modelWithTools = tools ? model.bindTools(tools) : model;

    // Log the final formatted messages before calling the model
    // console.log('Sending formatted messages to Claude model');
    // console.log('messages:', finalMessages);
    const stream = await modelWithTools.stream(finalMessages);
    return stream;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to get response from LangChain API:', errorMessage);
    throw new Error(
      `Failed to get response from LangChain API: ${errorMessage}`
    );
  }
}

/**
 * Run a standalone planning step with Anthropic thinking enabled and **no tools**.
 * This is used for high-level task planning and error analysis before entering
 * the main tool-calling loop.
 */
export async function runThinkingPlan(
  modelName: string,
  systemPrompt: string,
  humanPrompt: string,
  billingContext?: ThinkingPlanBillingContext
): Promise<string> {
  const messages: BaseMessage[] = [
    new SystemMessage({
      content: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
    }),
    new HumanMessage({
      content: [
        {
          type: 'text',
          text: humanPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
    }),
  ];

  const stream = await genAppClaudeV2(
    modelName,
    async (output: any) => {
      if (billingContext) {
        processLLMEndCallback(output, modelName, {
          currentUser: billingContext.currentUser,
          docId: billingContext.docId,
          docType: billingContext.docType,
          streamingMode: true,
        });
      }
    },
    [],
    messages,
    true
  );

  let planText = '';
  for await (const chunk of stream) {
    // chunk.content is treated as string in existing streaming helpers
    planText += (chunk as any).content ?? '';
  }

  return planText.trim();
}
