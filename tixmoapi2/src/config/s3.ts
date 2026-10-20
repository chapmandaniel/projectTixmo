import { S3Client } from '@aws-sdk/client-s3';

const urlStyle = process.env.S3_URL_STYLE || process.env.AWS_S3_URL_STYLE || 'path';
if (!['path', 'virtual'].includes(urlStyle)) {
  throw new Error('S3_URL_STYLE must be path or virtual');
}

// S3 client for Railway S3 (or compatible S3 storage)
export const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT || process.env.AWS_ENDPOINT,
  region: process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: urlStyle === 'path',
});

export const S3_BUCKET =
  process.env.S3_BUCKET_NAME || process.env.AWS_S3_BUCKET || 'tixmo-approvals';

// Check if S3 is configured
export const isS3Configured = (): boolean => {
  const hasS3CompatibleConfig = !!(
    process.env.S3_ENDPOINT &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY &&
    process.env.S3_BUCKET_NAME
  );

  const hasAwsConfig = !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_S3_BUCKET
  );

  return hasS3CompatibleConfig || hasAwsConfig;
};
