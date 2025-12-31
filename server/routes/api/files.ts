import { Router } from 'express';
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import multer from 'multer';
import { userProfileRequestHandler } from '../../lib/util';
import { ProfileResponse } from '../../types/response';
import { uploadToS3 } from '../../lib/s3Upload';
import prisma from '../../db/prisma';
import { checkDocumentAccess } from '../../services/documentService';

const client = new S3Client({
  region: process.env.AWS_REGION,
  // region: 'us-east-2', // IF test, use this
  // Use path-style URLs to avoid TLS issues with bucket names containing dots
  forcePathStyle: true,
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 150 * 1024 * 1024, // 150MB
  },
});

const router = Router();
router.use(userProfileRequestHandler);

// Helper to build path-style public URL
const buildPublicUrl = (bucketName: string, key: string) =>
  `https://s3.${process.env.AWS_REGION}.amazonaws.com/${bucketName}/${key}`;

router.get('/', async function (req, res) {
  res.send('file');
});
// Upload image to s3
router.post(
  '/upload/:s3BucketName',
  upload.single('file'),
  async function (
    req: Express.Request & { params: { s3BucketName: string } },
    response: ProfileResponse<string>
  ) {
    try {
      const file = req.file;
      const { s3BucketName } = req.params;

      if (!s3BucketName) {
        throw new Error('S3 Bucket Name is required');
      }
      const { userId } = response.locals.currentUser;
      if (!file) {
        throw new Error('No file uploaded.');
      }

      console.log('file=', file);

      const fileUrl = await uploadToS3({
        fileBuffer: file.buffer,
        originalName: file.originalname,
        userId,
        s3BucketName: s3BucketName,
      });

      console.log('file uploaded:', fileUrl);
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

// ---- Simple presign upload (no quota check) ----
router.post(
  '/simple-presign-upload',
  async function (
    req: Express.Request,
    res: ProfileResponse<{
      uploadUrl: string;
      key: string;
      publicUrl: string;
    }>
  ) {
    try {
      const { documentId, fileName, fileType } = req.body || {};
      if (!documentId || !fileName || !fileType) {
        return res.status(400).json({
          success: false,
          errorMsg: 'Missing required fields: documentId, fileName, fileType',
        });
      }

      const currentUser = res.locals.currentUser;
      const dbDocument = await prisma.document.findUnique({
        where: { id: documentId },
      });
      if (!dbDocument) {
        return res.status(404).json({
          success: false,
          errorMsg: 'Document not found',
        });
      }

      const { hasAccess } = await checkDocumentAccess(
        dbDocument as any,
        currentUser.email,
        currentUser.userId,
        currentUser.organizationId
      );
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          errorMsg: 'No permission to upload to this document',
        });
      }

      const BUCKET_NAME = process.env.BUCKET_NAME as string;
      if (!BUCKET_NAME) {
        return res.status(500).json({
          success: false,
          errorMsg: 'BUCKET_NAME is not configured',
        });
      }

      const orgId = dbDocument.organizationId || currentUser.organizationId;
      const sanitized = String(fileName).replace(/[^a-zA-Z0-9.-]/g, '_');
      const key = `user-content/${orgId}/${
        dbDocument.id
      }/${Date.now()}-${sanitized}`;

      const putCmd = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: fileType,
      });
      const uploadUrl = await getSignedUrl(client, putCmd, { expiresIn: 900 });
      const publicUrl = buildPublicUrl(BUCKET_NAME, key);

      return res.status(200).json({
        success: true,
        data: {
          uploadUrl,
          key,
          publicUrl,
        },
      });
    } catch (error) {
      console.error('Error in POST /files/simple-presign-upload', error);
      return res.status(500).json({
        success: false,
        errorMsg: (error as Error).message || 'presign failed',
      });
    }
  }
);

