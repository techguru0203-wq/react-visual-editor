import { Router } from 'express';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { ProfileResponse } from '../../types/response';

const client = new S3Client({
  region: process.env.AWS_REGION,
  // region: 'us-east-2', // IF test, use this
});

const router = Router();

// Modify proxy download route
router.get(
  '/proxy-download/:docId',
  async function (
    req: Express.Request & { params: { docId: string } },
    response: ProfileResponse<any>
  ) {
    try {
      const { docId } = req.params;

      if (!docId) {
        return response.status(400).json({
          success: false,
          errorMsg: 'Document ID is required',
        });
      }

      const s3Prefix = 'webpage-assets/';
      // Construct S3 file path using docId
      const key = `${s3Prefix}${docId}.json`;

      const command = new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: key,
      });

      try {
        const s3Response = await client.send(command);
        const content = await s3Response.Body?.transformToString();

        if (!content) {
          throw new Error('Failed to read file content');
        }

        // Try to parse JSON content
        const jsonContent = JSON.parse(content);

        response.status(200).json({
          success: true,
          data: jsonContent,
        });
      } catch (error) {
        if ((error as any).name === 'NoSuchKey') {
          // If file doesn't exist, return empty data
          response.status(200).json({
            success: true,
            data: null,
          });
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Error in GET /files/proxy-download:', error);
      response.status(500).json({
        success: false,
        errorMsg: (error as Error).message || 'Failed to fetch file content',
      });
    }
  }
);

module.exports = {
  className: 'pub',
  routes: router,
};
