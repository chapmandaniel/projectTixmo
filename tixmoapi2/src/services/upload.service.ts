import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, S3_BUCKET, isS3Configured } from '../config/s3';
import { randomUUID } from 'crypto';
import path from 'path';

export interface UploadResult {
    s3Key: string;
    s3Url: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
}

export class UploadService {
    private bucketName: string;

    constructor() {
        this.bucketName = S3_BUCKET;
    }

    /**
     * Upload a file to S3
     */
    async uploadFile(
        file: Express.Multer.File,
        folder: string = 'approvals'
    ): Promise<UploadResult> {
        if (!isS3Configured()) {
            throw new Error('S3 is not configured. Please set S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_BUCKET_NAME environment variables.');
        }

        const fileExtension = path.extname(file.originalname);
        const uniqueFilename = `${randomUUID()}${fileExtension}`;
        const s3Key = `${folder}/${uniqueFilename}`;

        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: s3Key,
            Body: file.buffer,
            ContentType: file.mimetype,
            Metadata: {
                originalName: file.originalname,
            },
        });

        await s3Client.send(command);

        // Generate a public URL (or use getSignedUrl for private buckets)
        const s3Url = await this.getSignedUrl(s3Key);

        return {
            s3Key,
            s3Url,
            filename: uniqueFilename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
        };
    }

    /**
     * Generate a signed URL for accessing a file
     */
    async getSignedUrl(s3Key: string, expiresIn: number = 3600): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: s3Key,
        });

        return getSignedUrl(s3Client, command, { expiresIn });
    }

    /**
     * Delete a file from S3
     */
    async deleteFile(s3Key: string): Promise<void> {
        const command = new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: s3Key,
        });

        await s3Client.send(command);
    }

    /**
     * Upload multiple files
     */
    async uploadMultiple(
        files: Express.Multer.File[],
        folder: string = 'approvals'
    ): Promise<UploadResult[]> {
        return Promise.all(files.map(file => this.uploadFile(file, folder)));
    }
}

export const uploadService = new UploadService();
