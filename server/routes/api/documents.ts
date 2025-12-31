import {
  Access,
  ChatSessionTargetEntityType,
  DOCTYPE,
  Document,
  DocumentPermission,
  DocumentPermissionStatus,
  DocumentPermissionTypes,
  DocumentStatus,
  IssueStatus,
  MessageUseTypes,
  Prisma,
  ProjectStatus,
  RecordStatus,
} from '@prisma/client';
import {
  DocumentRequestAccessTemplateData,
  DocumentShareTemplateData,
} from '../types/emailTemplateDataTypes';
import {
  LegacyDocumentOutput,
  RefinementGenerationInput,
  RefinementOutput,
} from '../types/documentTypes';
import {
  checkDocumentAccess,
  genDocumentAfterChat,
  getDefaultTemplateDocument,
} from '../../services/documentService';
import { isEmail, userProfileRequestHandler } from '../../lib/util';
import {
  deleteMigrationsFromS3,
  generatePresignedDownloadUrl,
} from '../../lib/s3Upload';
import { updateDocumentMeta } from '../../services/documentMetaService';
import { saveAppFileStructure } from '../../services/llmService/appGen/appGenUtil';

import { DocumentOutput } from './../../../client/src/containers/documents/types/documentTypes';
import { GenerationMinimumCredit } from '../../lib/constant';
import { ProfileResponse } from './../../types/response';
import { Router } from 'express';
import { SERVER_BASE_URL } from './../../../shared/constants';
import { createChatSession } from '../../services/llmService/chatAgent';
import { defaultProjectCodeTemplate } from '../../services/llmService/appGen/appGenUtil';
import { genRefinement } from '../../services/llmService/refinementGen';
import { getOrCreateChatSession } from '../../services/llmService/chatAgent';
import prisma from '../../db/prisma';
import { sendTemplateEmail } from '../../services/sesMailService';
import { RedisSingleton } from '../../services/redis/redis';
import {
  getDocumentHistories,
  getDocumentHistoryByVersion,
  updateDocumentHistoryRating,
} from '../../services/documentHistoryService';

const documentShareTemplateName = process.env.AWS_DOC_SHARE_TEMPLATE_NAME;

const router = Router();
router.use(userProfileRequestHandler);

// upsert document
// TODO: Do we need to handle Dev Plans specially here? Consider for creating documents in the planner
router.post(
  '/upsert',
  async function (req, res: ProfileResponse<LegacyDocumentOutput>) {
    const currentUser = res.locals.currentUser;

    let documentData = req.body;

    console.log(
      'in server.routes.api.documents.upsert.start:',
      currentUser?.userId,
      documentData
    );
    // TODO - set default value to DOCTYPE.OTHER
    let updateResult: Document | undefined;
    let { id, issueId, projectId, type, contentStr, chatSessionId } =
      documentData;
    delete documentData.issueId;
    delete documentData.projectId;
    delete documentData.contentStr;
    delete documentData.chatSessionId;

    // console.log('documentData:', documentData);
    try {
      if (documentData.id) {
        updateResult = await prisma.document.update({
          where: {
            id,
          },
          data: {
            ...documentData,
            organizationId: currentUser.organizationId,
            ...(contentStr
              ? { content: Buffer.from(contentStr, 'utf-8') }
              : {}),
          },
        });

        await prisma.document.updateMany({
          where: { projectId, type: DOCTYPE.PROTOTYPE }, // TODO: Consider Product case
          data: {
            description:
              'Create an app based on the linked requirement doc in the chat box.',
          },
        });
      } else {
        updateResult = await prisma.document.upsert({
          where: {
            id: '',
          },
          update: {
            ...documentData,
          },
          create: {
            ...documentData,
            type,
            status: DocumentStatus.CREATED,
            url: '',
            issue: issueId
              ? {
                  connect: {
                    id: issueId,
                  },
                }
              : undefined,
            creator: {
              connect: {
                id: currentUser?.userId,
              },
            },
            organization: {
              connect: {
                id: currentUser.organizationId,
              },
            },
            project: projectId
              ? {
                  connect: {
                    id: projectId,
                  },
                }
              : undefined,
          },
        });

        console.log('updateResult:', updateResult);
        if (updateResult && chatSessionId) {
          // now update chat session to point to this doc
          await prisma.chatSession.update({
            where: { id: chatSessionId },
            data: {
              targetEntityType: ChatSessionTargetEntityType.DOCUMENT,
              targetEntityId: updateResult.id,
            },
          });
        }
      }
    } catch (e) {
      console.error('in server.routes.api.documents.upsert.failure:', e);
      res
        .status(500)
        .json({ success: false, errorMsg: 'Network error. Please retry.' });
      return;
    }

    // update issue status if DOCUMENT status is updated to PUBLISHED
    if (updateResult.status === DocumentStatus.PUBLISHED && projectId) {
      try {
        await prisma.issue.update({
          where: {
            id: updateResult.issueId!,
          },
          data: {
            status: IssueStatus.COMPLETED,
            progress: 100,
            actualEndDate: new Date(),
            changeHistory: {
              create: {
                userId: currentUser.userId,
                modifiedAttribute: JSON.stringify({
                  status: IssueStatus.COMPLETED,
                }),
              },
            },
          },
        });
      } catch (e) {
        console.error(
          'in server.routes.api.documents.upsert.issueUpdate.failure:',
          e
        );
        res
          .status(500)
          .json({ success: false, errorMsg: 'Network error. Please retry.' });
        return;
      }
    }
    console.log('in server.routes.api.documents.upsert.result:', updateResult);
    res.status(201).json({
      success: true,
      data: { ...updateResult, contentStr },
    });
  }
);



