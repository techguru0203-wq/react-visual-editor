import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { uploads } from '@/lib/db/schema';
import type { UploadCompleteRequest } from '@/types';

const BUCKET_NAME = process.env.BUCKET_NAME;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

/**
 * Mark upload as complete and save to database
 * POST /api/upload/complete
 */
export async function POST(request: NextRequest) {
  try {
    const body: UploadCompleteRequest = await request.json();
    const { uploadId, s3Key, fileName, fileSize, fileType } = body;

    if (!uploadId || !s3Key || !fileName || !fileSize || !fileType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate S3 URL
    const s3Url = `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;

    // Save upload record to database
    const uploadRecord = await db.insert(uploads).values({
      id: uploadId,
      fileName,
      fileSize,
      fileType,
      s3Key,
      s3Url,
      status: 'completed',
    }).returning();

    return NextResponse.json({
      success: true,
      upload: uploadRecord[0],
    });
  } catch (error) {
    console.error('Error completing upload:', error);
    return NextResponse.json(
      { error: 'Failed to complete upload' },
      { status: 500 }
    );
  }
}