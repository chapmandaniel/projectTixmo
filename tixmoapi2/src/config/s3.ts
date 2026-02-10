import { S3Client } from '@aws-sdk/client-s3';

// S3 client for Railway S3 (or compatible S3 storage)
export const s3Client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
    forcePathStyle: true, // Required for Railway S3 and most S3-compatible services
});

export const S3_BUCKET = process.env.S3_BUCKET_NAME || 'tixmo-approvals';

// Check if S3 is configured
export const isS3Configured = (): boolean => {
    return !!(
        process.env.S3_ENDPOINT &&
        process.env.S3_ACCESS_KEY_ID &&
        process.env.S3_SECRET_ACCESS_KEY &&
        process.env.S3_BUCKET_NAME
    );
};
