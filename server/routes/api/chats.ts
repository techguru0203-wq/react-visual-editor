import { Router } from 'express';
import { extractJsonObject, userProfileRequestHandler } from '../../lib/util';
import { ProfileResponse } from '../../types/response';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import multer from 'multer';
import path from 'path';
import {
  createChatSession,
  generateChatResponse,
  getOrCreateChatSession,
  generateStreamingChatResponse,
} from '../../services/llmService/chatAgent';
import prisma from '../../db/prisma';
import { GenerationMinimumCredit } from '../../lib/constant';
import { ChatMessage, LegacyDocumentOutput } from '../types/documentTypes';
import {
  Access,
  ChatHistory,
  ChatSession,
  ChatSessionTargetEntityType,
  MessageUseTypes,
  Prisma,
  RecordStatus,
} from '@prisma/client';
import { ChatSessionOutput } from '../types/chatTypes';
import { RedisSingleton } from '../../services/redis/redis';

const router = Router();
router.use(userProfileRequestHandler);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 150 * 1024 * 1024, // 150MB
  },
});

interface FileContent {
  fileContent: string;
  fileType: string;
  fileId: string;
}

router.get(
  '/',
  async function (request, response: ProfileResponse<ChatMessage[]>) {
    try {
      const { docId, chatSessionId } = request.query;
      console.log('api.chats.start:', request.query, docId, chatSessionId);
      let whereClause;
      if (docId) {
        whereClause = {
          targetEntityId: docId as string,
          status: RecordStatus.ACTIVE,
        };
      } else if (chatSessionId) {
        whereClause = {
          id: chatSessionId as string,
          status: RecordStatus.ACTIVE,
        };
      }
      const session = await prisma.chatSession.findFirst({
        where: whereClause,
      });

      if (!session) {
        throw new Error('Chat session not found for document: ' + docId);
      }

      const chats = await prisma.chatHistory.findMany({
        where: {
          sessionId: session.id,
          messageUse: {
            in: [MessageUseTypes.BOTH, MessageUseTypes.CHAT],
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 15,
      });

      // Reverse the order back to ascending for display
      const result = chats
        .reverse()
        .reduce((acc: ChatMessage[], chat: ChatHistory) => {
          try {
            let message = chat.message as Prisma.JsonObject;
            let content = extractJsonObject(message.content as string);
            if (
              content &&
              typeof content === 'object' &&
              'message' in content
            ) {
              // it's an API response in an object
              acc.push({
                type: message.type as string,
                message: content.message as string,
                createdAt: chat.createdAt,
              });
            } else {
              // its a string message response
              acc.push({
                type: message.type as string,
                message: (message.content as string) || '',
                createdAt: chat.createdAt,
              });
            }
          } catch (error) {
            // If parsing fails, just use the raw content
            console.error('Error parsing chat message:', error);
            let message = chat.message as Prisma.JsonObject;
            acc.push({
              type: message.type as string,
              message: (message.content as string) || '',
              createdAt: chat.createdAt,
            });
          }
          return acc;
        }, []);

      response.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.log('in server.routes.api.chat.failure:', error);
      response.status(200).json({ success: true, data: [] });
    }
  }
);

router.get(
  '/sessions',
  async function (request, response: ProfileResponse<ChatSessionOutput[]>) {
    try {
      const { userId } = request.query;
      console.log('api.chats.sessions.start:', request.query, userId);

      const sessions = await prisma.chatSession.findMany({
        where: {
          userId: userId as string,
          status: RecordStatus.ACTIVE,
          targetEntityType: ChatSessionTargetEntityType.CHAT,
        },
        include: {
          user: {
            select: {
              username: true,
              id: true,
              email: true,
            },
          },
        },
      });

      if (!sessions) {
        throw new Error('Chat sessions not found for user: ' + userId);
      }

      // console.log('chats after final transform: => ', sessions);

      response.status(200).json({
        success: true,
        data: sessions,
      });
    } catch (error) {
      console.log('in server.routes.api.chat.sessions.failure:', error);
      response.status(200).json({ success: true, data: [] });
    }
  }
);

router.post('/upsert', async (req, res: ProfileResponse<ChatSession>) => {
  const currentUser = res.locals.currentUser;
  const userId = currentUser.userId;
  let org = await prisma.organization.findUnique({
    where: { id: currentUser.organizationId },
  });
  if (!org) {
    res
      .status(500)
      .json({ success: false, errorMsg: 'Organization not found.' });
    return;
  } else if (org.credits < GenerationMinimumCredit) {
    res.status(500).json({ success: false, errorMsg: 'Insufficient credits.' });
    return;
  }
  try {
    const { id, name, access, status } = req.body;
    if (id) {
      let updateResult = await prisma.chatSession.update({
        where: {
          id,
        },
        data: {
          name,
          access,
          status: status || RecordStatus.ACTIVE,
        },
      });
      res.status(200).json({
        success: true,
        data: updateResult,
      });
    } else {
      let chatSession = await createChatSession({
        name,
        access,
        userId,
        userEmail: currentUser.email,
        targetEntityId: '',
        targetEntityType: ChatSessionTargetEntityType.CHAT,
        targetEntitySubType: '',
      });
      res.status(200).json({
        success: true,
        data: chatSession,
      });
    }
  } catch (error: any) {
    console.log('errorMsg:', error.toString());
    res.status(500).json({ success: false, errorMsg: error.toString() });
  }
});

router.post(
  '/reset-document-session',
  async (req, res: ProfileResponse<{ chatSessionId: string }>) => {
    const currentUser = res.locals.currentUser;
    const { documentId, documentType } = req.body;

    if (!documentId || typeof documentId !== 'string') {
      res.status(400).json({
        success: false,
        errorMsg: 'Document ID is required.',
      });
      return;
    }

    try {
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

      const newSession = await createChatSession({
        name: documentType || '',
        access: Access.SELF,
        userId: currentUser.userId,
        userEmail: currentUser.email,
        targetEntityId: documentId,
        targetEntityType: ChatSessionTargetEntityType.DOCUMENT,
        targetEntitySubType: documentType || '',
      });

      res.status(200).json({
        success: true,
        data: { chatSessionId: newSession.id },
      });
    } catch (error: any) {
      console.log('errorMsg:', error.toString());
      res.status(500).json({ success: false, errorMsg: error.toString() });
    }
  }
);

router.post(
  '/full-message-streaming',
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
      const chatSessionId = param.chatSessionId;

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      await generateStreamingChatResponse({
        chatContent,
        sessionId: chatSessionId,
        currentUser: res.locals.currentUser,
        docId: entityId,
        targetEntityType: entityType,
        docType: req.body.entitySubType,
        uploadedFileContent: req.body.uploadedFileContent,
        chosenDocumentIds: req.body.chosenDocumentIds,
        previousDocument: req.body.contents,
        handleStreamToken: (token: string) => {
          res.write(token);
        },
      });

      res.end();
    } catch (error: any) {
      console.log('errorMsg:', error.toString());
      res.write(`Error: ${error.toString()}`);
      res.end();
    }
  }
);