// Get all documents for a user
router.get(
  '/',
  async function (request, response: ProfileResponse<DocumentOutput[]>) {
    const currentUser = response.locals.currentUser;

    try {
      const documents = await prisma.document.findMany({
        where: {
          creatorUserId: currentUser.userId,
          // type: { not: DOCTYPE.DEVELOPMENT_PLAN }, // todo - re-enable development plans later
          status: { notIn: [DocumentStatus.CANCELED, DocumentStatus.ARCHIVED] },
        },
        take: 50, // Increased limit to show more documents
        include: {
          project: {
            where: {
              status: { in: [ProjectStatus.CREATED, ProjectStatus.STARTED] },
            },
          },
          organization: true,
          creator: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      response.status(200).json({
        success: true,
        data: documents.map((doc) => ({
          ...doc,
          type: doc.type,
          contents: doc.content?.toString('utf-8'),
          meta: doc.meta as Prisma.JsonObject,
        })),
      });
    } catch (error) {
      console.error('Error occurred in GET /documents', error);
      response.status(200).json({
        success: false,
        errorMsg: (error as string | Error).toString(),
      });
    }
  }
);

// Get document generation status
router.get('/:documentId/status', async function (request, response) {
  try {
    const { documentId } = request.params;

    // Check Redis for generation status
    const generationStatusKey = `document-generating:${documentId}`;
    const isGenerating =
      (await RedisSingleton.getData(generationStatusKey)) === 'true';

    response.status(200).json({
      success: true,
      isGenerating,
      status: isGenerating ? 'GENERATING' : 'NOT_GENERATING',
    });
  } catch (error: any) {
    console.error('Error occurred in GET /documents/:documentId/status', error);
    response.status(500).json({
      success: false,
      errorMsg: (error as string | Error).toString(),
    });
  }
});

// Get a specific document by ID. Note that this will not return dev plan documents - the /devPlan APIs handle those exclusively
router.get(
  '/:documentId',
  async function (request, response: ProfileResponse<DocumentOutput>) {
    try {
      const { documentId } = request.params;
      const { organizationId, userId, email } =
        response.locals && response.locals.currentUser
          ? response.locals.currentUser
          : { organizationId: null, userId: undefined, email: undefined };

      const dbDocument = await prisma.document.findUnique({
        where: { id: documentId },
        include: { project: true, templateDocument: true, organization: true },
      });

      if (!dbDocument) {
        throw new Error('Could not find this document: ' + documentId);
      } else if (dbDocument.type === DOCTYPE.DEVELOPMENT_PLAN) {
        throw new Error(
          'Development plan documents can only be accessed via /devPlan API: ' +
            documentId
        );
      }

      // Call checkDocumentAccess to handle the logic
      const { hasAccess, documentPermission } = await checkDocumentAccess(
        dbDocument,
        email || '',
        userId || null,
        organizationId
      );

      if (!hasAccess) {
        throw new Error(
          'You have no permission to view this document: ' + documentId
        );
      }

      // DocumentTemplate
      if (
        userId &&
        !dbDocument.templateDocument &&
        dbDocument.type !== DOCTYPE.UI_DESIGN
      ) {
        dbDocument.templateDocument = await getDefaultTemplateDocument(
          dbDocument.type,
          response.locals.currentUser
        );
      }

      const { content: rawContents, type, ...document } = dbDocument;
      const contents = rawContents?.toString('utf-8');

      response.status(200).json({
        success: true,
        data: {
          ...document,
          type,
          contents,
          meta: document.meta as Prisma.JsonObject,
          documentPermission,
        },
      });
    } catch (error) {
      console.error('Error occurred in GET /documents/:documentId', error);
      response.status(200).json({
        success: false,
        errorMsg: (error as string | Error).toString(),
      });
    }
  }
);

// Get a shared document by ID
// TODO: use passCode, replace email
router.get(
  '/shared/:documentId',
  async function (
    request,
    response: ProfileResponse<
      DocumentOutput & {
        currentUserId: string | null;
        documentPermission: DocumentPermissionTypes;
      }
    >
  ) {
    try {
      let email = '',
        userId = null,
        organizationId = null;
      if (response.locals.currentUser) {
        email = response.locals.currentUser.email;
        userId = response.locals.currentUser.userId;
        organizationId = response.locals.currentUser.organizationId;
      }
      const { documentId } = request.params;
      let accessEmail = request.query.accessEmail as string; // Input email to check document access.
      if (!isEmail(accessEmail)) {
        accessEmail = email;
      }

      const dbDocument = await prisma.document.findUnique({
        where: { id: documentId },
        include: { project: true, organization: true },
      });

      if (!dbDocument) {
        throw new Error('Could not find this document.');
      }

      const { hasAccess, documentPermission } = await checkDocumentAccess(
        dbDocument,
        accessEmail,
        userId,
        organizationId
      );
      if (!hasAccess) {
        if (!isEmail(accessEmail)) {
          throw new Error('Please enter your email to access this document.');
        }
        throw new Error('You have no permission to access this document.');
      }

      const { content: rawContents, type, ...document } = dbDocument;
      const contents = rawContents?.toString('utf-8');

      response.status(200).json({
        success: true,
        data: {
          ...document,
          type,
          contents,
          currentUserId: userId,
          documentPermission,
          meta: document.meta as Prisma.JsonObject,
        },
      });
    } catch (error) {
      console.error('Error occurred in GET /documents/:documentId', error);
      response.status(500).json({
        success: false,
        errorMsg: (error as string | Error).toString(),
      });
    }
  }
);

// request document access
router.post('/requestAccess', async function (req, res: ProfileResponse) {
  const currentUser = res.locals.currentUser;
  const { documentId, message } = req.body;

  try {
    // find document
    const dbDocument = await prisma.document.findUnique({
      where: { id: documentId },
      include: { creator: true },
    });

    if (
      !dbDocument ||
      dbDocument.type === DOCTYPE.DEVELOPMENT_PLAN // You have to use the /devPlan API to access these
    ) {
      throw new Error('Could not find this document.');
    }

    // send email
    sendTemplateEmail<DocumentRequestAccessTemplateData>({
      templateName: 'DocRequestAccess',
      recipientEmails: [dbDocument.creator.email],
      TemplateData: {
        recipient_name: `${dbDocument.creator.firstname}`,
        sender_name: `${currentUser?.email}`,
        doc_name: dbDocument.name,
        message: message,
        link: `${SERVER_BASE_URL}/docs/${dbDocument.id}`,
      },
    });
    res.status(200).json({
      success: true,
      data: { msg: 'request sent' },
    });
  } catch (error) {
    res.status(200).json({
      success: false,
      errorMsg: (error as string | Error).toString(),
    });
  }
});

router.post(
  '/generate-refinement',
  async function (req, res: ProfileResponse<RefinementOutput>) {
    const currentUser = res.locals.currentUser;

    let org = await prisma.organization.findUnique({
      where: { id: currentUser.organizationId },
    });

    if (!org) {
      res
        .status(500)
        .json({ success: false, errorMsg: 'Organization not found.' });
      return;
    } else if (org.credits < GenerationMinimumCredit) {
      res
        .status(500)
        .json({ success: false, errorMsg: 'Insufficient credits.' });
      return;
    }

    const docData = req.body as RefinementGenerationInput;

    console.log(
      'in server.routes.api.documents.generate-refinement.start:',
      currentUser?.userId
    );
    let generateContent = '';

    try {
      generateContent = await genRefinement(docData, currentUser);

      console.log(
        'in server.routes.api.documents.generate-refinement.result:',
        generateContent
      );

      res.status(201).json({
        success: true,
        data: { contentStr: generateContent },
      });
    } catch (error) {
      console.error('Error occurred in GET /document-refinement', error);

      res.status(200).json({
        success: false,
        errorMsg: (error as string | Error).toString(),
      });
    }
  }
);

let keepAliveInterval: NodeJS.Timeout | null = null;

// Mock streaming endpoint for quick testing of UI, so we don't have to cost credits and wait for the app to generate
router.post(
  '/mock-document-streaming',
  async (req, res: ProfileResponse<LegacyDocumentOutput>) => {
    const currentUser = res.locals.currentUser;

    try {
      // Set up keep-alive interval
      keepAliveInterval = setInterval(() => {
        res.write(JSON.stringify({ keepalive: true }) + '\n\n');
      }, 10000); // Send heartbeat every 10 seconds to prevent timeouts

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Send initial status message
      // res.write(JSON.stringify({ status: { message: 'Starting mock streaming...' } }) + '\n\n');

      // Mock delay to simulate processing
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Simulate file-by-file streaming
      const mockFiles = defaultProjectCodeTemplate.files;

      // Stream each file with a delay between
      for (const file of mockFiles) {
        // Delay to simulate thinking/generation time
        await new Promise((resolve) => setTimeout(resolve, 800));

        // Send file content
        res.write(
          JSON.stringify({
            text: {
              path: file.path,
              content: file.content,
            },
          }) + '\n\n'
        );

        // Additional delay before next file
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      // Final status update
      res.write(
        JSON.stringify({ status: { message: 'Mock streaming complete!' } }) +
          '\n\n'
      );

      // Final source URL for deployment
      res.write(
        JSON.stringify({
          sourceUrl: 'https://mock-deployment-url.vercel.app',
        }) + '\n\n'
      );

      res.end();
    } catch (error: any) {
      console.log('Mock streaming error:', error.toString());
      res.write(JSON.stringify({ error: error.toString() }) + '\n\n');
      res.end();
    } finally {
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
    }
  }
);

router.post(
  '/generate-document-streaming',
  async (req, res: ProfileResponse<LegacyDocumentOutput>) => {
    const currentUser = res.locals.currentUser;
    let org = await prisma.organization.findUnique({
      where: { id: currentUser.organizationId },
    });
    if (!org) {
      res
        .status(500)
        .json({ success: false, errorMsg: 'Organization not found.' });
      return;
    } else if (org.credits < GenerationMinimumCredit) {
      res
        .status(500)
        .json({ success: false, errorMsg: 'Insufficient credits.' });
      return;
    }
    try {
      const param = req.body;
      console.log('param', param);
      let chatContent = param.description ?? '';
      const entityId = param.entityId ?? '';
      const entityType = param.entityType || '';
      const meta = (param.meta as Prisma.JsonObject) || {};

      // get chat session id
      let chatSessionId =
        param.chatSessionId ||
        (
          await getOrCreateChatSession({
            name: '',
            userId: param.userId,
            chatContent,
            userEmail: currentUser.email,
            targetEntityId: entityId,
            targetEntityType: entityType,
            targetEntitySubType: param.entitySubType,
          })
        ).id;

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
      res.flushHeaders(); // Flush headers immediately

      // Set up keep-alive interval with flush
      keepAliveInterval = setInterval(() => {
        try {
          if (!res.writableEnded && !res.destroyed) {
            res.write(JSON.stringify({ keepalive: true }) + '\n\n');
            // Flush if available (Node.js 18+)
            if ((res as any).flush) {
              (res as any).flush();
            }
          }
        } catch (err) {
          // Connection closed, clear interval
          if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
            keepAliveInterval = null;
          }
        }
      }, 10000); // send heartbeat to frontend every 10 seconds; heroku times out idle connections after 60s

      // Track if client disconnected
      let clientDisconnected = false;

      // Handle client disconnect
      req.on('close', () => {
        console.log(
          'Client disconnected during streaming, but generation continues in background'
        );
        clientDisconnected = true;
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
          keepAliveInterval = null;
        }
      });

      req.on('aborted', () => {
        console.log('Client aborted connection during streaming');
        clientDisconnected = true;
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
          keepAliveInterval = null;
        }
      });

      // Helper to safely write with flush
      // Always attempt to write - connection state may change (e.g., reconnection)
      const safeWrite = (data: string) => {
        try {
          if (!res.writableEnded && !res.destroyed) {
            res.write(data);
            // Flush if available (Node.js 18+)
            if ((res as any).flush) {
              (res as any).flush();
            }
            // Reset disconnected flag if write succeeds
            clientDisconnected = false;
          } else {
            clientDisconnected = true;
          }
        } catch (err) {
          // Only set disconnected if write actually fails
          console.error('Error writing to response stream:', err);
          clientDisconnected = true;
        }
      };

      // Start generation - it will continue even if client disconnects
      // The document will be saved to DB when complete, user can refresh to see it
      await genDocumentAfterChat(org, currentUser, {
        ...req.body,
        id: req.body.entityId,
        type: req.body.entitySubType,
        chatSessionId,
        docId: entityId,
        meta,
        isFixingDeploymentError: param.isFixingDeploymentError || false,
        onProgress: (progress: string) => {
          // progress is already JSON stringified
          safeWrite(`${progress}\n\n`);
        },
      });

      if (!res.writableEnded && !res.destroyed) {
        res.end();
      }
    } catch (error: any) {
      console.log('errorMsg:', error.toString());
      try {
        if (!res.writableEnded && !res.destroyed) {
          res.write(JSON.stringify({ error: error.toString() }) + '\n\n');
          res.end();
        }
      } catch (writeError) {
        console.error('Error writing error response:', writeError);
      }
    } finally {
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
    }
  }
);

router.post(
  '/generate-document-task-generation',
  async (req, res: ProfileResponse<LegacyDocumentOutput>) => {
    const currentUser = res.locals.currentUser;
    let org = await prisma.organization.findUnique({
      where: { id: currentUser.organizationId },
    });
    if (!org) {
      res
        .status(500)
        .json({ success: false, errorMsg: 'Organization not found.' });
      return;
    } else if (org.credits < GenerationMinimumCredit) {
      res
        .status(500)
        .json({ success: false, errorMsg: 'Insufficient credits.' });
      return;
    }
    try {
      const param = req.body;
      console.log('param', param);
      const entityId = param.entityId ?? '';

      // get chat session id
      let chatSessionId =
        param.chatSessionId ||
        (
          await createChatSession({
            name: '',
            access: 'SELF',
            userId: currentUser.userId,
            userEmail: currentUser.email,
            targetEntityId: entityId,
            targetEntityType: ChatSessionTargetEntityType.DOCUMENT,
            targetEntitySubType: param.entitySubType,
          })
        ).id;

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
      res.flushHeaders(); // Flush headers immediately

      // Set up keep-alive interval with flush
      keepAliveInterval = setInterval(() => {
        try {
          if (!res.writableEnded && !res.destroyed) {
            res.write(JSON.stringify({ keepalive: true }) + '\n\n');
            // Flush if available (Node.js 18+)
            if ((res as any).flush) {
              (res as any).flush();
            }
          }
        } catch (err) {
          // Connection closed, clear interval
          if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
            keepAliveInterval = null;
          }
        }
      }, 10000); // send heartbeat to frontend every 10 seconds; heroku times out idle connections after 60s

      // Track if client disconnected
      let clientDisconnected = false;

      // Handle client disconnect
      req.on('close', () => {
        console.log(
          'Client disconnected during streaming, but generation continues in background'
        );
        clientDisconnected = true;
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
          keepAliveInterval = null;
        }
      });

      req.on('aborted', () => {
        console.log('Client aborted connection during streaming');
        clientDisconnected = true;
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
          keepAliveInterval = null;
        }
      });

      // Helper to safely write with flush
      // Always attempt to write - connection state may change (e.g., reconnection)
      const safeWrite = (data: string) => {
        try {
          if (!res.writableEnded && !res.destroyed) {
            res.write(data);
            // Flush if available (Node.js 18+)
            if ((res as any).flush) {
              (res as any).flush();
            }
            // Reset disconnected flag if write succeeds
            clientDisconnected = false;
          } else {
            clientDisconnected = true;
          }
        } catch (err) {
          // Only set disconnected if write actually fails
          console.error('Error writing to response stream:', err);
          clientDisconnected = true;
        }
      };

      // Start generation - it will continue even if client disconnects
      // The document will be saved to DB when complete, user can refresh to see it
      await genDocumentAfterChat(org, currentUser, {
        ...req.body,
        id: req.body.entityId,
        type: req.body.entitySubType,
        chatSessionId,
        docId: entityId,
        onProgress: (progress: string) => {
          // progress is already JSON stringified
          safeWrite(`${progress}\n\n`);
        },
      });

      if (!res.writableEnded && !res.destroyed) {
        res.end();
      }
    } catch (error: any) {
      console.log('errorMsg:', error.toString());
      try {
        if (!res.writableEnded && !res.destroyed) {
          res.write(JSON.stringify({ error: error.toString() }) + '\n\n');
          res.end();
        }
      } catch (writeError) {
        console.error('Error writing error response:', writeError);
      }
    } finally {
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
    }
  }
);

