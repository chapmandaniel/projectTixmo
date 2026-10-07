import http from 'http';
import fs from 'fs';
import { once } from 'events';
import { PassThrough } from 'stream';
import { Request, Response } from 'express';
import { S3Client } from '@aws-sdk/client-s3';

let mockClient: S3Client;
jest.mock('../../src/config/s3', () => ({
  get s3Client() {
    return mockClient;
  },
  S3_BUCKET: 'owned-test-bucket',
  isS3Configured: () => true,
}));
jest.mock('../../src/api/assets/service', () => ({ assetLibraryService: {} }));
import { assetLibraryUploadMiddleware } from '../../src/api/assets/controller';
import { UploadService } from '../../src/services/upload.service';

describe('Multipart filenames through real S3 HTTP serialization', () => {
  let server: http.Server;
  const headers: http.IncomingHttpHeaders[] = [];
  const bodies: Buffer[] = [];
  beforeAll(async () => {
    server = http.createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      headers.push(req.headers);
      bodies.push(Buffer.concat(chunks));
      res.writeHead(200, { ETag: '"owned-test-object"' });
      res.end();
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    mockClient = new S3Client({
      endpoint: `http://127.0.0.1:${(server.address() as import('net').AddressInfo).port}`,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId: 'owned-test-key', secretAccessKey: 'owned-test-secret' },
      maxAttempts: 1,
    });
  });
  afterAll(async () => {
    mockClient.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it.each([
    ['poster%0Aapproved.png', 'poster\napproved.png'],
    ['poster%0Dapproved.png', 'poster\rapproved.png'],
    ['poster%22approved.png', 'poster"approved.png'],
    ['poster 100%.png', 'poster 100%.png'],
    ['poster.png', 'poster.png'],
  ])('uploads %s without corrupting its original name', async (wireName, originalName) => {
    const req = new PassThrough() as PassThrough & Request;
    req.headers = {
      'content-type': 'multipart/form-data; boundary=boundary',
      'transfer-encoding': 'chunked',
    };
    const parsed = new Promise<unknown>((resolve) =>
      assetLibraryUploadMiddleware(req, {} as Response, (error) => resolve(error))
    );
    req.end(
      Buffer.concat([
        Buffer.from(
          `--boundary\r\nContent-Disposition: form-data; name="files"; filename="${wireName}"\r\nContent-Type: image/png\r\n\r\n`
        ),
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.from('owned-file-content\r\n--boundary--\r\n'),
      ])
    );
    expect(await parsed).toBeUndefined();
    const file = (req.files as Express.Multer.File[])[0];
    expect(file.originalname).toBe(originalName);
    try {
      const result = await new UploadService().uploadFile(file);
      expect(result.originalName).toBe(originalName);
      expect(decodeURIComponent(String(headers.at(-1)?.['x-amz-meta-originalname']))).toBe(
        originalName
      );
      expect(headers.at(-1)?.['x-amz-meta-originalnameencoding']).toBe('uri-component');
      // SDK versions may use a streaming checksum envelope; actual content must remain.
      expect(bodies.at(-1)?.includes(Buffer.from('owned-file-content'))).toBe(true);
      expect(fs.existsSync(file.path)).toBe(false);
    } finally {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    }
  });
});
