import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import * as path from 'path';
import prisma from '../db/prisma';
import { KBFileStatus } from '@prisma/client';
import { OpenAIEmbeddings } from '@langchain/openai';
import { QdrantVectorStore } from '@langchain/qdrant';
import { Document } from '@langchain/core/documents';
import {
  createCollection,
  getCollectionInfo,
  deleteVectors,
} from './qdrantService';
import { uploadKnowledgeBaseFileToS3, s3Client } from '../lib/s3Upload';
import { v4 as uuidv4 } from 'uuid';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { Job } from 'bull';
import { fileProcessingQueue } from './fileProcessingQueue';
import {
  TextractClient,
  DetectDocumentTextCommand,
} from '@aws-sdk/client-textract';

interface FileUploadInput {
  knowledgeBaseId: string;
  file: Express.Multer.File;
  userId: string;
}

interface TextChunk {
  text: string;
  metadata: Record<string, any>;
}

// Initialize Textract client
const textractClient = new TextractClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

/**
 * Extract text from image using AWS Textract
 */
async function extractTextFromImage(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  try {
    const command = new DetectDocumentTextCommand({
      Document: {
        Bytes: buffer,
      },
    });

    const response = await textractClient.send(command);

    if (!response.Blocks || response.Blocks.length === 0) {
      console.warn(`No text detected in image: ${fileName}`);
      return `[Image file: ${fileName} - No text detected]`;
    }

    // Extract text from LINE blocks (preserves line structure)
    const textLines: string[] = [];
    for (const block of response.Blocks) {
      if (block.BlockType === 'LINE' && block.Text) {
        textLines.push(block.Text);
      }
    }

    const extractedText = textLines.join('\n');
    return extractedText;
  } catch (error: any) {
    console.error(`Error extracting text from image ${fileName}:`, error);
    // Fallback if Textract fails
    return `[Image file: ${fileName} - OCR failed: ${error.message}]`;
  }
}

/**
 * Extract text from uploaded file based on file type
 * For structured data (Excel/CSV), returns a special marker to indicate row-based processing
 */
async function extractTextFromFile(
  buffer: Buffer,
  fileType: string,
  fileName: string
): Promise<string | { type: 'structured'; data: TextChunk[] }> {
  try {
    const extension = path.extname(fileName).toLowerCase();

    // PDF files
    if (extension === '.pdf') {
      const data = await pdf(buffer);
      return data.text;
    }

    // DOCX files
    if (extension === '.docx') {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }

    // Excel files (.xlsx, .xls) - process as structured data
    if (extension === '.xlsx' || extension === '.xls') {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const chunks: TextChunk[] = [];

      // Process each worksheet
      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];

        // Convert to array of objects (each row as an object with column headers as keys)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        // Convert each row to a structured text chunk
        jsonData.forEach((row: any, index: number) => {
          // Format: "column1: value1, column2: value2, ..."
          const rowText = Object.entries(row)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');

          if (rowText.trim()) {
            chunks.push({
              text: rowText,
              metadata: {
                sheetName,
                rowIndex: index + 2, // +2 because Excel is 1-indexed and has header row
              },
            });
          }
        });
      });

      return { type: 'structured', data: chunks };
    }

    // CSV files - process as structured data
    if (extension === '.csv') {
      const csvText = buffer.toString('utf-8');
      try {
        const workbook = XLSX.read(csvText, { type: 'string' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        const chunks: TextChunk[] = jsonData
          .map((row: any, index: number) => {
            const rowText = Object.entries(row)
              .map(([key, value]) => `${key}: ${value}`)
              .join(', ');

            return {
              text: rowText,
              metadata: {
                rowIndex: index + 2, // +2 for same reason as Excel
              },
            };
          })
          .filter((chunk) => chunk.text.trim());

        return { type: 'structured', data: chunks };
      } catch {
        // If parsing fails, fallback to plain text processing
        return csvText;
      }
    }

    // Text files and code files
    const textExtensions = [
      '.txt',
      '.md',
      '.js',
      '.ts',
      '.tsx',
      '.jsx',
      '.py',
      '.java',
      '.go',
      '.rs',
      '.cpp',
      '.c',
      '.h',
      '.css',
      '.scss',
      '.html',
      '.json',
      '.xml',
      '.yaml',
      '.yml',
      '.sh',
      '.bash',
    ];

    if (textExtensions.includes(extension)) {
      return buffer.toString('utf-8');
    }

    // Image files - use AWS Textract for OCR
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp'];
    if (imageExtensions.includes(extension)) {
      return await extractTextFromImage(buffer, fileName);
    }

    throw new Error(`Unsupported file type: ${extension}`);
  } catch (error) {
    console.error('Error extracting text from file:', error);
    throw error;
  }
}