// generate document
router.post(
  '/generate',
  async function (req, res: ProfileResponse<{ contentStr: string }>) {
    const currentUser = res.locals.currentUser;

    let org = await prisma.organization.findUnique({
      where: { id: currentUser.organizationId },
    });
    if (!org) {
      res
        .status(500)
        .json({ success: false, errorMsg: 'Organization not found.' });
      return;
    } else if (org.credits < GenerationMinimumCredit) {
      res
        .status(500)
        .json({ success: false, errorMsg: 'Insufficient credits.' });
      return;
    }

    console.log('api.documents.document.generate');
    let generatedContent = await genDocumentAfterChat(org, currentUser, {
      ...req.body,
      chosenDocumentIds:
        req.body.chosenDocumentIds ?? req.body.meta?.chosenDocumentIds,
      id: req.body.entityId,
      type: req.body.entitySubType,
    });

    res.status(201).json({
      success: true,
      data: { contentStr: generatedContent as string },
    });
  }
);

// Stop generation endpoint
router.post(
  '/stop-generation',
  async function (
    req,
    res: ProfileResponse<{ stopped: boolean; chatMessage?: string }>
  ) {
    try {
      const { documentId, chatSessionId, language } = req.body;

      if (!documentId) {
        res.status(400).json({
          success: false,
          errorMsg: 'documentId is required',
        });
        return;
      }

      // Set stop signal in Redis with 20 minute expiry
      // Most of generation can be finished in 20 minutes, so we set 20 minutes TTL
      const stopKey = `stop-generation:${documentId}`;
      await RedisSingleton.setData({
        key: stopKey,
        val: 'true',
        expireInSec: 1200, // 20 minutes TTL
      });

      console.log(`Stop signal set for document ${documentId}`);

      // Add chat history message for record if we have sessionId
      let chatMessage: string | undefined;
      if (chatSessionId) {
        try {
          // Select message based on language
          const stopMessage =
            language === 'zh'
              ? '生成已取消。'
              : 'Generation has been cancelled.';

          await prisma.chatHistory.create({
            data: {
              sessionId: chatSessionId,
              message: {
                type: 'ai',
                content: stopMessage,
              },
              messageUse: MessageUseTypes.BOTH,
            },
          });
          console.log('Added stop message to chat history');
          chatMessage = stopMessage; // Return message to client
        } catch (chatError) {
          console.error(
            'Failed to add stop message to chat history:',
            chatError
          );
          // Don't fail the stop request if chat history fails
        }
      }

      res.status(200).json({
        success: true,
        data: { stopped: true, chatMessage },
      });
    } catch (error: any) {
      console.error('Error setting stop signal:', error);
      res.status(500).json({
        success: false,
        errorMsg: 'Failed to stop generation',
      });
    }
  }
);

