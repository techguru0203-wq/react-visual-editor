import axios from 'axios';
import { DeployResult, ProjectFile } from '../../shared/types/supabaseTypes';
import { PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import * as url from 'url';
import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
// import { HttpsProxyAgent } from 'https-proxy-agent';
import prisma from '../db/prisma';
import { Prisma } from '@prisma/client';
import { Element } from 'domhandler';
import stripAnsi from 'strip-ansi';
import { EnvSettings } from './documentService';
import { s3Client } from '../lib/s3Upload';
import { GENERAL_EMAIL } from '../lib/constant';
import { getOrganizationWithApiKey } from './apiKeyService';
import { RedisSingleton } from './redis/redis';
import { normalizeEnvSettings } from '../lib/util';
import { updateDocumentMeta } from './documentMetaService';
// import { executeDBMigrationWithDrizzle } from './databaseService';

export async function createOrganizationFolder(organizationId: string) {
  try {
    const bucketName = process.env.BUCKET_NAME;
    const folderKey = `user-content/${organizationId}/`;

    // Check if folder already exists
    try {
      await s3Client.send(
        new HeadObjectCommand({
          Bucket: bucketName,
          Key: folderKey,
        })
      );
      console.log(`ℹ️ Organization folder already exists: ${folderKey}`);
      return true; // Folder exists, consider it successful
    } catch (headError: any) {
      // If HeadObjectCommand fails with 404, the folder doesn't exist, so we can create it
      if (headError.name !== 'NotFound') {
        // If it's not a 404 error, something else went wrong
        throw headError;
      }
    }

    // Create a placeholder file to establish the folder structure
    const params = {
      Bucket: bucketName,
      Key: folderKey,
      Body: '', // Empty body to create a folder marker
      ContentType: 'application/x-directory',
    };

    await s3Client.send(new PutObjectCommand(params));
    console.log(`✅ Organization folder created: ${folderKey}`);
    return true;
  } catch (err) {
    console.error('❌ Error creating organization folder:', err);
    return false;
  }
}

export async function addEnvVariables(
  deployDocId: string,
  envSettings: EnvSettings | null,
  organizationId: string,
  target: 'production' | 'preview' | 'development' = 'preview'
) {
  const targetEnv = [target];
  const environmentVariables = [
    {
      key: 'VITE_SUPABASE_URL',
      value: process.env.VITE_SUPABASE_URL,
      type: 'plain',
      target: targetEnv,
    },
    {
      key: 'VITE_SUPABASE_ANON_KEY',
      value: process.env.VITE_SUPABASE_ANON_KEY,
      type: 'plain',
      target: targetEnv,
    },
    {
      key: 'FROM_EMAIL',
      value: GENERAL_EMAIL,
      type: 'plain',
      target: targetEnv,
    },
    {
      key: 'AWS_REGION',
      value: process.env.AWS_REGION,
      type: 'plain',
      target: targetEnv,
    },
    {
      key: 'AWS_ACCESS_KEY_ID',
      value: process.env.AWS_ACCESS_KEY_ID,
      type: 'plain',
      target: targetEnv,
    },
    {
      key: 'AWS_SECRET_ACCESS_KEY',
      value: process.env.AWS_SECRET_ACCESS_KEY,
      type: 'plain',
      target: targetEnv,
    },
    {
      key: 'BUCKET_NAME',
      value: process.env.BUCKET_NAME,
      type: 'plain',
      target: targetEnv,
    },
    ...(organizationId
      ? [
          {
            key: 'FOLDER_NAME',
            value: organizationId,
            type: 'plain',
            target: targetEnv,
          },
        ]
      : []),
  ];

  // Get organization API key and subscription tier, then add to environment variables
  try {
    const organization = await getOrganizationWithApiKey(organizationId);
    if (organization?.apiKey) {
      environmentVariables.push({
        key: 'OMNIFLOW_API_KEY',
        value: organization.apiKey,
        type: 'plain',
        target: targetEnv,
      });
    }

    // Add subscription tier from organization
    const orgSubscriptionTier = (organization as any)?.subscriptionTier;
    if (orgSubscriptionTier) {
      environmentVariables.push({
        key: 'SUBSCRIPTION_TIER',
        value: orgSubscriptionTier as string,
        type: 'plain',
        target: ['production'],
      });
      environmentVariables.push({
        key: 'VITE_SUBSCRIPTION_TIER',
        value: orgSubscriptionTier as string,
        type: 'plain',
        target: ['production'],
      });
      environmentVariables.push({
        key: 'NEXT_PUBLIC_SUBSCRIPTION_TIER',
        value: orgSubscriptionTier as string,
        type: 'plain',
        target: targetEnv,
      });
    }
  } catch (error) {
    console.error('Error getting organization data:', error);
  }

  // Add custom environment variables from envSettings if provided (including model name)
  // Note: envSettings is already normalized by the caller (deployCodeToVercel)
  if (envSettings) {
    // Add all environment variables from the already-normalized settings
    Object.entries(envSettings).forEach(([key, value]) => {
      if (typeof value === 'string') {
        environmentVariables.push({
          key: key,
          value: value,
          type: 'plain',
          target: targetEnv,
        });
      }
    });
  }

  try {
    const response = await axios.get(
      `https://api.vercel.com/v9/projects/${encodeURIComponent(deployDocId)}`,

      {
        headers: {
          Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('projectResult:', response.status);
    if (response.status === 200) {
      await axios.post(
        `https://api.vercel.com/v10/projects/${encodeURIComponent(
          deployDocId
        )}/env?upsert=true`,
        environmentVariables,
        {
          headers: {
            Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    return response.data.id;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      // 404
      if (error.response?.status === 404) {
        // First-time deployment: set environment variables for both production and preview
        const productionAndPreviewEnvVars = environmentVariables.map((env) => ({
          ...env,
          target: ['production', 'preview'],
        }));

        const createPayload = {
          name: deployDocId,
          environmentVariables: productionAndPreviewEnvVars,
        };
        const projectResult = await axios.post(
          `https://api.vercel.com/v11/projects`,
          createPayload,
          {
            headers: {
              Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
              'Content-Type': 'application/json',
            },
            // httpsAgent: new HttpsProxyAgent(proxyUrl),
          }
        );
        console.log('projectResult create: ', projectResult.statusText);

        return projectResult.data.id;
      }
    }
    throw new Error(`Vercel API error: ${error}`);
  }
}

export async function addCustomDomain(deployDocId: string, domainUrl: string) {
  // const domainName = `${deployDocId}.useomniflow.com`;
  const domainName = domainUrl.replace('.vercel.app', '.useomniflow.com');
  try {
    const response = await axios.post(
      `https://api.vercel.com/v9/projects/${deployDocId}/domains`,
      { name: domainName },
      {
        headers: {
          Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`✅ Added domain: ${domainName}, ${response.data.name}`);
    return response.data.name;
  } catch (error: any) {
    if (error.response.data.error.code === 'domain_already_in_use') {
      console.warn(`Failed to add domain ${domainName}: domain_already_in_use`);
    } else {
      console.error(`❌ Failed to add domain ${domainName}:`, error);
    }
  }

  return domainName;
}

export async function deployCodeToVercel(
  deployDocId: string,
  files: ProjectFile[],
  documentId: string,
  target: 'production' | 'preview' | 'development' = 'preview'
) {
  if (!files || files.length === 0) {
    return {
      sourceUrl: '',
      success: false,
      errorMessage: 'generated code is empty!',
    };
  }
  let generateContent = JSON.stringify({ files });
  let deployResult: DeployResult = {
    sourceUrl: '',
    success: false,
    errorMessage: '',
  };

  console.log('start deployCodeToVercelForRegenerate');
  // Get environment settings for the document

  // Get organization ID from document
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { organizationId: true, meta: true },
  });

  if (!document?.organizationId) {
    throw new Error('Document organization ID not found');
  }

  // Normalize envSettings to handle both old (flat) and new (preview/production) structures
  const rawEnvSettings = (document.meta as Prisma.JsonObject)?.envSettings;
  const envSettings = rawEnvSettings
    ? (normalizeEnvSettings(rawEnvSettings, target) as EnvSettings)
    : null;

  // // for to update the schema when save button is clicked just for easier testing
  // await executeDBMigrationWithDrizzle(
  //   documentId,
  //   generateContent,
  //   envSettings,
  //   true
  // );
  deployResult = await deployCodeToVercelForRegenerate(
    deployDocId,
    generateContent,
    envSettings,
    document.organizationId,
    documentId,
    target
  );

  return deployResult;
}

export async function deployVercelApp(
  deployDocId: string,
  sourceFiles: ProjectFile[],
  envSettings: EnvSettings | null,
  organizationId: string,
  target: 'production' | 'preview' | 'development' = 'preview'
) {
  try {
    console.log('addEnvVariables', deployDocId);

    const projectId = await addEnvVariables(
      deployDocId,
      envSettings,
      organizationId,
      target
    );
    console.log('✅ Environment variables added:', projectId);
    // 1. Transform file format
    const files = prepareVercelFiles(sourceFiles);

    // 2. Add project configuration
    const payload: any = {
      name: deployDocId,
      project: projectId,
      files,
      projectSettings: {
        framework: null,
      },
    };

    if (target !== 'preview') {
      payload.target = target;
    }

    // 3. Call Vercel API
    const response = await axios.post(
      'https://api.vercel.com/v13/deployments',
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    let domainUrl = response.data.url;
    console.log('✅ Deployment URL created! URL:', domainUrl);
    return { ...response.data, url: domainUrl };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Deployment Failed with AxiosError:', error.response?.data);
    } else {
      console.error('❌ Deployment failed:', error);
    }
    return null;
  }
}

const prepareVercelFiles = (sourceFiles: ProjectFile[]) => {
  return sourceFiles.map((file) => ({
    file: file.path,
    data: file.content,
    encoding: 'utf-8',
  }));
};

export async function deployCodeToVercelForRegenerate(
  deployDocId: string,
  generatedCodeInStr: string,
  envSettings: EnvSettings | null,
  organizationId: string,
  documentId?: string,
  target: 'production' | 'preview' | 'development' = 'preview'
): Promise<DeployResult> {
  let result: DeployResult = {
    sourceUrl: '',
    success: false,
    errorMessage:
      'generated code is empty. Please generate the source code first.',
  };
  if (!generatedCodeInStr) {
    return result;
  }
  let sourceUrl = '';
  const { files } = JSON.parse(generatedCodeInStr);
  if (files) {
    const deploymentResult = await deployVercelApp(
      deployDocId,
      files,
      envSettings,
      organizationId,
      target
    );
    console.log(
      'documentServices.genDocumentAfterChat.previewUrl:',
      deploymentResult?.alias
    );
    const { success, url, errorMessage } =
      await checkDeploymentStatusForRegenerate(
        deploymentResult.id,
        deployDocId,
        deploymentResult.url,
        documentId,
        target
      );
    console.log('checkDeploymentStatusForRegenerate.sourceUrl:', url);
    if (success) {
      sourceUrl = url.startsWith('http') ? url : `https://${url}`;
      if (organizationId) {
        try {
          const folderSuccess = await createOrganizationFolder(organizationId);
          if (folderSuccess) {
            console.log('✅ Organization folder created for:', organizationId);
          } else {
            console.warn(
              '⚠️ Failed to create organization folder for:',
              organizationId
            );
          }
        } catch (error) {
          console.error('❌ Failed to create organization folder:', error);
        }
      } else {
        console.log(
          '⚠️ Skipping organization folder creation - organizationId is undefined'
        );
      }

      result = {
        success: true,
        sourceUrl,
        errorMessage: errorMessage || '', // Keep error message from checkDeploymentStatusForRegenerate (READY with build errors)
        deploymentId: deploymentResult.id,
      };
    } else {
      result = {
        success: false,
        sourceUrl: url,
        errorMessage,
        deploymentId: deploymentResult.id,
      };
    }
  }
  return result;
}

export async function checkDeploymentStatusForRegenerate(
  deploymentId: string,
  deployDocId: string,
  deployDomainUrl: string,
  documentId?: string,
  target: 'production' | 'preview' | 'development' = 'preview'
) {
  try {
    let status = '';
    let retries = 0;
    const maxRetries = 20; // Maximum retry attempts (prevent infinite loop)

    const updatedResult = await updateVercelPreviewSettings(deployDocId);
    console.log('✅ Project settings updated successfully:');

    while (status !== 'READY' && retries < maxRetries) {
      // Check if user stopped generation during deployment
      if (documentId) {
        const stopKey = `stop-generation:${documentId}`;
        const stopSignal = await RedisSingleton.getData(stopKey);
        if (stopSignal === 'true') {
          console.log('User stopped generation during deployment polling');
          await RedisSingleton.clearData(stopKey);
          return {
            success: false,
            url: '',
            errorMessage: 'Deployment cancelled by user',
          };
        }
      }

      const response = await axios.get(
        `https://api.vercel.com/v13/deployments/${deploymentId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
          },
        }
      );
      status = response.data.readyState;
      console.log(`Current status: ${status}`);
      if (status === 'READY') {
        let url = response.data.url;

        if (process.env.NODE_ENV !== 'development') {
          // Add deployment alias with environment-specific domain
          const aliasUrl = await addDeploymentAlias(
            deploymentId,
            deployDomainUrl,
            target
          );

          // For production deploy, use project domain instead of deployment URL
          if (target === 'production') {
            console.log('🎯 Production deployment - fetching project domain');
            const projectDomain = await getProjectDomains(deployDocId);
            if (projectDomain) {
              url = projectDomain;
              console.log(`✅ Using project domain: ${url}`);
            } else {
              // Fallback to alias if no project domain found
              url = aliasUrl;
              console.log(`⚠️ No project domain found, using alias: ${url}`);
            }
          } else {
            // For preview/development, use the environment-specific alias
            url = aliasUrl;
            console.log(`✅ Using deployment alias: ${url}`);
          }
        }

        // add 5s delay because vercel is missing logs sometimes
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const errorLogs = await getDeploymentLogs(deploymentId);

        // READY state always returns success=true, but includes error logs if present
        // This allows LLM to fix build warnings/errors while still providing a working URL
        if (errorLogs) {
          console.log(
            '⚠️ Deployment READY with build errors - will trigger LLM fix'
          );
          return {
            success: true,
            url: url,
            errorMessage: errorLogs,
          };
        }

        console.log('✅ Deployment completed! URL:', url);
        return {
          success: true,
          url: url,
          errorMessage: '',
        };
      } else if (status === 'ERROR') {
        const { errorCode, errorMessage, errorStep } = response.data;
        console.log(
          'get deployment failed message code:',
          errorCode,
          errorStep,
          errorMessage
        );
        // add 5s delay because vercel is missing logs sometimes
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const errorLogs = await getDeploymentLogs(deploymentId);

        // Always return error when status is ERROR, even if detailed logs aren't available
        const finalErrorMessage =
          errorLogs ||
          errorMessage ||
          errorCode ||
          'Build failed with unknown error';
        return {
          success: false,
          url: '',
          errorMessage: finalErrorMessage,
        };
      }
      retries++;
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Check every 5 seconds
    }
    const errorLogs = await getDeploymentLogs(deploymentId);

    throw new Error('Deployment timeout due to error: ' + errorLogs);
  } catch (error) {
    console.error(
      '❌ Status check failed:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return {
      success: false,
      url: '',
      errorMessage:
        error instanceof Error ? error.message : 'Deployment timeout',
    };
  }
}

export async function getDeploymentLogs(deploymentId: string) {
  const response = await axios.get(
    `https://api.vercel.com/v3/deployments/${deploymentId}/events?limit=-1`,
    {
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
      },
    }
  );
  const logs = response.data || [];
  const lastLog = logs[logs.length - 1];
  console.log('getDeploymentLogs.response:', lastLog);

  // Extract error messages from logs with more precise filtering
  const errorMessages = logs
    .filter((log: any) => {
      const text = log.text || '';
      const payload = log.payload || {};

      // Priority 1: Fatal errors (most critical)
      if (log.type === 'fatal') {
        return true;
      }

      // Priority 2: Error level logs
      if (log.level === 'error') {
        return true;
      }

      // Priority 3: stderr but exclude warnings and success messages
      if (log.type === 'stderr') {
        const textUpper = text.toUpperCase();
        const textLower = text.toLowerCase();

        // Filter out warnings
        if (
          textLower.includes('npm warn') ||
          textUpper.includes('WARN!') ||
          textUpper.includes('WARNING:') ||
          textUpper.match(/^\s*WARN\s/i)
        ) {
          return false;
        }

        // Filter out success/info messages that appear in stderr
        if (
          textLower.includes('build completed') ||
          textLower.includes('vercel cli')
        ) {
          return false;
        }

        return true;
      }

      // Priority 4: Exit events with non-zero status
      if (
        log.type === 'exit' &&
        payload.statusCode &&
        payload.statusCode !== 0
      ) {
        return true;
      }

      // Priority 5: stdout with clear error indicators (excluding warnings and success messages)
      const textLower = text.toLowerCase();
      if (
        textLower.includes('error:') ||
        textLower.includes('failed to resolve import') ||
        textLower.includes('build failed') ||
        textLower.includes('exited with')
      ) {
        return true;
      }

      return false;
    })
    .map((log: any) => {
      // For exit events, construct meaningful message
      if (log.type === 'exit' && log.payload) {
        return `Build step exited with code ${log.payload.statusCode}`;
      }
      return stripAnsi(log.text || '');
    })
    .filter((msg: string) => msg.trim().length > 0); // Remove empty lines

  const errMessage = errorMessages.join('\n');

  console.log('getDeploymentLogs.errMessage:', errMessage);
  return errMessage;
}

export async function updateVercelPreviewSettings(deployDocId: string) {
  try {
    const response = await axios.patch(
      `https://api.vercel.com/v9/projects/${encodeURIComponent(deployDocId)}`,
      {
        ssoProtection: null,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(
        'Vercel API request failed:',
        error.response?.data?.error?.message || error.message
      );
      throw new Error(
        `Failed to update project settings: ${
          error.response?.data?.error?.message || error.message
        }`
      );
    }
    throw error;
  }
}

interface UploadOptions {
  sourceUrl: string;
  s3Bucket: string;
  s3Prefix?: string;
  docId: string;
}

interface AssetInfo {
  originalUrl: string;
  resolvedUrl: string;
  type: 'script' | 'css';
}

export async function uploadWebpageAssetsToS3(
  options: UploadOptions
): Promise<void> {
  const { sourceUrl, s3Bucket, s3Prefix = '', docId } = options;

  console.log(`Starting asset extraction from URL: ${sourceUrl}`);

  // 1. Create output directory
  fs.mkdirSync(path.join(process.cwd(), 'build-assets'), { recursive: true });

  // 2. Get page HTML and parse resources
  console.log(`Fetching HTML from ${sourceUrl}...`);
  let html: string;
  try {
    const response = await axios.get<string>(sourceUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      timeout: 10000,
      // httpsAgent: new HttpsProxyAgent(proxyUrl),
    });
    html = response.data;
  } catch (error) {
    console.error('Failed to fetch HTML:', error);
    throw error;
  }

  // Initialize files array with HTML content
  const files: ProjectFile[] = [
    {
      path: 'index.html',
      content: html,
      type: 'file',
    },
  ];

  // Parse HTML using Cheerio
  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(html);
    console.log('✅ HTML fetched and parsed successfully');
  } catch (error) {
    console.error('Failed to parse HTML:', error);
    throw error;
  }

  // Parse the source URL to resolve relative paths
  const parsedUrl = url.parse(sourceUrl);
  const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

  // Function to resolve relative URLs
  const resolveUrl = (assetPath: string): string | null => {
    if (!assetPath) return null;
    assetPath = assetPath.trim();
    if (!assetPath) return null;

    if (assetPath.startsWith('http://') || assetPath.startsWith('https://')) {
      return assetPath;
    }

    if (assetPath.startsWith('/')) {
      return `${baseUrl}${assetPath}`;
    }

    const dirname = path.dirname(parsedUrl.pathname || '');
    return `${baseUrl}${path.join(dirname, assetPath)}`;
  };

  // Collect asset information with safer DOM traversal
  const assets: AssetInfo[] = [];

  // Extract JavaScript files with error handling
  const scriptElements = $('script[src]');
  if (scriptElements.length) {
    scriptElements.each((i: number, el: Element) => {
      try {
        const element = $(el);
        if (!element.length) return;

        const originalSrc = element.attr('src');
        if (originalSrc) {
          const resolvedUrl = resolveUrl(originalSrc);
          if (resolvedUrl) {
            assets.push({
              originalUrl: originalSrc,
              resolvedUrl,
              type: 'script',
            });
          }
        }
      } catch (error) {
        console.error('Error processing script element:', error);
      }
    });
  }

  // Extract CSS files with error handling
  const cssElements = $('link[rel="stylesheet"]');
  if (cssElements.length) {
    cssElements.each((i: number, el: Element) => {
      try {
        const element = $(el);
        if (!element.length) return;

        const originalHref = element.attr('href');
        if (originalHref) {
          const resolvedUrl = resolveUrl(originalHref);
          if (resolvedUrl) {
            assets.push({
              originalUrl: originalHref,
              resolvedUrl,
              type: 'css',
            });
          }
        }
      } catch (error) {
        console.error('Error processing stylesheet element:', error);
      }
    });
  }

  console.log(`Found ${assets.length} assets to process:`);
  assets.forEach((asset) => {
    console.log(
      `- ${asset.type}: ${asset.originalUrl} (Resolved: ${asset.resolvedUrl})`
    );
  });

  // Download and process assets with better error handling
  for (const asset of assets) {
    try {
      console.log(`Downloading ${asset.type}: ${asset.resolvedUrl}`);
      const assetResponse = await axios.get(asset.resolvedUrl, {
        responseType: 'arraybuffer',
        timeout: 15000, // Increased timeout
        // httpsAgent: new HttpsProxyAgent(proxyUrl),
      });

      const content = assetResponse.data.toString('utf-8');

      // Sanitize path and ensure it's relative
      let assetPath = asset.originalUrl;
      if (assetPath.startsWith('http://') || assetPath.startsWith('https://')) {
        const urlObj = new URL(assetPath);
        assetPath = urlObj.pathname.startsWith('/')
          ? urlObj.pathname.substring(1)
          : urlObj.pathname;
      } else if (assetPath.startsWith('/')) {
        assetPath = assetPath.substring(1);
      }

      files.push({
        path: assetPath,
        content,
        type: 'file',
      });

      console.log(`✓ Downloaded ${asset.type}: ${asset.originalUrl}`);
    } catch (error) {
      console.error(
        `Failed to download ${asset.type} file ${asset.resolvedUrl}:`,
        error instanceof Error ? error.message : 'Unknown error'
      );
      // Continue with other assets even if one fails
    }
  }

  // Upload files array to S3
  try {
    const key = `${s3Prefix}${docId}.json`.replace(/\/\//g, '/');
    const fileUrl = `https://${s3Bucket}.s3.amazonaws.com/${key}`;

    const uploadParams = {
      Bucket: s3Bucket,
      Key: key,
      Body: JSON.stringify({ files }),
      ContentType: 'application/json',
    };

    const command = new PutObjectCommand(uploadParams);
    await s3Client.send(command);

    console.log(`✓ Uploaded files array to ${fileUrl}`);

    // Update document metadata using partial update
    try {
      await updateDocumentMeta(docId, {
        builtFileUrl: fileUrl,
      });

      console.log(`✓ Updated document with builtFileUrl: ${fileUrl}`);
    } catch (prismaError) {
      console.error('Failed to update document metadata:', prismaError);
      // Don't throw here as the S3 upload succeeded
    }
  } catch (error) {
    console.error('Failed to upload files array to S3:', error);
    throw error;
  }
}

export async function getProjectDomains(projectId: string) {
  try {
    const response = await axios.get(
      `https://api.vercel.com/v9/projects/${encodeURIComponent(
        projectId
      )}/domains`,
      {
        headers: {
          Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const domains = response.data.domains || [];
    console.log(`✅ Found ${domains.length} domains for project ${projectId}`);

    // Find primary or first custom domain
    const primaryDomain = domains.find((d: any) => d.primary) || domains[0];

    return primaryDomain?.name || null;
  } catch (error: any) {
    console.error(
      `❌ Failed to get project domains:`,
      error.response?.data || error
    );
    return null;
  }
}

export async function addDeploymentAlias(
  deploymentId: string,
  domainUrl: string,
  target: 'production' | 'preview' | 'development' = 'preview'
) {
  // Extract first 3 segments from domain URL (e.g., materialtodo-prod-cmi7m4gjj003)
  // This ensures all deployments share the same alias domain
  const domainWithoutSuffix = domainUrl
    .replace('.vercel.app', '')
    .replace('.useomniflow.com', '');

  const segments = domainWithoutSuffix.split('-');
  const baseName = segments.slice(0, 3).join('-');

  const aliasName =
    target === 'production'
      ? `${baseName}.useomniflow.com`
      : `${baseName}-${target}.useomniflow.com`;

  try {
    const response = await axios.post(
      `https://api.vercel.com/v2/deployments/${encodeURIComponent(
        deploymentId
      )}/aliases`,
      { alias: aliasName },
      {
        headers: {
          Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`✅ Added alias: ${aliasName}, ${response.data.alias}`);
    return response.data.alias;
  } catch (error: any) {
    if (error.response?.data?.error?.code === 'alias_in_use') {
      console.warn(`⚠️ Failed to add alias ${aliasName}: already in use`);
    } else {
      console.error(
        `❌ Failed to add alias ${aliasName}:`,
        error.response?.data || error
      );
    }
  }

  return aliasName;
}
