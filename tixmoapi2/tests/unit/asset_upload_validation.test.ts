// Set environment variables before imports
process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/tixmoapi?schema=public';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

jest.mock('../../src/api/assets/service', () => ({
  assetLibraryService: {},
}));

import {
  isAllowedAssetUploadType,
  sniffAssetMimeType,
} from '../../src/api/assets/controller';

describe('Asset library upload validation', () => {
  it('allows EPS logo uploads declared as PostScript', () => {
    expect(isAllowedAssetUploadType({
      originalname: 'brand-logo.eps',
      mimetype: 'application/postscript',
    })).toBe(true);
  });

  it('allows EPS logo uploads with a generic MIME type', () => {
    expect(isAllowedAssetUploadType({
      originalname: 'brand-logo.eps',
      mimetype: 'application/octet-stream',
    })).toBe(true);
  });

  it('rejects generic MIME uploads without an EPS extension', () => {
    expect(isAllowedAssetUploadType({
      originalname: 'brand-logo.bin',
      mimetype: 'application/octet-stream',
    })).toBe(false);
  });

  it('detects EPS content from its PostScript EPS header', () => {
    const epsBuffer = Buffer.from('%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 100 100\n', 'utf8');

    expect(sniffAssetMimeType(epsBuffer)).toBe('application/postscript');
  });

  it('does not treat plain PostScript as an EPS asset', () => {
    const postscriptBuffer = Buffer.from('%!PS-Adobe-3.0\n%%Pages: 1\n', 'utf8');

    expect(sniffAssetMimeType(postscriptBuffer)).toBeUndefined();
  });
});
