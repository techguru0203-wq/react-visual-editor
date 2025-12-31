import { Router } from 'express';
import { userProfileRequestHandler } from '../../lib/util';
import {
  startDevServer,
  stopDevServer,
  getDevServerStatus,
  updateDevServerFiles,
  deleteProject,
} from '../../services/devServerManager';
import { ProjectFile } from '../../../shared/types/supabaseTypes';
import prisma from '../../db/prisma';
import { checkDocumentAccess } from '../../services/documentService';

const router = Router();
router.use(userProfileRequestHandler);

/**
 * Start a dev server for a document
 * POST /api/dev-server/start
 */
router.post('/start', async (req, res) => {
  try {
    const { documentId } = req.body as { documentId: string };
    const currentUser = res.locals.currentUser;

    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: 'documentId is required',
      });
    }

    // Get document and files
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      include: { project: true },
    });

    if (!doc) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
      });
    }

    // Check document access
    const { hasAccess } = await checkDocumentAccess(
      doc,
      currentUser.email,
      currentUser.userId,
      currentUser.organizationId || null
    );
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Parse files from document content
    let files: ProjectFile[] = [];
    try {
      const contentStr = doc.content?.toString('utf-8') || '{}';
      const content = JSON.parse(contentStr);
      files = content.files || [];
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid document content format',
      });
    }

    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files found in document',
      });
    }

    // Start dev server
    const result = await startDevServer(documentId, files);

    if (result.success) {
      res.json({
        success: true,
        url: result.url,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to start dev server',
      });
    }
  } catch (error) {
    console.error('Error starting dev server:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Stop a dev server for a document
 * POST /api/dev-server/stop
 */
router.post('/stop', async (req, res) => {
  try {
    const { documentId } = req.body as { documentId: string };
    const currentUser = res.locals.currentUser;

    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: 'documentId is required',
      });
    }

    // Get document to check access
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      include: { project: true },
    });

    if (!doc) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
      });
    }

    // Check document access
    const { hasAccess } = await checkDocumentAccess(
      doc,
      currentUser.email,
      currentUser.userId,
      currentUser.organizationId || null
    );
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Stop dev server
    const result = await stopDevServer(documentId);

    if (result.success) {
      res.json({
        success: true,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to stop dev server',
      });
    }
  } catch (error) {
    console.error('Error stopping dev server:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get dev server status for a document
 * GET /api/dev-server/status/:documentId
 */
router.get('/status/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const currentUser = res.locals.currentUser;

    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: 'documentId is required',
      });
    }

    // Get document to check access
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      include: { project: true },
    });

    if (!doc) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
      });
    }

    // Check document access
    const { hasAccess } = await checkDocumentAccess(
      doc,
      currentUser.email,
      currentUser.userId,
      currentUser.organizationId || null
    );
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Get dev server status
    const status = getDevServerStatus(documentId);

    res.json({
      success: true,
      running: status.running,
      url: status.url,
      port: status.port,
    });
  } catch (error) {
    console.error('Error getting dev server status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Update files for a running dev server
 * POST /api/dev-server/update-files
 */
router.post('/update-files', async (req, res) => {
  try {
    const { documentId, files } = req.body as {
      documentId: string;
      files: ProjectFile[];
    };
    const currentUser = res.locals.currentUser;

    if (!documentId || !files || !Array.isArray(files)) {
      return res.status(400).json({
        success: false,
        error: 'documentId and files array are required',
      });
    }

    // Get document to check access
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      include: { project: true },
    });

    if (!doc) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
      });
    }

    // Check document access
    const { hasAccess } = await checkDocumentAccess(
      doc,
      currentUser.email,
      currentUser.userId,
      currentUser.organizationId || null
    );
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Update dev server files
    const result = updateDevServerFiles(documentId, files);

    if (result.success) {
      res.json({
        success: true,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to update dev server files',
      });
    }
  } catch (error) {
    console.error('Error updating dev server files:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Delete project directory for a document (force fresh installation)
 * DELETE /api/dev-server/delete/:documentId
 */
router.delete('/delete/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const currentUser = res.locals.currentUser;

    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: 'documentId is required',
      });
    }

    // Get document to check access
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      include: { project: true },
    });

    if (!doc) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
      });
    }

    // Check document access
    const { hasAccess } = await checkDocumentAccess(
      doc,
      currentUser.email,
      currentUser.userId,
      currentUser.organizationId || null
    );
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Delete project
    const result = await deleteProject(documentId);

    if (result.success) {
      res.json({
        success: true,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to delete project',
      });
    }
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

module.exports = {
  className: 'dev-server',
  routes: router,
};

