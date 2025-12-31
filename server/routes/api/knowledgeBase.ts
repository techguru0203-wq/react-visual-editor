import { Router } from 'express';
import multer from 'multer';
import { userProfileRequestHandler } from '../../lib/util';
import { ProfileResponse } from '../../types/response';
import {
  createKnowledgeBase,
  getKnowledgeBaseList,
  getKnowledgeBaseById,
  updateKnowledgeBase,
  deleteKnowledgeBase,
  linkProjectToKnowledgeBase,
  unlinkProjectFromKnowledgeBase,
  getKnowledgeBaseFiles,
  deleteKnowledgeBaseFile,
} from '../../services/knowledgeBaseService';
import {
  uploadFile,
  reprocessFile,
} from '../../services/fileProcessingService';
import {
  searchKnowledgeBase,
  chatWithKnowledgeBase,
} from '../../services/knowledgeSearchService';
import { KnowledgeBase, KnowledgeBaseFile } from '@prisma/client';
import {
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  s3Client,
} from '../../lib/s3Upload';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import path from 'path';
import prisma from '../../db/prisma';
import { processFileToVectors } from '../../services/fileProcessingService';
import { fileProcessingQueue } from '../../services/fileProcessingQueue';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

const router = Router();

// Protected routes with user authentication
router.use(userProfileRequestHandler);

router.post('/', async (req, res: ProfileResponse<KnowledgeBase>) => {
  const currentUser = res.locals.currentUser;

  try {
    const { name, description, projectIds } = req.body;

    if (!name) {
      res.status(400).json({
        success: false,
        errorMsg: 'Name is required',
      });
      return;
    }

    const knowledgeBase = await createKnowledgeBase({
      name,
      description,
      organizationId: currentUser.organizationId,
      creatorUserId: currentUser.userId,
      projectIds,
    });

    res.status(200).json({
      success: true,
      data: knowledgeBase,
    });
  } catch (error: any) {
    console.error('Error in POST /api/knowledge-base:', error);
    res.status(500).json({
      success: false,
      errorMsg: error.message || 'Failed to create knowledge base',
    });
  }
});

router.get('/', async (req, res: ProfileResponse<KnowledgeBase[]>) => {
  const currentUser = res.locals.currentUser;

  try {
    const knowledgeBases = await getKnowledgeBaseList(
      currentUser.organizationId
    );

    res.status(200).json({
      success: true,
      data: knowledgeBases,
    });
  } catch (error: any) {
    console.error('Error in GET /api/knowledge-base:', error);
    res.status(500).json({
      success: false,
      errorMsg: error.message || 'Failed to fetch knowledge bases',
    });
  }
});