// get access permission
router.get(
  '/:documentId/permission',
  async function (request, response: ProfileResponse<DocumentPermission[]>) {
    try {
      const { documentId } = request.params;
      const dbDocument = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!dbDocument) {
        throw new Error('Could not find this document: ' + documentId);
      }

      const result = await prisma.documentPermission.findMany({
        where: {
          documentId,
          status: DocumentPermissionStatus.ACTIVE,
        },
      });

      response.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.log('in server.routes.api.doc.permission.post.failure:', error);
      response
        .status(500)
        .json({ success: false, errorMsg: 'Network error. Please retry.' });
    }
  }
);

// add access permission
router.post(
  '/:documentId/permission',
  async function (request, response: ProfileResponse<string>) {
    try {
      const { documentId } = request.params;
      let userIds: [string] = request.body.userIds;
      console.log(
        'in api.documents.post.documentId.permission:',
        JSON.stringify(request.body)
      );
      // const shareUrl = request.body.shareUrl;
      // const permission: DocumentPermissionTypes = request.body.permission;
      const currentUser = response.locals.currentUser;

      const {
        emails,
        permission,
        documentPermissions,
        documentAccess,
        shareUrl,
      }: {
        documentId: string;
        emails: string[];
        permission: DocumentPermissionTypes;
        documentPermissions: DocumentPermission[];
        documentAccess: Access;
        shareUrl: string;
      } = request.body;

      const dbDocument = await prisma.document.findUnique({
        where: { id: documentId },
        include: { project: true },
      });

      if (!dbDocument) {
        throw new Error('Could not find this document: ' + documentId);
      }

      // update exists permissions
      for (const docPermission of documentPermissions) {
        await prisma.documentPermission.update({
          where: {
            id: docPermission.id,
          },
          data: {
            permission: docPermission.permission,
          },
        });
      }

      // to delete permissions
      const dbPermissions = await prisma.documentPermission.findMany({
        where: {
          documentId,
        },
      });
      const toDeletePermissionIds = [];
      for (const dbPermission of dbPermissions) {
        if (
          !documentPermissions.some(
            (docPermission) => dbPermission.id === docPermission.id
          )
        ) {
          toDeletePermissionIds.push(dbPermission.id);
        }
      }
      await prisma.documentPermission.updateMany({
        where: {
          id: {
            in: toDeletePermissionIds,
          },
        },
        data: {
          status: DocumentPermissionStatus.CANCELED,
        },
      });

      // Update Document access
      await prisma.document.update({
        where: {
          id: documentId,
        },
        data: {
          access: documentAccess,
        },
      });

      // add new permissions
      const toCreateEmails = emails.filter(
        (email) =>
          !documentPermissions
            .map((docPermission) => docPermission.email)
            .includes(email)
      );

      // Find userIds for emails that correspond to registered users
      const usersByEmail = await prisma.user.findMany({
        where: {
          email: { in: toCreateEmails },
        },
        select: { id: true, email: true },
      });
      const emailToUserIdMap = new Map(
        usersByEmail.map((user) => [user.email.toLowerCase(), user.id])
      );

      const toCreatePermissions = toCreateEmails.map((email) => {
        const normalizedEmail = email.toLowerCase();
        const userId = emailToUserIdMap.get(normalizedEmail);
        return {
          documentId,
          email: normalizedEmail,
          userId: userId || null,
          permission,
          status: DocumentPermissionStatus.ACTIVE,
        };
      });

      await prisma.documentPermission.createMany({
        data: toCreatePermissions,
      });

      const currentUserProfile = await prisma.user.findUnique({
        where: { id: currentUser.userId },
        select: { firstname: true, lastname: true },
      });

      if (userIds && userIds.length) {
        // Send Share Email
        const toUsers = await prisma.user.findMany({
          where: {
            id: { in: userIds },
          },
        });

        for (const toUser of toUsers) {
          sendTemplateEmail<DocumentShareTemplateData>({
            templateName: 'DocLink',
            recipientEmails: [toUser.email],
            TemplateData: {
              recipient_name: `${toUser.firstname} ${toUser.lastname}`,
              sender_name: `${currentUserProfile?.firstname} ${currentUserProfile?.lastname}`,
              doc_name: dbDocument.name,
              link: shareUrl,
            },
          });
        }
      }

      for (const email of toCreateEmails) {
        sendTemplateEmail<DocumentShareTemplateData>({
          templateName: 'DocLink',
          recipientEmails: [email],
          TemplateData: {
            recipient_name: `${email}`,
            sender_name: `${currentUserProfile?.firstname} ${currentUserProfile?.lastname}`,
            doc_name: dbDocument.name,
            link: shareUrl,
          },
        });
      }

      response.status(201).json({
        success: true,
        data: 'ok',
      });
    } catch (error) {
      console.log('in server.routes.api.doc.permission.post.failure:', error);
      response
        .status(500)
        .json({ success: false, errorMsg: 'Network error. Please retry.' });
    }
  }
);

