import { Router } from 'express';
import {
  uploadWebpageAssetsToS3,
  deployCodeToVercel,
} from '../../services/deployService';
import { ProjectFile } from '../../../shared/types/supabaseTypes';
import prisma from '../../db/prisma';
import { IssueStatus, Prisma } from '@prisma/client';
import {
  generateDeployDocId,
  userProfileRequestHandler,
  normalizeEnvSettings,
} from '../../lib/util';
import {
  genDocumentAfterChat,
  EnvSettings,
} from '../../services/documentService';
import { getOrCreateChatSession } from '../../services/llmService/chatAgent';
import {
  updateDocumentMeta,
  updateDocumentMetaAfterDeploy,
} from '../../services/documentMetaService';
import { executeDBMigrationWithDrizzle } from '../../services/databaseService';
import { injectVisualEditSupport } from '../../services/visualEditInjector';

const router = Router();
router.use(userProfileRequestHandler);

router.post('/deployToVercel', async (req, res) => {
  try {
    const { documentId, files } = req.body as {
      documentId: string;
      files: ProjectFile[];
    };

    if (!documentId || !files || !Array.isArray(files)) {
      return res.status(400).json({
        success: false,
        sourceUrl: '',
        errorMessage:
          'Invalid request: documentId and files array are required',
      });
    }

    // Inject visual edit support for click-to-select functionality
    const filesWithVisualEdit = injectVisualEditSupport(files);

    let doc = await prisma.document.findUnique({
      where: { id: documentId },
    });
    const deployDocId = generateDeployDocId(
      doc?.name || '',
      doc?.type || '',
      documentId
    );
    console.log(
      `Deploying document ${documentId} with deployDocId: ${deployDocId}`
    );

    // Execute preview environment migrations before deployment
    const docMeta = (doc?.meta as Prisma.JsonObject) || {};
    const rawEnvSettings = docMeta?.envSettings;

    if (rawEnvSettings) {
      try {
        const previewEnvSettings = normalizeEnvSettings(
          rawEnvSettings,
          'preview'
        ) as EnvSettings;

        // Convert files to generateContent format
        const generateContent = JSON.stringify({ files });

        // Execute migration with the file content (will upload new migrations to S3)
        const migrationResult = await executeDBMigrationWithDrizzle(
          documentId,
          generateContent,
          previewEnvSettings,
          true, // hasSchemaChange - assume true when explicitly deploying
          'preview'
        );

        // If migration fails, return error (unless it's just "no migration files found")
        if (!migrationResult.success && migrationResult.error) {
          return res.status(500).json({
            success: false,
            sourceUrl: '',
            errorMessage: `Database migration failed: ${migrationResult.error}`,
          });
        }
      } catch (migrationError) {
        return res.status(500).json({
          success: false,
          sourceUrl: '',
          errorMessage: `Database migration failed: ${
            migrationError instanceof Error
              ? migrationError.message
              : 'Unknown error'
          }`,
        });
      }
    }

    const result = await deployCodeToVercel(deployDocId, filesWithVisualEdit, documentId);

    // Update document meta after deployment (unified function)
    if (result.success) {
      try {
        await updateDocumentMetaAfterDeploy(documentId, result, 'preview');
      } catch (e) {
        console.error('Failed to update document meta after deploy:', e);
      }
    }

    res.json({
      success: result.success,
      sourceUrl: result.sourceUrl,
      errorMessage: result.errorMessage,
    });
  } catch (error) {
    console.error('Error in Vercel deployment route:', error);
    res.status(500).json({
      success: false,
      sourceUrl: '',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/deployToVercel-streaming', async (req, res) => {
  let keepAlive: NodeJS.Timeout | undefined;

  // Helper function to send updates with immediate flush
  const sendUpdate = (data: any) => {
    try {
      if (!res.writableEnded && !res.destroyed) {
        res.write(`${JSON.stringify(data)}\n\n`);
        // Force immediate flush to prevent Heroku buffering
        if (typeof (res as any).flush === 'function') {
          (res as any).flush();
        }
      }
    } catch (err) {
      console.error('Error sending SSE update:', err);
    }
  };

  try {
    const { documentId, files } = req.body as {
      documentId: string;
      files: ProjectFile[];
    };

    if (!documentId || !files || !Array.isArray(files)) {
      return res.status(400).json({
        success: false,
        sourceUrl: '',
        errorMessage:
          'Invalid request: documentId and files array are required',
      });
    }

    // Inject visual edit support for click-to-select functionality
    const filesWithVisualEdit = injectVisualEditSupport(files);

    // Prepare SSE headers - Critical for Heroku deployment
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.setHeader('Transfer-Encoding', 'chunked'); // Force chunked encoding

    // Ensure headers are sent immediately
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    // Keep-alive ping to prevent idle timeouts - critical for long-running streams
    keepAlive = setInterval(() => {
      try {
        if (!res.writableEnded && !res.destroyed) {
          res.write(': ping\n\n');
          // Force immediate flush for keep-alive
          if (typeof (res as any).flush === 'function') {
            (res as any).flush();
          }
        } else {
          if (keepAlive) clearInterval(keepAlive);
        }
      } catch (err) {
        console.error('Error sending keep-alive:', err);
        if (keepAlive) clearInterval(keepAlive);
      }
    }, 15000);

    // Start deployment process
    sendUpdate({ status: { message: 'deploying.app' } });
    // Use our existing deployment function
    let doc = await prisma.document.findUnique({
      where: { id: documentId },
    });
    const deployDocId = generateDeployDocId(
      doc?.name || '',
      doc?.type || '',
      documentId
    );

    // Execute preview environment migrations before deployment
    const docMeta = (doc?.meta as Prisma.JsonObject) || {};
    const rawEnvSettings = docMeta?.envSettings;

    if (rawEnvSettings) {
      try {
        const previewEnvSettings = normalizeEnvSettings(
          rawEnvSettings,
          'preview'
        ) as EnvSettings;

        // Convert files to generateContent format
        const generateContent = JSON.stringify({ files });

        // Execute migration with the file content (will upload new migrations to S3)
        const migrationResult = await executeDBMigrationWithDrizzle(
          documentId,
          generateContent,
          previewEnvSettings,
          true, // hasSchemaChange - assume true when explicitly deploying
          'preview'
        );

        // If migration fails, return error (unless it's just "no migration files found")
        if (!migrationResult.success && migrationResult.error) {
          if (keepAlive) clearInterval(keepAlive);
          sendUpdate({
            status: { message: 'Migration failed' },
            error: `Database migration failed: ${migrationResult.error}`,
            success: false,
          });
          await new Promise((resolve) => setTimeout(resolve, 100));
          res.end();
          return;
        }
      } catch (migrationError) {
        if (keepAlive) clearInterval(keepAlive);
        sendUpdate({
          status: { message: 'Migration failed' },
          error: `Database migration failed: ${
            migrationError instanceof Error
              ? migrationError.message
              : 'Unknown error'
          }`,
          success: false,
        });
        await new Promise((resolve) => setTimeout(resolve, 100));
        res.end();
        return;
      }
    }

    const deployResult = await deployCodeToVercel(
      deployDocId,
      filesWithVisualEdit,
      documentId
    );

    // Check if deployment succeeded perfectly (READY state without errors)
    const hasBuildErrors = deployResult.success && deployResult.errorMessage;

    if (deployResult.success && !deployResult.errorMessage) {
      // Perfect deployment - READY state with no errors
      // Update document meta after deployment (unified function)
      try {
        await updateDocumentMetaAfterDeploy(
          documentId,
          deployResult,
          'preview'
        );
        // Also update deployDocId using partial update to avoid overwriting other fields
        await updateDocumentMeta(documentId, {
          deployDocId: deployDocId,
        });
      } catch (e) {
        console.error('Failed to update document meta after deploy:', e);
      }

      // Send success message after meta update
      sendUpdate({
        status: { message: 'Deployment complete' },
        sourceUrl: deployResult.sourceUrl,
        success: true,
      });
    } else if (hasBuildErrors || !deployResult.success) {
      // Has build errors (READY with errors) OR true deployment failure (ERROR state)
      // Update document meta to save the working URL (if available)
      if (deployResult.sourceUrl) {
        try {
          await updateDocumentMetaAfterDeploy(
            documentId,
            deployResult,
            'preview'
          );
          await updateDocumentMeta(documentId, {
            deployDocId: deployDocId,
          });
        } catch (e) {
          console.error('Failed to update document meta after deploy:', e);
        }
      }

      // Trigger LLM to fix the errors
      sendUpdate({
        status: {
          message: hasBuildErrors
            ? 'Deployment ready with build errors, fixing...'
            : 'Deployment failed, fixing errors...',
        },
        success: false,
      });

      // Get organization and user info
      const currentUser = res.locals.currentUser;
      const org = await prisma.organization.findUnique({
        where: { id: currentUser.organizationId },
      });

      if (!org) {
        if (keepAlive) clearInterval(keepAlive);
        sendUpdate({
          status: { message: 'Deployment failed' },
          error: deployResult.errorMessage,
          success: false,
        });
        await new Promise((resolve) => setTimeout(resolve, 100));
        res.end();
        return;
      }

      // Get or create chat session
      const chatSessionId = await getOrCreateChatSession({
        name: doc?.name || '',
        userId: currentUser.userId,
        chatContent: 'Fixing deployment errors',
        userEmail: currentUser.email,
        targetEntityId: documentId,
        targetEntityType: 'DOCUMENT',
        targetEntitySubType: doc?.type || 'PROTOTYPE',
      });

      // Get document contents
      const documentContent = doc?.content?.toString('utf-8') || '';

      // Trigger LLM to fix the errors
      console.log('[DEBUG] Triggering LLM fix via genDocumentAfterChat');
      try {
        await genDocumentAfterChat(org, currentUser, {
          id: documentId,
          description: doc?.description || '',
          name: doc?.name || '',
          projectId: doc?.projectId || '',
          meta: (doc?.meta as Prisma.JsonObject) || {},
          type: (doc?.type as any) || 'PROTOTYPE',
          contents: documentContent,
          imageBase64: '',
          templateId: '',
          outputFormat: '',
          chatSessionId: chatSessionId.id,
          isFixingDeploymentError: true,
          initialDeployError: deployResult.errorMessage || '', // Pass the deployment error
          onProgress: (progress: string) => {
            // Forward progress updates to client
            try {
              if (!res.writableEnded && !res.destroyed) {
                res.write(`${progress}\n\n`);
              }
            } catch (err) {
              console.error('Error writing progress update:', err);
            }
          },
        });
      } catch (error) {
        console.error('Error triggering LLM fix:', error);
        sendUpdate({
          status: { message: 'Deployment failed' },
          error: deployResult.errorMessage,
          success: false,
        });
      }
    }

    // Clear keep-alive interval
    if (keepAlive) {
      clearInterval(keepAlive);
    }

    // Small delay to ensure final message is sent before ending stream
    await new Promise((resolve) => setTimeout(resolve, 100));

    // End the SSE stream
    if (!res.writableEnded && !res.destroyed) {
      res.end();
    }
  } catch (error) {
    console.error('Error in Vercel streaming deployment:', error);

    // Clear keep-alive interval on error
    if (keepAlive) {
      clearInterval(keepAlive);
    }

    try {
      if (!res.writableEnded && !res.destroyed) {
        sendUpdate({
          status: { message: 'Deployment failed' },
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false,
        });
        // Small delay before ending
        await new Promise((resolve) => setTimeout(resolve, 100));
        res.end();
      }
    } catch (endError) {
      console.error('Error ending stream:', endError);
    }
  }
});

router.post('/uploadWebpageAssets', async (req, res) => {
  try {
    const { documentId, sourceUrl, issueId } = req.body as {
      documentId: string;
      sourceUrl: string;
      issueId: string;
    };
    const { userId } = res.locals.currentUser;

    if (!documentId || !sourceUrl) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: documentId and sourceUrl are required',
      });
    }

    const s3Prefix = 'webpage-assets/';
    await uploadWebpageAssetsToS3({
      sourceUrl,
      s3Bucket: process.env.BUCKET_NAME || '',
      s3Prefix,
      docId: documentId,
    });

    // update buildable status
    await prisma.issue.update({
      where: {
        id: issueId,
      },
      data: {
        status: IssueStatus.COMPLETED,
        progress: 100,
        actualEndDate: new Date(),
        changeHistory: {
          create: {
            userId: userId,
            modifiedAttribute: JSON.stringify({
              status: IssueStatus.COMPLETED,
            }),
          },
        },
      },
    });

    const fileUrl = `https://${process.env.BUCKET_NAME}.s3.amazonaws.com/${s3Prefix}${documentId}.json`;
    res.json({
      success: true,
      fileUrl,
    });
  } catch (error) {
    console.error('Error uploading webpage assets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload webpage assets',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

module.exports = {
  className: 'deploy',
  routes: router,
};
