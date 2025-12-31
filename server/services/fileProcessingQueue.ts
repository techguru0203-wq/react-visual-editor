import Bull, { Queue, Job } from 'bull';
import { processFileToVectors } from './fileProcessingService';
import { downloadS3ObjectToBuffer } from './fileProcessingService';
import prisma from '../db/prisma';
import { KBFileStatus } from '@prisma/client';

interface FileProcessingJobData {
  fileId: string;
  knowledgeBaseId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  s3Key: string;
  bucketName: string;
}

/**
 * File Processing Queue using Bull
 * Handles asynchronous processing of uploaded files
 */
class FileProcessingQueueService {
  private queue: Queue<FileProcessingJobData>;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }

    // Initialize Bull queue with Redis connection
    this.queue = new Bull('file-processing', redisUrl, {
      defaultJobOptions: {
        attempts: 3, // Retry failed jobs up to 3 times
        backoff: {
          type: 'exponential',
          delay: 2000, // Start with 2s, then 4s, then 8s
        },
        removeOnComplete: true, // Clean up completed jobs
        removeOnFail: false, // Keep failed jobs for debugging
      },
      settings: {
        maxStalledCount: 2, // Max times a job can be recovered from stalled state
        stalledInterval: 30000, // Check for stalled jobs every 30s
      },
    });

    // Set up job event handlers
    this.setupEventHandlers();

    // Start processing jobs
    this.processJobs();

    console.log('📋 File Processing Queue initialized');
  }

  /**
   * Set up event handlers for job lifecycle
   */
  private setupEventHandlers(): void {
    this.queue.on('error', (error) => {
      console.error('❌ Queue error:', error);
    });

    this.queue.on('waiting', (jobId) => {
      console.log(`⏳ Job ${jobId} is waiting`);
    });

    this.queue.on('active', (job) => {
      console.log(`🔄 Job ${job.id} started processing: ${job.data.fileName}`);
    });

    this.queue.on('completed', (job, result) => {
      console.log(
        `✅ Job ${job.id} completed: ${job.data.fileName} (${result.chunkCount} chunks)`
      );
    });

    this.queue.on('failed', (job, err) => {
      console.error(
        `❌ Job ${job?.id} failed: ${job?.data.fileName}`,
        err.message
      );
    });

    this.queue.on('stalled', (jobId) => {
      console.warn(`⚠️ Job ${jobId} stalled`);
    });
  }

  /**
   * Process jobs from the queue
   */
  private processJobs(): void {
    // Process jobs one at a time to avoid overwhelming the system
    // Adjust concurrency based on your server capacity
    this.queue.process(1, async (job: Job<FileProcessingJobData>) => {
      const { fileId, knowledgeBaseId, fileName, fileType, s3Key, bucketName } =
        job.data;

      console.log(`\n🚀 Processing queued job for file: ${fileName}`);

      try {
        // Update progress to 10% - downloading
        await job.progress(10);

        // Download file from S3
        const buffer = await downloadS3ObjectToBuffer(bucketName, s3Key);

        // Update progress to 30% - extracting
        await job.progress(30);

        // Process file and upload to vector store
        const result = await processFileToVectors(
          fileId,
          knowledgeBaseId,
          buffer,
          fileName,
          fileType,
          job // Pass job for progress updates
        );

        // Update progress to 100%
        await job.progress(100);

        return result;
      } catch (error: any) {
        console.error(`Error processing job for file ${fileName}:`, error);
        throw error; // Let Bull handle retries
      }
    });
  }

  /**
   * Add a file processing job to the queue
   */
  async addJob(data: FileProcessingJobData): Promise<Job<FileProcessingJobData>> {
    const job = await this.queue.add(data, {
      priority: this.calculatePriority(data.fileSize),
      timeout: 600000, // 10 minutes timeout per job
    });

    console.log(
      `📥 Added job ${job.id} to queue: ${data.fileName} (${(data.fileSize / 1024 / 1024).toFixed(2)}MB)`
    );

    return job;
  }

  /**
   * Calculate job priority based on file size
   * Smaller files get higher priority (lower number = higher priority)
   */
  private calculatePriority(fileSize: number): number {
    const sizeMB = fileSize / (1024 * 1024);
    if (sizeMB < 1) return 1;
    if (sizeMB < 5) return 2;
    if (sizeMB < 20) return 3;
    return 4;
  }

  /**
   * Get job status by job ID
   */
  async getJobStatus(jobId: string): Promise<{
    status: string;
    progress: number;
    result?: any;
    error?: string;
  }> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      return { status: 'not_found', progress: 0 };
    }

    const state = await job.getState();
    const progress = job.progress() as number;
    const failedReason = job.failedReason;

    return {
      status: state,
      progress,
      result: job.returnvalue,
      error: failedReason,
    };
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * Clean up old jobs
   */
  async cleanOldJobs(): Promise<void> {
    // Remove completed jobs older than 1 hour
    await this.queue.clean(3600 * 1000, 'completed');
    // Remove failed jobs older than 24 hours
    await this.queue.clean(24 * 3600 * 1000, 'failed');
    console.log('🧹 Cleaned old jobs from queue');
  }

  /**
   * Get the Bull queue instance
   */
  getQueue(): Queue<FileProcessingJobData> {
    return this.queue;
  }

  /**
   * Close the queue connection
   */
  async close(): Promise<void> {
    await this.queue.close();
    console.log('📋 File Processing Queue closed');
  }
}

// Export singleton instance
export const fileProcessingQueue = new FileProcessingQueueService();

// Export type for use in other modules
export type { FileProcessingJobData };

