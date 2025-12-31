import { Router, Request, Response, NextFunction } from 'express';
import { CreateMultipartUploadCommand, UploadPartCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, S3_CONFIG } from '../config/constants';
import { UploadRepository } from '../repositories/upload';
import { AppError } from '../middleware/errorHandler';

const router = Router();
const uploadRepo = new UploadRepository();

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB

// Generate presigned URLs for multipart upload
const generatePresignedUrlHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { fileName, fileType, fileSize } = req.body;

    console.log('=== Presigned URL Request ===');
    console.log('Request body:', { fileName, fileType, fileSize });
    console.log('AWS Config:', {
      region: process.env.AWS_REGION,
      bucket: S3_CONFIG.BUCKET_NAME,
      hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
    });

    if (!fileName || !fileType || !fileSize) {
      throw new AppError('Missing required fields: fileName, fileType, fileSize', 400);
    }

    // Validate file size based on subscription tier
    const tier = process.env.SUBSCRIPTION_TIER || 'FREE';
    const tierLimits: Record<string, number> = {
      FREE: 10 * 1024 * 1024,        // 10MB
      STARTER: 50 * 1024 * 1024, // 50MB
      PRO: 100 * 1024 * 1024,       // 100MB
      BUSINESS: 500 * 1024 * 1024,      // 500MB
      ENTERPRISE: 1000 * 1024 * 1024,           // 1GB
    };

    const maxSize = tierLimits[tier.toUpperCase()] || tierLimits.FREE;
    
    if (fileSize > maxSize) {
      const limitText = maxSize === Infinity ? 'unlimited' : `${Math.round(maxSize / (1024 * 1024))}MB`;
      throw new AppError(`File size exceeds ${limitText} limit for ${tier} tier`, 400);
    }

    const numParts = Math.ceil(fileSize / CHUNK_SIZE);
    const timestamp = Date.now();
    const key = `${S3_CONFIG.FOLDER_PREFIX}/${process.env.FOLDER_NAME}/${timestamp}-${fileName}`;

    console.log('Creating multipart upload:', { key, numParts });

    const createCommand = new CreateMultipartUploadCommand({
      Bucket: S3_CONFIG.BUCKET_NAME,
      Key: key,
      ContentType: fileType,
    });

    const multipartResponse = await s3Client.send(createCommand);
    console.log('Multipart upload created:', multipartResponse);

    const { UploadId } = multipartResponse;

    if (!UploadId) {
      throw new AppError('Failed to create multipart upload - no UploadId returned', 500);
    }

    console.log('Generating presigned URLs for', numParts, 'parts');
    const presignedUrls: string[] = [];
    
    for (let i = 1; i <= numParts; i++) {
      const uploadPartCommand = new UploadPartCommand({
        Bucket: S3_CONFIG.BUCKET_NAME,
        Key: key,
        UploadId,
        PartNumber: i,
      });

      const presignedUrl = await getSignedUrl(s3Client, uploadPartCommand, {
        expiresIn: S3_CONFIG.PRESIGNED_URL_EXPIRY,
      });

      presignedUrls.push(presignedUrl);
    }

    console.log('Generated', presignedUrls.length, 'presigned URLs');

    const upload = await uploadRepo.create({
      fileName,
      fileSize,
      fileType,
      s3Key: key,
      s3Url: `https://${S3_CONFIG.BUCKET_NAME}.s3.${S3_CONFIG.REGION}.amazonaws.com/${key}`,
      uploadId: UploadId,
      status: 'pending',
    });

    console.log('Database record created:', upload.id);

    res.json({
      success: true,
      data: {
        uploadId: UploadId,
        key,
        urls: presignedUrls,
        dbRecordId: upload.id,
      },
    });
  } catch (error) {
    console.error('=== Presigned URL Error ===');
    console.error('Error details:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    next(error);
  }
};

// Notify backend of completed upload
const notifyUploadComplete = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { uploadId, fileName, fileSize, fileType, s3Key } = req.body;

    if (!uploadId || !fileName || !fileSize || !fileType || !s3Key) {
      throw new AppError('Missing required fields', 400);
    }

    // Generate public S3 URL
    const s3Url = `https://${S3_CONFIG.BUCKET_NAME}.s3.${S3_CONFIG.REGION}.amazonaws.com/${s3Key}`;

    const upload = await uploadRepo.create({
      fileName,
      fileSize,
      fileType,
      s3Key,
      s3Url,
      status: 'completed',
    });

    res.json({
      success: true,
      data: upload,
    });
  } catch (error) {
    next(error);
  }
};

// Routes
router.post('/presigned-url', generatePresignedUrlHandler);
router.post('/complete', notifyUploadComplete);

export default router;