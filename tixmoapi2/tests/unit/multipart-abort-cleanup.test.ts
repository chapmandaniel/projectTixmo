import fs from 'fs';
import { PassThrough } from 'stream';
import { Request, Response } from 'express';

jest.mock('../../src/api/approvals/service', () => ({ approvalService: {} }));
jest.mock('../../src/api/assets/service', () => ({ assetLibraryService: {} }));
import {
  approvalCreateUploadMiddleware,
  approvalRevisionUploadMiddleware,
} from '../../src/api/approvals/controller';
import { assetLibraryUploadMiddleware } from '../../src/api/assets/controller';

const middlewareCases = [
  ['approval', approvalCreateUploadMiddleware],
  ['revision', approvalRevisionUploadMiddleware],
  ['asset', assetLibraryUploadMiddleware],
] as const;
const requestBody =
  '--boundary\r\nContent-Disposition: form-data; name="files"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n';
const makeRequest = () => {
  const req = new PassThrough() as PassThrough & Request;
  req.headers = {
    'content-type': 'multipart/form-data; boundary=boundary',
    'transfer-encoding': 'chunked',
  };
  return req;
};

describe('Multipart staging ownership', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each(middlewareCases)(
    'settles and removes a %s writer opened after the client aborts',
    async (_name, middleware) => {
      const originalOpen = fs.open;
      const originalWriter = fs.createWriteStream;
      let stagedPath = '',
        writer: fs.WriteStream | undefined,
        releaseOpen: (() => void) | undefined;
      let reachedOpen!: () => void;
      const opening = new Promise<void>((resolve) => {
        reachedOpen = resolve;
      });
      jest.spyOn(fs, 'createWriteStream').mockImplementation(((
        target: fs.PathLike,
        options: any
      ) => {
        writer = originalWriter(target, options);
        stagedPath = String(target);
        return writer;
      }) as typeof fs.createWriteStream);
      jest.spyOn(fs, 'open').mockImplementation(((...args: any[]) => {
        if (String(args[0]) === stagedPath) {
          releaseOpen = () => (originalOpen as any)(...args);
          reachedOpen();
        } else (originalOpen as any)(...args);
      }) as typeof fs.open);
      const req = makeRequest();
      const next = jest.fn();
      const rejected = new Promise<any>((resolve) =>
        middleware(req, {} as Response, (error) => {
          next(error);
          resolve(error);
        })
      );
      try {
        req.write(requestBody + 'unfinished payload');
        await opening;
        req.emit('aborted');
        req.destroy();
        releaseOpen!();
        const error = await rejected;
        expect(error.message).toMatch(/abort|interrupted/i);
        expect(error.storageErrors).toEqual([]);
        expect(writer?.closed).toBe(true);
        expect(fs.existsSync(stagedPath)).toBe(false);
        expect(next).toHaveBeenCalledTimes(1);
      } finally {
        writer?.destroy();
        if (fs.existsSync(stagedPath)) fs.unlinkSync(stagedPath);
      }
    }
  );

  it('preserves complete multipart files and private filesystem permissions', async () => {
    const req = makeRequest();
    const finished = new Promise<any>((resolve) =>
      assetLibraryUploadMiddleware(req, {} as Response, resolve)
    );
    req.end(requestBody + 'complete payload\r\n--boundary--\r\n');
    expect(await finished).toBeUndefined();
    const file = (req.files as Express.Multer.File[])[0];
    try {
      expect(fs.readFileSync(file.path, 'utf8')).toBe('complete payload');
      expect(fs.statSync(file.path).mode & 0o777).toBe(0o600);
      expect(file.size).toBe(Buffer.byteLength('complete payload'));
    } finally {
      fs.unlinkSync(file.path);
    }
  });
});
