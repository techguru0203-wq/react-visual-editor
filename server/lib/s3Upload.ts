import {
  PutObjectCommand,
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import path from 'path';
import fs from 'fs';

// Initialize S3 client (path-style to avoid TLS with dotted bucket names)
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

interface UploadToS3Params {
  fileBuffer: Buffer;
  originalName: string;
  userId: string;
  s3BucketName?: string;
}

export async function uploadToS3(params: UploadToS3Params): Promise<string> {
  const { fileBuffer, originalName, userId, s3BucketName = 'images' } = params;

  const fileExt = path.extname(originalName);
  const key = `${s3BucketName}/${userId}/${
    originalName.split('.')[0]
  }_${Date.now()}${fileExt}`;

  // BUCKET_NAME = 'omniflow.team' for dev env, and 'omniflow-team' for prod env
  const BUCKET_NAME = process.env.BUCKET_NAME;
  if (!BUCKET_NAME) {
    throw new Error('BUCKET_NAME environment variable is not set');
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
  });

  await s3Client.send(command);
  const region = process.env.AWS_REGION;
  if (s3BucketName === 'images') {
    return `https://s3.${region}.amazonaws.com/${BUCKET_NAME}/${key}`;
  }
  return `https://s3.${region}.amazonaws.com/${BUCKET_NAME}/${key}`;
}

// Migration-specific S3 functions
export async function downloadMigrationsFromS3(
  docId: string,
  tempMigrationsDir: string
): Promise<string[]> {
  try {
    const BUCKET_NAME = process.env.BUCKET_NAME;
    if (!BUCKET_NAME) {
      throw new Error('BUCKET_NAME environment variable is not set');
    }

    const prefix = `migrations/${docId}/`;
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
    });

    const response = await s3Client.send(command);
    const migrationFiles: string[] = [];

    if (response.Contents) {
      for (const object of response.Contents) {
        if (object.Key && object.Key.endsWith('.sql')) {
          const fileName = path.basename(object.Key);
          const localPath = path.join(tempMigrationsDir, fileName);

          // Download the migration file
          const getCommand = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: object.Key,
          });

          const fileResponse = await s3Client.send(getCommand);
          const fileContent = await fileResponse.Body?.transformToString();

          if (fileContent) {
            fs.writeFileSync(localPath, fileContent);
            migrationFiles.push(fileName);
            console.log(`📥 Downloaded migration from S3: ${fileName}`);
          }
        }
      }
    }

    return migrationFiles;
  } catch (error) {
    console.log(
      '📁 No existing migrations found in S3 or error downloading:',
      error
    );
    return [];
  }
}

export async function uploadMigrationsToS3(
  docId: string,
  migrationFiles: string[],
  tempMigrationsDir: string
): Promise<void> {
  try {
    const BUCKET_NAME = process.env.BUCKET_NAME;
    if (!BUCKET_NAME) {
      throw new Error('BUCKET_NAME environment variable is not set');
    }

    for (const fileName of migrationFiles) {
      const localPath = path.join(tempMigrationsDir, fileName);
      const s3Key = `migrations/${docId}/${fileName}`;

      const fileContent = fs.readFileSync(localPath);

      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: fileContent,
        ContentType: 'text/plain',
      });

      await s3Client.send(command);
      console.log(`📤 Uploaded migration to S3: ${fileName}`);
    }
  } catch (error) {
    console.error('❌ Error uploading migrations to S3:', error);
    throw error;
  }
}

export async function deleteMigrationsFromS3(docId: string): Promise<void> {
  try {
    const BUCKET_NAME = process.env.BUCKET_NAME;
    if (!BUCKET_NAME) {
      throw new Error('BUCKET_NAME environment variable is not set');
    }

    const prefix = `migrations/${docId}/`;
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
    });

    const response = await s3Client.send(command);
    const deletedFiles: string[] = [];

    if (response.Contents) {
      for (const object of response.Contents) {
        if (object.Key && object.Key.endsWith('.sql')) {
          const deleteCommand = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: object.Key,
          });

          await s3Client.send(deleteCommand);
          deletedFiles.push(object.Key);
          console.log(`🗑️ Deleted migration from S3: ${object.Key}`);
        }
      }
    }

    if (deletedFiles.length === 0) {
      console.log(`📁 No migration files found in S3 for docId: ${docId}`);
    } else {
      console.log(
        `🗑️ Successfully deleted ${deletedFiles.length} migration files from S3 for docId: ${docId}`
      );
    }
  } catch (error) {
    console.error('❌ Error deleting migrations from S3:', error);
    throw error;
  }
}

/**
 * Generate presigned upload URL for knowledge base files
 */
export async function generatePresignedUploadUrl(
  s3Key: string,
  fileType: string,
  bucketName?: string
): Promise<string> {
  const bucket = bucketName || process.env.KNOWLEDGE_BASE_BUCKET_NAME || process.env.BUCKET_NAME;
  if (!bucket) {
    throw new Error('Bucket name not configured');
  }

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    ContentType: fileType,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  return url;
}

/**
 * Generate presigned download URL for knowledge base files
 */
export async function generatePresignedDownloadUrl(
  s3Key: string,
  bucketName?: string
): Promise<string> {
  const bucket = bucketName || process.env.KNOWLEDGE_BASE_BUCKET_NAME || process.env.BUCKET_NAME;
  if (!bucket) {
    throw new Error('Bucket name not configured');
  }

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: s3Key,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  return url;
}

/**
 * Delete a file from S3
 */
export async function deleteFileFromS3(
  s3Key: string,
  bucketName?: string
): Promise<void> {
  const bucket = bucketName || process.env.KNOWLEDGE_BASE_BUCKET_NAME || process.env.BUCKET_NAME;
  if (!bucket) {
    throw new Error('Bucket name not configured');
  }

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: s3Key,
  });

  await s3Client.send(command);
  console.log(`🗑️ Deleted file from S3: ${s3Key}`);
}

/**
 * Upload knowledge base file to S3
 */
export async function uploadKnowledgeBaseFileToS3(params: {
  fileBuffer: Buffer;
  originalName: string;
  userId: string;
  knowledgeBaseId: string;
}): Promise<{ s3Key: string; s3Url: string }> {
  const { fileBuffer, originalName, userId, knowledgeBaseId } = params;

  const fileExt = path.extname(originalName);
  const s3Key = `knowledge-base/${knowledgeBaseId}/${userId}/${
    originalName.split('.')[0]
  }_${Date.now()}${fileExt}`;

  const bucketName = process.env.KNOWLEDGE_BASE_BUCKET_NAME || process.env.BUCKET_NAME;
  if (!bucketName) {
    throw new Error('Bucket name not configured');
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: s3Key,
    Body: fileBuffer,
  });

  await s3Client.send(command);
  
  const region = process.env.AWS_REGION;
  const s3Url = `https://s3.${region}.amazonaws.com/${bucketName}/${s3Key}`;
  
  return { s3Key, s3Url };
}

export { s3Client };
