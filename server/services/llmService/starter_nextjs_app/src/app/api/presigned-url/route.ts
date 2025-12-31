import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { PresignedUrlResponse } from '@/types';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.BUCKET_NAME;
const FOLDER_NAME = process.env.FOLDER_NAME || 'uploads';

/**
 * Generate presigned URL for S3 upload
 * POST /api/upload/presigned-url
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileName, fileType, fileSize } = body;

    if (!fileName || !fileType || !fileSize) {
      return NextResponse.json(
        { error: 'Missing required fields: fileName, fileType, fileSize' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: `File size exceeds ${limitText} limit for ${tier} tier` },
        { status: 400 }
      );
    }

    // Generate unique upload ID and S3 key
    const uploadId = crypto.randomUUID();
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const s3Key = `user-content/${FOLDER_NAME}/${timestamp}-${sanitizedFileName}`;

    // Create presigned URL
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      ContentType: fileType,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600, // 1 hour
    });

    const response: PresignedUrlResponse = {
      uploadId,
      presignedUrl,
      s3Key,
      expiresIn: 3600,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate presigned URL' },
      { status: 500 }
    );
  }
}