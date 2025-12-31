import { S3Client } from '@aws-sdk/client-s3';

export const JWT_CONFIG = {
  SECRET: process.env.JWT_SECRET,
  FALLBACK_SECRET: 'development-jwt-secret', // Only used if no secret is configured
  EXPIRES_IN: '24h',
} as const;

export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: 'Invalid credentials',
  EMAIL_ALREADY_EXISTS: 'Email already registered',
  INVALID_TOKEN: 'Invalid token',
  NO_TOKEN: 'No token provided',
  UNAUTHORIZED: 'Unauthorized access',
} as const;

export const SERVER_CONFIG = {
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV || 'development',
} as const;

if (
  !process.env.AWS_REGION ||
  !process.env.AWS_ACCESS_KEY_ID ||
  !process.env.AWS_SECRET_ACCESS_KEY
) {
  console.error('AWS credentials not configured:', {
    AWS_REGION: process.env.AWS_REGION ? 'set' : 'missing',
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? 'set' : 'missing',
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY
      ? 'set'
      : 'missing',
  });
  throw new Error(
    'AWS credentials are required. Please set AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY environment variables.'
  );
}

export const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export const S3_CONFIG = {
  BUCKET_NAME: process.env.BUCKET_NAME,
  REGION: process.env.AWS_REGION,
  FOLDER_PREFIX: 'user-content',
  PRESIGNED_URL_EXPIRY: 3600, // 1 hour in seconds
} as const;