// ---- Presign upload (project quota check) ----
router.post(
  '/presign-upload',
  async function (
    req: Express.Request,
    res: ProfileResponse<{
      uploadUrl: string;
      key: string;
      publicUrl: string;
      usedBytes: number;
      limitBytes: number;
    }>
  ) {
    try {
      const { documentId, fileName, fileType, fileSize } = req.body || {};
      if (
        !documentId ||
        !fileName ||
        !fileType ||
        typeof fileSize !== 'number'
      ) {
        return res.status(400).json({
          success: false,
          errorMsg:
            'Missing required fields: documentId, fileName, fileType, fileSize',
        });
      }

      const currentUser = res.locals.currentUser;
      const dbDocument = await prisma.document.findUnique({
        where: { id: documentId },
        include: { project: true, organization: true },
      });
      if (!dbDocument) {
        return res.status(404).json({
          success: false,
          errorMsg: 'Document not found',
        });
      }

      const { hasAccess } = await checkDocumentAccess(
        dbDocument as any,
        currentUser.email,
        currentUser.userId,
        currentUser.organizationId
      );
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          errorMsg: 'No permission to upload to this document',
        });
      }

      const BUCKET_NAME = process.env.BUCKET_NAME as string;
      if (!BUCKET_NAME) {
        return res.status(500).json({
          success: false,
          errorMsg: 'BUCKET_NAME is not configured',
        });
      }

      const QUOTA_BYTES = 1024 * 1024 * 1024; // 1GB per project

      // Helper: sum S3 sizes for one prefix
      const sumBytesForPrefix = async (prefix: string): Promise<number> => {
        let continuationToken: string | undefined = undefined;
        let sum = 0;
        do {
          const listCmd = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          });
          const out = await client.send(listCmd);
          continuationToken = out.IsTruncated
            ? out.NextContinuationToken
            : undefined;
          (out.Contents || []).forEach((o) => (sum += o.Size || 0));
        } while (continuationToken);
        return sum;
      };

      // Compute used bytes at project scope (fallback to this document when no project)
      let usedBytes = 0;
      const orgId = dbDocument.organizationId || currentUser.organizationId;
      if (dbDocument.projectId) {
        const projectDocs = await prisma.document.findMany({
          where: {
            projectId: dbDocument.projectId,
            status: { not: 'ARCHIVED' },
          },
          select: { id: true },
        });
        for (const d of projectDocs) {
          const prefix = `user-content/${orgId}/${d.id}/`;
          usedBytes += await sumBytesForPrefix(prefix);
        }
      } else {
        const prefix = `user-content/${orgId}/${dbDocument.id}/`;
        usedBytes += await sumBytesForPrefix(prefix);
      }

      if (usedBytes + fileSize > QUOTA_BYTES) {
        return res.status(400).json({
          success: false,
          errorMsg: 'Storage quota exceeded',
        });
      }

      const sanitized = String(fileName).replace(/[^a-zA-Z0-9.-]/g, '_');
      const key = `user-content/${orgId}/${
        dbDocument.id
      }/${Date.now()}-${sanitized}`;

      const putCmd = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: fileType,
      });
      const uploadUrl = await getSignedUrl(client, putCmd, { expiresIn: 900 });
      const publicUrl = buildPublicUrl(BUCKET_NAME, key);

      return res.status(200).json({
        success: true,
        data: {
          uploadUrl,
          key,
          publicUrl,
          usedBytes,
          limitBytes: QUOTA_BYTES,
        },
      });
    } catch (error) {
      console.error('Error in POST /files/presign-upload', error);
      return res.status(500).json({
        success: false,
        errorMsg: (error as Error).message || 'presign failed',
      });
    }
  }
);

