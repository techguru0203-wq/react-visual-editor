import prisma from '../db/prisma';
import {
  KnowledgeBase,
  KnowledgeBaseFile,
  KnowledgeBaseProjectLink,
  RecordStatus,
  Prisma,
} from '@prisma/client';
import {
  deleteCollection,
  deleteVectors,
  deleteVectorsByFilter,
} from './qdrantService';
import { deleteFileFromS3 } from '../lib/s3Upload';

interface CreateKnowledgeBaseInput {
  name: string;
  description?: string;
  organizationId: string;
  creatorUserId: string;
  projectIds?: string[];
}

interface UpdateKnowledgeBaseInput {
  name?: string;
  description?: string;
  status?: RecordStatus;
  projectIds?: string[];
}

/**
 * Create a new knowledge base
 */
export async function createKnowledgeBase(
  input: CreateKnowledgeBaseInput
): Promise<KnowledgeBase> {
  const { name, description, organizationId, creatorUserId, projectIds } =
    input;

  try {
    const knowledgeBase = await prisma.knowledgeBase.create({
      data: {
        name,
        description,
        organizationId,
        creatorUserId,
        status: RecordStatus.ACTIVE,
        projectLinks: projectIds
          ? {
              create: projectIds.map((projectId) => ({
                projectId,
              })),
            }
          : undefined,
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        projectLinks: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        files: true,
      },
    });

    console.log(`✅ Created knowledge base: ${knowledgeBase.id}`);
    return knowledgeBase;
  } catch (error) {
    console.error('Error creating knowledge base:', error);
    throw error;
  }
}

/**
 * Get knowledge bases list for an organization
 */