// reset document content and set chat session to inactive
router.post(
  '/:documentId/reset',
  async function (req, res: ProfileResponse<LegacyDocumentOutput>) {
    const currentUser = res.locals.currentUser;
    const { documentId } = req.params;

    console.log(
      'in server.routes.api.documents.reset.start:',
      currentUser?.userId,
      documentId
    );

    try {
      // Find the document
      const document = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        res
          .status(404)
          .json({ success: false, errorMsg: 'Document not found.' });
        return;
      }

      // Check if user has access to this document
      if (document.creatorUserId !== currentUser.userId) {
        res.status(403).json({ success: false, errorMsg: 'Access denied.' });
        return;
      }

      // Update document content to empty
      const updateResult = await prisma.document.update({
        where: { id: documentId },
        data: {
          content: Buffer.from('', 'utf-8'),
          status: DocumentStatus.CREATED,
          meta: {},
        },
      });

      // Set chat session to inactive for this document
      await prisma.chatSession.updateMany({
        where: {
          targetEntityId: documentId,
          targetEntityType: ChatSessionTargetEntityType.DOCUMENT,
          status: RecordStatus.ACTIVE,
        },
        data: {
          status: RecordStatus.INACTIVE,
        },
      });

      // Delete migration files from S3 for this product
      console.log('🗑️ Deleting migration files from S3...');
      try {
        await deleteMigrationsFromS3(documentId);
        console.log('✅ Successfully deleted migration files from S3');
      } catch (s3Error) {
        console.warn('⚠️ Failed to delete migration files from S3:', s3Error);
        // Continue with document reset even if S3 cleanup fails
      }

      console.log('in server.routes.api.documents.reset.result:', updateResult);
      res.status(200).json({
        success: true,
        data: { ...updateResult, contentStr: '' },
      });
    } catch (e) {
      console.error('in server.routes.api.documents.reset.failure:', e);
      res
        .status(500)
        .json({ success: false, errorMsg: 'Network error. Please retry.' });
      return;
    }
  }
);

