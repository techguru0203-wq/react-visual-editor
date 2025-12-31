import { Router } from 'express';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ProfileResponse } from '../../types/response';
import { userProfileRequestHandler } from '../../lib/util';

const router = Router();
router.use(userProfileRequestHandler);

const client = new S3Client({
  region: process.env.AWS_REGION,
});

router.get('/fetch-code', async function (req, res: ProfileResponse<any>) {
  try {
    const { key } = req.query;
    if (!key || typeof key !== 'string') {
      return res.status(400).json({
        success: false,
        errorMsg: 'Missing or invalid "key" parameter',
      });
    }
    const bucketName = process.env.BUCKET_NAME;

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const s3Response = await client.send(command);
    const content = await s3Response.Body?.transformToString();

    if (!content) {
      throw new Error('No content found in S3');
    }

    const jsonContent = JSON.parse(content);

    res.status(200).json({
      success: true,
      data: jsonContent,
    });
  } catch (error) {
    console.error('Error in GET /services_test/fetch-code:', error);
    res.status(500).json({
      success: false,
      errorMsg: (error as Error).message || 'Failed to fetch data',
    });
  }
});

module.exports = {
  className: 's3FileService',
  routes: router,
};