router.get('/:id', async (req, res: ProfileResponse<KnowledgeBase>) => {
  try {
    const { id } = req.params;

    const knowledgeBase = await getKnowledgeBaseById(id);

    if (!knowledgeBase) {
      res.status(404).json({
        success: false,
        errorMsg: 'Knowledge base not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: knowledgeBase,
    });
  } catch (error: any) {
    console.error('Error in GET /api/knowledge-base/:id:', error);
    res.status(500).json({
      success: false,
      errorMsg: error.message || 'Failed to fetch knowledge base',
    });
  }
});

router.put('/:id', async (req, res: ProfileResponse<KnowledgeBase>) => {
  try {
    const { id } = req.params;
    const { name, description, projectIds } = req.body;

    const knowledgeBase = await updateKnowledgeBase(id, {
      name,
      description,
      projectIds,
    });

    res.status(200).json({
      success: true,
      data: knowledgeBase,
    });
  } catch (error: any) {
    console.error('Error in PUT /api/knowledge-base/:id:', error);
    res.status(500).json({
      success: false,
      errorMsg: error.message || 'Failed to update knowledge base',
    });
  }
});

router.delete(
  '/:id',
  async (req, res: ProfileResponse<{ message: string }>) => {
    try {
      const { id } = req.params;

      await deleteKnowledgeBase(id);

      res.status(200).json({
        success: true,
        data: { message: 'Knowledge base deleted successfully' },
      });
    } catch (error: any) {
      console.error('Error in DELETE /api/knowledge-base/:id:', error);
      res.status(500).json({
        success: false,
        errorMsg: error.message || 'Failed to delete knowledge base',
      });
    }
  }
);

router.post(
  '/:id/presign-upload',
  async (
    req,
    res: ProfileResponse<{
      uploadUrl: string;
      publicUrl: string;
      fileId: string;
    }>
  ) => {
    const currentUser = res.locals.currentUser;

    try {
      const { id } = req.params;
      const { fileName, fileType, fileSize } = req.body;

      if (!fileName || !fileType || typeof fileSize !== 'number') {
        res.status(400).json({
          success: false,
          errorMsg: 'Missing required fields: fileName, fileType, fileSize',
        });
        return;
      }

      // Generate S3 key
      const fileExt = path.extname(fileName);
      const s3Key = `knowledge-base/${id}/${currentUser.userId}/${
        fileName.split('.')[0]
      }_${Date.now()}${fileExt}`;

      // Generate presigned upload URL
      const uploadUrl = await generatePresignedUploadUrl(s3Key, fileType);

      const bucketName =
        process.env.KNOWLEDGE_BASE_BUCKET_NAME || process.env.BUCKET_NAME;
      const region = process.env.AWS_REGION;
      const publicUrl = `https://s3.${region}.amazonaws.com/${bucketName}/${s3Key}`;

      // Create file record in database with PENDING status
      const fileRecord = await prisma.knowledgeBaseFile.create({
        data: {
          knowledgeBaseId: id,
          fileName,
          fileType,
          fileSize,
          s3Key,
          s3Url: publicUrl,
          uploadedBy: currentUser.userId,
          processingStatus: 'PENDING',
        },
      });

      // Trigger file processing asynchronously after client uploads to S3
      // We'll need to call the processing after S3 upload completes
      // For now, we return the upload URL and file record ID
      res.status(200).json({
        success: true,
        data: {
          uploadUrl,
          publicUrl,
          fileId: fileRecord.id,
        },
      });
    } catch (error: any) {
      console.error(
        'Error in POST /api/knowledge-base/:id/presign-upload:',
        error
      );
      res.status(500).json({
        success: false,
        errorMsg: error.message || 'Failed to generate presigned URL',
      });
    }
  }
);

router.post(
  '/:id/files/:fileId/process',
  async (req, res: ProfileResponse<{ message: string }>) => {
    try {
      const { fileId } = req.params;
      console.log(`📄 Processing file request for fileId: ${fileId}`);

      const file = await prisma.knowledgeBaseFile.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        console.error(`❌ File not found: ${fileId}`);
        res.status(404).json({
          success: false,
          errorMsg: 'File not found',
        });
        return;
      }

      console.log(`✅ File found: ${file.fileName}, s3Key: ${file.s3Key}`);

      // Download file from S3
      const bucketName =
        process.env.KNOWLEDGE_BASE_BUCKET_NAME || process.env.BUCKET_NAME;
      console.log(
        `📦 Downloading from S3 bucket: ${bucketName}, key: ${file.s3Key}`
      );

      const getCommand = new GetObjectCommand({
        Bucket: bucketName,
        Key: file.s3Key,
      });

      const s3Response = await s3Client.send(getCommand);
      const fileBuffer = Buffer.from(
        await s3Response.Body!.transformToByteArray()
      );
      console.log(
        `✅ File downloaded from S3, size: ${fileBuffer.length} bytes`
      );

      console.log(
        `🔄 Starting background processing for file: ${file.fileName}`
      );

      // Start processing in background
      processFileToVectors(
        file.id,
        file.knowledgeBaseId,
        fileBuffer,
        file.fileName,
        file.fileType
      ).catch((error: any) => {
        console.error('❌ Error in background file processing:', error);
        console.error('Error stack:', error.stack);
      });

      res.status(200).json({
        success: true,
        data: { message: 'File processing started' },
      });
    } catch (error: any) {
      console.error(
        '❌ Error in POST /api/knowledge-base/:id/files/:fileId/process:',
        error
      );
      console.error('Error stack:', error.stack);
      res.status(500).json({
        success: false,
        errorMsg: error.message || 'Failed to start file processing',
      });
    }
  }
);

router.get(
  '/:id/files',
  async (req, res: ProfileResponse<KnowledgeBaseFile[]>) => {
    try {
      const { id } = req.params;

      const files = await getKnowledgeBaseFiles(id);

      res.status(200).json({
        success: true,
        data: files,
      });
    } catch (error: any) {
      console.error('Error in GET /api/knowledge-base/:id/files:', error);
      res.status(500).json({
        success: false,
        errorMsg: error.message || 'Failed to fetch files',
      });
    }
  }
);

router.post(
  '/:id/files',
  upload.single('file'),
  async (req, res: ProfileResponse<KnowledgeBaseFile>) => {
    const currentUser = res.locals.currentUser;

    try {
      const { id } = req.params;
      const file = req.file;

      if (!file) {
        res.status(400).json({
          success: false,
          errorMsg: 'No file uploaded',
        });
        return;
      }

      const fileRecord = await uploadFile({
        knowledgeBaseId: id,
        file,
        userId: currentUser.userId,
      });

      res.status(200).json({
        success: true,
        data: fileRecord,
      });
    } catch (error: any) {
      console.error('Error in POST /api/knowledge-base/:id/files:', error);
      res.status(500).json({
        success: false,
        errorMsg: error.message || 'Failed to upload file',
      });
    }
  }
);