// Update document publish URL
router.put(
  '/:documentId/publish-url',
  async function (req, res: ProfileResponse<any>) {
    const currentUser = res.locals.currentUser;
    const { documentId } = req.params;
    const { publishUrl } = req.body;

    if (!publishUrl || typeof publishUrl !== 'string') {
      return res.status(400).json({
        success: false,
        errorMsg: 'Publish URL is required',
      });
    }

    try {
      // Check if document exists and user has access
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: { documentPermissions: true },
      });

      if (!document) {
        return res.status(404).json({
          success: false,
          errorMsg: 'Document not found',
        });
      }

      // Check if user has permission to edit this document
      const hasPermission =
        document.documentPermissions.some(
          (permission) =>
            permission.userId === currentUser.userId &&
            permission.permission === 'EDIT'
        ) || document.creatorUserId === currentUser.userId;

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          errorMsg: 'Insufficient permissions to edit this document',
        });
      }

      // Update document meta with new publish URL using partial update
      await updateDocumentMeta(documentId, {
        publishUrl,
        publishUrlUpdatedAt: new Date().toISOString(),
      });

      // Fetch updated document for response
      const updatedDocument = await prisma.document.findUnique({
        where: { id: documentId },
      });

      return res.status(200).json({
        success: true,
        data: updatedDocument,
      });
    } catch (error) {
      console.error('Error updating publish URL:', error);
      return res.status(500).json({
        success: false,
        errorMsg: 'Failed to update publish URL',
      });
    }
  }
);

// Update document settings (Stripe keys, database settings, etc.)
router.put(
  '/:documentId/settings',
  async function (req, res: ProfileResponse<any>) {
    const currentUser = res.locals.currentUser;
    const { documentId } = req.params;
    const {
      stripeSecretKey,
      stripePublishedKey,
      databaseUrl,
      jwtSecret,
      envSettings,
    } = req.body;

    try {
      // Check if document exists and user has access
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: { documentPermissions: true },
      });

      if (!document) {
        return res.status(404).json({
          success: false,
          errorMsg: 'Document not found',
        });
      }

      // Check if user has permission to edit this document
      const hasPermission =
        document.documentPermissions.some(
          (permission) =>
            permission.userId === currentUser.userId &&
            permission.permission === 'EDIT'
        ) || document.creatorUserId === currentUser.userId;

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          errorMsg: 'Insufficient permissions to edit this document',
        });
      }

      // Build partial meta updates (only fields that need to be changed)
      const currentMeta = (document.meta as Prisma.JsonObject) || {};
      const currentEnvSettings =
        (currentMeta.envSettings as Prisma.JsonObject) || {};

      const metaUpdates: Record<string, any> = {};

      // Update stripe settings if provided
      if (stripeSecretKey !== undefined || stripePublishedKey !== undefined) {
        metaUpdates.stripe = {
          secretKey: stripeSecretKey,
          publishedKey: stripePublishedKey,
        };
      }

      // Update envSettings if provided
      if (
        databaseUrl !== undefined ||
        jwtSecret !== undefined ||
        envSettings !== undefined
      ) {
        metaUpdates.envSettings = {
          ...currentEnvSettings,
          ...(databaseUrl !== undefined ? { DATABASE_URL: databaseUrl } : {}),
          ...(jwtSecret !== undefined ? { JWT_SECRET: jwtSecret } : {}),
          ...(envSettings || {}),
        };

        // When updating with envSettings, remove old stripe format if it exists
        if (envSettings !== undefined && currentMeta.stripe) {
          // Need to explicitly handle deletion in partial update
          metaUpdates.stripe = null;
        }
      }

      // Use partial update to preserve other meta fields (e.g., previewUpdatedAt)
      await updateDocumentMeta(documentId, metaUpdates);

      // Fetch updated document for response
      const updatedDocument = await prisma.document.findUnique({
        where: { id: documentId },
      });

      res.json({
        success: true,
        data: {
          message: 'Document settings updated successfully',
          document: updatedDocument,
        },
      });
    } catch (error) {
      console.error('Error updating document settings:', error);
      res.status(500).json({
        success: false,
        errorMsg: 'Failed to update document settings',
      });
    }
  }
);

// Get document history
router.get(
  '/:documentId/history',
  async function (req, res: ProfileResponse<any>) {
    const currentUser = res.locals.currentUser;
    const { documentId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    try {
      // Check if user has access to the document
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          projectId: true,
          access: true,
          creatorUserId: true,
          organizationId: true,
        },
      });

      if (!document) {
        res.status(404).json({
          success: false,
          errorMsg: 'Document not found',
        });
        return;
      }

      // Check access permissions
      const hasAccess = await checkDocumentAccess(
        document,
        currentUser.email,
        currentUser.userId,
        currentUser.organizationId
      );

      if (!hasAccess) {
        res.status(403).json({
          success: false,
          errorMsg: 'Access denied',
        });
        return;
      }

      // Get document histories
      const histories = await getDocumentHistories(documentId, {
        limit,
        offset,
      });

      res.json({
        success: true,
        data: histories,
      });
    } catch (error) {
      console.error('Error fetching document history:', error);
      res.status(500).json({
        success: false,
        errorMsg: 'Failed to fetch document history',
      });
    }
  }
);

