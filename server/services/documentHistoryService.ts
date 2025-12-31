import { Prisma } from '@prisma/client';
import prisma from '../db/prisma';

export interface CreateDocumentHistoryInput {
  documentId: string;
  versionNumber: number;
  description: string;
  fileUrl?: string;
  currentVersionUrl?: string;
  content?: string;
  chosenDocumentIds?: string;
  rating?: Prisma.JsonValue;
  creatorUserId: string;
  creatorEmail: string;
}

export interface DocumentHistoryOutput {
  id: string;
  documentId: string;
  versionNumber: number;
  description: string;
  fileUrl?: string | null;
  currentVersionUrl?: string | null;
  content?: string | null;
  chosenDocumentIds?: string | null;
  rating?: Prisma.JsonValue;
  creatorUserId: string;
  creatorEmail: string;
  createdAt: Date;
}

/**
 * Create a new document history record
 */
export async function createDocumentHistory(
  input: CreateDocumentHistoryInput
): Promise<DocumentHistoryOutput> {
  const history = await prisma.documentHistory.create({
    data: {
      documentId: input.documentId,
      versionNumber: input.versionNumber,
      description: input.description,
      fileUrl: input.fileUrl,
      currentVersionUrl: input.currentVersionUrl,
      content: input.content,
      chosenDocumentIds: input.chosenDocumentIds,
      rating: input.rating,
      creatorUserId: input.creatorUserId,
      creatorEmail: input.creatorEmail,
    },
  });

  return history;
}

/**
 * Get document history records by document ID
 */
export async function getDocumentHistories(
  documentId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<DocumentHistoryOutput[]> {
  const histories = await prisma.documentHistory.findMany({
    where: { documentId },
    orderBy: { versionNumber: 'desc' },
    take: options?.limit,
    skip: options?.offset,
  });

  return histories;
}

/**
 * Get a specific version of document history
 */
export async function getDocumentHistoryByVersion(
  documentId: string,
  versionNumber: number
): Promise<DocumentHistoryOutput | null> {
  const history = await prisma.documentHistory.findUnique({
    where: {
      documentId_versionNumber: {
        documentId,
        versionNumber,
      },
    },
  });

  return history;
}

/**
 * Get the latest version number for a document
 */
export async function getLatestVersionNumber(
  documentId: string
): Promise<number> {
  const latestHistory = await prisma.documentHistory.findFirst({
    where: { documentId },
    orderBy: { versionNumber: 'desc' },
    select: { versionNumber: true },
  });

  return latestHistory?.versionNumber || 0;
}

/**
 * Update rating for a document history
 */
export async function updateDocumentHistoryRating(
  documentId: string,
  versionNumber: number,
  rating: Prisma.JsonValue
): Promise<DocumentHistoryOutput> {
  const history = await prisma.documentHistory.update({
    where: {
      documentId_versionNumber: {
        documentId,
        versionNumber,
      },
    },
    data: {
      rating,
    },
  });

  return history;
}

/**
 * Delete old document history records, keeping only the most recent N versions
 */
export async function pruneOldHistories(
  documentId: string,
  keepCount: number = 20
): Promise<number> {
  // Get all version numbers for this document
  const histories = await prisma.documentHistory.findMany({
    where: { documentId },
    orderBy: { versionNumber: 'desc' },
    select: { versionNumber: true },
  });

  if (histories.length <= keepCount) {
    return 0;
  }

  // Get version numbers to delete (all except the most recent keepCount)
  const versionsToDelete = histories
    .slice(keepCount)
    .map((h) => h.versionNumber);

  const result = await prisma.documentHistory.deleteMany({
    where: {
      documentId,
      versionNumber: {
        in: versionsToDelete,
      },
    },
  });

  return result.count;
}

/**
 * Get document history count for a document
 */
export async function getDocumentHistoryCount(
  documentId: string
): Promise<number> {
  return await prisma.documentHistory.count({
    where: { documentId },
  });
}

