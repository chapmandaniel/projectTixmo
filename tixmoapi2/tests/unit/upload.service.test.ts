import { UploadService } from '../../src/services/upload.service';
import { s3Client, isS3Configured } from '../../src/config/s3';
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import { unlink } from 'fs/promises';
import { randomUUID } from 'crypto';

// Mock dependencies
jest.mock('../../src/config/s3', () => ({
    s3Client: {
        send: jest.fn(),
    },
    isS3Configured: jest.fn(),
    S3_BUCKET: 'test-bucket',
}));

jest.mock('@aws-sdk/client-s3', () => ({
    PutObjectCommand: jest.fn(),
    GetObjectCommand: jest.fn(),
    DeleteObjectCommand: jest.fn(),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
    getSignedUrl: jest.fn(),
}));

jest.mock('fs', () => ({
    createReadStream: jest.fn(),
}));

jest.mock('fs/promises', () => ({
    unlink: jest.fn(),
}));

jest.mock('crypto', () => ({
    randomUUID: jest.fn(),
}));

describe('UploadService', () => {
    let uploadService: UploadService;
    const mockUuid = '123e4567-e89b-12d3-a456-426614174000';

    beforeEach(() => {
        jest.clearAllMocks();

        // Default mocks
        (isS3Configured as jest.Mock).mockReturnValue(true);
        (randomUUID as jest.Mock).mockReturnValue(mockUuid);
        (getSignedUrl as jest.Mock).mockResolvedValue('https://s3.example.com/signed-url');
        (s3Client.send as jest.Mock).mockResolvedValue({});

        // Re-instantiate service to ensure fresh state if needed, though here it's stateless regarding deps
        uploadService = new UploadService();
    });

    describe('uploadFile', () => {
        const mockBufferFile = {
            originalname: 'test-image.png',
            mimetype: 'image/png',
            buffer: Buffer.from('test-content'),
            size: 1024,
        } as Express.Multer.File;

        const mockStreamFile = {
            originalname: 'test-document.pdf',
            mimetype: 'application/pdf',
            path: '/tmp/test-document.pdf',
            size: 2048,
        } as Express.Multer.File;

        it('should throw error if S3 is not configured', async () => {
            (isS3Configured as jest.Mock).mockReturnValue(false);

            await expect(uploadService.uploadFile(mockBufferFile))
                .rejects
                .toThrow('S3 is not configured');
        });

        it('should upload file from buffer successfully', async () => {
            const folder = 'test-folder';
            const expectedKey = `${folder}/${mockUuid}.png`;

            const result = await uploadService.uploadFile(mockBufferFile, folder);

            // Verify PutObjectCommand
            expect(PutObjectCommand).toHaveBeenCalledWith({
                Bucket: 'test-bucket',
                Key: expectedKey,
                Body: mockBufferFile.buffer,
                ContentType: mockBufferFile.mimetype,
                Metadata: {
                    originalName: mockBufferFile.originalname,
                },
            });

            // Verify s3 send
            expect(s3Client.send).toHaveBeenCalledTimes(1);
            expect(s3Client.send).toHaveBeenCalledWith(expect.any(PutObjectCommand)); // Since we mocked the constructor, checks instance

            // Verify getSignedUrl
            expect(GetObjectCommand).toHaveBeenCalledWith({
                Bucket: 'test-bucket',
                Key: expectedKey,
            });
            expect(getSignedUrl).toHaveBeenCalledWith(s3Client, expect.any(GetObjectCommand), { expiresIn: 3600 });

            // Verify result
            expect(result).toEqual({
                s3Key: expectedKey,
                s3Url: 'https://s3.example.com/signed-url',
                filename: `${mockUuid}.png`,
                originalName: mockBufferFile.originalname,
                mimeType: mockBufferFile.mimetype,
                size: mockBufferFile.size,
            });
        });

        it('should upload file from path (stream) successfully and delete temp file', async () => {
            const mockStream = { pipe: jest.fn() };
            (fs.createReadStream as jest.Mock).mockReturnValue(mockStream);
            (unlink as jest.Mock).mockResolvedValue(undefined);

            const result = await uploadService.uploadFile(mockStreamFile);
            const expectedKey = `approvals/${mockUuid}.pdf`; // Default folder

            // Verify fs usage
            expect(fs.createReadStream).toHaveBeenCalledWith(mockStreamFile.path);

            // Verify PutObjectCommand with stream
            expect(PutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
                Body: mockStream,
                Key: expectedKey,
            }));

            // Verify cleanup
            expect(unlink).toHaveBeenCalledWith(mockStreamFile.path);

            expect(result.s3Key).toBe(expectedKey);
        });

        it('should throw error if file content is empty', async () => {
            const emptyFile = {
                originalname: 'empty.txt',
                mimetype: 'text/plain',
            } as Express.Multer.File;

            await expect(uploadService.uploadFile(emptyFile))
                .rejects
                .toThrow('File content is empty');
        });

        it('should throw error if S3 upload fails', async () => {
            const error = new Error('S3 Error');
            (s3Client.send as jest.Mock).mockRejectedValue(error);
            (unlink as jest.Mock).mockResolvedValue(undefined);

            await expect(uploadService.uploadFile(mockBufferFile))
                .rejects
                .toThrow('S3 Error');
        });

        it('should log error but not throw if temp file deletion fails', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            (fs.createReadStream as jest.Mock).mockReturnValue({});
            (unlink as jest.Mock).mockRejectedValue(new Error('Unlink failed'));

            await uploadService.uploadFile(mockStreamFile);

            expect(unlink).toHaveBeenCalledWith(mockStreamFile.path);
            expect(consoleSpy).toHaveBeenCalledWith('Failed to delete temp file:', expect.any(Error));

            consoleSpy.mockRestore();
        });
    });

    describe('getSignedUrl', () => {
        it('should return signed URL', async () => {
            const s3Key = 'test/file.png';
            const result = await uploadService.getSignedUrl(s3Key, 1800);

            expect(GetObjectCommand).toHaveBeenCalledWith({
                Bucket: 'test-bucket',
                Key: s3Key,
            });
            expect(getSignedUrl).toHaveBeenCalledWith(s3Client, expect.any(GetObjectCommand), { expiresIn: 1800 });
            expect(result).toBe('https://s3.example.com/signed-url');
        });
    });

    describe('deleteFile', () => {
        it('should delete file from S3', async () => {
            const s3Key = 'test/file.png';
            await uploadService.deleteFile(s3Key);

            expect(DeleteObjectCommand).toHaveBeenCalledWith({
                Bucket: 'test-bucket',
                Key: s3Key,
            });
            expect(s3Client.send).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
        });
    });

    describe('uploadMultiple', () => {
        it('should upload multiple files', async () => {
            const files = [
                {
                    originalname: 'file1.png',
                    mimetype: 'image/png',
                    buffer: Buffer.from('1'),
                },
                {
                    originalname: 'file2.png',
                    mimetype: 'image/png',
                    buffer: Buffer.from('2'),
                },
            ] as Express.Multer.File[];

            // Spy on uploadFile to verify it's called
            const uploadFileSpy = jest.spyOn(uploadService, 'uploadFile');
            // We need to mock the implementation or ensure the underlying mocks work.
            // Since underlying mocks are set up, the real method will run and succeed.

            const results = await uploadService.uploadMultiple(files, 'multi-folder');

            expect(uploadFileSpy).toHaveBeenCalledTimes(2);
            expect(uploadFileSpy).toHaveBeenCalledWith(files[0], 'multi-folder');
            expect(uploadFileSpy).toHaveBeenCalledWith(files[1], 'multi-folder');
            expect(results).toHaveLength(2);
        });
    });
});