// Get source code from document history (for code diff comparison)
// NOTE: This route must come BEFORE /:documentId/history/:versionNumber to avoid route conflict
router.get(
  '/:documentId/history/source-code',
  async function (req, res: ProfileResponse<any>) {
    const currentUser = res.locals.currentUser;
    const { documentId } = req.params;
    const versionNumber = req.query.versionNumber
      ? (() => {
          const parsed = parseInt(req.query.versionNumber as string, 10);
          return isNaN(parsed) ? undefined : parsed;
        })()
      : undefined;

    try {
      // Check if user has access to the document
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: { project: true },
      });

      if (!document) {
        res.status(404).json({
          success: false,
          errorMsg: 'Document not found',
        });
        return;
      }

      // Check access permissions
      const { hasAccess } = await checkDocumentAccess(
        document,
        currentUser.email,
        currentUser.userId,
        currentUser.organizationId
      );

      if (!hasAccess) {
        res.status(403).json({
          success: false,
          errorMsg: 'Access denied',
        });
        return;
      }

      // Determine which version to fetch
      let targetVersionNumber: number | undefined = versionNumber;

      if (targetVersionNumber === undefined) {
        // If no version specified, use activeHistoryVersion from document meta
        const meta = document.meta as Prisma.JsonObject;

        if (
          meta?.activeHistoryVersion &&
          typeof meta.activeHistoryVersion === 'number'
        ) {
          targetVersionNumber = meta.activeHistoryVersion;
        } else {
          // Fallback: get latest version
          const latestHistory = await getDocumentHistories(documentId, {
            limit: 1,
            offset: 0,
          });
          if (latestHistory.length === 0) {
            res.status(404).json({
              success: false,
              errorMsg: 'No document history found',
            });
            return;
          }
          targetVersionNumber = latestHistory[0].versionNumber;
        }
      }

      // Final safety check
      if (
        targetVersionNumber === undefined ||
        typeof targetVersionNumber !== 'number'
      ) {
        console.error(
          'Failed to determine version number:',
          targetVersionNumber
        );
        res.status(500).json({
          success: false,
          errorMsg: 'Failed to determine version number',
        });
        return;
      }

      // Fetch the specific version
      let history = await getDocumentHistoryByVersion(
        documentId,
        targetVersionNumber
      );

      if (!history) {
        res.status(404).json({
          success: false,
          errorMsg: `Document history version ${targetVersionNumber} not found`,
        });
        return;
      }

      // If the target version doesn't have fileUrl, find the most recent version that does
      if (!history.fileUrl || history.fileUrl.trim() === '') {
        const historiesWithFileUrl = await prisma.documentHistory.findFirst({
          where: {
            documentId,
            fileUrl: { not: null },
            // Also filter out empty strings using a length check
            // Note: Prisma doesn't support string length directly, so we'll check after fetching
          },
          orderBy: { versionNumber: 'desc' },
        });

        // Filter out empty strings manually since Prisma doesn't support it directly
        let validHistory = historiesWithFileUrl;
        if (historiesWithFileUrl && (!historiesWithFileUrl.fileUrl || historiesWithFileUrl.fileUrl.trim() === '')) {
          // Find another history with a non-empty fileUrl
          const allHistories = await prisma.documentHistory.findMany({
            where: {
              documentId,
              fileUrl: { not: null },
            },
            orderBy: { versionNumber: 'desc' },
          });
          validHistory = allHistories.find(h => h.fileUrl && h.fileUrl.trim() !== '');
        }

        if (!validHistory || !validHistory.fileUrl || validHistory.fileUrl.trim() === '') {
          res.status(404).json({
            success: false,
            errorMsg: 'No saved source code version available for comparison',
          });
          return;
        }

        // Use the fallback history
        history = validHistory;
      }

      // Validate that fileUrl is not empty
      if (!history.fileUrl || history.fileUrl.trim() === '') {
        res.status(404).json({
          success: false,
          errorMsg: 'No file URL available for this version',
        });
        return;
      }

      // Generate presigned URL for secure access
      let presignedUrl: string | null = null;

      try {
        // Extract bucket name and key from the S3 URL
        // Support formats:
        // 1. Virtual-hosted with region: https://bucket.s3.region.amazonaws.com/key (bucket can contain dots)
        // 2. Virtual-hosted without region: https://bucket.s3.amazonaws.com/key (bucket can contain dots)
        // 3. Path-style: https://s3.region.amazonaws.com/bucket/key

        let bucketName: string | undefined;
        let key: string | undefined;

        // Try virtual-hosted style (most common)
        // Use non-greedy match (.+?) to capture bucket name (which may contain dots) until .s3
        const virtualHostedMatch = history.fileUrl.match(
          /https?:\/\/(.+?)\.s3(?:[.-]([^.]+))?\.amazonaws\.com\/(.+)$/
        );

        if (virtualHostedMatch) {
          bucketName = virtualHostedMatch[1];
          key = virtualHostedMatch[3];
        } else {
          // Try path-style
          const pathStyleMatch = history.fileUrl.match(
            /https?:\/\/s3[.-]([^.]+)\.amazonaws\.com\/([^/]+)\/(.+)$/
          );
          if (pathStyleMatch) {
            bucketName = pathStyleMatch[2];
            key = pathStyleMatch[3];
          }
        }

        if (bucketName && key) {
          presignedUrl = await generatePresignedDownloadUrl(key, bucketName);
        } else {
          console.warn('Could not parse S3 URL:', history.fileUrl);
          res.status(400).json({
            success: false,
            errorMsg: 'Invalid S3 URL format',
          });
          return;
        }
      } catch (error) {
        console.error('Error generating presigned URL:', error);
        res.status(500).json({
          success: false,
          errorMsg: 'Failed to generate presigned URL',
        });
        return;
      }

      if (!presignedUrl) {
        res.status(500).json({
          success: false,
          errorMsg: 'Failed to generate presigned URL',
        });
        return;
      }

      // Return presigned URL for client to fetch
      res.json({
        success: true,
        data: {
          versionNumber: history.versionNumber,
          fileUrl: presignedUrl,
          createdAt: history.createdAt,
        },
      });
    } catch (error) {
      console.error('Error fetching document history source code:', error);
      res.status(500).json({
        success: false,
        errorMsg: 'Failed to fetch source code',
      });
    }
  }
);