// ---- List files by document (with pagination) ----
router.get(
  '/list',
  async function (
    req: Express.Request,
    res: ProfileResponse<{
      items: Array<{
        key: string;
        name: string;
        size: number;
        lastModified?: string;
        url: string;
      }>;
      nextCursor?: string;
      usedBytes: number;
    }>
  ) {
    try {
      const documentId = String(req.query.documentId || '');
      const cursor = (req.query.cursor as string) || undefined;
      const pageSize = Math.min(
        parseInt(String(req.query.pageSize || '50'), 10),
        100
      );
      if (!documentId) {
        return res
          .status(400)
          .json({ success: false, errorMsg: 'documentId is required' });
      }

      const currentUser = res.locals.currentUser;
      const dbDocument = await prisma.document.findUnique({
        where: { id: documentId },
        include: { project: true, organization: true },
      });
      if (!dbDocument) {
        return res
          .status(404)
          .json({ success: false, errorMsg: 'Document not found' });
      }
      const { hasAccess } = await checkDocumentAccess(
        dbDocument as any,
        currentUser.email,
        currentUser.userId,
        currentUser.organizationId
      );
      if (!hasAccess) {
        return res
          .status(403)
          .json({ success: false, errorMsg: 'No permission' });
      }

      const BUCKET_NAME = process.env.BUCKET_NAME as string;
      const orgId = dbDocument.organizationId || currentUser.organizationId;
      const prefix = `user-content/${orgId}/${dbDocument.id}/`;

      const listCmd = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: prefix,
        ContinuationToken: cursor,
        MaxKeys: pageSize,
      });
      const out = await client.send(listCmd);

      const items = (out.Contents || [])
        .filter((o) => !!o.Key && (o.Size || 0) >= 0)
        .map((o) => {
          const key = o.Key as string;
          const name = key.substring(prefix.length);
          const url = buildPublicUrl(BUCKET_NAME, key);
          return {
            key,
            name,
            size: o.Size || 0,
            lastModified: o.LastModified?.toISOString(),
            url,
          };
        });

      // used bytes for project scope
      let usedBytes = 0;
      const sumBytesForPrefix = async (p: string) => {
        let token: string | undefined = undefined;
        let sum = 0;
        do {
          const cmd = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: p,
            ContinuationToken: token,
          });
          const resp = await client.send(cmd);
          token = resp.IsTruncated ? resp.NextContinuationToken : undefined;
          (resp.Contents || []).forEach((o) => (sum += o.Size || 0));
        } while (token);
        return sum;
      };
      if (dbDocument.projectId) {
        const projectDocs = await prisma.document.findMany({
          where: {
            projectId: dbDocument.projectId,
            status: { not: 'ARCHIVED' },
          },
          select: { id: true },
        });
        for (const d of projectDocs) {
          usedBytes += await sumBytesForPrefix(
            `user-content/${orgId}/${d.id}/`
          );
        }
      } else {
        usedBytes += await sumBytesForPrefix(prefix);
      }

      return res.status(200).json({
        success: true,
        data: {
          items,
          nextCursor: out.IsTruncated ? out.NextContinuationToken : undefined,
          usedBytes,
        },
      });
    } catch (error) {
      console.error('Error in GET /files/list', error);
      return res.status(500).json({
        success: false,
        errorMsg: (error as Error).message || 'list failed',
      });
    }
  }
);

// ---- Quota summary ----
router.get(
  '/quota',
  async function (
    req: Express.Request,
    res: ProfileResponse<{ usedBytes: number; limitBytes: number }>
  ) {
    try {
      const documentId = String(req.query.documentId || '');
      if (!documentId) {
        return res
          .status(400)
          .json({ success: false, errorMsg: 'documentId is required' });
      }
      const currentUser = res.locals.currentUser;
      const dbDocument = await prisma.document.findUnique({
        where: { id: documentId },
        include: { project: true, organization: true },
      });
      if (!dbDocument) {
        return res
          .status(404)
          .json({ success: false, errorMsg: 'Document not found' });
      }
      const { hasAccess } = await checkDocumentAccess(
        dbDocument as any,
        currentUser.email,
        currentUser.userId,
        currentUser.organizationId
      );
      if (!hasAccess) {
        return res
          .status(403)
          .json({ success: false, errorMsg: 'No permission' });
      }

      const BUCKET_NAME = process.env.BUCKET_NAME as string;
      const orgId = dbDocument.organizationId || currentUser.organizationId;
      const sumBytesForPrefix = async (p: string) => {
        let token: string | undefined = undefined;
        let sum = 0;
        do {
          const cmd = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: p,
            ContinuationToken: token,
          });
          const resp = await client.send(cmd);
          token = resp.IsTruncated ? resp.NextContinuationToken : undefined;
          (resp.Contents || []).forEach((o) => (sum += o.Size || 0));
        } while (token);
        return sum;
      };
      let usedBytes = 0;
      if (dbDocument.projectId) {
        const projectDocs = await prisma.document.findMany({
          where: {
            projectId: dbDocument.projectId,
            status: { not: 'ARCHIVED' },
          },
          select: { id: true },
        });
        for (const d of projectDocs) {
          usedBytes += await sumBytesForPrefix(
            `user-content/${orgId}/${d.id}/`
          );
        }
      } else {
        usedBytes += await sumBytesForPrefix(
          `user-content/${orgId}/${dbDocument.id}/`
        );
      }
      const QUOTA_BYTES = 1024 * 1024 * 1024;
      return res
        .status(200)
        .json({ success: true, data: { usedBytes, limitBytes: QUOTA_BYTES } });
    } catch (error) {
      console.error('Error in GET /files/quota', error);
      return res.status(500).json({
        success: false,
        errorMsg: (error as Error).message || 'quota failed',
      });
    }
  }
);