export async function getKnowledgeBaseList(
  organizationId: string,
  status?: RecordStatus
): Promise<KnowledgeBase[]> {
  try {
    const knowledgeBases = await prisma.knowledgeBase.findMany({
      where: {
        organizationId,
        status: status || RecordStatus.ACTIVE,
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        _count: {
          select: {
            files: true,
          },
        },
        projectLinks: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return knowledgeBases;
  } catch (error) {
    console.error('Error fetching knowledge base list:', error);
    throw error;
  }
}

/**
 * Get a single knowledge base by ID
 */
export async function getKnowledgeBaseById(
  id: string
): Promise<KnowledgeBase | null> {
  try {
    const knowledgeBase = await prisma.knowledgeBase.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        _count: {
          select: {
            files: true,
          },
        },
        files: {
          include: {
            uploader: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        projectLinks: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return knowledgeBase;
  } catch (error) {
    console.error('Error fetching knowledge base:', error);
    throw error;
  }
}

/**
 * Update a knowledge base
 */
export async function updateKnowledgeBase(
  id: string,
  input: UpdateKnowledgeBaseInput
): Promise<KnowledgeBase> {
  const { name, description, status, projectIds } = input;

  try {
    // If projectIds are provided, update project links
    if (projectIds !== undefined) {
      // Delete existing links
      await prisma.knowledgeBaseProjectLink.deleteMany({
        where: { knowledgeBaseId: id },
      });

      // Create new links
      if (projectIds.length > 0) {
        await prisma.knowledgeBaseProjectLink.createMany({
          data: projectIds.map((projectId) => ({
            knowledgeBaseId: id,
            projectId,
          })),
        });
      }
    }

    // Update the knowledge base
    const knowledgeBase = await prisma.knowledgeBase.update({
      where: { id },
      data: {
        name,
        description,
        status,
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        projectLinks: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        files: true,
      },
    });

    console.log(`✅ Updated knowledge base: ${id}`);
    return knowledgeBase;
  } catch (error) {
    console.error('Error updating knowledge base:', error);
    throw error;
  }
}

/**
 * Delete a knowledge base (soft delete by setting status to INACTIVE)
 */
export async function deleteKnowledgeBase(id: string): Promise<void> {
  try {
    // Get all files in this knowledge base
    const files = await prisma.knowledgeBaseFile.findMany({
      where: { knowledgeBaseId: id },
    });

    // Delete all vectors from Qdrant
    const collectionName = `kb_${id}`;
    try {
      await deleteCollection(collectionName);
    } catch (error) {
      console.warn(
        `Warning: Could not delete Qdrant collection ${collectionName}:`,
        error
      );
    }

    // Soft delete the knowledge base
    await prisma.knowledgeBase.update({
      where: { id },
      data: {
        status: RecordStatus.INACTIVE,
      },
    });

    console.log(`✅ Deleted knowledge base: ${id}`);
  } catch (error) {
    console.error('Error deleting knowledge base:', error);
    throw error;
  }
}

/**
 * Get files for a knowledge base
 */
export async function getKnowledgeBaseFiles(
  knowledgeBaseId: string
): Promise<KnowledgeBaseFile[]> {
  try {
    const files = await prisma.knowledgeBaseFile.findMany({
      where: { knowledgeBaseId },
      select: {
        id: true,
        knowledgeBaseId: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        s3Key: true,
        s3Url: true,
        processingStatus: true,
        chunkCount: true,
        errorMessage: true,
        uploadedBy: true,
        meta: true,
        createdAt: true,
        updatedAt: true,
        uploader: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return files as any;
  } catch (error) {
    console.error('Error fetching knowledge base files:', error);
    throw error;
  }
}

/**
 * Delete a file from a knowledge base
 */
export async function deleteKnowledgeBaseFile(fileId: string): Promise<void> {
  console.log(`🗑️  Deleting file: ${fileId}`);

  try {
    const file = await prisma.knowledgeBaseFile.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new Error('File not found');
    }

    const errors: string[] = [];
    const collectionName = `kb_${file.knowledgeBaseId}`;

    // Delete vectors from Qdrant
    if (file.qdrantIds && file.qdrantIds.length > 0) {
      try {
        await deleteVectors(collectionName, file.qdrantIds);
      } catch (error: any) {
        errors.push(`Qdrant: ${error.message}`);
      }
    } else {
      try {
        await deleteVectorsByFilter(collectionName, { fileId: file.id });
      } catch (error: any) {
        errors.push(`Qdrant filter: ${error.message}`);
      }
    }

    // Delete file from S3
    if (file.s3Key) {
      try {
        await deleteFileFromS3(file.s3Key);
      } catch (error: any) {
        errors.push(`S3: ${error.message}`);
      }
    }

    // Delete file record from database
    await prisma.knowledgeBaseFile.delete({
      where: { id: fileId },
    });

    if (errors.length > 0) {
      console.warn(
        `⚠️  File ${file.fileName} deleted with warnings: ${errors.join('; ')}`
      );
    } else {
      console.log(`✅ File ${file.fileName} deleted successfully`);
    }
  } catch (error) {
    console.error(`❌ Error deleting file:`, error);
    throw error;
  }
}

/**
 * Link a project to a knowledge base
 */
export async function linkProjectToKnowledgeBase(
  knowledgeBaseId: string,
  projectId: string
): Promise<KnowledgeBaseProjectLink> {
  try {
    const link = await prisma.knowledgeBaseProjectLink.create({
      data: {
        knowledgeBaseId,
        projectId,
      },
    });

    // Update project meta to include knowledge base ID
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (project) {
      const meta = (project.meta as Prisma.JsonObject) ?? {};
      const knowledgeBaseIds = (meta.knowledgeBaseIds as string[]) ?? [];

      // Only add if not already present
      if (!knowledgeBaseIds.includes(knowledgeBaseId)) {
        knowledgeBaseIds.push(knowledgeBaseId);
        await prisma.project.update({
          where: { id: projectId },
          data: {
            meta: {
              ...meta,
              knowledgeBaseIds,
            },
          },
        });
      }
    }

    console.log(
      `✅ Linked project ${projectId} to knowledge base ${knowledgeBaseId}`
    );
    return link;
  } catch (error) {
    console.error('Error linking project to knowledge base:', error);
    throw error;
  }
}

/**
 * Unlink a project from a knowledge base
 */
export async function unlinkProjectFromKnowledgeBase(
  knowledgeBaseId: string,
  projectId: string
): Promise<void> {
  try {
    await prisma.knowledgeBaseProjectLink.delete({
      where: {
        knowledgeBaseId_projectId: {
          knowledgeBaseId,
          projectId,
        },
      },
    });

    // Update project meta to remove knowledge base ID
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (project) {
      const meta = (project.meta as Prisma.JsonObject) ?? {};
      const knowledgeBaseIds = (
        (meta.knowledgeBaseIds as string[]) ?? []
      ).filter((id) => id !== knowledgeBaseId);

      await prisma.project.update({
        where: { id: projectId },
        data: {
          meta: {
            ...meta,
            knowledgeBaseIds,
          },
        },
      });
    }

    console.log(
      `✅ Unlinked project ${projectId} from knowledge base ${knowledgeBaseId}`
    );
  } catch (error) {
    console.error('Error unlinking project from knowledge base:', error);
    throw error;
  }
}
