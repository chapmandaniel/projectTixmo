import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';

jest.mock('../../src/api/approvals/service', () => ({
    approvalService: {},
}));

import { approvalCreateUploadMiddleware } from '../../src/api/approvals/controller';

describe('Approval upload validation', () => {
    let app: express.Application;
    let tempFilePath: string;

    beforeAll(() => {
        app = express();
        app.post(
            '/upload',
            approvalCreateUploadMiddleware,
            (req: Request, res: Response) => {
                res.status(200).json({ files: (req.files as Express.Multer.File[]).length });
            },
            (err: Error, _req: Request, res: Response, next: NextFunction) => {
                if (!err) {
                    next();
                    return;
                }

                res.status(400).json({ error: err.message });
            }
        );

        tempFilePath = path.join(os.tmpdir(), 'approval-upload-test.bin');
        fs.writeFileSync(tempFilePath, Buffer.from('test'));
    });

    afterAll(() => {
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
    });

    it('accepts png uploads', async () => {
        const response = await request(app)
            .post('/upload')
            .attach('files', tempFilePath, {
                filename: 'asset.png',
                contentType: 'image/png',
            });

        expect(response.status).toBe(200);
        expect(response.body.files).toBe(1);
    });

    it('rejects unsupported mime types', async () => {
        const response = await request(app)
            .post('/upload')
            .attach('files', tempFilePath, {
                filename: 'asset.txt',
                contentType: 'text/plain',
            });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('File type text/plain is not allowed');
    });
});
