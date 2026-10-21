import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { ApprovalController } from '../../src/api/approvals/controller';
import { AssetLibraryController } from '../../src/api/assets/controller';
import { approvalService } from '../../src/api/approvals/service';
import { assetLibraryService } from '../../src/api/assets/service';
import { UploadService } from '../../src/services/upload.service';
import { isS3Configured, s3Client } from '../../src/config/s3';

jest.mock('../../src/api/approvals/service', () => ({
  approvalService: {
    getUserOrganizationId: jest.fn(),
    create: jest.fn(),
    createRevision: jest.fn(),
  },
}));
jest.mock('../../src/api/assets/service', () => ({ assetLibraryService: { upload: jest.fn() } }));
jest.mock('../../src/config/s3', () => ({
  S3_BUCKET: 'synthetic',
  isS3Configured: jest.fn(),
  s3Client: { send: jest.fn() },
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://test.invalid/file'),
}));

describe('Request-owned staged upload cleanup', () => {
  let directory: string;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tixmo-upload-cleanup-'));
    jest.clearAllMocks();
    jest.mocked(approvalService.getUserOrganizationId).mockResolvedValue('organization');
    jest.mocked(isS3Configured).mockReturnValue(false);
  });
  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = (name = 'fixture.png'): Express.Multer.File => {
    const target = path.join(directory, name);
    fs.writeFileSync(target, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    return {
      path: target,
      originalname: name,
      mimetype: 'image/png',
      size: 8,
    } as Express.Multer.File;
  };
  const request = (files: Express.Multer.File[], body: any = {}) =>
    ({
      user: { userId: 'user' },
      params: { id: randomUUID() },
      body,
      files,
      get: () => undefined,
    }) as any;
  const response = () =>
    ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }) as any;
  const approvalBody = () => ({
    eventId: randomUUID(),
    title: 'Fixture',
    deadline: new Date(Date.now() + 86400000).toISOString(),
    reviewers: [{ email: 'reviewer@test.invalid' }],
  });

  it('removes staged files on schema rejection, business rejection and revision rejection', async () => {
    const schema = file('schema.png'),
      next = jest.fn();
    await ApprovalController.create(request([schema]), response(), next);
    expect(next).toHaveBeenCalled();
    expect(fs.existsSync(schema.path)).toBe(false);
    const business = file('business.png');
    jest.mocked(approvalService.create).mockRejectedValueOnce(new Error('Event not found'));
    await ApprovalController.create(request([business], approvalBody()), response(), next);
    expect(fs.existsSync(business.path)).toBe(false);
    const revision = file('revision.png');
    jest
      .mocked(approvalService.createRevision)
      .mockRejectedValueOnce(new Error('Approval not found'));
    await ApprovalController.createRevision(request([revision]), response(), next);
    expect(fs.existsSync(revision.path)).toBe(false);
  });

  it('removes files on role/context rejection, signature rejection and success', async () => {
    const denied = file('denied.png'),
      next = jest.fn();
    jest.mocked(assetLibraryService.upload).mockRejectedValueOnce(new Error('Role not permitted'));
    await AssetLibraryController.upload(request([denied]), response(), next);
    expect(fs.existsSync(denied.path)).toBe(false);
    const signature = file('signature.png');
    fs.writeFileSync(signature.path, 'invalid');
    await AssetLibraryController.upload(request([signature]), response(), next);
    expect(fs.existsSync(signature.path)).toBe(false);
    const accepted = file('accepted.png');
    jest.mocked(assetLibraryService.upload).mockResolvedValueOnce({} as any);
    const res = response();
    await AssetLibraryController.upload(request([accepted]), res, next);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(fs.existsSync(accepted.path)).toBe(false);
  });

  it('cleans up service configuration failures and closes rejected S3 streams', async () => {
    const missing = file('missing-config.png'),
      original = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'development';
      await expect(new UploadService().uploadFile(missing)).rejects.toThrow('S3 is not configured');
    } finally {
      process.env.NODE_ENV = original;
    }
    expect(fs.existsSync(missing.path)).toBe(false);
    const failed = file('failed-stream.png');
    jest.mocked(isS3Configured).mockReturnValue(true);
    let stream: fs.ReadStream | undefined;
    jest.mocked(s3Client.send as any).mockImplementationOnce(async (command: any) => {
      stream = command.input.Body;
      throw new Error('S3 rejected');
    });
    await expect(new UploadService().uploadFile(failed)).rejects.toThrow('S3 rejected');
    expect(stream?.closed).toBe(true);
    expect(fs.existsSync(failed.path)).toBe(false);
  });

  it('does not release request files while a sibling upload remains unsettled', async () => {
    const first = file('first.png'),
      slow = file('slow.png'),
      service = new UploadService();
    let settle!: () => void;
    let started!: () => void;
    const uploadStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    jest.spyOn(service, 'uploadFile').mockImplementation(async (staged) => {
      if (staged === first) throw new Error('One file failed');
      await new Promise<void>((resolve) => {
        settle = resolve;
        started();
      });
      return {} as any;
    });
    jest
      .mocked(assetLibraryService.upload)
      .mockImplementationOnce(async (_user, files) => service.uploadMultiple(files) as any);
    const cleanup = jest.spyOn(fs.promises, 'unlink');
    const next = jest.fn(),
      pending = AssetLibraryController.upload(request([first, slow]), response(), next);
    try {
      await Promise.race([
        uploadStarted,
        pending.then(() => {
          throw new Error('Request settled before the sibling upload started');
        }),
      ]);
      // Let rejection handlers run without assuming any filesystem speed.
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(next).not.toHaveBeenCalled();
      expect(cleanup).not.toHaveBeenCalled();
      expect(fs.existsSync(slow.path)).toBe(true);
    } finally {
      settle?.();
      try {
        await pending;
      } finally {
        cleanup.mockRestore();
      }
    }
    expect(next).toHaveBeenCalled();
    expect(fs.existsSync(first.path)).toBe(false);
    expect(fs.existsSync(slow.path)).toBe(false);
  });
});
