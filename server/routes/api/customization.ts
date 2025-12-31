import {
  StyleSourceType,
  RecordStatus,
  SubscriptionTier,
} from '@prisma/client';
import { Router } from 'express';
import z from 'zod';
import prisma from '../../db/prisma';
import { GenerationMinimumCredit } from '../../lib/constant';
import { userProfileRequestHandler } from '../../lib/util';
import { AuthenticatedUserWithProfile } from '../../types/authTypes';
import { ProfileResponse } from '../../types/response';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { extractStyleFromImage } from '../../services/llmService/customizationAgent';
import { Readable } from 'stream';
import sharp from 'sharp';

const router = Router();
router.use(userProfileRequestHandler);

// Middleware to check subscription tier for customization features
const checkCustomizationAccess = async (
  req: any,
  res: ProfileResponse<any>,
  next: any
) => {
  const currentUser: AuthenticatedUserWithProfile = res.locals.currentUser;

  const org = await prisma.organization.findUnique({
    where: { id: currentUser.organizationId },
    select: { subscriptionTier: true },
  });

  if (!org) {
    return res
      .status(404)
      .json({ success: false, errorMsg: 'Organization not found.' });
  }

  const allowedTiers: SubscriptionTier[] = [
    SubscriptionTier.PRO,
    SubscriptionTier.BUSINESS,
    SubscriptionTier.ENTERPRISE,
  ];

  if (
    !(allowedTiers as readonly SubscriptionTier[]).includes(
      org.subscriptionTier
    )
  ) {
    return res.status(403).json({
      success: false,
      errorMsg:
        'Design customization is only available for Teams, and Scale plans.',
    });
  }

  next();
};

const client = new S3Client({
  region: process.env.AWS_REGION,
});

const ImageStyleExtractionInputSchema = z.object({
  imageUrl: z.string().min(10), // basic check to ensure non-empty input
});

type ImageStyleExtractionInput = z.infer<
  typeof ImageStyleExtractionInputSchema
>;

interface StyleFromImageOutput {
  contentStr: string;
  styleDescription: string;
}

router.post(
  '/generate-style-from-image',
  checkCustomizationAccess,
  async (req, res: ProfileResponse<StyleFromImageOutput>) => {
    const currentUser: AuthenticatedUserWithProfile = res.locals.currentUser;

    const org = await prisma.organization.findUnique({
      where: { id: currentUser.organizationId },
    });

    if (!org) {
      res
        .status(500)
        .json({ success: false, errorMsg: 'Organization not found.' });
      return;
    } else if (org.credits < GenerationMinimumCredit) {
      res
        .status(500)
        .json({ success: false, errorMsg: 'Insufficient credits.' });
      return;
    }

    const parsed = ImageStyleExtractionInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        errorMsg: 'Invalid request body: ' + parsed.error.message,
      });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let keepAliveInterval: NodeJS.Timeout | null = null;
    keepAliveInterval = setInterval(() => {
      res.write(`event: keepalive\ndata: {}\n\n`);
    }, 10000); // heroku drops idle connections after 60s

    const { imageUrl } = parsed.data;

    const parsedUrl = new URL(imageUrl);
    const bucketName = process.env.BUCKET_NAME;
    const key = decodeURIComponent(parsedUrl.pathname.slice(1));

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    async function streamToBuffer(stream: Readable): Promise<Buffer> {
      return new Promise((resolve, reject) => {
        const chunks: any[] = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
      });
    }

    const s3Response = await client.send(command);
    if (!s3Response.Body) throw new Error('Empty file body from S3');

    const buffer = await streamToBuffer(s3Response.Body as Readable);

    // Compress the image using sharp (example: resize to max 800px width, jpeg quality 80)
    const compressedBuffer = await sharp(buffer)
      .resize({ width: 800, withoutEnlargement: true }) // optional resizing
      .jpeg({ quality: 80 }) // compress jpeg quality
      .toBuffer();

    const base64Image = `data:image/jpeg;base64,${compressedBuffer.toString(
      'base64'
    )}`;

    // Would like to compress, but need to install npm package 'sharp'

    try {
      console.log(
        'in server.routes.api.customization.generate-style-from-image.start:',
        currentUser.userId
      );

      const styleDescription = await extractStyleFromImage(
        base64Image,
        currentUser
      );

      res.write(
        `event: step\ndata: ${JSON.stringify({
          message: 'Style extracted',
        })}\n\n`
      );

      const saved = await prisma.designStyle.create({
        data: {
          organizationId: currentUser.organizationId,
          styleInfo: styleDescription,
          sourceType: StyleSourceType.IMAGE,
          sourceUrls: [imageUrl],
          status: RecordStatus.ACTIVE,
        },
      });

      res.write(
        `event: step\ndata: ${JSON.stringify({ message: 'Style saved' })}\n\n`
      );

      // Final result
      res.write(
        `event: done\ndata: ${JSON.stringify({
          success: true,
          data: { styleDescription },
          // data: { contentStr, styleDescription },
        })}\n\n`
      );
      res.end();
    } catch (error) {
      console.error('Error occurred in POST /generate-style-from-image', error);
      res.write(
        `event: error\ndata: ${JSON.stringify({
          success: false,
          errorMsg: (error as string | Error).toString(),
        })}\n\n`
      );
      res.end();
    } finally {
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
      }
    }
  }
);