router.get(
  '/:id/files/:fileId/download',
  async (req, res: ProfileResponse<{ downloadUrl: string }>) => {
    try {
      const { fileId } = req.params;

      const file = await prisma.knowledgeBaseFile.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        res.status(404).json({
          success: false,
          errorMsg: 'File not found',
        });
        return;
      }

      // Generate presigned download URL
      const downloadUrl = await generatePresignedDownloadUrl(file.s3Key);

      res.status(200).json({
        success: true,
        data: { downloadUrl },
      });
    } catch (error: any) {
      console.error(
        'Error in GET /api/knowledge-base/:id/files/:fileId/download:',
        error
      );
      res.status(500).json({
        success: false,
        errorMsg: error.message || 'Failed to generate download URL',
      });
    }
  }
);

router.delete(
  '/:id/files/:fileId',
  async (req, res: ProfileResponse<{ message: string }>) => {
    try {
      const { fileId } = req.params;

      await deleteKnowledgeBaseFile(fileId);

      res.status(200).json({
        success: true,
        data: { message: 'File deleted successfully' },
      });
    } catch (error: any) {
      console.error(
        'Error in DELETE /api/knowledge-base/:id/files/:fileId:',
        error
      );
      res.status(500).json({
        success: false,
        errorMsg: error.message || 'Failed to delete file',
      });
    }
  }
);

router.post(
  '/:id/files/:fileId/reprocess',
  async (req, res: ProfileResponse<{ message: string }>) => {
    try {
      const { fileId } = req.params;

      await reprocessFile(fileId);

      res.status(200).json({
        success: true,
        data: { message: 'File reprocessing started' },
      });
    } catch (error: any) {
      console.error(
        'Error in POST /api/knowledge-base/:id/files/:fileId/reprocess:',
        error
      );
      res.status(500).json({
        success: false,
        errorMsg: error.message || 'Failed to reprocess file',
      });
    }
  }
);

router.post('/:id/search', async (req, res: ProfileResponse<any>) => {
  try {
    const { id } = req.params;
    const { query, topK } = req.body;

    if (!query) {
      res.status(400).json({
        success: false,
        errorMsg: 'Query is required',
      });
      return;
    }

    const results = await searchKnowledgeBase(id, query, topK);

    res.status(200).json({
      success: true,
      data: { results },
    });
  } catch (error: any) {
    console.error('Error in POST /api/knowledge-base/:id/search:', error);
    res.status(500).json({
      success: false,
      errorMsg: error.message || 'Failed to search knowledge base',
    });
  }
});

router.post('/:id/chat', async (req, res: ProfileResponse<any>) => {
  const currentUser = res.locals.currentUser;

  try {
    const { id } = req.params;
    const { message, chatSessionId } = req.body;

    if (!message || !message.trim()) {
      res.status(400).json({
        success: false,
        errorMsg: 'Message is required',
      });
      return;
    }

    const response = await chatWithKnowledgeBase({
      knowledgeBaseId: id,
      userMessage: message,
      userId: currentUser.userId,
      chatSessionId,
    });

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error: any) {
    console.error('Error in POST /api/knowledge-base/:id/chat:', error);
    res.status(500).json({
      success: false,
      errorMsg: error.message || 'Failed to generate response',
    });
  }
});

router.post(
  '/:id/projects/:projectId',
  async (req, res: ProfileResponse<any>) => {
    try {
      const { id, projectId } = req.params;

      const link = await linkProjectToKnowledgeBase(id, projectId);

      res.status(200).json({
        success: true,
        data: link,
      });
    } catch (error: any) {
      console.error(
        'Error in POST /api/knowledge-base/:id/projects/:projectId:',
        error
      );
      res.status(500).json({
        success: false,
        errorMsg: error.message || 'Failed to link project',
      });
    }
  }
);

router.delete(
  '/:id/projects/:projectId',
  async (req, res: ProfileResponse<{ message: string }>) => {
    try {
      const { id, projectId } = req.params;

      await unlinkProjectFromKnowledgeBase(id, projectId);

      res.status(200).json({
        success: true,
        data: { message: 'Project unlinked successfully' },
      });
    } catch (error: any) {
      console.error(
        'Error in DELETE /api/knowledge-base/:id/projects/:projectId:',
        error
      );
      res.status(500).json({
        success: false,
        errorMsg: error.message || 'Failed to unlink project',
      });
    }
  }
);

router.get('/jobs/:jobId/status', async (req, res: ProfileResponse<any>) => {
  try {
    const { jobId } = req.params;

    const status = await fileProcessingQueue.getJobStatus(jobId);

    if (status.status === 'not_found') {
      return res.status(404).json({
        success: false,
        errorMsg: 'Job not found',
      });
    }

    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    console.error(
      'Error in GET /api/knowledge-base/jobs/:jobId/status:',
      error
    );
    res.status(500).json({
      success: false,
      errorMsg: error.message || 'Failed to get job status',
    });
  }
});

router.get('/queue/stats', async (req, res: ProfileResponse<any>) => {
  try {
    const stats = await fileProcessingQueue.getQueueStats();

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('Error in GET /api/knowledge-base/queue/stats:', error);
    res.status(500).json({
      success: false,
      errorMsg: error.message || 'Failed to get queue stats',
    });
  }
});

module.exports = {
  className: 'knowledge-base',
  routes: router,
};