// ---- Delete object ----
router.delete(
  '/object',
  async function (
    req: Express.Request,
    res: ProfileResponse<{ deleted: boolean }>
  ) {
    try {
      const { documentId, key } = req.body || {};
      if (!documentId || !key) {
        return res.status(400).json({
          success: false,
          errorMsg: 'documentId and key are required',
        });
      }

      const currentUser = res.locals.currentUser;
      const dbDocument = await prisma.document.findUnique({
        where: { id: documentId },
        include: { project: true, organization: true },
      });
      if (!dbDocument) {
        return res
          .status(404)
          .json({ success: false, errorMsg: 'Document not found' });
      }
      const { hasAccess } = await checkDocumentAccess(
        dbDocument as any,
        currentUser.email,
        currentUser.userId,
        currentUser.organizationId
      );
      if (!hasAccess) {
        return res
          .status(403)
          .json({ success: false, errorMsg: 'No permission' });
      }

      const BUCKET_NAME = process.env.BUCKET_NAME as string;
      const orgId = dbDocument.organizationId || currentUser.organizationId;
      const allowedPrefix = `user-content/${orgId}/${dbDocument.id}/`;
      if (!String(key).startsWith(allowedPrefix)) {
        return res
          .status(400)
          .json({ success: false, errorMsg: 'Invalid key for document' });
      }

      const cmd = new (await import('@aws-sdk/client-s3')).DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });
      await client.send(cmd);
      return res.status(200).json({ success: true, data: { deleted: true } });
    } catch (error) {
      console.error('Error in DELETE /files/object', error);
      return res.status(500).json({
        success: false,
        errorMsg: (error as Error).message || 'delete failed',
      });
    }
  }
);

// Upload built to s3
router.post(
  '/upload-built-file/:docId',
  upload.single('file'),
  async function (
    req: Express.Request & { params: { docId: string } },
    response: ProfileResponse<string>
  ) {
    try {
      const file = req.file;
      if (!file) {
        throw new Error('No file uploaded.');
      }

      const { docId } = req.params;

      console.log('file=', file);

      const fileUrl = await uploadToS3({
        fileBuffer: file.buffer,
        originalName: `${docId}.json`,
        userId: 'system', // Use 'system' as userId for built files
        s3BucketName: 'built-file',
      });

      console.log('file uploaded:', fileUrl);
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

// Modify proxy download route
router.get(
  '/proxy-download/:docId',
  async function (
    req: Express.Request & { params: { docId: string } },
    response: ProfileResponse<any>
  ) {
    try {
      const { docId } = req.params;

      if (!docId) {
        return response.status(400).json({
          success: false,
          errorMsg: 'Document ID is required',
        });
      }

      const s3Prefix = 'webpage-assets/';
      // Construct S3 file path using docId
      const key = `${s3Prefix}${docId}.json`;

      const command = new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: key,
      });

      try {
        const s3Response = await client.send(command);
        const content = await s3Response.Body?.transformToString();

        if (!content) {
          throw new Error('Failed to read file content');
        }

        // Try to parse JSON content
        const jsonContent = JSON.parse(content);

        response.status(200).json({
          success: true,
          data: jsonContent,
        });
      } catch (error) {
        if ((error as any).name === 'NoSuchKey') {
          // If file doesn't exist, return empty data
          response.status(200).json({
            success: true,
            data: null,
          });
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Error in GET /files/proxy-download:', error);
      response.status(500).json({
        success: false,
        errorMsg: (error as Error).message || 'Failed to fetch file content',
      });
    }
  }
);

module.exports = {
  className: 'files',
  routes: router,
};
