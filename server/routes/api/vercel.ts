import axios from 'axios';
import { Router } from 'express';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { deployCodeToVercel } from '../../services/deployService';
import { userProfileRequestHandler } from '../../lib/util';
import { ProfileResponse } from '../../types/response';
import { DeployResult } from '../../../shared/types/supabaseTypes';
import {
  autoCreateDatabaseIfMissing,
  executeAllPendingMigrations,
} from '../../services/databaseService';
import prisma from '../../db/prisma';
import { DocumentStatus, IssueStatus } from '@prisma/client';
import { updateDocumentMetaAfterDeploy } from '../../services/documentMetaService';

const router = Router();
router.use(userProfileRequestHandler);
const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;

const getVercelHeaders = () => ({
  Authorization: `Bearer ${VERCEL_API_TOKEN}`,
  'Content-Type': 'application/json',
});

// This API is used to manage Vercel projects and environment variables
// It allows setting up environment variables for a Vercel project
router.post('/env-vars', async (req, res) => {
  const { deployDocId, envVars } = req.body;

  if (!deployDocId || !envVars || !Array.isArray(envVars)) {
    return res.status(400).json({
      success: false,
      data: {
        info: 'deployDocId and envVars are required',
        error: 'Missing deployDocId or envVars',
      },
    });
  }

  try {
    const response = await axios.post(
      `https://api.vercel.com/v10/projects/${encodeURIComponent(
        deployDocId
      )}/env?upsert=true`,
      envVars.map((env) => ({
        key: env.key,
        value: env.value,
        type: env.type || 'plain',
        target: env.target || ['production', 'preview', 'development'],
      })),
      {
        headers: getVercelHeaders(),
      }
    );

    return res.status(200).json({
      success: true,
      data: {
        info: 'Environment variables updated successfully',
        envVars: response.data,
      },
    });
  } catch (error: any) {
    console.error(
      'Failed to update env vars:',
      error.response?.data || error.message
    );
    return res.status(500).json({
      success: false,
      error:
        error.response?.data?.error?.message ||
        error.message ||
        'Unknown error',
    });
  }
});
//This API is used to get Vercel project information,
// which is useful for checking if the project exists before performing operations
router.get('/get-project/:deployDocId', async (req, res) => {
  const { deployDocId } = req.params;

  if (!deployDocId) {
    return res.status(400).json({
      success: false,
      error: 'deployDocId is required',
    });
  }
  console.log('Fetching Vercel project info for:', deployDocId);
  try {
    const response = await axios.get(
      `https://api.vercel.com/v9/projects/${encodeURIComponent(deployDocId)}`,
      { headers: getVercelHeaders() }
    );

    return res.status(200).json({
      success: true,
      data: response.data,
    });
  } catch (error: any) {
    console.error(
      'Failed to fetch Vercel project:',
      error.response?.data || error.message
    );
    return res.status(500).json({
      success: false,
      error:
        error.response?.data?.error?.message ||
        error.message ||
        'Unknown error',
    });
  }
});

// Get Build Logs (deployment events) for a specific deployment
router.get('/build-logs/:deploymentId', async (req, res) => {
  const { deploymentId } = req.params;
  const { limit } = req.query;

  if (!deploymentId) {
    return res.status(400).json({
      success: false,
      error: 'deploymentId is required',
    });
  }

  console.log('Fetching build logs for deployment:', deploymentId);
  try {
    const response = await axios.get(
      `https://api.vercel.com/v1/deployments/${encodeURIComponent(
        deploymentId
      )}/events${limit ? `?limit=${limit}` : ''}`,
      { headers: getVercelHeaders() }
    );

    return res.status(200).json({
      success: true,
      data: response.data,
    });
  } catch (error: any) {
    console.error(
      'Failed to fetch build logs:',
      error.response?.data || error.message
    );
    return res.status(500).json({
      success: false,
      error:
        error.response?.data?.error?.message ||
        error.message ||
        'Unknown error',
    });
  }
});

