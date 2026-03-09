import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';

jest.mock('../../src/api/approvals/service', () => ({
    approvalService: {},
}));

import { approvalCreateUploadMiddleware } from '../../src/api/approvals/controller';

describe('Approval upload limits', () => {
    let app: express.Application;
    let largeFilePath: string;
    let smallFilePath: string;

    beforeAll(() => {
        app = express();
        app.post(
            '/upload',
            approvalCreateUploadMiddleware,
            (_req: Request, res: Response) => {
                res.status(200).json({ ok: true });
            },
            (err: any, _req: Request, res: Response, next: NextFunction) => {
                if (!err) {
                    next();
                    return;
                }

                if (err.code === 'LIMIT_FILE_SIZE') {
                    res.status(413).json({ error: 'File too large' });
                    return;
                }

                if (err.code === 'LIMIT_FILE_COUNT') {
                    res.status(400).json({ error: 'Too many files' });
                    return;
                }

                res.status(400).json({ error: err.message });
            }
        );

        largeFilePath = path.join(os.tmpdir(), 'approval-large-file.bin');
        smallFilePath = path.join(os.tmpdir(), 'approval-small-file.bin');
        fs.writeFileSync(largeFilePath, Buffer.alloc(26 * 1024 * 1024));
        fs.writeFileSync(smallFilePath, Buffer.from('test'));
    });

    afterAll(() => {
        if (fs.existsSync(largeFilePath)) {
            fs.unlinkSync(largeFilePath);
        }

        if (fs.existsSync(smallFilePath)) {
            fs.unlinkSync(smallFilePath);
        }
    });

    it('rejects files larger than 25MB', async () => {
        const response = await request(app)
            .post('/upload')
            .attach('files', largeFilePath, {
                filename: 'huge.png',
                contentType: 'image/png',
            });

        expect(response.status).toBe(413);
        expect(response.body.error).toBe('File too large');
    });

    it('rejects more than 10 files in one request', async () => {
        const submission = request(app).post('/upload');

        for (let index = 0; index < 11; index += 1) {
            submission.attach('files', smallFilePath, {
                filename: `asset-${index}.png`,
                contentType: 'image/png',
            });
        }

        const response = await submission;

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Too many files');
    });
});