router.post(
  '/message',
  async (req, res: ProfileResponse<LegacyDocumentOutput>) => {
    const currentUser = res.locals.currentUser;
    const userId = currentUser.userId;
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
      const docType = param.entitySubType || '';

      // Clear any stale stop signal from previous generations at the start of a new message
      // This prevents old stop signals from affecting new messages
      const stopKey = `stop-generation:${entityId}`;
      if (entityId) {
        await RedisSingleton.clearData(stopKey);
      }

      // get chat session id
      let chatSessionId =
        param.chatSessionId ||
        (
          await getOrCreateChatSession({
            name: param.name,
            userId,
            chatContent,
            userEmail: currentUser.email,
            targetEntityId: entityId,
            targetEntityType: entityType,
            targetEntitySubType: param.entitySubType,
          })
        ).id;
      // determine if this request is to generate a document or answer a message
      let intentReply = await generateChatResponse({
        chatContent: param.description,
        sessionId: chatSessionId,
        currentUser: res.locals.currentUser,
        docId: entityId,
        targetEntityType: entityType,
        docType: docType,
        uploadedFileContent: param.uploadedFileContent,
        chosenDocumentIds: param.chosenDocumentIds,
        previousDocument: param.contents,
      });
      console.log('api.chat.intentReply:', intentReply);

      res.status(200).json({
        success: true,
        data: { ...intentReply, chatSessionId },
      });
    } catch (error: any) {
      console.log('errorMsg:', error.toString());
      res.status(500).json({ success: false, errorMsg: error.toString() });
    }
  }
);

router.post(
  '/upload-file',
  upload.single('file'),
  async function (req: Express.Request, response: ProfileResponse<string>) {
    const client = new S3Client({
      region: process.env.AWS_REGION,
      // region: 'us-east-2', // IF test, use this
    });

    try {
      console.log('req.file; ', req.file);

      const file = req.file;
      // const userId = '91cb9560-5081-7093-010f-17c6900bcbf7';
      const { userId } = response.locals.currentUser;
      if (!file) {
        throw new Error('No file uploaded.');
      }

      console.log('file=', file);

      const fileExt = path.extname(file.originalname);
      const key = `images/${userId}/${file.originalname.split(
        '.'[0]
      )}_${Date.now()}${fileExt}`;

      console.log('file key=', key);

      // BUCKET_NAME = 'omniflow.team' for dev env, and 'omniflow-team' for prod env
      const BUCKET_NAME = process.env.BUCKET_NAME;
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file.buffer,
      });

      const result = await client.send(command);
      console.log('file uploaded:', result);
      const fileUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;
      response.status(201).json({
        success: true,
        data: fileUrl,
      });
    } catch (error) {
      console.error('Error in POST /files/single-upload', error);
      response.status(500).json({
        success: false,
        errorMsg: (error as string | Error).toString(),
      });
    }
  }
);

module.exports = {
  className: 'chats',
  routes: router,
};
