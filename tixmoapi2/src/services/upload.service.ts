import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, S3_BUCKET, isS3Configured } from '../config/s3';
import { logger } from '../config/logger';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import { unlink } from 'fs/promises';

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
  async uploadFile(file: Express.Multer.File, folder: string = 'approvals'): Promise<UploadResult> {
    let body: Buffer | fs.ReadStream | undefined;
    try {
      if (!isS3Configured()) {
        if (process.env.NODE_ENV === 'test') {
          const fileExtension = path.extname(file.originalname);
          const uniqueFilename = `${randomUUID()}${fileExtension}`;
          const s3Key = `${folder}/${uniqueFilename}`;

          return {
            s3Key,
            s3Url: `https://test-storage.local/${s3Key}`,
            filename: uniqueFilename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
          };
        }

        throw new Error(
          'S3 is not configured. Please set S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_BUCKET_NAME environment variables.'
        );
      }

      const fileExtension = path.extname(file.originalname);
      const uniqueFilename = `${randomUUID()}${fileExtension}`;
      const s3Key = `${folder}/${uniqueFilename}`;

      // Support both buffer (memory storage) and stream (disk storage)
      if (file.buffer) {
        body = file.buffer;
      } else if (file.path) {
        body = fs.createReadStream(file.path);
      } else {
        throw new Error('File content is empty');
      }

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: body,
        ContentType: file.mimetype,
        Metadata: {
          // S3 user metadata is sent in HTTP headers; filenames can contain CR/LF or Unicode.
          originalName: encodeURIComponent(file.originalname),
          originalNameEncoding: 'uri-component',
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
    } finally {
      if (body instanceof fs.ReadStream && !body.closed) {
        const stream = body;
        await new Promise<void>((resolve) => {
          stream.once('close', resolve);
          stream.once('error', () => {});
          stream.destroy();
        });
      }
      // Clean up every path, including configuration and pre-S3 failures.
      if (file.path) {
        try {
          await unlink(file.path);
        } catch (err) {
          console.error('Failed to delete temp file:', err);
        }
      }
    }
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

  async resolveFileUrl(
    s3Key: string,
    fallbackUrl?: string,
    expiresIn: number = 24 * 60 * 60
  ): Promise<string> {
    if (!isS3Configured()) {
      return fallbackUrl || `https://test-storage.local/${s3Key}`;
    }

    try {
      return await this.getSignedUrl(s3Key, expiresIn);
    } catch (error) {
      logger.warn(`Failed to generate signed URL for ${s3Key}: ${(error as Error).message}`);
      if (fallbackUrl) {
        return fallbackUrl;
      }
      throw error;
    }
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
    // Do not settle the request while sibling uploads still own file streams.
    const results = await Promise.allSettled(files.map((file) => this.uploadFile(file, folder)));
    const failure = results.find((result) => result.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
    return results.map((result) => (result as PromiseFulfilledResult<UploadResult>).value);
  }
}

export const uploadService = new UploadService();
