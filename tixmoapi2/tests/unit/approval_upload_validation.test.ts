import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Mock the service to avoid environment variable checks and DB connections
jest.mock('../../src/api/approvals/service', () => ({
    approvalService: {}
}));

import { uploadMiddleware } from '../../src/api/approvals/controller';

describe('Approval Upload Validation', () => {
    let app: express.Application;
    let tempFilePath: string;

    beforeAll(() => {
        app = express();

        // Error handling middleware to catch multer errors
        const errorHandler = (err: any, _req: Request, res: Response, next: NextFunction) => {
            if (err) {
                // In a real scenario, this might be mapped to a 400 Bad Request,
                // but the current implementation throws a generic Error which is caught as 500 here
                res.status(500).json({ error: err.message });
                return;
            }
            next();
        };

        app.post('/upload', uploadMiddleware, (req: Request, res: Response) => {
            res.status(200).json({ message: 'Upload successful', files: (req as any).files?.length });
        }, errorHandler);

        // Create a temporary file
        tempFilePath = path.join(os.tmpdir(), 'test-file');
        fs.writeFileSync(tempFilePath, Buffer.from('test content'));
    });

    afterAll(() => {
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
    });

    it('should accept allowed file types (e.g., image/png)', async () => {
        const response = await request(app)
            .post('/upload')
            .attach('files', tempFilePath, { filename: 'image.png', contentType: 'image/png' });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Upload successful');
    });

    it('should accept allowed file types (e.g., application/pdf)', async () => {
        const response = await request(app)
            .post('/upload')
            .attach('files', tempFilePath, { filename: 'doc.pdf', contentType: 'application/pdf' });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Upload successful');
    });

    it('should reject disallowed file types (e.g., text/plain)', async () => {
        const response = await request(app)
            .post('/upload')
            .attach('files', tempFilePath, { filename: 'text.txt', contentType: 'text/plain' });

        expect(response.status).toBe(500);
        expect(response.body.error).toContain('File type text/plain is not allowed');
    });

    it('should reject disallowed file types (e.g., application/x-msdownload)', async () => {
        const response = await request(app)
            .post('/upload')
            .attach('files', tempFilePath, { filename: 'setup.exe', contentType: 'application/x-msdownload' });

        expect(response.status).toBe(500);
        expect(response.body.error).toContain('File type application/x-msdownload is not allowed');
    });
});
