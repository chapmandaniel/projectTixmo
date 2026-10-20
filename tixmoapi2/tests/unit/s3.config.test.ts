import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

describe('S3 endpoint URL style', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
    jest.resetModules();
  });

  const load = (style?: string, awsStyle?: string) => {
    jest.resetModules();
    process.env.S3_ENDPOINT = 'https://storage.test.invalid';
    process.env.S3_BUCKET_NAME = 'owned-bucket';
    process.env.S3_ACCESS_KEY_ID = 'owned-test-access';
    process.env.S3_SECRET_ACCESS_KEY = 'owned-test-secret';
    process.env.S3_REGION = 'auto';
    delete process.env.S3_URL_STYLE;
    delete process.env.AWS_S3_URL_STYLE;
    if (style) process.env.S3_URL_STYLE = style;
    if (awsStyle) process.env.AWS_S3_URL_STYLE = awsStyle;
    return require('../../src/config/s3');
  };

  it.each([
    [undefined, undefined, 'storage.test.invalid', '/owned-bucket/assets/file%20name.png'],
    ['path', undefined, 'storage.test.invalid', '/owned-bucket/assets/file%20name.png'],
    ['virtual', undefined, 'owned-bucket.storage.test.invalid', '/assets/file%20name.png'],
    [undefined, 'virtual', 'owned-bucket.storage.test.invalid', '/assets/file%20name.png'],
    ['path', 'virtual', 'storage.test.invalid', '/owned-bucket/assets/file%20name.png'],
  ])(
    'signs objects using style %s with AWS fallback %s',
    async (style, awsStyle, host, pathname) => {
      const { s3Client, S3_BUCKET, isS3Configured } = load(style, awsStyle);
      expect(isS3Configured()).toBe(true);
      const url = new URL(
        await getSignedUrl(
          s3Client,
          new GetObjectCommand({ Bucket: S3_BUCKET, Key: 'assets/file name.png' }),
          {
            expiresIn: 60,
          }
        )
      );
      expect(url.hostname).toBe(host);
      expect(url.pathname).toBe(pathname);
      expect(url.searchParams.get('X-Amz-Expires')).toBe('60');
      s3Client.destroy();
    }
  );

  it('refuses a URL style that cannot match the provider credentials', () => {
    expect(() => load('unsupported')).toThrow('S3_URL_STYLE must be path or virtual');
  });
});
