
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';

// Mock the service to avoid environment variable checks and DB connections
jest.mock('../../src/api/approvals/service', () => ({
    approvalService: {}
}));

import { uploadMiddleware } from '../../src/api/approvals/controller';
import path from 'path';
import fs from 'fs';
import os from 'os';

describe('Approval Upload Limits', () => {
    let app: express.Application;
    let tempFilePath: string;

    beforeAll(() => {
        app = express();

        // Error handling middleware to catch multer errors
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const errorHandler = (err: any, _req: Request, res: Response, next: NextFunction) => {
            if (err.code === 'LIMIT_FILE_SIZE') {
                res.status(413).json({ error: 'File too large' });
                return;
            }
            if (err.code === 'LIMIT_FILE_COUNT') {
                res.status(400).json({ error: 'Too many files' });
                return;
            }
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            next();
        };

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        app.post('/upload', uploadMiddleware, (req: Request, res: Response) => {
            res.status(200).json({ message: 'Upload successful', files: (req as any).files?.length });
        }, errorHandler);

        // Create a temporary large file (6MB)
        tempFilePath = path.join(os.tmpdir(), 'large-test-file.png');
        const buffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
        fs.writeFileSync(tempFilePath, buffer);
    });

    afterAll(() => {
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
    });

    it('should reject files larger than 5MB', async () => {
        // With current 50MB limit, this will return 200.
        // After fix (5MB limit), this should return 413.
        const response = await request(app)
            .post('/upload')
            .attach('files', tempFilePath, { contentType: 'image/png' });

        if (response.status !== 413) {
            console.log('Upload failed with:', response.status, response.body);
        }
        expect(response.status).toBe(413);
        expect(response.body.error).toBe('File too large');
    });

    it('should reject upload with more than 5 files', async () => {
         // Create a small file for this test
         const smallFilePath = path.join(os.tmpdir(), 'small-test-file.png');
         fs.writeFileSync(smallFilePath, Buffer.from('test'));

         // Attach 6 files
         // With current 10 file limit, this returns 200.
         // After fix (5 files limit), this should return 400.
         const req = request(app).post('/upload');

         for (let i = 0; i < 6; i++) {
             req.attach('files', smallFilePath, { filename: `file${i}.png`, contentType: 'image/png' });
         }

         const response = await req;

         fs.unlinkSync(smallFilePath);

         if (response.status !== 400) {
            console.log('Upload failed with:', response.status, response.body);
         }
         expect(response.status).toBe(400);
         expect(response.body.error).toBe('Too many files');
    });
});