const RegenerateStylePreviewSchema = z.object({
  styleDescription: z.string(),
});

router.post(
  '/regenerate-style-preview',
  checkCustomizationAccess,
  async function (req, res: ProfileResponse<{ contentStr: string }>) {
    const currentUser: AuthenticatedUserWithProfile = res.locals.currentUser;

    const parsed = RegenerateStylePreviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        errorMsg: 'Invalid request body: ' + parsed.error.message,
      });
    }

    const { styleDescription } = parsed.data;

    try {
      const existing = await prisma.designStyle.findFirst({
        where: {
          organizationId: currentUser.organizationId,
          sourceType: StyleSourceType.IMAGE,
          status: RecordStatus.ACTIVE,
        },
        orderBy: {
          version: 'desc',
        },
      });

      if (existing) {
        await prisma.designStyle.update({
          where: { id: existing.id },
          data: { styleInfo: styleDescription },
        });
      } else {
        await prisma.designStyle.create({
          data: {
            organizationId: currentUser.organizationId,
            styleInfo: styleDescription,
            sourceType: StyleSourceType.IMAGE,
            sourceUrls: [],
            status: RecordStatus.ACTIVE,
          },
        });
      }

      res.status(200).json({
        success: true,
        data: { contentStr: '' },
        // data: { contentStr: htmlPreview },
      });
    } catch (error) {
      console.error('Failed to regenerate style preview:', error);
      res.status(500).json({
        success: false,
        errorMsg: (error as Error).message,
      });
    }
  }
);

router.get(
  '/latest-style-description',
  checkCustomizationAccess,
  async function (
    req,
    res: ProfileResponse<{
      styleDescription: string;
      imageUrl: string;
      base64: string;
    }>
  ) {
    const currentUser: AuthenticatedUserWithProfile = res.locals.currentUser;

    try {
      const latest = await prisma.designStyle.findFirst({
        where: {
          organizationId: currentUser.organizationId,
          sourceType: StyleSourceType.IMAGE,
          status: RecordStatus.ACTIVE,
        },
        orderBy: {
          version: 'desc',
        },
        select: {
          styleInfo: true,
          sourceUrls: true,
        },
      });

      // If no style description exists, return empty data instead of error
      if (!latest || !latest.sourceUrls || latest.sourceUrls.length === 0) {
        return res.status(200).json({
          success: true,
          data: {
            styleDescription: '',
            imageUrl: '',
            base64: '',
          },
        });
      }

      const imageUrl = latest.sourceUrls[0];
      const parsedUrl = new URL(imageUrl);
      const bucketName = process.env.BUCKET_NAME;
      const key = decodeURIComponent(parsedUrl.pathname.slice(1));

      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      async function streamToBuffer(stream: Readable): Promise<Buffer> {
        return new Promise((resolve, reject) => {
          const chunks: any[] = [];
          stream.on('data', (chunk) => chunks.push(chunk));
          stream.on('error', reject);
          stream.on('end', () => resolve(Buffer.concat(chunks)));
        });
      }

      const s3Response = await client.send(command);
      if (!s3Response.Body) throw new Error('Empty file body from S3');

      const buffer = await streamToBuffer(s3Response.Body as Readable);

      const base64Image = `data:image/jpeg;base64,${buffer.toString('base64')}`;

      return res.status(200).json({
        success: true,
        data: {
          styleDescription: latest.styleInfo?.toString() || '',
          imageUrl: imageUrl || '',
          base64: base64Image || '',
        },
      });
    } catch (error) {
      console.error('Error fetching latest style description:', error);
      return res.status(500).json({
        success: false,
        errorMsg: 'Failed to fetch latest style description.',
      });
    }
  }
);

module.exports = {
  className: 'customization',
  routes: router,
};