// SSE endpoint to stream real-time runtime logs using `vercel logs` CLI
router.get('/runtime-logs/stream', async (req, res) => {
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Missing required query parameter: url',
    });
  }

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

  // Helper to send SSE data with immediate flush
  const send = (data: string) => {
    res.write(`data: ${data}\n\n`);
    // Force immediate flush to prevent Heroku buffering
    if (typeof (res as any).flush === 'function') {
      (res as any).flush();
    }
  };
  const sendEvent = (event: string, data: string) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${data}\n\n`);
    // Force immediate flush to prevent Heroku buffering
    if (typeof (res as any).flush === 'function') {
      (res as any).flush();
    }
  };

  // Keep-alive ping to prevent idle timeouts - critical for long-running streams
  const keepAlive = setInterval(() => {
    res.write(': ping\n\n');
    // Force immediate flush for keep-alive
    if (typeof (res as any).flush === 'function') {
      (res as any).flush();
    }
  }, 15000);

  // Resolve local vercel CLI binary
  const vercelBin = path.join(
    process.cwd(),
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'vercel.cmd' : 'vercel'
  );

  const cli = fs.existsSync(vercelBin) ? vercelBin : 'vercel';

  const args = ['logs', url, '-j']; // -j enables JSON output
  if (VERCEL_API_TOKEN) {
    args.push('--token', VERCEL_API_TOKEN);
  }

  console.log('Starting vercel logs stream for:', url);

  // Send initial connection confirmation immediately
  // This prevents Heroku from buffering/closing the connection
  sendEvent('connected', JSON.stringify({ message: 'Stream connected', url }));

  // Spawn the vercel logs process
  const child = spawn(cli, args, {
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      LANG: 'en_US.UTF-8',
    },
    cwd: process.cwd(),
  });

  sendEvent(
    'start',
    JSON.stringify({ message: 'Starting vercel logs...', url })
  );

  // Buffer to handle incomplete lines across chunks
  let stdoutBuffer = '';
  let stderrBuffer = '';
  const sentLogs = new Set<string>(); // Track sent logs to prevent duplicates
  let isCleanedUp = false; // Prevent multiple cleanup calls
  // Timeout control: hard limit 5 minutes per Vercel logs window
  const MAX_STREAM_DURATION_MS = 5 * 60 * 1000;
  let maxDurationTimer: NodeJS.Timeout | undefined;

  child.stdout.on('data', (chunk) => {
    // Append chunk to buffer
    stdoutBuffer += chunk.toString();

    // Split by line breaks, keep last incomplete line in buffer
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() || ''; // Preserve potentially incomplete last line

    // Send complete lines
    for (const line of lines) {
      if (!line.trim()) continue;

      // Deduplicate: skip if already sent
      if (sentLogs.has(line)) {
        continue;
      }

      sentLogs.add(line);
      send(line);
    }
  });

  child.stderr.on('data', (chunk) => {
    // Append chunk to buffer
    stderrBuffer += chunk.toString();

    // Split by line breaks, keep last incomplete line in buffer
    const lines = stderrBuffer.split(/\r?\n/);
    stderrBuffer = lines.pop() || '';

    // Send complete lines
    for (const line of lines) {
      if (!line.trim()) continue;
      sendEvent('stderr', line);
    }
  });

  child.on('error', (err) => {
    console.error('Failed to start vercel CLI:', err);
    sendEvent(
      'error',
      JSON.stringify({
        message: 'Failed to start vercel CLI',
        error: String(err),
      })
    );
    cleanupAndEnd();
  });

  child.on('close', (code, signal) => {
    // Process any remaining buffer content with deduplication
    if (stdoutBuffer.trim() && !sentLogs.has(stdoutBuffer)) {
      sentLogs.add(stdoutBuffer);
      send(stdoutBuffer);
    }
    if (stderrBuffer.trim()) {
      sendEvent('stderr', stderrBuffer);
    }

    sendEvent('end', JSON.stringify({ code, signal }));
    cleanupAndEnd();
  });

  const cleanupAndEnd = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;

    console.log('Cleaning up vercel logs stream for:', url);

    // Clear keep-alive interval
    clearInterval(keepAlive);
    // Clear timer
    if (maxDurationTimer) clearTimeout(maxDurationTimer);

    // Kill child process if it's still running
    if (child && !child.killed) {
      console.log('Terminating vercel CLI process...');
      child.kill('SIGTERM');

      // Force kill after timeout if process doesn't terminate
      setTimeout(() => {
        if (child && !child.killed) {
          console.log('Force killing vercel CLI process...');
          child.kill('SIGKILL');
        }
      }, 5000);
    }

    // End response
    try {
      if (!res.writableEnded) {
        res.end();
      }
    } catch (err) {
      console.error('Error ending response:', err);
    }
  };

  // Start max duration timer (5 minutes)
  maxDurationTimer = setTimeout(() => {
    sendEvent(
      'timeout',
      JSON.stringify({ message: 'Max stream duration reached' })
    );
    cleanupAndEnd();
  }, MAX_STREAM_DURATION_MS);

  // Abort when client disconnects
  req.on('aborted', () => {
    console.log('Client aborted connection for:', url);
    cleanupAndEnd();
  });

  res.on('close', () => {
    console.log('Client closed connection for:', url);
    cleanupAndEnd();
  });
});

// Publish app to production environment
// Uses SSE streaming to avoid Heroku 30s timeout and provide real-time updates
router.post('/publish', async (req, res: ProfileResponse<DeployResult>) => {
  const { documentId, deployDocId, files } = req.body;

  if (!documentId || !deployDocId) {
    return res.status(400).json({
      success: false,
      errorMsg: 'documentId and deployDocId are required',
    });
  }

  try {
    // Get document data to validate it exists
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      return res.status(404).json({
        success: false,
        errorMsg: 'Document not found',
      });
    }

    // Capture currentUser before setting up SSE
    const currentUser = res.locals.currentUser;

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders(); // Flush headers immediately

    // Helper function to send SSE messages
    // Format: JSON directly (matching deploy.ts format for consistency)
    const sendUpdate = (data: any) => {
      try {
        if (!res.writableEnded && !res.destroyed) {
          res.write(`${JSON.stringify(data)}\n\n`);
          // Flush if available (Node.js 18+)
          if ((res as any).flush) {
            (res as any).flush();
          }
        }
      } catch (err) {
        console.error('Error sending SSE update:', err);
      }
    };

    // Send initial status
    sendUpdate({
      status: { message: 'Starting publication...' },
    });

    // Process publishing asynchronously
    (async () => {
      try {
        console.log(`Publishing app to production: ${deployDocId}`);

        // Check and auto-create production database if missing
        try {
          sendUpdate({
            status: { message: 'Setting up production database...' },
          });

          const docData = {
            id: doc.id,
            name: doc.name,
            type: doc.type,
            meta: doc.meta as Record<string, any>,
            onProgress: (message: string) => {
              console.log('Database creation progress:', message);
              sendUpdate({
                status: { message: `Database: ${message}` },
              });
            },
          };

          // Ensure production database exists
          const prodEnvSettings = await autoCreateDatabaseIfMissing(
            docData,
            'production'
          );
          console.log('✅ Production database check completed');

          sendUpdate({
            status: { message: 'Checking for pending migrations...' },
          });

          // Execute all pending migrations for production environment
          console.log('🔄 Checking for pending migrations in production...');
          const migrationResult = await executeAllPendingMigrations(
            documentId,
            prodEnvSettings,
            'production'
          );

          if (!migrationResult.success) {
            console.error('⚠️ Migration failed:', migrationResult.error);
            sendUpdate({
              status: { message: 'Migration failed' },
              error: `Database migration failed: ${migrationResult.error}`,
              success: false,
            });
            res.end();
            return;
          }

          if (
            migrationResult.migrationsApplied &&
            migrationResult.migrationsApplied > 0
          ) {
            console.log(
              `✅ Applied ${migrationResult.migrationsApplied} migrations to production`
            );
            sendUpdate({
              status: {
                message: `Applied ${migrationResult.migrationsApplied} migration(s)`,
              },
            });
          } else {
            console.log('✅ No pending migrations for production');
          }

          sendUpdate({
            status: { message: 'Deploying to production...' },
          });

          // Deploy to Vercel
          const deployResult = await deployCodeToVercel(
            deployDocId,
            files,
            documentId,
            'production'
          );

          if (deployResult.success) {
            // Update document status and meta with publish URL
            try {
              // Ensure URL has https:// prefix
              const publishUrl = deployResult.sourceUrl.startsWith('http')
                ? deployResult.sourceUrl
                : `https://${deployResult.sourceUrl}`;

              // Re-fetch document to get issueId for later use
              const latestDoc = await prisma.document.findUnique({
                where: { id: documentId },
                select: { issueId: true },
              });

              // Update document status to PUBLISHED
              await prisma.document.update({
                where: { id: documentId },
                data: {
                  status: DocumentStatus.PUBLISHED,
                },
              });

              // Update document meta after deployment (unified function for production)
              await updateDocumentMetaAfterDeploy(
                documentId,
                { ...deployResult, sourceUrl: publishUrl },
                'production'
              );

              console.log(
                `✅ Updated document -- ${documentId} -- status to PUBLISHED with URL: ${publishUrl}`
              );

              // Also update related Issue status so Planner shows "Published"
              try {
                if (latestDoc?.issueId) {
                  await prisma.issue.update({
                    where: { id: latestDoc.issueId },
                    data: {
                      status: IssueStatus.COMPLETED,
                      progress: 100,
                      actualEndDate: new Date(),
                      changeHistory: {
                        create: {
                          userId: currentUser.userId,
                          modifiedAttribute: JSON.stringify({
                            status: IssueStatus.COMPLETED,
                          }),
                        },
                      },
                    },
                  });
                  console.log('✅ Updated related issue status to COMPLETED');
                }
              } catch (issueUpdateError) {
                console.error(
                  'Failed to update related issue status after publish:',
                  issueUpdateError
                );
                // Do not fail the deployment if issue update fails
              }

              // Send success message with publishUrl
              sendUpdate({
                status: { message: 'Publication complete' },
                sourceUrl: publishUrl,
                success: true,
              });
              console.log(
                '✅ Sent success message with publishUrl:',
                publishUrl
              );
            } catch (metaError) {
              console.error(
                'Failed to update document meta with publish URL:',
                metaError
              );
              // Still send success with URL even if meta update fails
              sendUpdate({
                status: { message: 'Publication complete' },
                sourceUrl: deployResult.sourceUrl,
                success: true,
              });
              console.log(
                '✅ Sent success message with deployResult.sourceUrl:',
                deployResult.sourceUrl
              );
            }
          } else {
            // Send error message
            sendUpdate({
              status: { message: 'Deployment failed' },
              error: deployResult.errorMessage || 'Deployment failed',
              success: false,
            });
            console.error('❌ Deployment failed:', deployResult.errorMessage);
          }
        } catch (dbError: any) {
          console.error('⚠️ Failed to setup production database:', dbError);
          sendUpdate({
            status: { message: 'Database setup failed' },
            error: `Failed to setup production database: ${dbError.message}`,
            success: false,
          });
        }
      } catch (error: any) {
        console.error('Failed to publish app:', error);
        sendUpdate({
          status: { message: 'Publication failed' },
          error: error.message || 'Unknown error',
          success: false,
        });
      } finally {
        // Small delay to ensure final message is sent before ending stream
        await new Promise((resolve) => setTimeout(resolve, 100));
        // End the SSE stream
        if (!res.writableEnded && !res.destroyed) {
          res.end();
        }
      }
    })();
  } catch (error: any) {
    console.error('Failed to initiate publish:', error);
    return res.status(500).json({
      success: false,
      errorMsg: error.message || 'Unknown error',
    });
  }
});

module.exports = {
  className: 'vercel',
  routes: router,
};
