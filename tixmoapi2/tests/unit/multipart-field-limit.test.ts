import { PassThrough } from 'stream';
import { Request, Response } from 'express';

jest.mock('../../src/api/approvals/service', () => ({ approvalService: {} }));
jest.mock('../../src/api/assets/service', () => ({ assetLibraryService: {} }));
import {
  approvalCreateUploadMiddleware,
  approvalRevisionUploadMiddleware,
} from '../../src/api/approvals/controller';
import { assetLibraryUploadMiddleware } from '../../src/api/assets/controller';

const routes = [
  ['approval', approvalCreateUploadMiddleware],
  ['revision', approvalRevisionUploadMiddleware],
  ['asset', assetLibraryUploadMiddleware],
] as const;

const parse = async (middleware: (typeof routes)[number][1], fields: [string, string][]) => {
  const req = new PassThrough() as PassThrough & Request;
  req.headers = {
    'content-type': 'multipart/form-data; boundary=boundary',
    'transfer-encoding': 'chunked',
  };
  const finished = new Promise<Error | undefined>((resolve) =>
    middleware(req, {} as Response, (error) => resolve(error))
  );
  req.end(
    fields
      .map(
        ([key, value]) =>
          `--boundary\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`
      )
      .join('') + '--boundary--\r\n'
  );
  return { req, error: await finished };
};

describe.each(routes)('%s multipart field boundary', (_route, middleware) => {
  it.each(['items[1001]', 'items[4294967294]', 'items[00001001]', 'items[0][1001]'])(
    'rejects %s before constructing a sparse array',
    async (name) => {
      const { req, error } = await parse(middleware, [
        [name, 'first'],
        ['items[x]', 'second'],
      ]);
      expect(error).toMatchObject({ code: 'LIMIT_FIELD_ARRAY_INDEX' });
      expect(Array.isArray(req.body.items)).toBe(false);
      expect(req.body.items?.['1001']).toBeUndefined();
      expect(req.body.items?.['0']).toBeUndefined();
    }
  );

  it('preserves scalar metadata, JSON reviewers and ordinary bracket-index arrays', async () => {
    const reviewers = JSON.stringify([{ email: 'reviewer@example.com', association: 'AGENT' }]);
    const { req, error } = await parse(middleware, [
      ['title', 'Actual approval'],
      ['summary', 'Revision summary'],
      ['folderId', 'folder-1'],
      ['reviewers', reviewers],
      ['contacts[0][email]', 'staff@example.com'],
    ]);
    expect(error).toBeUndefined();
    expect(req.body).toMatchObject({
      title: 'Actual approval',
      summary: 'Revision summary',
      folderId: 'folder-1',
      reviewers,
      contacts: [{ email: 'staff@example.com' }],
    });
  });
});
