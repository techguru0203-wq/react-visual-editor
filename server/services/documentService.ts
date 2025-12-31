import {
  Access,
  DOCTYPE,
  Document,
  DocumentPermissionStatus,
  DocumentPermissionTypes,
  DocumentStatus,
  IssueStatus,
  MessageUseTypes,
  Organization,
  Prisma,
  Project,
  RecordStatus,
  TemplateDocument,
  TemplateStatus,
} from '@prisma/client';
import prisma from '../db/prisma';
import dayjs from 'dayjs';
import { DevPlan } from '../types/schedulingTypes';
import {
  generateDeployDocId,
  isEmail,
  normalizeEnvSettings,
} from '../lib/util';
import { AuthenticatedUserWithProfile } from '../types/authTypes';
import { genPRD } from './llmService/prdAgent';
import { genTechDesign } from './llmService/techDesignAgent';
import { genQAPlan } from './llmService/qaAgent';
import { genReleasePlan } from './llmService/releasePlanAgent';
import { extractDetailStyleFromImage } from './llmService/customizationAgent';
import { OrganizationID } from '../db/seed/organizationsData';
import {
  DefaultSampleTaskStoryPoint,
  DefaultStoryPointsPerSprint,
  DefaultWeeksPerSprint,
} from '../../shared/constants';
import { genDevPlan } from './llmService/devPlanAgent';
import { genDefaultDoc } from './llmService/defaultDocAgent';
import { DocumentGenerationInput } from '../routes/types/documentTypes';
import { DevPlanMetaSchema } from '../routes/types/devPlanTypes';
import { DevPlanGenInput } from './types';
import { RedisSingleton } from './redis/redis';
import { genUIDesignAnthropic } from './llmService/uiDesignAgentAnthropic';
import { DeployResult } from '../../shared/types/supabaseTypes';
import {
  AppGenState,
  buildInitialMessages,
  genAppClaudeV2,
  ImageData,
  runThinkingPlan,
} from './llmService/appAgentAnthropic';
import {
  defaultReactProjectCodeTemplate,
  saveAppFileStructure,
  convertJsonToCode,
  processCodeForDeployment,
  determineFramework,
  handleStripeFiles,
} from './llmService/appGen/appGenUtil';
import {
  ACTIVE_CLAUDE_MODEL_ID,
  processStream,
  processStreamJsonWithToolCalling,
} from './llmService/uiux/ai_utils';
import { processLLMEndCallback } from './llmService/llmUtil';
import {
  autoCreateDatabaseIfMissing,
  executeDBMigrationWithDrizzle,
} from './databaseService';
import { deployCodeToVercelForRegenerate } from './deployService';
import {
  initializeCodebaseManager,
  createCodebaseTools,
  writeFilesToolName,
  planFilesToolName,
  searchReplaceToolName,
} from './llmService/tools/codebaseTools';
import { webSearchToolName } from './llmService/tools/webSearchTool';
import { externalFileFetchToolName } from './llmService/tools/externalFileFetchTool';
import { unsplashSearchToolName } from './llmService/tools/unsplashTool';
import { AIMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import { checkProjectAccess } from './projectService';
import { CacheBlockManager } from './llmService/appGen/cacheBlockManager';
import mixpanel from './trackingService';
import { createUnsplashSearchTool } from './llmService/tools/unsplashTool';
import { getConnectorsForDocument } from './connectorService';

import {
  createDocumentHistory,
  getLatestVersionNumber,
} from './documentHistoryService';
import {
  updateDocumentMeta,
  updateDocumentMetaAfterDeploy,
} from './documentMetaService';
const polishAppRetryMax = 10;

/**
 * Check if user requested Stripe/payment features in conversation
 * @param chatSessionId The chat session ID
 * @param additionalContext Additional context from user files
 * @returns Whether Stripe feature was requested
 */
async function checkStripeFeatureRequested(
  chatSessionId: string | undefined,
  additionalContext: string
): Promise<boolean> {
  // Core payment keywords that explicitly indicate Stripe/payment integration (English + Chinese)
  const paymentKeywords = [
    'payment',
    'payments',
    'pay',
    'billing',
    'stripe',
    'checkout',
    'subscription',
    'subscriptions',
    'credit card',
    'debit card',
    'purchase',
    'buy',
    'order',
    'cart',
    'shopping',
    'pricing',
    'membership',
    'invoice',
    'receipt',
    // Chinese keywords
    '支付',
    '付款',
    '结账',
    '订阅',
    '购买',
    '购物',
    '订单',
    '会员',
  ];

  // Action verbs indicating integration request (English + Chinese)
  const actionVerbs = [
    'add',
    'implement',
    'create',
    'build',
    'integrate',
    'setup',
    'install',
    'implement',
    // Chinese action verbs
    '添加',
    '集成',
    '整合',
    '实现',
    '安装',
    '接入',
  ];

  // Check in additional context (must have both keyword and action verb)
  const contextLower = (additionalContext || '').toLowerCase();
  const contextHasPayment = paymentKeywords.some((keyword) =>
    contextLower.includes(keyword)
  );
  const contextHasAction = actionVerbs.some((verb) =>
    contextLower.includes(verb)
  );

  if (contextHasPayment && contextHasAction) {
    console.log('✅ Stripe feature detected in additional context');
    return true;
  }

  // Check in chat history if session exists
  if (chatSessionId) {
    const chatMessages = await prisma.chatHistory.findMany({
      where: { sessionId: chatSessionId },
      orderBy: { createdAt: 'desc' },
      take: 10, // Check last 10 messages
    });

    for (const msg of chatMessages) {
      const messageText = JSON.stringify(msg.message).toLowerCase();
      const hasPaymentKeyword = paymentKeywords.some((keyword) =>
        messageText.includes(keyword)
      );

      if (hasPaymentKeyword) {
        // Also check for action verbs to confirm it's a request
        const hasActionVerb = actionVerbs.some((verb) =>
          messageText.includes(verb)
        );

        if (hasActionVerb) {
          console.log(
            `✅ Stripe feature detected in chat history: "${messageText.substring(
              0,
              100
            )}..."`
          );
          return true;
        }
      }
    }
  }

  return false;
}

export interface EnvSettings {
  DATABASE_URL?: string;
  JWT_SECRET?: string;
  [key: string]: any;
}

/**
 * Helper function to check if user has stopped generation and handle the stop logic
 * Returns object indicating if generation should stop and the updated state
 */
async function checkAndHandleStopSignal(
  stopKey: string,
  existingContents: string,
  retryCount: number,
  lastSuccessfulDeployResult: DeployResult | null
): Promise<{
  shouldStop: boolean;
  generateContent: string;
  deployResult: DeployResult | null;
  sourceUrl: string;
}> {
  const stopSignal = await RedisSingleton.getData(stopKey);

  if (stopSignal !== 'true') {
    return {
      shouldStop: false,
      generateContent: '',
      deployResult: null,
      sourceUrl: '',
    };
  }

  console.log(
    'User stopped generation, preserving existing code without saving partial work'
  );

  // Keep the most recent working code by not overwriting it
  let generateContent = existingContents || '';

  // If stopped during retry, use last successful deployment
  let deployResult: DeployResult | null = null;
  let sourceUrl = '';

  if (retryCount > 0 && lastSuccessfulDeployResult) {
    console.log(
      'Using last successful deployment from retry:',
      lastSuccessfulDeployResult.sourceUrl
    );
    deployResult = lastSuccessfulDeployResult;
    sourceUrl = lastSuccessfulDeployResult.sourceUrl;
  }

  // Clear stop signal
  await RedisSingleton.clearData(stopKey);
  console.log('Cleared stop signal after user stop');

  return {
    shouldStop: true,
    generateContent,
    deployResult,
    sourceUrl,
  };
}

/**
 * Retrieves environment settings for a document
 * @param documentId The ID of the document
 * @returns The environment settings or null if not found
 */
export async function getEnvSettingsForDoc(
  documentId: string
): Promise<EnvSettings | null> {
  const docData = await prisma.document.findFirst({
    where: { id: documentId },
    select: { meta: true },
  });

  return (docData?.meta as any)?.envSettings as EnvSettings | null;
}

export async function getDocumentForProject(
  projectId: string,
  docType: DOCTYPE
): Promise<Document | null> {
  let result = await prisma.document.findFirst({
    where: {
      projectId,
      type: docType,
      status: {
        in: [DocumentStatus.PUBLISHED, DocumentStatus.CREATED],
      },
    },
  });
  return result;
}

export function getDeliveryImpact(
  name: string,
  sprintKey: string,
  oldDevPlan: DevPlan,
  newDevPlan: DevPlan
) {
  // first: find new tasks created
  let target = newDevPlan.epics.reduce(
    (acc: any, m: any) => {
      m.children.forEach((s: any) => {
        if (s.name.trim().toLowerCase() === name.trim().toLowerCase()) {
          acc.epicName = m.name;
          acc.story = s;
        }
      });
      return acc;
    },
    { epicName: '', story: null }
  );
  console.log(
    'in server.services.documentService.getDeliveryImpact:',
    name,
    target
  );
  let newTaskInfo = target.story?.children.reduce(
    (acc: string[], curTask: any, index: number) => {
      let taskInfo = newDevPlan.sprints.reduce(
        (summary: any, curSprint: any) => {
          curSprint.children.forEach((s: any) => {
            s.children.forEach((t: any) => {
              if (t.key === curTask.key) {
                console.log(
                  'in server.services.documentService.getDeliveryImpact.findTask: t:',
                  t.key,
                  curTask.name
                );
                summary = {
                  ownerUserId: t.ownerUserId,
                  sprintName: curSprint.name,
                };
              }
            });
          });
          return summary;
        },
        {}
      );
      acc.push(
        `New Task ${index + 1}: ${curTask.name}, ${
          curTask.storyPoint
        } story point, owner: ${taskInfo.ownerUserId}, sprint: ${
          taskInfo.sprintName
        }`
      );
      return acc;
    },
    [
      `New Story: 1 story "${name}" with ${target.story?.children.length} task(s) and ${target.story.storyPoint} story points were added to epic [${target.epicName}]`,
    ]
  );

  // second: find epics delivery impact
  let [epicsBefore, epicsAfter] = [
    oldDevPlan.milestones,
    newDevPlan.milestones,
  ].map((mls) => {
    return mls.reduce((allEpics: any, m: any) => {
      m.epics.forEach((e: any) => {
        if (!allEpics[e.name]) {
          allEpics[e.name] = {
            milestone: m.name,
            totalStoryPoint: e.totalStoryPoint,
            startDate: e.startDate,
            endDate: e.endDate,
          };
        } else {
          allEpics[e.name] = {
            milestone: m.name,
            totalStoryPoint: e.totalStoryPoint,
            startDate: dayjs(allEpics[e.name].startDate).isBefore(e.startDate)
              ? allEpics[e.name].startDate
              : e.startDate,
            endDate: dayjs(allEpics[e.name].endDate).isBefore(e.endDate)
              ? e.endDate
              : allEpics[e.name].endDate,
          };
        }
      });
      return allEpics;
    }, {});
  });
  let epicsImpact = Object.keys(epicsBefore).reduce((acc: any, cur: any) => {
    let before = epicsBefore[cur];
    let after = epicsAfter[cur];
    acc[cur] = `${cur}:`;
    if (before.totalStoryPoint !== after.totalStoryPoint) {
      acc[
        cur
      ] += ` story points to change from ${before.totalStoryPoint} to ${after.totalStoryPoint},`;
    }
    if (before.endDate !== after.endDate) {
      acc[
        cur
      ] += ` delivery date to move from ${before.endDate} to ${after.endDate}`;
    }
    return acc;
  }, {});
  // third: find milestone delivery impact
  let [resultBefore, resultAfter] = [
    oldDevPlan.milestones,
    newDevPlan.milestones,
  ].map((mls) => {
    return mls.reduce((acc: any, cur: any) => {
      acc[cur.name] = {
        startDate: cur.startDate,
        endDate: cur.endDate,
        storyPoint: cur.storyPoint,
        completeEpics: cur.epics.reduce((doneEpics: any, cur: any) => {
          if (cur.storyPoint + cur.prevStoryPoint === cur.totalStoryPoint) {
            doneEpics += `[${cur.name}(${cur.totalStoryPoint} points)] `;
          }
          return doneEpics;
        }, ''),
      };
      return acc;
    }, {});
  });
  console.log(
    'in server.services.documentService.getDeliveryImpact:',
    resultBefore,
    resultAfter
  );
  let milestoneImpact = Object.keys(resultBefore).reduce(
    (acc: any, cur: any) => {
      let before = resultBefore[cur];
      let after = resultAfter[cur];
      acc[cur] = `${cur}:`;
      if (!after) {
        acc[cur] += ` will be removed.`;
        return acc;
      }
      // impact for story point
      if (before.storyPoint !== after.storyPoint) {
        acc[
          cur
        ] += ` story points to change from ${before.storyPoint} to ${after.storyPoint},`;
      } else {
        acc[cur] += ` story points remains as ${before.storyPoint},`;
      }
      // impact for delivery date
      if (before.endDate !== after.endDate) {
        acc[
          cur
        ] += ` delivery date to move from ${before.endDate} to ${after.endDate},`;
      } else {
        acc[cur] += ` delivery date remains as ${before.endDate},`;
      }
      //impact for epics
      if (before.completeEpics !== after.completeEpics) {
        acc[
          cur
        ] += ` completed epics to change from ${before.completeEpics} to ${after.completeEpics}.`;
      } else {
        acc[cur] += ` completed epics remain as ${before.completeEpics}.`;
      }
      return acc;
    },
    {}
  );

  return {
    newTaskInfo,
    // epicsBefore,
    // epicsAfter,
    epicsImpact,
    // resultBefore,
    // resultAfter,
    milestoneImpact,
  };
}

export interface DocumentCreationData {
  name: string;
  issueId: string;
  description: string;
  projectId: string;
  type: string;
  userId: string;
  access: string;
}

export async function createDocumentForBuildable(
  documentData: DocumentCreationData
) {
  let { name, issueId, description, projectId, type, userId, access } =
    documentData;
  let updateResult: Document;
  try {
    updateResult = await prisma.document.create({
      data: {
        name,
        description,
        type: type as DOCTYPE,
        status: DocumentStatus.CREATED,
        url: '',
        access: access as Access,
        issue: {
          connect: {
            id: issueId,
          },
        },
        creator: {
          connect: {
            id: userId,
          },
        },
        project: {
          connect: {
            id: projectId,
          },
        },
      },
    });
    console.log(
      'server.services.documentService.createDocumentForBuildable.success: ',
      updateResult.id
    );
  } catch (e) {
    console.error(
      'server.services.documentService.createDocumentForBuildable: ',
      e
    );
    throw e;
  }
  return updateResult;
}

export async function checkDocumentAccess(
  dbDocument: Document & { project: Project | null },
  email: string,
  userId: string | null,
  organizationId: string | null
): Promise<{
  hasAccess: boolean;
  documentPermission: DocumentPermissionTypes;
}> {
  let hasAccess = false;
  let documentPermission: DocumentPermissionTypes =
    DocumentPermissionTypes.VIEW;

  // 1. Check if the user is the document creator (existing logic)
  if (userId && userId === dbDocument.creatorUserId) {
    hasAccess = true;
    documentPermission = DocumentPermissionTypes.EDIT;
  } else {
    // 2. Check document permission by userId if the user is logged in
    if (userId) {
      const docPermissionWithUserId = await prisma.documentPermission.findFirst(
        {
          where: {
            documentId: dbDocument.id,
            userId,
            status: DocumentPermissionStatus.ACTIVE,
          },
        }
      );
      if (docPermissionWithUserId !== null) {
        documentPermission = docPermissionWithUserId.permission;
        hasAccess = true;
        console.log(
          `[checkDocumentAccess] Found document permission by userId: ${docPermissionWithUserId.permission} for document ${dbDocument.id}, userId: ${userId}`
        );
      } else {
        console.log(
          `[checkDocumentAccess] No document permission found by userId for document ${dbDocument.id}, userId: ${userId}`
        );
      }
    }
    // 3. Check document permission by email (for logged-out users or as fallback)
    // Also check by email even if userId check failed, in case permission was created with email only
    if (!hasAccess && isEmail(email)) {
      const normalizedEmail = email.toLowerCase();
      // Get all active permissions for this document to do case-insensitive matching
      const allDocPermissions = await prisma.documentPermission.findMany({
        where: {
          documentId: dbDocument.id,
          status: DocumentPermissionStatus.ACTIVE,
        },
      });

      // Find permission by email (case-insensitive match)
      const docPermissionWithEmail = allDocPermissions.find(
        (perm) =>
          perm.email.toLowerCase() === normalizedEmail ||
          perm.email === email ||
          perm.email.toLowerCase() === email.toLowerCase()
      );

      if (docPermissionWithEmail) {
        documentPermission = docPermissionWithEmail.permission;
        hasAccess = true;
        console.log(
          `[checkDocumentAccess] Found document permission by email: ${docPermissionWithEmail.permission} for document ${dbDocument.id}, userId: ${userId}, email: ${email}, permission email: ${docPermissionWithEmail.email}`
        );
        // If userId is available but wasn't set in permission, update it for future lookups
        if (userId && !docPermissionWithEmail.userId) {
          await prisma.documentPermission
            .update({
              where: { id: docPermissionWithEmail.id },
              data: { userId },
            })
            .catch((err) => {
              // Log but don't fail if update fails
              console.warn(
                'Failed to update document permission with userId:',
                err
              );
            });
        }
      } else {
        console.log(
          `[checkDocumentAccess] No document permission found by email for document ${dbDocument.id}, userId: ${userId}, email: ${email}. Available permissions:`,
          allDocPermissions.map((p) => ({
            email: p.email,
            userId: p.userId,
            permission: p.permission,
          }))
        );
      }
    }
  }

  // 4. If no document access, check if user has access to the project
  if (!hasAccess && dbDocument.project) {
    const projectAccess = await checkProjectAccess(
      dbDocument.project,
      email,
      userId,
      organizationId
    );

    if (projectAccess.hasAccess) {
      // If the user has access to the project, grant document access (with the appropriate permission)
      hasAccess = true;
      documentPermission =
        projectAccess.projectPermission || DocumentPermissionTypes.VIEW;
    }
  }

  // 5. If still no access, check document-specific access (based on document's access level)
  if (!hasAccess && userId != null && userId != '') {
    switch (dbDocument.access) {
      case Access.SELF:
        hasAccess = userId === dbDocument.creatorUserId;
        break;
      case Access.ORGANIZATION:
        hasAccess = organizationId === dbDocument.project?.organizationId;
        break;
      case Access.TEAM:
        if (dbDocument.project?.teamId) {
          const userTeam = await prisma.userTeam.findFirst({
            where: {
              userId,
              teamId: dbDocument.project.teamId,
            },
          });
          hasAccess = userTeam !== null;
        }
        break;
      default:
        break;
    }
  }

  // 6. Public document access
  if (!hasAccess && dbDocument.access === Access.PUBLIC) {
    hasAccess = true;
  }

  console.log(
    `[checkDocumentAccess] Final result for document ${dbDocument.id}: hasAccess=${hasAccess}, documentPermission=${documentPermission}, userId=${userId}, email=${email}`
  );
  return {
    hasAccess,
    documentPermission,
  };
}

export async function getGenTemplateDocumentPrompt(
  templateId: string
): Promise<string> {
  let template = await prisma.templateDocument.findUnique({
    where: {
      id: templateId,
    },
    select: {
      promptText: true,
    },
  });

  if (!template) {
    return '';
  }

  console.log(
    'in documentService.getGenTemplateDocumentPrompt.prompt:',
    template.promptText
  );
  return template.promptText as string;
}

export async function getGenDefaultTemplateDocumentOutputFormat(
  templateId: string
): Promise<string> {
  let template = await prisma.templateDocument.findUnique({
    where: {
      id: templateId,
    },
    select: {
      outputFormat: true,
    },
  });

  if (!template) {
    return '';
  }

  return template.outputFormat as string;
}

export async function getDefaultTemplateDocument(
  docType: string,
  currentUser: AuthenticatedUserWithProfile
): Promise<TemplateDocument | null> {
  // get content from database on the created PRD template document
  // update this query below to find the record with the highest useCount

  let templateDoc = await prisma.templateDocument.findFirst({
    where: {
      type: docType as DOCTYPE,
      status: TemplateStatus.PUBLISHED,
      OR: [
        {
          creatorUserId: currentUser.userId,
        },
        {
          access: Access.ORGANIZATION,
          organizationId: currentUser.organizationId,
        },
        {
          access: Access.PUBLIC,
        },
      ],
    },
    orderBy: {
      useCount: 'desc',
    },
  });
  if (!templateDoc) {
    templateDoc = await prisma.templateDocument.findFirst({
      where: {
        type: docType as DOCTYPE,
        status: TemplateStatus.PUBLISHED,
        access: Access.PUBLIC,
      },
      orderBy: {
        useCount: 'desc',
      },
    });
  }
  if (!templateDoc) {
    console.log(
      `in documentService.getDefaultTemplateDocument: No default template document found for: ${docType}, ${currentUser.email}`
    );
  }

  return templateDoc;
}

export async function genTemplateDocumentDoc(
  currentUser: AuthenticatedUserWithProfile,
  // docData: any,
  type: DOCTYPE,
  promptText: string,
  sampleInputText: string,
  templateName: string
): Promise<string> {
  let generateContent = '';

  const docName = `${templateName}: Sample Doc`;
  const docData = {
    name: docName,
    description: sampleInputText, // user sampleInputText
    promptText,
    id: '', // docId
    type, // docType
    additionalContextFromUserFiles: '',
    contents: '',
  };

  let inputContent = ''; // prd Content or development plan content
  // todo - remove this false check when development plans are enabled again
  if (
    ![
      DOCTYPE.TECH_DESIGN as string,
      DOCTYPE.DEVELOPMENT_PLAN as string,
      DOCTYPE.QA_PLAN as string,
      DOCTYPE.RELEASE_PLAN as string,
    ].includes(type)
  ) {
    // get prd content from database on the created PRD template document
    let templateDoc = await prisma.templateDocument.findFirst({
      where: {
        organizationId: currentUser.organizationId,
        type:
          type === DOCTYPE.RELEASE_PLAN
            ? DOCTYPE.DEVELOPMENT_PLAN
            : DOCTYPE.PRD,
        status: TemplateStatus.PUBLISHED,
      },
      select: {
        sampleOutputText: true,
      },
    });
    if (!templateDoc) {
      // fallback to a public PRD template document from omniflow organization
      templateDoc = await prisma.templateDocument.findFirst({
        where: {
          organizationId: OrganizationID.Willy,
          type:
            type === DOCTYPE.RELEASE_PLAN
              ? DOCTYPE.DEVELOPMENT_PLAN
              : DOCTYPE.PRD,
          status: TemplateStatus.PUBLISHED,
          access: Access.PUBLIC,
        },
        select: {
          sampleOutputText: true,
        },
      });
    }
    if (templateDoc) {
      inputContent = templateDoc.sampleOutputText as string;
      console.log(
        'in documentService.genTemplateDocumentDoc:',
        type,
        templateDoc,
        inputContent
      );
    } else {
      throw new Error('No public PRD template document found.');
    }
  }
  switch (type) {
    case DOCTYPE.PRD:
      const prdStream = await genPRD(docData, currentUser);
      const prdTemplateResult = await processStream(prdStream);
      generateContent = prdTemplateResult.content;
      break;
    case DOCTYPE.UI_DESIGN:
      generateContent = 'This type is not supported yet.';
      break;
    case DOCTYPE.TECH_DESIGN:
      const techDesignStream = await genTechDesign(docData, currentUser);
      const techTemplateResult = await processStream(techDesignStream);
      generateContent = techTemplateResult.content;
      break;
    case DOCTYPE.DEVELOPMENT_PLAN:
      // Fetch organization meta to get documentGenerateLang setting
      const org = await prisma.organization.findUnique({
        where: { id: currentUser.organizationId },
        select: { meta: true },
      });
      const orgMeta = (org?.meta as Prisma.JsonObject) ?? {};
      const documentGenerateLang =
        (orgMeta?.documentGenerateLang as string) || undefined;
      const devPlanContents = {
        weeksPerSprint: DefaultWeeksPerSprint,
        teamMembers: [
          {
            userId: currentUser.userId,
            specialty: 'fullstack engineer',
            storyPointsPerSprint: DefaultStoryPointsPerSprint,
          },
        ],
        requiredSpecialties: ['Fullstack Engineer'],
        chosenDocumentIds: [],
        sprintStartDate: new Date().toDateString(),
        sampleTaskStoryPoint: DefaultSampleTaskStoryPoint,
        prdContent: inputContent,
        techDesignContent: '',
        documentGenerateLang,
      };
      try {
        generateContent = (await genDevPlan(
          docData,
          devPlanContents,
          currentUser
        )) as string;
      } catch (error) {
        const errorMsg = (error as string | Error).toString();
        console.error(
          'Error generating dev plan in server.routes.api.documents.generate',
          errorMsg
        );
      }
      break;
    case DOCTYPE.QA_PLAN:
      const qaPlanStream = await genQAPlan(docData, currentUser);
      const qaTemplateResult = await processStream(qaPlanStream);
      generateContent = qaTemplateResult.content;
      break;
    case DOCTYPE.RELEASE_PLAN:
      const releasePlanStream = await genReleasePlan(docData, currentUser);
      const releaseTemplateResult = await processStream(releasePlanStream);
      generateContent = releaseTemplateResult.content;
      break;
    case DOCTYPE.BUSINESS:
    case DOCTYPE.PRODUCT:
    case DOCTYPE.ENGINEERING:
    case DOCTYPE.MARKETING:
    case DOCTYPE.SALES:
    case DOCTYPE.SUPPORT:
      const defaultDocStream = await genDefaultDoc(docData, currentUser);
      const defaultTemplateResult = await processStream(defaultDocStream);
      generateContent = defaultTemplateResult.content;
      break;
    case DOCTYPE.PROPOSAL:
    case DOCTYPE.OTHER:
      break;
  }

  if (!Boolean(generateContent.trim())) {
    throw new Error('generated template example document content is empty!');
  }
  return generateContent.trim();
}

const tryExceptToolWrapper = async (
  toolCall: any,
  toolHandlers: Record<string, (args: any) => Promise<string>>,
  docData: any,
  currentUser: AuthenticatedUserWithProfile,
  setHasSchemaChange: (value: boolean) => void
) => {
  const { name, args, id } = toolCall;
  try {
    if (!toolHandlers[name]) {
      throw new Error(`Unknown tool: ${name}`);
    }

    console.log('toolCall:', toolCall);

    const response = await toolHandlers[name](args);

    const toolMessage = new ToolMessage({
      tool_call_id: id,
      content: [
        {
          type: 'text',
          text: response,
        },
      ],
      name: name,
    });

    // Handle specific tool side effects
    if (name === writeFilesToolName || name === searchReplaceToolName) {
      // Parse args.files if it's a string to convert it to JSON first
      let files = args.files || args.replacements;
      if (typeof files === 'string') {
        try {
          files = JSON.parse(files);
        } catch (error) {
          console.error('Failed to parse args.files as JSON:', error);
          throw new Error(
            'Invalid args.files format: expected JSON string or array'
          );
        }
      }

      let filePaths = files.map((file: any) => file.filePath);
      if (
        filePaths.includes('backend/db/schema.ts') ||
        filePaths.includes('src/lib/db/schema.ts')
      ) {
        setHasSchemaChange(true);
      }
    }

    if (name === planFilesToolName) {
      if (docData.onProgress) {
        args.files.forEach((file: any) => {
          docData.onProgress(
            JSON.stringify({
              text: {
                path: file.filePath,
                content:
                  file.purpose || file.description || 'No description provided',
              },
            })
          );
        });
      }
    }
    return toolMessage;
  } catch (error: any) {
    let suggestion = error.message.includes('identical')
      ? 'Please provide different content for the change'
      : error.message.includes('not found')
      ? 'Please verify the file path or create the file first'
      : (error.message.includes(
          'Received tool input did not match expected schema'
        ) ||
          error.message.includes('Stringification detected')) &&
        name === 'write_files'
      ? 'Please reconstruct the arguments of write_files tool and tool calls arguments. Do not stringify write_files tool input, otherwise it will cause server parsing errors.'
      : error.message;
    // Create an error message that the LLM can understand and act upon
    const errorContext = {
      tool: name,
      args: args,
      error: error.message,
      suggestion,
    };

    // track tool execution error
    mixpanel.track('tool_execution_error', {
      distinct_id: currentUser.email,
      docId: docData.id,
      docType: docData.type,
      toolName: name,
      suggestion,
      errorMessage: error.message,
    });

    const errorMessage = new ToolMessage({
      tool_call_id: id,
      content: JSON.stringify(errorContext, null, 2),
      name: name,
    });

    // Log the error for debugging
    console.error('Tool execution error:', errorContext);

    return errorMessage;
  }
};

/**
 * Filters PRD content to keep only essential information.
 * Removes sections related to architecture design and future improvements.
 */
function filterEssentialPRDContent(prdContent: string): string {
  if (!prdContent) return prdContent;

  let filtered = prdContent;

  // Patterns to match section headers (both HTML and markdown formats)
  const architecturePatterns = [
    /<h2[^>]*>[\s]*System Architecture[\s]*<\/h2>[\s\S]*?(?=<h[12]|$)/gi,
    /<h2[^>]*>[\s]*Architecture[\s]*<\/h2>[\s\S]*?(?=<h[12]|$)/gi,
    /<h2[^>]*>[\s]*Architecture Design[\s]*<\/h2>[\s\S]*?(?=<h[12]|$)/gi,
    /<h2[^>]*>[\s]*Technical Architecture[\s]*<\/h2>[\s\S]*?(?=<h[12]|$)/gi,
    /##[\s]*System Architecture[\s]*##?[\s\S]*?(?=##|$)/gi,
    /##[\s]*Architecture[\s]*##?[\s\S]*?(?=##|$)/gi,
    /##[\s]*Architecture Design[\s]*##?[\s\S]*?(?=##|$)/gi,
    /##[\s]*Technical Architecture[\s]*##?[\s\S]*?(?=##|$)/gi,
  ];

  const futureImprovementPatterns = [
    /<h2[^>]*>[\s]*Future Improvements?[\s]*<\/h2>[\s\S]*?(?=<h[12]|$)/gi,
    /<h2[^>]*>[\s]*Future Enhancements?[\s]*<\/h2>[\s\S]*?(?=<h[12]|$)/gi,
    /<h2[^>]*>[\s]*Roadmap[\s]*<\/h2>[\s\S]*?(?=<h[12]|$)/gi,
    /<h2[^>]*>[\s]*Future Plans?[\s]*<\/h2>[\s\S]*?(?=<h[12]|$)/gi,
    /##[\s]*Future Improvements?[\s]*##?[\s\S]*?(?=##|$)/gi,
    /##[\s]*Future Enhancements?[\s]*##?[\s\S]*?(?=##|$)/gi,
    /##[\s]*Roadmap[\s]*##?[\s\S]*?(?=##|$)/gi,
    /##[\s]*Future Plans?[\s]*##?[\s\S]*?(?=##|$)/gi,
  ];

  // Remove architecture sections
  for (const pattern of architecturePatterns) {
    filtered = filtered.replace(pattern, '');
  }

  // Remove future improvement sections
  for (const pattern of futureImprovementPatterns) {
    filtered = filtered.replace(pattern, '');
  }

  // Clean up multiple consecutive newlines/whitespace
  filtered = filtered.replace(/\n{3,}/g, '\n\n');
  filtered = filtered.replace(/\s{3,}/g, ' ');

  return filtered.trim();
}

/**
 * Extract routes and pages from generated files for README generation
 */
function extractAppStructure(files: Array<{ path: string; content: string }>): {
  appName: string;
  framework: string;
  pages: Array<{ path: string; route: string; description?: string }>;
} {
  let appName = 'App';
  let framework = 'Unknown';
  const pages: Array<{ path: string; route: string; description?: string }> =
    [];

  // Extract app name and framework from package.json
  const packageJsonFile = files.find((f) => f.path === 'package.json');
  if (packageJsonFile) {
    try {
      const packageJson = JSON.parse(packageJsonFile.content);
      appName = packageJson.name || appName;
      if (packageJson.dependencies?.next) {
        framework = 'Next.js';
      } else if (packageJson.dependencies?.react) {
        framework = 'React';
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  // Extract pages/routes based on framework
  if (framework === 'Next.js') {
    // Next.js App Router: look for page.tsx files in src/app directory
    const pageFiles = files.filter(
      (f) =>
        (f.path.includes('src/app/') || f.path.includes('app/')) &&
        (f.path.endsWith('/page.tsx') ||
          f.path.endsWith('/page.js') ||
          f.path.endsWith('/page.ts'))
    );

    pageFiles.forEach((file) => {
      // Extract route from file path
      // src/app/page.tsx -> /
      // src/app/about/page.tsx -> /about
      // src/app/products/[id]/page.tsx -> /products/[id]
      // app/(auth)/login/page.tsx -> /login (route groups)
      let route = file.path
        .replace(/^(src\/)?app\//, '/')
        .replace(/\/page\.(tsx|js|ts)$/, '')
        .replace(/\/index$/, '')
        .replace(/\([^)]+\)\//g, ''); // Remove route groups like (auth)
      if (route === '') route = '/';

      // Try to extract page title/description from content
      const titleMatch =
        file.content.match(/export\s+default\s+function\s+(\w+)/) ||
        file.content.match(/const\s+(\w+)\s*=\s*\(\)\s*=>/) ||
        file.content.match(/function\s+(\w+)\s*\(/);
      const componentName = titleMatch ? titleMatch[1] : undefined;

      // Try to find metadata or title in the file
      const metadataMatch = file.content.match(
        /(?:title|name|heading)[\s:]*['"]([^'"]+)['"]/i
      );
      const description = metadataMatch
        ? metadataMatch[1]
        : componentName || undefined;

      pages.push({
        path: file.path,
        route,
        description,
      });
    });
  } else if (framework === 'React') {
    // React Router: look for route definitions in App.tsx or main router file
    const appFile =
      files.find((f) => f.path === 'src/App.tsx') ||
      files.find((f) => f.path === 'src/app.tsx') ||
      files.find((f) => f.path === 'App.tsx') ||
      files.find((f) => f.path.includes('App.') && f.path.endsWith('.tsx'));

    if (appFile) {
      // Extract routes from Route components (v6 syntax: <Route path="..." element={<Component />} />)
      const routeRegexV6 =
        /<Route\s+path=["']([^"']+)["'][^>]*element=\{<([^/>\s]+)[^>]*\/>\}/g;
      let match;
      while ((match = routeRegexV6.exec(appFile.content)) !== null) {
        const route = match[1];
        const componentName = match[2];

        // Try to find corresponding component file
        const componentFile = files.find(
          (f) =>
            (f.path.includes(componentName) ||
              f.path.includes(componentName.toLowerCase())) &&
            (f.path.endsWith('.tsx') ||
              f.path.endsWith('.jsx') ||
              f.path.endsWith('.ts') ||
              f.path.endsWith('.js'))
        );

        pages.push({
          path: componentFile?.path || 'src/App.tsx',
          route,
          description: componentName,
        });
      }

      // Also try v5 syntax: <Route path="..." component={Component} />
      const routeRegexV5 =
        /<Route\s+path=["']([^"']+)["'][^>]*component=\{(\w+)\}/g;
      while ((match = routeRegexV5.exec(appFile.content)) !== null) {
        const route = match[1];
        const componentName = match[2];

        const componentFile = files.find(
          (f) =>
            (f.path.includes(componentName) ||
              f.path.includes(componentName.toLowerCase())) &&
            (f.path.endsWith('.tsx') ||
              f.path.endsWith('.jsx') ||
              f.path.endsWith('.ts') ||
              f.path.endsWith('.js'))
        );

        pages.push({
          path: componentFile?.path || 'src/App.tsx',
          route,
          description: componentName,
        });
      }

      // If no routes found, check for page components in src/pages or src/components/pages
      if (pages.length === 0) {
        const pageFiles = files.filter(
          (f) =>
            (f.path.includes('src/pages/') ||
              f.path.includes('src/components/pages/') ||
              f.path.includes('pages/')) &&
            (f.path.endsWith('.tsx') ||
              f.path.endsWith('.jsx') ||
              f.path.endsWith('.ts') ||
              f.path.endsWith('.js'))
        );

        pageFiles.forEach((file) => {
          const fileName =
            file.path
              .split('/')
              .pop()
              ?.replace(/\.(tsx|jsx|ts|js)$/, '') || '';
          const route = `/${fileName.toLowerCase()}`;
          pages.push({
            path: file.path,
            route,
          });
        });
      }
    }
  }

  // Deduplicate pages by route
  const uniquePages = new Map<
    string,
    { path: string; route: string; description?: string }
  >();
  pages.forEach((page) => {
    if (!uniquePages.has(page.route)) {
      uniquePages.set(page.route, page);
    }
  });

  return {
    appName,
    framework,
    pages: Array.from(uniquePages.values()),
  };
}

/**
 * Generate README.md content for prototype/product apps
 */
function generateReadmeContent(
  files: Array<{ path: string; content: string }>,
  docName?: string
): string {
  const { appName, framework, pages } = extractAppStructure(files);
  const displayName = docName || appName;

  let readme = `# ${displayName}\n\n`;
  readme += `This is a ${framework} application.\n\n`;

  // App Info Section
  readme += `## App Information\n\n`;
  readme += `- **Framework**: ${framework}\n`;
  readme += `- **Name**: ${appName}\n\n`;

  // Page Structure Section
  if (pages.length > 0) {
    readme += `## Page Structure\n\n`;
    readme += `The application contains the following pages:\n\n`;

    pages.forEach((page) => {
      readme += `### ${page.route}\n`;
      readme += `- **File**: \`${page.path}\`\n`;
      if (page.description) {
        readme += `- **Description**: ${page.description}\n`;
      }
      readme += `\n`;
    });
  } else {
    readme += `## Page Structure\n\n`;
    readme += `No pages detected in the application structure.\n\n`;
  }

  // Routes Section
  if (pages.length > 0) {
    readme += `## Routes\n\n`;
    readme += `| Route | File | Description |\n`;
    readme += `|-------|------|-------------|\n`;

    pages.forEach((page) => {
      const route = page.route || '/';
      const file = page.path || 'N/A';
      const description = page.description || '-';
      readme += `| \`${route}\` | \`${file}\` | ${description} |\n`;
    });
    readme += `\n`;
  }

  readme += `\n## Getting Started\n\n`;
  readme += `1. Install dependencies:\n`;
  readme += `   \`\`\`bash\n`;
  readme += `   npm install\n`;
  readme += `   \`\`\`\n\n`;
  readme += `2. Run the development server:\n`;
  readme += `   \`\`\`bash\n`;
  if (framework === 'Next.js') {
    readme += `   npm run dev\n`;
  } else {
    readme += `   npm start\n`;
  }
  readme += `   \`\`\`\n\n`;

  return readme;
}

/**
 * Add README.md to generated files if it doesn't exist
 */
function addReadmeToFiles(generateContent: string, docName?: string): string {
  try {
    // Only process if content is valid JSON (PROTOTYPE/PRODUCT format)
    if (!generateContent || typeof generateContent !== 'string') {
      return generateContent;
    }

    const contentData = JSON.parse(generateContent);
    if (!contentData || typeof contentData !== 'object') {
      return generateContent;
    }

    if (!contentData.files || !Array.isArray(contentData.files)) {
      return generateContent;
    }

    // Check if README.md already exists
    const hasReadme = contentData.files.some(
      (f: any) =>
        f &&
        typeof f === 'object' &&
        (f.path === 'README.md' ||
          f.path === 'readme.md' ||
          f.path?.toLowerCase() === 'readme.md')
    );

    if (!hasReadme && contentData.files.length > 0) {
      // Generate README content
      const readmeContent = generateReadmeContent(contentData.files, docName);

      // Add README.md to files array
      contentData.files.push({
        path: 'README.md',
        content: readmeContent,
      });

      return JSON.stringify(contentData);
    }
  } catch (e) {
    console.error('Error adding README to files:', e);
    // Return original content if parsing/generation fails
  }

  return generateContent;
}

export async function genDocumentAfterChat(
  org: Organization,
  currentUser: AuthenticatedUserWithProfile,
  docData: DocumentGenerationInput & {
    onProgress: (progress: string) => void;
    initialDeployError?: string; // Optional: initial deployment error to fix
  }
) {
  const orgMeta = (org.meta as Prisma.JsonObject) ?? {};
  const {
    projectId,
    id: docId,
    type: docType,
    description,
    name,
    chatSessionId,
    contents,
    isFixingDeploymentError,
    meta,
  } = docData;
  console.log(
    'documentServices.genDocumentAfterChat.start:',
    currentUser?.userId,
    docData
  );
  let generateContent = '';
  let fileUrl = '';
  let migrations: {
    success: boolean;
    migrationId?: string;
    error?: string;
    failedMigrationFile?: string | null;
  } = { success: false };
  let sourceUrl = '';
  let deployResult: DeployResult | null = null;
  const stopKey = `stop-generation:${docId}`;
  const generationStatusKey = `document-generating:${docId}`;

  // Set Redis key to indicate generation is in progress
  if (docId) {
    await RedisSingleton.setData({
      key: generationStatusKey,
      val: 'true',
      expireInSec: 3600, // Expire after 1 hour as safety measure
    });
  }

  let docInDB = docId
    ? await prisma.document.findUnique({
        where: {
          id: docId,
        },
      })
    : null;

  let docMeta = docInDB?.meta as Prisma.JsonObject;
  let repoUrl = docMeta?.repoUrl || '';
  // Preserve original envSettings structure (may be nested with preview/production)
  let rawEnvSettings = docMeta?.envSettings || null;
  // Get normalized settings for current environment (always use 'preview' for code generation)
  let envSettings = rawEnvSettings
    ? (normalizeEnvSettings(rawEnvSettings, 'preview') as EnvSettings)
    : null;

  //define generatedDescription for tagged documents and uploaded files
  let additionalContextFromUserFiles = '';
  let imageData: ImageData[] = []; // Collect image data (base64 + public URL) for LLM
  let prdDocContent = '';
  let prdDocDescription = '';
  const chosenDocumentIds = docData.chosenDocumentIds ?? '';
  const uploadedFileContent = docData.uploadedFileContent ?? [];

  // For NON-PRD generation, automatically include PRD from the same project
  if (docType.trim() !== DOCTYPE.PRD) {
    const prdDoc = await prisma.document.findFirst({
      where: {
        projectId: projectId,
        type: DOCTYPE.PRD,
        status: {
          not: DocumentStatus.CANCELED,
        },
      },
      orderBy: {
        createdAt: 'desc', // Get the most recent PRD
      },
      select: {
        content: true,
        description: true,
      },
    });
    if (prdDoc?.content) {
      prdDocContent = filterEssentialPRDContent(
        prdDoc.content.toString('utf-8')
      );
      prdDocDescription = prdDoc.description || '';
    }
  }
  let designReference = ''; // Collect design reference separately for PRD documents

  // Fetch org-level designStyle once for reuse across PRD, PROTOTYPE, and PRODUCT docs
  let designStyle: { styleInfo: any } | null = null;
  if (
    docType === DOCTYPE.PRD ||
    docType === DOCTYPE.PROTOTYPE ||
    docType === DOCTYPE.PRODUCT
  ) {
    designStyle = await prisma.designStyle.findFirst({
      where: {
        organizationId: org.id,
        status: RecordStatus.ACTIVE,
      },
      orderBy: {
        version: 'desc', // get latest version
      },
      select: {
        styleInfo: true,
      },
    });
  }

  if (uploadedFileContent.length > 0) {
    for (const item of uploadedFileContent) {
      if (item.fileType !== 'image') {
        additionalContextFromUserFiles += item.fileContent + '\n';
      } else {
        // Collect image data: base64 for LLM viewing + S3 URL for code generation
        if (item.fileContent && item.fileContent.startsWith('data:image/')) {
          const image: ImageData = {
            base64DataUrl: item.fileContent, // For LLM to view the image
            publicUrl: item.s3Url, // For code generation (optional)
          };
          imageData.push(image);
        }

        // For PRD documents, extract design information from images for design reference
        // Use S3 URL if available (for better performance), otherwise use base64
        if (docType === DOCTYPE.PRD && (item.s3Url || item.fileContent)) {
          try {
            const imageSource = item.s3Url || item.fileContent;
            const designInfo = await extractDetailStyleFromImage(
              imageSource,
              currentUser,
              docId,
              docType
            );
            // Add to design reference for PRD generation
            if (designReference) {
              designReference += '\n\n';
            }
            designReference += designInfo;
          } catch (error) {
            console.error(
              'Failed to extract design information from image:',
              error
            );
            // If extraction fails, LLM will still have access to the image via imageData
          }
        }
      }
    }
  }
  // If no design reference for PRD, use designStyle from database as fallback (already fetched)
  if (
    docType === DOCTYPE.PRD &&
    designReference.trim() === '' &&
    designStyle?.styleInfo
  ) {
    designReference = String(designStyle.styleInfo);
  }

  let promptText = ''; // for generation using template
  let templateId = docData.templateId;
  if (templateId) {
    // update template use count
    await prisma.templateDocument.update({
      where: {
        id: templateId,
      },
      data: {
        useCount: { increment: 1 },
      },
    });
    // handle all other types of doc generation using a template. The promptText is already written and we will use it
    console.log(
      'documentServices.genDocumentAfterChat.actualDocBasedOnTemplatePrompt:'
    );
    promptText = await getGenTemplateDocumentPrompt(templateId);
  }
  if (docType === DOCTYPE.PRD) {
    const prdStream = await genPRD(
      {
        ...docData,
        additionalContextFromUserFiles,
        designReference,
        chatSessionId,
      },
      currentUser
    );
    const prdResult = await processStream(
      prdStream,
      docData.onProgress,
      stopKey
    );
    // If stopped early, preserve existing content; otherwise use new content
    if (prdResult.wasStopped && docData.contents) {
      generateContent = docData.contents;
    } else {
      generateContent = prdResult.content;
    }
  } else if (docType === DOCTYPE.TECH_DESIGN) {
    const techDesignStream = await genTechDesign(
      { ...docData, additionalContextFromUserFiles, chatSessionId },
      currentUser
    );
    const techResult = await processStream(
      techDesignStream,
      docData.onProgress,
      stopKey
    );
    // If stopped early, preserve existing content; otherwise use new content
    if (techResult.wasStopped && docData.contents) {
      generateContent = docData.contents;
    } else {
      generateContent = techResult.content;
    }
  } else if (docType === DOCTYPE.DEVELOPMENT_PLAN) {
    const sampleTaskStoryPoint =
      (orgMeta?.sampleTaskStoryPoint as number) || DefaultSampleTaskStoryPoint;
    const documentGenerateLang =
      (orgMeta?.documentGenerateLang as string) || undefined;
    const schedulingParameters = DevPlanMetaSchema.parse(docData.meta);
    // Add PRD content if available (from auto-detected PRD)
    if (prdDocContent) {
      if (additionalContextFromUserFiles) {
        additionalContextFromUserFiles += '\n\n';
      }
      additionalContextFromUserFiles += `## Product Requirement Document (PRD) ##\n${prdDocContent}`;
    }

    const contents: DevPlanGenInput = {
      additionalContextFromUserFiles,
      ...schedulingParameters,
      sampleTaskStoryPoint,
      documentGenerateLang,
    } as DevPlanGenInput;

    try {
      generateContent = (await genDevPlan(
        docData,
        contents,
        currentUser
      )) as string;

      // Send completion event for dev plan generation
      if (docData.onProgress && generateContent) {
        try {
          const devPlanData = JSON.parse(generateContent);
          if (devPlanData.epics && devPlanData.epics.length > 0) {
            docData.onProgress(
              JSON.stringify({
                status: { message: 'Dev plan generation completed' },
                completed: true,
                docId: docData.id,
              })
            );
          }
        } catch (parseError) {
          console.error(
            'Error parsing dev plan content for completion event:',
            parseError
          );
        }
      }
    } catch (error) {
      const errorMsg = (error as string | Error).toString();
      console.error(
        'Error generating dev plan in documentServices.genDocumentAfterChat.generate',
        errorMsg
      );
      // Send error event via SSE if available
      if (docData.onProgress) {
        docData.onProgress(
          JSON.stringify({
            error: errorMsg,
            completed: false,
            docId: docData.id,
          })
        );
      }
      // save error code into redis in case server request times out
      RedisSingleton.setData({
        key: `devplan:${docData.id}`,
        val: errorMsg,
        expireInSec: 30,
      });
      // Set generateContent to empty string to prevent Buffer.from error
      generateContent = '';
    }

    // Check if generation failed (generateContent is undefined, null, or empty)
    // This handles the case where genDevPlan returns undefined without throwing
    if (
      !generateContent ||
      (typeof generateContent === 'string' && generateContent.trim() === '')
    ) {
      console.error('Dev plan generation failed: no content generated');
      // Send error event via SSE if available
      if (docData.onProgress) {
        docData.onProgress(
          JSON.stringify({
            error: 'Dev plan generation failed: no content generated',
            completed: false,
            docId: docData.id,
          })
        );
      }
      // Don't proceed with saving - return early
      return '';
    }
  } else if (docType === DOCTYPE.QA_PLAN) {
    console.log(
      'documentServices.genDocumentAfterChat.generate.QA_PLAN:',
      additionalContextFromUserFiles
    );
    const qaPlanStream = await genQAPlan(
      { ...docData, additionalContextFromUserFiles, chatSessionId },
      currentUser
    );
    const qaResult = await processStream(
      qaPlanStream,
      docData.onProgress,
      stopKey
    );
    // If stopped early, preserve existing content; otherwise use new content
    if (qaResult.wasStopped && docData.contents) {
      generateContent = docData.contents;
    } else {
      generateContent = qaResult.content;
    }
  } else if (docType === DOCTYPE.RELEASE_PLAN) {
    console.log(
      'documentServices.genDocumentAfterChat.generate.RELEASE_PLAN:',
      additionalContextFromUserFiles
    );

    const releasePlanStream = await genReleasePlan(
      { ...docData, additionalContextFromUserFiles, chatSessionId },
      currentUser
    );
    const releaseResult = await processStream(
      releasePlanStream,
      docData.onProgress,
      stopKey
    );
    // If stopped early, preserve existing content; otherwise use new content
    if (releaseResult.wasStopped && docData.contents) {
      generateContent = docData.contents;
    } else {
      generateContent = releaseResult.content;
    }
  } else if (docType === DOCTYPE.UI_DESIGN) {
    console.log(
      'documentServices.genDocumentAfterChat.generate.uiDesign:',
      additionalContextFromUserFiles
    );

    // Extract base64 data URL from imageData for UI Design generation
    let imageBase64 = '';
    if (imageData.length > 0) {
      imageBase64 = imageData[0].base64DataUrl;
    }

    const stream = await genUIDesignAnthropic(
      {
        ...docData,
        imageBase64,
        additionalContextFromUserFiles,
        chatSessionId,
      },
      currentUser
    );
    const uiResult = await processStream(stream, docData.onProgress, stopKey);
    // If stopped early, preserve existing content; otherwise use new content
    if (uiResult.wasStopped && docData.contents) {
      generateContent = docData.contents;
    } else {
      generateContent = uiResult.content;
    }
  } else if (docType === DOCTYPE.PROTOTYPE || docType === DOCTYPE.PRODUCT) {
    if (docType === DOCTYPE.PRODUCT && !envSettings?.DATABASE_URL) {
      envSettings = await autoCreateDatabaseIfMissing(docData);
    }

    const sendStatus = (message: string) => {
      try {
        if (docData.onProgress) {
          docData.onProgress(
            JSON.stringify({
              status: { message },
            })
          );
        }
      } catch (error) {
        // If connection is lost, status updates may fail silently
        // This is okay - the frontend will poll for completion
        console.log(
          'Failed to send status update (connection may be lost):',
          message
        );
      }
    };

    deployResult = {
      sourceUrl: '',
      success: false,
      errorMessage:
        docData.initialDeployError ||
        (isFixingDeploymentError ? description : ''),
      deploymentId: '',
    };
    let lastSuccessfulDeployResult: DeployResult | null = null;
    let userStoppedGeneration = false;
    let retryCount = 0;
    // Error repetition detection
    let lastErrorMessage = '';
    let sameErrorCount = 0;
    console.log(
      `[DEBUG] Initialized retryCount: ${retryCount}, polishAppRetryMax: ${polishAppRetryMax}`
    );

    let originalCode = docData.contents;
    // Detect framework preference from description or use default
    const framework = determineFramework(
      docData.description,
      prdDocDescription,
      prdDocContent
    );

    if (!originalCode || originalCode.length === 0) {
      const defaultCodeWithUIComponents = await defaultReactProjectCodeTemplate(
        docData.type,
        projectId,
        framework
      );
      originalCode = JSON.stringify(defaultCodeWithUIComponents);
    }

    const appGenState = docData.contents
      ? AppGenState.IMPROVE
      : AppGenState.STARTER;

    // Check if user requested Stripe/payment features in conversation
    console.log(
      '🔍 Checking for Stripe feature request...',
      `chatSessionId: ${chatSessionId}, additionalContext length: ${additionalContextFromUserFiles.length}`
    );
    const stripeFeatureRequested = await checkStripeFeatureRequested(
      chatSessionId,
      additionalContextFromUserFiles
    );
    console.log(
      `🔍 Stripe feature requested: ${stripeFeatureRequested}, appGenState: ${appGenState}`
    );

    // Handle Stripe module integration based on app state and user request
    const { code: modifiedCode, stripeIntegrated } = await handleStripeFiles(
      originalCode,
      appGenState,
      stripeFeatureRequested,
      docMeta
    );
    originalCode = modifiedCode;

    if (stripeIntegrated) {
      console.log('✅ Stripe module has been integrated into the codebase');
    }

    // First initialize the codebase manager with the code
    const codebaseManager = initializeCodebaseManager(originalCode);
    // Then create tools that will use the shared manager
    const [
      getFilesContentTool,
      listFilesTool,
      findMatchingFilesTool,
      writeFilesTool,
      planFilesTool,
      deleteFilesTool,
      searchReplaceTool,
      webSearchTool,
      externalFileFetchTool,
    ] = createCodebaseTools(codebaseManager);
    const unsplashSearchTool = createUnsplashSearchTool();
    const tools = [
      getFilesContentTool,
      listFilesTool,
      findMatchingFilesTool,
      writeFilesTool,
      planFilesTool,
      deleteFilesTool,
      searchReplaceTool,
      webSearchTool,
      externalFileFetchTool,
      unsplashSearchTool,
    ];

    // Define a mapping of tool names to their handlers for better maintainability
    const toolHandlers: Record<string, (args: any) => Promise<string>> = {
      [getFilesContentTool.name]: async (args) => {
        const { filePaths } = args;
        return await getFilesContentTool.invoke({ filePaths });
      },
      [listFilesTool.name]: async (args) => {
        const { directory, pattern } = args;
        return await listFilesTool.invoke({ directory, pattern });
      },
      [findMatchingFilesTool.name]: async (args) => {
        const { keyword, caseSensitive, directory } = args;
        return await findMatchingFilesTool.invoke({
          keyword,
          caseSensitive,
          directory,
        });
      },
      [writeFilesTool.name]: async (args) => {
        const { files } = args;
        return await writeFilesTool.invoke({ files });
      },
      [searchReplaceTool.name]: async (args) => {
        const { replacements } = args;
        return await searchReplaceTool.invoke({ replacements });
      },
      [planFilesTool.name]: async (args) => {
        const { files } = args;
        return await planFilesTool.invoke({ files });
      },
      [deleteFilesTool.name]: async (args) => {
        const { filePaths } = args;
        return await deleteFilesTool.invoke({ filePaths });
      },
      [webSearchTool.name]: async (args) => {
        const { query } = args;
        return await webSearchTool.invoke({ query });
      },
      [externalFileFetchTool.name]: async (args) => {
        const { url, fileType } = args;
        return await externalFileFetchTool.invoke({ url, fileType });
      },
      [unsplashSearchTool.name]: async (args) => {
        return await unsplashSearchTool.invoke(args);
      },
    };

    // Get codebase information from the manager directly
    let availableFiles = codebaseManager.getAvailableFiles();
    const readmeContent = codebaseManager.getReadmeContent();

    // Load connectors and inject their environment variables
    let enhancedEnvSettings = envSettings;
    try {
      const connectors = await getConnectorsForDocument(docData.id, 'preview');
      const previewConnectors = connectors.preview || [];

      if (previewConnectors.length > 0) {
        enhancedEnvSettings = { ...envSettings };

        // Inject connector credentials as environment variables
        for (const connector of previewConnectors) {
          if (connector.type === 'custom_api' && connector.envVars) {
            Object.assign(enhancedEnvSettings, connector.envVars);
          }
        }

        console.log(
          `[DocumentService] Injected env vars from ${previewConnectors.length} connector(s)`
        );
      }
    } catch (error) {
      console.log(
        '[DocumentService] Could not load connector env vars:',
        error
      );
    }

    let starterGen = appGenState === AppGenState.STARTER;
    const codeWithoutUIComponents = convertJsonToCode(originalCode);

    let messages = await buildInitialMessages({
      appGenState,
      docId: docData.id,
      docType: docData.type,
      refImage: null, // Images are now handled via imageData
      imageData: imageData, // Pass image data (base64 + URLs) for LLM
      starterCode: starterGen ? codeWithoutUIComponents : '',
      availableFiles: starterGen ? [] : availableFiles,
      readmeContent: starterGen ? '' : readmeContent,
      chatSessionId,
      currentUser,
      framework,
      envSettings: enhancedEnvSettings,
      defaultDesignStyle: designStyle?.styleInfo || '',
      prdContent: prdDocContent || '',
    });

    // Initialize cache manager - assuming system message has cache
    const cacheManager = new CacheBlockManager(true);
    let breakOutputLoopFlag = false;

    let generationStartTimestamp = Date.now();
    // Continue loop if: 1) deployment failed (success=false), or 2) deployment has build errors (success=true but errorMessage exists)
    while (
      retryCount < polishAppRetryMax &&
      (!deployResult.success || deployResult.errorMessage)
    ) {
      console.log(
        `[DEBUG] Entering while loop. retryCount: ${retryCount}, polishAppRetryMax: ${polishAppRetryMax}, deployResult.success: ${deployResult?.success}, errorMessage length: ${deployResult?.errorMessage?.length}`
      );

      // Check if user explicitly stopped generation
      const stopResult = await checkAndHandleStopSignal(
        stopKey,
        docData.contents,
        retryCount,
        lastSuccessfulDeployResult
      );
      if (stopResult.shouldStop) {
        userStoppedGeneration = true;
        generateContent = stopResult.generateContent;
        if (stopResult.deployResult) {
          deployResult = stopResult.deployResult;
        }
        sourceUrl = stopResult.sourceUrl;
        break;
      }

      // Check if the same error message appears repeatedly (prevent infinite retry with same error)
      if (deployResult.errorMessage) {
        if (deployResult.errorMessage === lastErrorMessage) {
          sameErrorCount++;
          console.log(
            `[DEBUG] Same error detected. Count: ${sameErrorCount + 1}/3`
          );
          if (sameErrorCount >= 2) {
            // Same error appeared 3 times (initial + 2 retries)
            console.log(
              '⚠️ Same error appeared 3 times consecutively, stopping retry to avoid infinite loop'
            );
            sendStatus(
              'Unable to fix the error after multiple attempts. Please check the error details.'
            );
            // Track repeated error failure
            mixpanel.track('Deployment Retry Failed - Repeated Error', {
              distinct_id: `${docData.name}-${docId}`,
              email: currentUser.email,
              docId,
              docType,
              docName: docData.name,
              retryCount,
              errorMessage: deployResult.errorMessage.substring(0, 200), // First 200 chars
            });
            break;
          }
        } else {
          // Different error, reset counter
          sameErrorCount = 0;
          lastErrorMessage = deployResult.errorMessage;
          console.log('[DEBUG] New error detected, reset error counter');
        }
      }

      if (retryCount > 0) {
        sendStatus('polishing.app');
      }

      let hasPendingToolCalls = false;
      // Set hasSchemaChange to true in two cases:
      // 1. For STARTER state (first-time generation), because the template already contains schema and migrations
      // 2. If Stripe was integrated, because it adds new tables
      let hasSchemaChange =
        (starterGen && retryCount === 0) || stripeIntegrated;

      // Save Stripe module installation status to prevent duplicate installations
      if (stripeIntegrated && docId) {
        try {
          const stripeMetaUpdate = {
            stripeModuleInstalled: true,
            stripeModuleInstalledAt: new Date().toISOString(),
          };
          await updateDocumentMeta(docId, stripeMetaUpdate);
          // Update local meta variable to prevent overwrite later
          Object.assign(meta, stripeMetaUpdate);
          console.log(
            '✅ Saved Stripe module installation status to document meta'
          );
        } catch (error) {
          console.error('Error saving Stripe module status:', error);
        }
      }
      let toolCallingCount = 0;
      const maxToolCalls = 40; // Maximum number of tool calls to prevent infinite loops

      // Handle deployment errors more efficiently (includes migration errors and build errors set in deployResult.errorMessage)
      if (deployResult && deployResult.errorMessage) {
        // Check if this is a build error or migration error
        const isBuildError =
          deployResult.errorMessage.includes('Build') ||
          deployResult.errorMessage.includes('build') ||
          deployResult.errorMessage.includes('exited with') ||
          deployResult.errorMessage.includes('npm run build');
        const isMigrationError =
          deployResult.errorMessage.includes('migration') ||
          deployResult.errorMessage.includes('Migration');

        let errorPrompt = '';
        if (isMigrationError) {
          errorPrompt = `## ❌ DATABASE MIGRATION ERROR - CRITICAL FIX REQUIRED

**ERROR DETAILS:**
<error>${deployResult.errorMessage}</error>

**REQUIRED ACTIONS:**
1. **READ** the migration file using get_files_content to see current SQL
2. **IDENTIFY** the exact SQL syntax error (line number, statement)
3. **FIX** using search_replace tool with precise old/new SQL
4. **VERIFY** SQL syntax matches PostgreSQL standards

**COMMON ISSUES:**
- Missing semicolons or incorrect quote escaping
- ALTER TABLE without proper constraint handling
- Invalid data types or constraint syntax

**YOU MUST use search_replace tool to fix the migration file. DO NOT use write_files.**`;
        } else if (isBuildError) {
          errorPrompt = `## ❌ BUILD ERROR - CRITICAL FIX REQUIRED

**ERROR DETAILS:**
<error>${deployResult.errorMessage}</error>

**REQUIRED ACTIONS:**
1. **ANALYZE** the error message to extract:
   - Exact file path with the error
   - Line number of the error
   - Type of error (TypeScript, import, syntax, etc.)
2. **READ** the problematic file using get_files_content
3. **IDENTIFY** the exact code causing the error
4. **FIX** using search_replace tool with precise old/new code
5. **VERIFY** the fix addresses the root cause

**COMMON ISSUES:**
- Import paths incorrect or missing
- Type mismatches or undefined types
- Missing dependencies or wrong component usage
- Syntax errors (unclosed brackets, quotes, etc.)

**YOU MUST use search_replace tool to fix the code. DO NOT use write_files. Include enough context in old_string to make it unique.**`;
        } else {
          errorPrompt = `## ❌ DEPLOYMENT ERROR - CRITICAL FIX REQUIRED

**ERROR DETAILS:**
<error>${deployResult.errorMessage}</error>

**REQUIRED ACTIONS:**
1. **READ** the error message carefully and identify the root cause
2. **LOCATE** the problematic file(s) using get_files_content
3. **FIX** the exact issue using search_replace tool
4. **VERIFY** your fix addresses the specific error mentioned

**YOU MUST use tools to fix the issue. DO NOT just acknowledge the error.**`;
        }

        // Only keep first message (system message) for error retry
        messages.splice(1);
        // reset cache manager
        cacheManager.reset(true);

        // 2) Thinking-based planning step for deployment/migration error (no tools)
        try {
          const errorPlanningSystemPrompt =
            'You are a senior fullstack engineer. Analyze the following deployment or migration error and produce a precise internal plan (3-8 bullet points) describing which files to inspect and which tools (get_files_content, search_replace, write_files, plan_files, list_files, web_search, external_file_fetch) to use to fix it. Do not execute any tools and do not generate code in this step.';
          const errorPlanningHumanPrompt = errorPrompt;

          const errorPlan = await runThinkingPlan(
            ACTIVE_CLAUDE_MODEL_ID,
            errorPlanningSystemPrompt,
            errorPlanningHumanPrompt,
            {
              currentUser,
              docId: docData.id,
              docType: docData.type,
            }
          );

          if (errorPlan) {
            cacheManager.addMessageWithSmartCaching(
              messages,
              new HumanMessage({
                content: [
                  {
                    type: 'text',
                    text:
                      'Here is your internal plan for fixing the deployment error. Do not show this plan directly to the user; follow it with tool calls and code edits:\n\n' +
                      errorPlan,
                  },
                ],
              })
            );
          }
        } catch (planningError) {
          console.log(
            'Error planning step failed, continuing without thinking planner:',
            planningError
          );
        }

        // Add concrete error instructions as the latest human message for the tool-using run
        cacheManager.addMessageWithSmartCaching(
          messages,
          new HumanMessage({
            content: [
              {
                type: 'text',
                text: errorPrompt,
                cache_control: { type: 'ephemeral' },
              },
            ],
          })
        );
      }

      do {
        // Check if user explicitly stopped generation
        const stopResult = await checkAndHandleStopSignal(
          stopKey,
          docData.contents,
          retryCount,
          lastSuccessfulDeployResult
        );
        if (stopResult.shouldStop) {
          userStoppedGeneration = true;
          generateContent = stopResult.generateContent;
          if (stopResult.deployResult) {
            deployResult = stopResult.deployResult;
          }
          sourceUrl = stopResult.sourceUrl;
          breakOutputLoopFlag = true; // Signal to exit outer loop as well
          break;
        }

        // Improved cache redistribution strategy
        await cacheManager.redistributeCacheIfNeeded(messages);
        try {
          const stream = await genAppClaudeV2(
            ACTIVE_CLAUDE_MODEL_ID,
            async (output: any) => {
              processLLMEndCallback(output, ACTIVE_CLAUDE_MODEL_ID, {
                currentUser,
                docId,
                docType,
                streamingMode: true,
                skipCreditDeduction: retryCount > 0,
              });
            },
            tools,
            messages
          );

          let toolCalls: any[] = [];
          let gatheredContent = '';
          let additional_kwargs: any = {};
          let response_metadata: any = {};
          let messageFlushed: boolean = false;
          let hasIncompleteToolCall = false;
          let incompleteToolCallReason = '';

          for await (const event of processStreamJsonWithToolCalling(stream)) {
            if (event.type === 'content') {
              gatheredContent = event.text;
            } else if (!messageFlushed && event.type === 'tool_call') {
              // Check if tool call has valid arguments
              if (!event.toolCall.args) {
                hasIncompleteToolCall = true;
                incompleteToolCallReason = 'missing args';
                console.log(
                  'Incomplete tool call due to missing args, will retry...'
                );
                break; // Break out of the loop to trigger retry
              }

              // replace the last ':' at the end of the content with '.'
              gatheredContent = gatheredContent.trim().replace(/:$/, '.');
              retryCount === 0 &&
                gatheredContent &&
                (await prisma.chatHistory.create({
                  data: {
                    sessionId: chatSessionId || '',
                    message: {
                      type: 'ai',
                      content: gatheredContent,
                      additional_kwargs: {},
                      response_metadata: {},
                    },
                    messageUse: MessageUseTypes.CHAT,
                  },
                }));
              if (retryCount === 0 && gatheredContent && docData.onProgress) {
                docData.onProgress(
                  JSON.stringify({
                    chats: {
                      path: new Date().toISOString(), // use ISO timestamp for ordering
                      content: gatheredContent,
                    },
                  })
                );
              }
              messageFlushed = true;
              toolCalls.push(event.toolCall);
            } else if (event.type === 'additional_kwargs') {
              additional_kwargs = event.data;
            } else if (event.type === 'response_metadata') {
              response_metadata = event.data;
              // Check if the response was cut off due to token limits
              if (response_metadata?.usage?.total_tokens >= 64000) {
                console.log(
                  'Incomplete tool calls due to token limit exceeded, will retry...'
                );
                incompleteToolCallReason = 'token limit exceeded';
                // Add a flag to indicate potential incomplete response
                hasIncompleteToolCall = true;
              }
            }
          }

          // If we detected an incomplete tool call, throw an error to trigger retry
          if (hasIncompleteToolCall) {
            throw new Error(
              'Incomplete tool call detected:' + incompleteToolCallReason
            );
            incompleteToolCallReason = '';
          }
          if (retryCount === 0 && !messageFlushed && gatheredContent) {
            // Stream ended without a tool call
            await prisma.chatHistory.create({
              data: {
                sessionId: chatSessionId || '',
                message: {
                  type: 'ai',
                  content: gatheredContent,
                  additional_kwargs,
                  response_metadata,
                },
                messageUse: MessageUseTypes.BOTH,
              },
            });
            if (retryCount === 0 && docData.onProgress) {
              docData.onProgress(
                JSON.stringify({
                  chats: {
                    path: new Date().toISOString(), // use ISO timestamp for ordering
                    content: gatheredContent,
                  },
                })
              );
            }
          }

          hasPendingToolCalls = toolCalls && toolCalls.length > 0;

          if (hasPendingToolCalls) {
            // Smart AI message caching
            const aiMessage = new AIMessage({
              content: gatheredContent ?? '',
              tool_calls: toolCalls ?? [],
              additional_kwargs: additional_kwargs,
              response_metadata: response_metadata,
            });

            cacheManager.addMessageWithSmartCaching(messages, aiMessage);

            // Separate tool calls into external API tools and code tools
            // External API tools can run in parallel with code operations
            const externalApiToolNames = [
              webSearchToolName,
              externalFileFetchToolName,
              unsplashSearchToolName,
            ];

            const externalApiToolCalls: Array<{
              name: string;
              args: any;
              id: string;
              index: number;
            }> = [];
            const codeToolCalls: Array<{
              name: string;
              args: any;
              id: string;
              index: number;
            }> = [];

            toolCalls.forEach((toolCall, index) => {
              const toolCallWithIndex = { ...toolCall, index };
              if (externalApiToolNames.includes(toolCall.name)) {
                externalApiToolCalls.push(toolCallWithIndex);
              } else {
                codeToolCalls.push(toolCallWithIndex);
              }
            });

            // Execute external API tools and code tools in parallel
            // This allows external API calls (which can take 500ms-2s) to not block code generation
            const [externalApiResults, codeResults] = await Promise.all([
              // External API tools (web search, file fetch, unsplash)
              Promise.all(
                externalApiToolCalls.map((toolCall) =>
                  tryExceptToolWrapper(
                    toolCall,
                    toolHandlers,
                    docData,
                    currentUser,
                    (value) => {
                      hasSchemaChange = value;
                    }
                  ).then((result) => ({ result, index: toolCall.index }))
                )
              ),
              // Code tools (file operations, search/replace, etc.)
              Promise.all(
                codeToolCalls.map((toolCall) =>
                  tryExceptToolWrapper(
                    toolCall,
                    toolHandlers,
                    docData,
                    currentUser,
                    (value) => {
                      hasSchemaChange = value;
                    }
                  ).then((result) => ({ result, index: toolCall.index }))
                )
              ),
            ]);

            // Combine results maintaining original order (important for tool_call_id mapping)
            // Sort by original index to preserve the order in which tools were called
            const allResults = [...externalApiResults, ...codeResults].sort(
              (a, b) => a.index - b.index
            );
            const toolMessages = allResults.map(({ result }) => result);

            // Add tool results with strategic caching
            toolMessages.forEach((toolMsg) =>
              cacheManager.addMessageWithSmartCaching(messages, toolMsg)
            );
          } else {
            // Check if user explicitly stopped generation before expensive deployment
            const stopResult = await checkAndHandleStopSignal(
              stopKey,
              docData.contents,
              retryCount,
              lastSuccessfulDeployResult
            );
            if (stopResult.shouldStop) {
              userStoppedGeneration = true;
              generateContent = stopResult.generateContent;
              if (stopResult.deployResult) {
                deployResult = stopResult.deployResult;
              }
              sourceUrl = stopResult.sourceUrl;
              breakOutputLoopFlag = true; // Signal to exit outer loop as well
              break;
            }

            // Deploy and handle results
            sendStatus(`deploying.document.${docType.toLowerCase()}`);
            // Ensure Redis key is set during deployment (especially on retries) so polling can detect it
            if (docId) {
              await RedisSingleton.setData({
                key: generationStatusKey,
                val: 'true',
                expireInSec: 3600, // Expire after 1 hour as safety measure
              });
            }
            generateContent = await processCodeForDeployment(codebaseManager);
            // Save generated content immediately to prevent loss
            await prisma.document.update({
              where: { id: docId },
              data: {
                content: Buffer.from(generateContent, 'utf-8'),
              },
            });

            const startTime = Date.now();
            // track generation time
            mixpanel.track('Start2GenerateComplete Time', {
              distinct_id: `${name}-${docId}`,
              email: currentUser.email,
              docId,
              docType,
              docName: name,
              timeTaken: (startTime - generationStartTimestamp) / 1000,
            });
            let deployDocId = generateDeployDocId(name, docType, docId);

            [fileUrl, migrations, deployResult] = await Promise.all([
              saveAppFileStructure(docId, startTime, generateContent),
              executeDBMigrationWithDrizzle(
                docId,
                generateContent,
                envSettings,
                hasSchemaChange
              ),
              deployCodeToVercelForRegenerate(
                deployDocId,
                generateContent,
                envSettings,
                org.id,
                docId,
                'preview'
              ),
            ]);
            const endTime = Date.now();
            console.log(`time taken to deploy: ${endTime - startTime}ms`);
            console.log('deployResult:', deployResult);
            console.log('migrations result:', migrations);

            // Check migration result and handle errors (similar to build errors)
            if (migrations && !migrations.success && migrations.error) {
              console.error('❌ Migration failed:', migrations.error);

              // Format migration error message for LLM retry (similar to build errors)
              const migrationErrorMsg = `Database migration failed in file "${
                migrations.failedMigrationFile || 'unknown'
              }". Error: ${
                migrations.error
              }\n\nPlease fix the SQL syntax in the migration file and try again.`;

              // Set deployResult to failed to trigger retry loop
              deployResult = {
                success: false,
                sourceUrl: '',
                errorMessage: migrationErrorMsg,
                deploymentId: '',
              };

              // Send detailed error to chat if available
              if (chatSessionId && retryCount === 0) {
                const migrationErrorMessage = `⚠️ Database migration error:\n\n${migrations.error}\n\nPlease fix the SQL syntax in the migration file and try again.`;
                await prisma.chatHistory.create({
                  data: {
                    sessionId: chatSessionId,
                    message: {
                      type: 'ai',
                      content: migrationErrorMessage,
                      additional_kwargs: {},
                      response_metadata: {},
                    },
                    messageUse: MessageUseTypes.BOTH,
                  },
                });

                // Also send through progress channel for immediate feedback
                if (docData.onProgress) {
                  docData.onProgress(
                    JSON.stringify({
                      chats: {
                        path: new Date().toISOString(),
                        content: migrationErrorMessage,
                      },
                    })
                  );
                }
              }
            }

            // If deployment was cancelled by user during polling, use last successful or existing URL
            if (deployResult.errorMessage === 'Deployment cancelled by user') {
              userStoppedGeneration = true;
              if (retryCount > 0 && lastSuccessfulDeployResult) {
                console.log(
                  'Deployment cancelled - using last successful deployment:',
                  lastSuccessfulDeployResult.sourceUrl
                );
                deployResult = lastSuccessfulDeployResult;
                sourceUrl = lastSuccessfulDeployResult.sourceUrl;
              } else {
                const existingUrl = (docInDB?.meta as any)?.sourceUrl;
                if (existingUrl) {
                  console.log(
                    'Deployment cancelled - reusing existing deployment URL:',
                    existingUrl
                  );
                  deployResult = {
                    sourceUrl: existingUrl,
                    success: true,
                    errorMessage: '',
                  };
                  sourceUrl = existingUrl;
                }
              }
            }

            // track deployment time
            mixpanel.track('Generate2DeployComplete Time', {
              distinct_id: `${name}-${docId}`,
              email: currentUser.email,
              docId,
              docType,
              docName: name,
              timeTaken: (endTime - startTime) / 1000,
              retryCount,
            });

            // Check if deployment is truly successful (READY state without errors)
            const readyButHasBuildErrors =
              deployResult.success && deployResult.errorMessage;

            if (deployResult.success && !deployResult.errorMessage) {
              // Perfect deployment - READY state with no errors
              sourceUrl = deployResult.sourceUrl;
              lastSuccessfulDeployResult = deployResult;
              sendStatus('Deployment complete');
              // track successful deployment
              mixpanel.track('Start2DeploySuccess Time', {
                distinct_id: `${name}-${docId}`,
                email: currentUser.email,
                docId,
                docType,
                docName: name,
                retryCount,
                timeTaken: (Date.now() - generationStartTimestamp) / 1000,
              });
              // Update document meta after deployment (unified function)
              if (docId) {
                try {
                  await updateDocumentMetaAfterDeploy(
                    docId,
                    deployResult,
                    'preview'
                  );
                } catch (e) {
                  console.error(
                    'Failed to update document meta after deploy:',
                    e
                  );
                }

                // Update issue status separately if needed
                if (docType === DOCTYPE.PROTOTYPE) {
                  await prisma.document.update({
                    where: { id: docId },
                    data: {
                      issue: {
                        update: {
                          status: IssueStatus.COMPLETED,
                        },
                      },
                    },
                  });
                }
              }
              break;
            } else if (readyButHasBuildErrors) {
              // READY state but has build errors - save working URL but trigger LLM fix
              console.log(
                '⚠️ Deployment READY with build errors, will attempt LLM fix'
              );
              sourceUrl = deployResult.sourceUrl;
              lastSuccessfulDeployResult = deployResult;

              // Update document meta to save the working URL
              if (docId) {
                try {
                  await updateDocumentMetaAfterDeploy(
                    docId,
                    deployResult,
                    'preview'
                  );
                } catch (e) {
                  console.error(
                    'Failed to update document meta after deploy:',
                    e
                  );
                }
              }

              // Continue to retry loop to fix build errors
              retryCount++;
              console.log(
                `[DEBUG] Incremented retryCount to ${retryCount} due to build errors`
              );

              if (retryCount >= polishAppRetryMax) {
                // Max retries reached - keep the working URL
                console.log(
                  '⚠️ Max retries reached, keeping working URL with build warnings'
                );
                mixpanel.track('Start2DeploySuccess Time', {
                  distinct_id: `${name}-${docId}`,
                  email: currentUser.email,
                  docId,
                  docType,
                  docName: name,
                  retryCount,
                  timeTaken: (Date.now() - generationStartTimestamp) / 1000,
                  hasWarnings: true,
                });
                sendStatus('Deployment complete with warnings');
                break;
              } else {
                sendStatus(
                  `Deployment ready but has build errors. Analyzing and fixing... (${retryCount}/${polishAppRetryMax})`
                );
              }
            } else {
              retryCount++;
              console.log(
                `[DEBUG] Incremented retryCount to ${retryCount} due to deployment failure`
              );

              if (retryCount >= polishAppRetryMax) {
                // track failed deployment
                mixpanel.track('Start2DeployFailed Time', {
                  distinct_id: `${name}-${docId}`,
                  email: currentUser.email,
                  docId,
                  docType,
                  docName: name,
                  timeTaken: (Date.now() - generationStartTimestamp) / 1000,
                  retryCount,
                });
                sendStatus(
                  'Deployment failed. Please check the logs and try again.'
                );
                break;
              } else {
                sendStatus(
                  `Deployment failed. Analyzing errors and attempting fix... (${retryCount}/${polishAppRetryMax})`
                );
              }
            }
          }

          toolCallingCount++;
        } catch (e) {
          toolCallingCount++;
          console.error('Error in polishing loop:', e);
          // Check if this is a token limit error
          if (
            e instanceof Error &&
            e.message.includes('token limit exceeded')
          ) {
            console.log(
              'Tool calling error:Token limit exceeded - ',
              e.message
            );
            // Use emergency token limit handling
            cacheManager.handleTokenLimit(messages);
            continue; // Continue to retry with reduced context
          } else if (
            e instanceof Error &&
            e.message.includes('Incomplete tool call detected')
          ) {
            console.log('Incomplete tool call, retrying...', e.message);
            continue; // Continue to retry for incomplete tool calls
          } else if (e instanceof Error) {
            // For API errors (like Failed to get response from LangChain API)
            // or other unexpected errors, we should break the loop to avoid infinite retry
            console.error(
              'Critical error in LLM call, stopping generation:',
              e.message
            );
            // Track the error
            mixpanel.track('LLM Generation Critical Error', {
              distinct_id: `${docData.name}-${docId}`,
              email: currentUser.email,
              docId,
              docType,
              docName: docData.name,
              errorMessage: e.message.substring(0, 200),
              retryCount,
            });
            breakOutputLoopFlag = true;
            break; // Break out of loop instead of continue
          }
          breakOutputLoopFlag = true;
          break;
        }
        console.log(
          `[DEBUG] End of do-while loop. hasPendingToolCalls: ${hasPendingToolCalls}, toolCallingCount: ${toolCallingCount}`
        );
      } while (hasPendingToolCalls && toolCallingCount < maxToolCalls);

      // Check if we hit the tool call limit
      if (toolCallingCount >= maxToolCalls) {
        console.error(
          `Tool call limit exceeded (${maxToolCalls}). Breaking out of loop to prevent infinite execution.`
        );
        breakOutputLoopFlag = true;
      }

      if (breakOutputLoopFlag) {
        // Don't send error status if user intentionally stopped generation
        if (!userStoppedGeneration) {
          sendStatus('Network error. Please retry.');
        }
        console.error(`Stop LLM Calling Due to Model Error in Polishing Loop.`);
        break;
      }
    }

    if (!deployResult.success) {
      console.error(
        `Failed to deploy code to Vercel after ${polishAppRetryMax} retries`
      );

      // If user stopped generation early, handle the preserved code
      const existingSourceUrl = (docInDB?.meta as any)?.sourceUrl;

      if (userStoppedGeneration && generateContent) {
        // Priority 1: Use last successful deployment from current session (if stopped during retry)
        if (lastSuccessfulDeployResult) {
          console.log(
            'Using last successful deployment from this session:',
            lastSuccessfulDeployResult.sourceUrl
          );
          deployResult = lastSuccessfulDeployResult;
          sourceUrl = lastSuccessfulDeployResult.sourceUrl;
        }
        // Priority 2: Use existing deployment URL from previous sessions
        else if (existingSourceUrl) {
          console.log('Reusing existing deployment URL:', existingSourceUrl);
          sourceUrl = existingSourceUrl;
          deployResult = {
            sourceUrl: existingSourceUrl,
            success: true,
            errorMessage: '',
          };
        }
      }
    }
  } else {
    // default generation for documents without templateID or not one of those existing types
    const defaultDocStream = await genDefaultDoc(
      {
        ...docData,
        additionalContextFromUserFiles,
        promptText,
        docId: docData.id,
        chatSessionId,
      },
      currentUser
    );
    const defaultResult = await processStream(
      defaultDocStream,
      docData.onProgress,
      stopKey
    );
    // If stopped early, preserve existing content; otherwise use new content
    if (defaultResult.wasStopped && docData.contents) {
      generateContent = docData.contents;
    } else {
      generateContent = defaultResult.content;
    }
  }

  // Generate and add README.md for PROTOTYPE/PRODUCT documents
  const isPrototypeOrProduct =
    docInDB?.type === DOCTYPE.PROTOTYPE || docInDB?.type === DOCTYPE.PRODUCT;
  if (isPrototypeOrProduct && generateContent) {
    try {
      generateContent = addReadmeToFiles(generateContent, docData.name);
      console.log('✅ Generated README.md for document');
    } catch (readmeError) {
      console.error('Error generating README:', readmeError);
      // Don't fail the whole operation if README generation fails
    }
  }

  let updateResult;

  // Save document history to DocumentHistory table
  try {
    // Get the latest version number
    const latestVersionNumber = await getLatestVersionNumber(docData.id);
    const newVersionNumber = latestVersionNumber + 1;

    // Create new history record in DocumentHistory table
    await createDocumentHistory({
      documentId: docData.id,
      versionNumber: newVersionNumber,
      description,
      fileUrl,
      currentVersionUrl: sourceUrl,
      // Only store content for non-PROTOTYPE/PRODUCT types to save space
      content:
        docInDB?.type === DOCTYPE.PROTOTYPE || docInDB?.type === DOCTYPE.PRODUCT
          ? undefined
          : generateContent,
      chosenDocumentIds,
      rating: undefined,
      creatorUserId: currentUser.userId,
      creatorEmail: currentUser.email,
    });

    console.log(
      `✅ Created document history version ${newVersionNumber} for document ${docData.id}`
    );
  } catch (historyError) {
    console.error('Error creating document history:', historyError);
    // Don't fail the whole operation if history creation fails
  }

  try {
    // Use the new version number as activeHistoryVersion
    const latestVersionNumber = await getLatestVersionNumber(docData.id);
    const newActiveHistoryVersion = latestVersionNumber;

    // Always save as nested structure (preview/production)
    // Migrate old flat structure to new nested structure
    let finalEnvSettings: any;
    if (
      rawEnvSettings &&
      typeof rawEnvSettings === 'object' &&
      !Array.isArray(rawEnvSettings) &&
      ((rawEnvSettings as any).preview || (rawEnvSettings as any).production)
    ) {
      // Already nested structure - update preview environment
      finalEnvSettings = {
        ...(rawEnvSettings as object),
        preview: envSettings || (rawEnvSettings as any).preview || {},
      };
    } else {
      // Old flat structure - migrate to nested structure
      // Put current envSettings (from flat structure) into preview, leave production empty
      finalEnvSettings = {
        preview: envSettings || {},
        production: {},
      };
    }

    // Step 1: Update basic fields (name, type, content, etc.)
    // Only update content if generateContent is not empty
    const updateData: any = {
      name,
      type: docType,
      projectId,
      organizationId: currentUser.organizationId,
      templateDocumentId: docData.templateId || null,
    };

    // Only include content if it's not empty (to avoid Buffer.from error)
    if (generateContent && generateContent.trim() !== '') {
      updateData.content = Buffer.from(generateContent, 'utf-8');
    }

    updateResult = await prisma.document.update({
      where: {
        id: docData.id,
      },
      data: updateData,
    });

    // Step 2: Partially update meta to preserve fields set by other processes
    const metaUpdates: Record<string, any> = {
      envSettings: finalEnvSettings,
      migrations, // Migration result (not tracking)
      repoUrl: repoUrl,
      activeHistoryVersion: newActiveHistoryVersion,
    };

    // Only add sourceUrl if deployment didn't succeed (otherwise it was already updated by updateDocumentMetaAfterDeploy)
    if (!deployResult?.success && sourceUrl) {
      metaUpdates.sourceUrl = sourceUrl;
    }

    await updateDocumentMeta(docData.id, metaUpdates);
  } catch (e) {
    console.error('documentServices.genDocumentAfterChat.update.failure:', e);
  }

  // Clear stop signal after generation completes (success or failure)
  await RedisSingleton.clearData(stopKey);
  console.log('Cleared stop signal for document:', docId);

  // Clear generation status from Redis
  if (docId) {
    await RedisSingleton.clearData(generationStatusKey);
    console.log('Cleared generation status for document:', docId);
  }

  return generateContent;
}