// Get a specific version of document history
router.get(
  '/:documentId/history/:versionNumber',
  async function (req, res: ProfileResponse<any>) {
    const currentUser = res.locals.currentUser;
    const { documentId, versionNumber } = req.params;

    try {
      // Validate versionNumber
      const parsedVersionNumber = parseInt(versionNumber, 10);
      if (isNaN(parsedVersionNumber)) {
        res.status(400).json({
          success: false,
          errorMsg: 'Invalid version number',
        });
        return;
      }

      // Check if user has access to the document
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          projectId: true,
          access: true,
          creatorUserId: true,
          organizationId: true,
        },
      });

      if (!document) {
        res.status(404).json({
          success: false,
          errorMsg: 'Document not found',
        });
        return;
      }

      // Check access permissions
      const hasAccess = await checkDocumentAccess(
        document,
        currentUser.email,
        currentUser.userId,
        currentUser.organizationId
      );

      if (!hasAccess) {
        res.status(403).json({
          success: false,
          errorMsg: 'Access denied',
        });
        return;
      }

      // Get the specific history version
      const history = await getDocumentHistoryByVersion(
        documentId,
        parsedVersionNumber
      );

      if (!history) {
        res.status(404).json({
          success: false,
          errorMsg: 'History version not found',
        });
        return;
      }

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      console.error('Error fetching document history version:', error);
      res.status(500).json({
        success: false,
        errorMsg: 'Failed to fetch document history version',
      });
    }
  }
);

// Update document history rating
router.post(
  '/:documentId/history/:versionNumber/rating',
  async function (req, res: ProfileResponse<any>) {
    const currentUser = res.locals.currentUser;
    const { documentId, versionNumber } = req.params;
    const { rating } = req.body;

    try {
      // Check if user has access to the document
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          projectId: true,
          access: true,
          creatorUserId: true,
          organizationId: true,
        },
      });

      if (!document) {
        res.status(404).json({
          success: false,
          errorMsg: 'Document not found',
        });
        return;
      }

      // Check access permissions
      const hasAccess = await checkDocumentAccess(
        document,
        currentUser.email,
        currentUser.userId,
        currentUser.organizationId
      );

      if (!hasAccess) {
        res.status(403).json({
          success: false,
          errorMsg: 'Access denied',
        });
        return;
      }

      // Update the rating
      const updatedHistory = await updateDocumentHistoryRating(
        documentId,
        parseInt(versionNumber),
        rating
      );

      res.json({
        success: true,
        data: updatedHistory,
      });
    } catch (error) {
      console.error('Error updating document history rating:', error);
      res.status(500).json({
        success: false,
        errorMsg: 'Failed to update rating',
      });
    }
  }
);

// Manual document history save (for PROTOTYPE/PRODUCT save button)
router.post(
  '/:documentId/history',
  async function (req, res: ProfileResponse<any>) {
    const currentUser = res.locals.currentUser;
    const { documentId } = req.params;
    const { description, sourceUrl } = req.body;

    try {
      // Check if user has access to the document
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: {
          project: true,
        },
      });

      if (!document) {
        res.status(404).json({
          success: false,
          errorMsg: 'Document not found',
        });
        return;
      }

      // Check access permissions
      const accessCheck = await checkDocumentAccess(
        document,
        currentUser.email,
        currentUser.userId,
        currentUser.organizationId
      );

      if (!accessCheck.hasAccess) {
        res.status(403).json({
          success: false,
          errorMsg: 'Access denied',
        });
        return;
      }

      // Only allow for PROTOTYPE/PRODUCT documents
      if (
        document.type !== DOCTYPE.PROTOTYPE &&
        document.type !== DOCTYPE.PRODUCT
      ) {
        res.status(400).json({
          success: false,
          errorMsg:
            'Manual history save only allowed for PROTOTYPE/PRODUCT documents',
        });
        return;
      }

      // Get the latest version number
      const {
        getLatestVersionNumber,
        createDocumentHistory,
      } = require('../../services/documentHistoryService');
      const latestVersionNumber = await getLatestVersionNumber(documentId);
      const newVersionNumber = latestVersionNumber + 1;

      // Upload source code to S3
      let fileUrl: string | undefined = undefined;
      try {
        const contentStr = document.content?.toString('utf-8');
        if (contentStr) {
          // Upload file structure to S3 using the same function as during generation
          fileUrl = await saveAppFileStructure(
            documentId,
            newVersionNumber,
            contentStr
          );
          console.log(
            `✅ Uploaded source code to S3 for version ${newVersionNumber}:`,
            fileUrl
          );
        } else {
          console.warn(
            `⚠️ No document content found to upload for document ${documentId}`
          );
        }
      } catch (s3Error) {
        console.error('Failed to upload source code to S3:', s3Error);
        // Continue with history creation even if S3 upload fails
      }

      // Create new history record
      const history = await createDocumentHistory({
        documentId,
        versionNumber: newVersionNumber,
        description: description || 'Manual save',
        fileUrl,
        currentVersionUrl: sourceUrl,
        content: undefined, // Don't store content for PROTOTYPE/PRODUCT
        chosenDocumentIds: undefined,
        rating: undefined,
        creatorUserId: currentUser.userId,
        creatorEmail: currentUser.email,
      });

      console.log(
        `✅ Manually created document history version ${newVersionNumber} for document ${documentId}`
      );

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      console.error('Error creating document history:', error);
      res.status(500).json({
        success: false,
        errorMsg: 'Failed to create document history',
      });
    }
  }
);


module.exports = {
  className: 'documents',
  routes: router,
};