/**
 * Split text into chunks with overlap
 * Larger chunks = better context for embeddings = higher search quality
 */
function chunkText(
  text: string,
  chunkSize: number = 1500,
  overlap: number = 300
): string[] {
  const chunks: string[] = [];
  let startIndex = 0;

  // Normalize whitespace but preserve paragraph breaks
  const cleanedText = text
    .replace(/\r\n/g, '\n') // normalize line endings
    .replace(/[ \t]+/g, ' ') // collapse spaces/tabs
    .replace(/\n{3,}/g, '\n\n') // max 2 consecutive newlines
    .trim();

  if (cleanedText.length === 0) {
    return chunks;
  }

  while (startIndex < cleanedText.length) {
    const endIndex = Math.min(startIndex + chunkSize, cleanedText.length);
    let chunk = cleanedText.substring(startIndex, endIndex);

    // Try to end at a natural boundary
    if (endIndex < cleanedText.length) {
      // Look for paragraph break, sentence, or other natural breaks
      const lastDoubleNewline = chunk.lastIndexOf('\n\n');
      const lastPeriod = chunk.lastIndexOf('. ');
      const lastNewline = chunk.lastIndexOf('\n');
      const lastBreak = Math.max(lastDoubleNewline, lastPeriod, lastNewline);

      // Use natural break if it's not too far back (at least 50% into chunk)
      if (lastBreak > chunkSize * 0.5) {
        chunk = chunk.substring(0, lastBreak + 1).trim();
        startIndex += lastBreak + 1;
      } else {
        // No good break point, use overlap
        startIndex += chunkSize - overlap;
      }
    } else {
      startIndex = cleanedText.length;
    }

    if (chunk.trim().length > 0) {
      chunks.push(chunk.trim());
    }
  }

  return chunks;
}

/**
 * Calculate optimal chunk size and batch size based on file size
 * Larger files use bigger chunks to reduce total count and processing time
 */
export function calculateProcessingParams(fileSizeBytes: number): {
  chunkSize: number;
  overlap: number;
  batchSize: number;
} {
  const sizeMB = fileSizeBytes / (1024 * 1024);

  // For very small files (< 1MB)
  if (sizeMB < 1) {
    return {
      chunkSize: 1500,
      overlap: 300,
      batchSize: 100, // Can handle larger batches for small files
    };
  }

  // For small files (1-5MB)
  if (sizeMB < 5) {
    return {
      chunkSize: 2000,
      overlap: 350,
      batchSize: 60,
    };
  }

  // For medium files (5-20MB)
  if (sizeMB < 20) {
    return {
      chunkSize: 3000,
      overlap: 400,
      batchSize: 40,
    };
  }

  // For large files (20-50MB)
  return {
    chunkSize: 4000,
    overlap: 500,
    batchSize: 30,
  };
}

/**
 * Download an S3 object into a Buffer
 */
export async function downloadS3ObjectToBuffer(
  bucket: string,
  key: string
): Promise<Buffer> {
  const resp = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
  if (!resp.Body) {
    throw new Error('S3 object has no body');
  }
  const bodyAny = resp.Body as any;
  if (typeof bodyAny.transformToByteArray === 'function') {
    const bytes = await bodyAny.transformToByteArray();
    return Buffer.from(bytes);
  }
  // Fallback for stream bodies
  const stream = resp.Body as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  return await new Promise<Buffer>((resolve, reject) => {
    stream.on('data', (chunk) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    );
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

/**
 * Create embeddings instance based on configured provider
 */
function createEmbeddingsInstance(): OpenAIEmbeddings {
  return new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: process.env.OPENAI_EMBEDDINGS_MODEL || 'text-embedding-3-small',
    batchSize: Number(process.env.EMBEDDINGS_BATCH_SIZE || '100'),
    timeout: Number(process.env.OPENAI_EMBEDDINGS_TIMEOUT_MS || '120000'),
  });
}

/**
 * Process file and store vectors in Qdrant using langchain
 */
export async function processFileToVectors(
  fileId: string,
  knowledgeBaseId: string,
  buffer: Buffer,
  fileName: string,
  fileType: string,
  job?: Job // Optional Bull job for progress tracking
): Promise<{ chunkCount: number; qdrantIds: string[] }> {
  const startTime = Date.now();
  const fileSize = buffer.length;

  console.log(
    `Processing file: ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)}MB)`
  );

  // Calculate optimal processing parameters based on file size
  const { chunkSize, overlap, batchSize } = calculateProcessingParams(fileSize);

  try {
    // Update file status to PROCESSING
    await prisma.knowledgeBaseFile.update({
      where: { id: fileId },
      data: { processingStatus: KBFileStatus.PROCESSING },
    });
    if (job) await job.progress(35);

    // Extract text from file
    const extractResult = await extractTextFromFile(buffer, fileType, fileName);

    let textChunks: string[];
    let chunkMetadata: Record<string, any>[] = [];
    let isStructuredData = false;

    // Handle structured data (Excel/CSV) differently
    if (
      typeof extractResult === 'object' &&
      extractResult.type === 'structured'
    ) {
      isStructuredData = true;
      textChunks = extractResult.data.map((chunk) => chunk.text);
      chunkMetadata = extractResult.data.map((chunk) => chunk.metadata);

      if (textChunks.length === 0) {
        throw new Error('No data rows found in structured file');
      }
      if (job) await job.progress(45);
    } else {
      // Handle unstructured text (PDF, DOCX, TXT, etc.)
      const text = extractResult as string;

      if (!text || text.trim().length === 0) {
        throw new Error('No text content extracted from file');
      }
      if (job) await job.progress(45);

      // Split into chunks using dynamic parameters
      textChunks = chunkText(text, chunkSize, overlap);

      if (textChunks.length === 0) {
        throw new Error('No chunks created from text');
      }
      if (job) await job.progress(55);
    }

    // Prepare collection name and check if it exists
    const collectionName = `kb_${knowledgeBaseId}`;

    // Create embeddings instance
    const embeddings = createEmbeddingsInstance();

    // Ensure collection exists
    try {
      await getCollectionInfo(collectionName);
    } catch (error) {
      // Default vector size for text-embedding-3-small
      await createCollection(collectionName, 1536);
    }

    // Generate unique IDs for documents
    const qdrantIds: string[] = [];
    const documents: Document[] = textChunks.map((chunk, index) => {
      const pointId = uuidv4();
      qdrantIds.push(pointId);

      // Merge base metadata with structured data metadata (if available)
      const metadata: Record<string, any> = {
        fileId,
        fileName,
        chunkIndex: index,
        knowledgeBaseId,
        isStructuredData,
      };

      // Add structured data metadata (sheetName, rowIndex) if available
      if (isStructuredData && chunkMetadata[index]) {
        Object.assign(metadata, chunkMetadata[index]);
      }

      return new Document({
        pageContent: chunk,
        metadata,
        id: pointId,
      });
    });

    // Store documents using QdrantVectorStore with batch uploading
    const totalBatches = Math.ceil(documents.length / batchSize);
    if (job) await job.progress(65);

    // Create or get vector store instance
    const vectorStore = await QdrantVectorStore.fromExistingCollection(
      embeddings,
      {
        url: process.env.QDRANT_DATABASE_URL,
        apiKey: process.env.QDRANT_API_KEY,
        collectionName,
      }
    );

    // Upload documents in batches with progress tracking
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;

      await vectorStore.addDocuments(batch);

      // Update progress: 65-95% for batch uploads
      if (job) {
        const progress = 65 + Math.floor((batchNum / totalBatches) * 30);
        await job.progress(progress);
      }
    }

    // Update file status to COMPLETED
    await prisma.knowledgeBaseFile.update({
      where: { id: fileId },
      data: {
        processingStatus: KBFileStatus.COMPLETED,
        chunkCount: textChunks.length,
        qdrantIds,
        errorMessage: null,
      },
    });

    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(
      `File processed: ${fileName}, ${textChunks.length} chunks, ${processingTime}s`
    );

    return {
      chunkCount: textChunks.length,
      qdrantIds,
    };
  } catch (error: any) {
    console.error(`File processing failed: ${fileName}`, error);

    // Update file status to FAILED
    try {
      await prisma.knowledgeBaseFile.update({
        where: { id: fileId },
        data: {
          processingStatus: KBFileStatus.FAILED,
          errorMessage: error.message || 'Unknown error',
        },
      });
    } catch (dbError) {
      console.error(`Failed to update file status:`, dbError);
    }

    throw error;
  }
}

/**
 * Upload and process a file for a knowledge base
 * Now uses Bull queue for async processing to avoid Heroku 30s timeout
 */
export async function uploadFile(input: FileUploadInput): Promise<any> {
  const { knowledgeBaseId, file, userId } = input;

  try {
    // Validate file size (max 50MB)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(
        `File size exceeds maximum allowed size of ${
          MAX_FILE_SIZE / 1024 / 1024
        }MB`
      );
    }

    // Upload file to S3
    const { s3Key, s3Url } = await uploadKnowledgeBaseFileToS3({
      fileBuffer: file.buffer,
      originalName: file.originalname,
      userId,
      knowledgeBaseId,
    });

    // Create file record in database
    const fileRecord = await prisma.knowledgeBaseFile.create({
      data: {
        knowledgeBaseId,
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        s3Key,
        s3Url,
        uploadedBy: userId,
        processingStatus: KBFileStatus.PENDING,
      },
    });

    const bucketName =
      process.env.KNOWLEDGE_BASE_BUCKET_NAME || process.env.BUCKET_NAME;

    if (!bucketName) {
      throw new Error('Bucket name not configured');
    }

    const job = await fileProcessingQueue.addJob({
      fileId: fileRecord.id,
      knowledgeBaseId,
      fileName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
      s3Key,
      bucketName,
    });

    // Return file record with job ID for tracking
    return {
      ...fileRecord,
      jobId: job.id,
    };
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
}

/**
 * Reprocess a file (regenerate embeddings)
 * Now uses Bull queue for async processing
 */
export async function reprocessFile(
  fileId: string
): Promise<{ jobId: string }> {
  try {
    const file = await prisma.knowledgeBaseFile.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new Error('File not found');
    }

    const bucketName =
      process.env.KNOWLEDGE_BASE_BUCKET_NAME || process.env.BUCKET_NAME;
    if (!bucketName) {
      throw new Error('Bucket name not configured');
    }

    // Delete existing vectors before reprocessing
    const existingIds = file.qdrantIds || [];
    if (existingIds.length > 0) {
      const collectionName = `kb_${file.knowledgeBaseId}`;
      await deleteVectors(collectionName, existingIds);
    }

    // Update status to PENDING (will be picked up by queue processor)
    await prisma.knowledgeBaseFile.update({
      where: { id: fileId },
      data: {
        processingStatus: KBFileStatus.PENDING,
        errorMessage: null,
        qdrantIds: [], // Clear old IDs
      },
    });

    const job = await fileProcessingQueue.addJob({
      fileId: file.id,
      knowledgeBaseId: file.knowledgeBaseId,
      fileName: file.fileName,
      fileType: file.fileType,
      fileSize: file.fileSize,
      s3Key: file.s3Key,
      bucketName,
    });

    return { jobId: job.id.toString() };
  } catch (error) {
    console.error('Error reprocessing file:', error);
    throw error;
  }
}
