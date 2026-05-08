import prisma from '../../src/config/prisma';
import { assetLibraryService } from '../../src/api/assets/service';
import { uploadService } from '../../src/services/upload.service';

jest.mock('../../src/config/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
    event: {
      findFirst: jest.fn(),
    },
    assetLibraryAsset: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    assetLibraryFolder: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    assetLibraryFolderShare: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../src/services/upload.service', () => ({
  uploadService: {
    uploadMultiple: jest.fn(),
    resolveFileUrl: jest.fn(),
    deleteFile: jest.fn(),
  },
}));

const file = {
  originalname: 'Poster.png',
  mimetype: 'image/png',
  size: 1024,
} as Express.Multer.File;

const uploadedAsset = {
  filename: 'poster.png',
  originalName: 'Poster.png',
  mimeType: 'image/png',
  size: 1024,
  s3Key: 'assets/org-1/poster.png',
  s3Url: 'https://cdn.example.com/poster.png',
};

const createdAsset = {
  id: 'asset-1',
  organizationId: 'org-1',
  folderId: null,
  eventId: 'event-1',
  filename: uploadedAsset.filename,
  originalName: uploadedAsset.originalName,
  mimeType: uploadedAsset.mimeType,
  size: uploadedAsset.size,
  s3Key: uploadedAsset.s3Key,
  s3Url: uploadedAsset.s3Url,
  category: 'event',
  usageType: 'EVENT',
  createdAt: new Date('2026-05-04T12:00:00.000Z'),
  updatedAt: new Date('2026-05-04T12:00:00.000Z'),
  uploadedBy: {
    id: 'user-1',
    firstName: 'Nina',
    lastName: 'Lopez',
    email: 'nina@example.com',
  },
  event: {
    id: 'event-1',
    name: 'Summer Jam',
  },
  folder: null,
};

describe('assetLibraryService.upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      organizationId: 'org-1',
      role: 'MANAGER',
    });
    (prisma.event.findFirst as jest.Mock).mockResolvedValue({ id: 'event-1' });
    (prisma.assetLibraryFolder.findFirst as jest.Mock).mockResolvedValue(null);
    (uploadService.uploadMultiple as jest.Mock).mockResolvedValue([uploadedAsset]);
    (uploadService.resolveFileUrl as jest.Mock).mockImplementation((key, url) => Promise.resolve(url || key));
    (prisma.assetLibraryAsset.findFirst as jest.Mock).mockResolvedValue({ id: 'asset-1' });
    (prisma.assetLibraryAsset.create as jest.Mock).mockResolvedValue(createdAsset);
    (prisma.assetLibraryAsset.update as jest.Mock).mockResolvedValue(createdAsset);
    (prisma.assetLibraryAsset.delete as jest.Mock).mockResolvedValue({ id: 'asset-1' });
    (prisma.assetLibraryFolder.delete as jest.Mock).mockResolvedValue({ id: 'folder-1' });
    ((prisma as any).assetLibraryFolderShare.findMany as jest.Mock).mockResolvedValue([]);
    ((prisma as any).assetLibraryFolderShare.create as jest.Mock).mockResolvedValue({
      id: 'share-1',
      folderId: 'folder-1',
      recipientLabel: 'Agency',
      expiresAt: new Date('2026-05-18T12:00:00.000Z'),
      revokedAt: null,
      lastViewedAt: null,
      viewCount: 0,
      createdAt: new Date('2026-05-04T12:00:00.000Z'),
      updatedAt: new Date('2026-05-04T12:00:00.000Z'),
    });
    ((prisma as any).assetLibraryFolderShare.update as jest.Mock).mockResolvedValue({
      id: 'share-1',
      folderId: 'folder-1',
      recipientLabel: 'Agency',
      expiresAt: new Date('2026-05-18T12:00:00.000Z'),
      revokedAt: new Date('2026-05-05T12:00:00.000Z'),
      lastViewedAt: null,
      viewCount: 0,
      createdAt: new Date('2026-05-04T12:00:00.000Z'),
      updatedAt: new Date('2026-05-05T12:00:00.000Z'),
    });
    (prisma.$transaction as jest.Mock).mockImplementation((operations) => Promise.all(operations));
  });

  it('requires a brand or event usage type', async () => {
    await expect(assetLibraryService.upload('user-1', [file], {})).rejects.toMatchObject({
      statusCode: 400,
      message: 'Choose Brand library or Event assets before uploading',
    });

    expect(uploadService.uploadMultiple).not.toHaveBeenCalled();
  });

  it('requires an event id for event uploads', async () => {
    await expect(assetLibraryService.upload('user-1', [file], { usageType: 'EVENT' })).rejects.toMatchObject({
      statusCode: 400,
      message: 'Select an event before uploading event assets',
    });

    expect(uploadService.uploadMultiple).not.toHaveBeenCalled();
  });

  it('stores event uploads against the selected event', async () => {
    const result = await assetLibraryService.upload('user-1', [file], {
      usageType: 'EVENT',
      eventId: 'event-1',
      category: 'event',
    });

    expect(prisma.event.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'event-1',
        organizationId: 'org-1',
        deletedAt: null,
      },
      select: { id: true },
    });
    expect(prisma.assetLibraryAsset.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        organizationId: 'org-1',
        uploadedById: 'user-1',
        folderId: null,
        eventId: 'event-1',
        usageType: 'EVENT',
        category: 'event',
      }),
    }));
    expect(result.assets[0]).toMatchObject({
      id: 'asset-1',
      folderId: null,
      eventId: 'event-1',
      usageType: 'EVENT',
      category: 'event',
    });
  });

  it('uploads assets into an existing folder', async () => {
    (prisma.assetLibraryFolder.findFirst as jest.Mock).mockResolvedValue({
      id: 'folder-1',
      parentId: null,
      eventId: 'event-1',
      name: 'Artist Photos',
      category: 'photography',
      usageType: 'EVENT',
    });
    (prisma.assetLibraryAsset.create as jest.Mock).mockResolvedValue({
      ...createdAsset,
      folderId: 'folder-1',
      category: 'photography',
    });

    const result = await assetLibraryService.upload('user-1', [file], {
      folderId: 'folder-1',
    });

    expect(prisma.assetLibraryFolder.findFirst).toHaveBeenCalledWith({
      where: { id: 'folder-1', organizationId: 'org-1' },
      select: {
        id: true,
        parentId: true,
        eventId: true,
        name: true,
        category: true,
        usageType: true,
      },
    });
    expect(prisma.assetLibraryAsset.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        folderId: 'folder-1',
        eventId: 'event-1',
        usageType: 'EVENT',
        category: 'photography',
      }),
    }));
    expect(result.assets[0]).toMatchObject({
      folderId: 'folder-1',
      category: 'photography',
    });
  });

  it('creates folders inside the user organization', async () => {
    (prisma.assetLibraryFolder.create as jest.Mock).mockResolvedValue({
      id: 'folder-1',
      organizationId: 'org-1',
      parentId: null,
      eventId: 'event-1',
      name: 'Artist Photos',
      category: 'photography',
      usageType: 'EVENT',
      createdAt: new Date('2026-05-04T12:00:00.000Z'),
      updatedAt: new Date('2026-05-04T12:00:00.000Z'),
      event: { id: 'event-1', name: 'Summer Jam' },
      _count: { assets: 0, children: 0 },
    });

    const result = await assetLibraryService.createFolder('user-1', {
      name: 'Artist Photos',
      category: 'photography',
      eventId: 'event-1',
    });

    expect(prisma.assetLibraryFolder.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        organizationId: 'org-1',
        createdById: 'user-1',
        name: 'Artist Photos',
        category: 'photography',
        eventId: 'event-1',
        usageType: 'EVENT',
      }),
    }));
    expect(result.folder).toMatchObject({
      id: 'folder-1',
      name: 'Artist Photos',
      category: 'photography',
      eventId: 'event-1',
    });
  });

  it('moves uploaded assets into an existing folder', async () => {
    (prisma.assetLibraryFolder.findFirst as jest.Mock).mockResolvedValue({
      id: 'folder-1',
      parentId: null,
      eventId: 'event-1',
      name: 'Artist Photos',
      category: 'photography',
      usageType: 'EVENT',
    });
    (prisma.assetLibraryAsset.update as jest.Mock).mockResolvedValue({
      ...createdAsset,
      folderId: 'folder-1',
      category: 'photography',
      folder: {
        id: 'folder-1',
        name: 'Artist Photos',
        parentId: null,
        category: 'photography',
      },
    });

    const result = await assetLibraryService.moveAssetToFolder('user-1', 'asset-1', 'folder-1');

    expect(prisma.assetLibraryAsset.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'asset-1',
        organizationId: 'org-1',
      },
      select: { id: true },
    });
    expect(prisma.assetLibraryAsset.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'asset-1' },
      data: expect.objectContaining({
        folderId: 'folder-1',
        eventId: 'event-1',
        usageType: 'EVENT',
        category: 'photography',
      }),
    }));
    expect(result.asset).toMatchObject({
      id: 'asset-1',
      folderId: 'folder-1',
      category: 'photography',
    });
  });

  it('deletes uploaded assets and removes the backing file', async () => {
    (prisma.assetLibraryAsset.findFirst as jest.Mock).mockResolvedValue({
      id: 'asset-1',
      s3Key: 'assets/org-1/poster.png',
    });

    const result = await assetLibraryService.deleteAsset('user-1', 'asset-1');

    expect(prisma.assetLibraryAsset.delete).toHaveBeenCalledWith({
      where: { id: 'asset-1' },
    });
    expect(uploadService.deleteFile).toHaveBeenCalledWith('assets/org-1/poster.png');
    expect(result).toEqual({ id: 'asset-1', deleted: true });
  });

  it('deletes empty folders', async () => {
    (prisma.assetLibraryFolder.findFirst as jest.Mock).mockResolvedValue({
      id: 'folder-1',
      _count: {
        assets: 0,
        children: 0,
      },
    });

    const result = await assetLibraryService.deleteFolder('user-1', 'folder-1');

    expect(prisma.assetLibraryFolder.delete).toHaveBeenCalledWith({
      where: { id: 'folder-1' },
    });
    expect(result).toEqual({ id: 'folder-1', deleted: true });
  });

  it('refuses to delete non-empty folders', async () => {
    (prisma.assetLibraryFolder.findFirst as jest.Mock).mockResolvedValue({
      id: 'folder-1',
      _count: {
        assets: 1,
        children: 0,
      },
    });

    await expect(assetLibraryService.deleteFolder('user-1', 'folder-1')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Delete assets and subfolders before deleting this folder',
    });

    expect(prisma.assetLibraryFolder.delete).not.toHaveBeenCalled();
  });

  it('creates revocable external share links for saved folders', async () => {
    (prisma.assetLibraryFolder.findFirst as jest.Mock).mockResolvedValue({
      id: 'folder-1',
      parentId: null,
      eventId: null,
      name: 'Brand Photos',
      category: 'branding',
      usageType: 'BRAND',
    });

    const result = await assetLibraryService.createFolderShare('user-1', 'folder-1', {
      recipientLabel: 'Agency',
      expiresInDays: 10,
      dashboardOrigin: 'https://mightyquinton.tixmo.co',
    });

    expect((prisma as any).assetLibraryFolderShare.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-1',
        folderId: 'folder-1',
        createdById: 'user-1',
        recipientLabel: 'Agency',
      }),
    });
    expect((prisma as any).assetLibraryFolderShare.create.mock.calls[0][0].data.tokenHash).toHaveLength(64);
    expect(result.share.shareUrl).toContain('https://mightyquinton.tixmo.co/assets/shared/');
    expect(result.share.active).toBe(true);
  });

  it('revokes folder shares only inside the user organization', async () => {
    ((prisma as any).assetLibraryFolderShare.findFirst as jest.Mock).mockResolvedValue({
      id: 'share-1',
      folderId: 'folder-1',
      organizationId: 'org-1',
    });

    const result = await assetLibraryService.revokeFolderShare('user-1', 'folder-1', 'share-1');

    expect((prisma as any).assetLibraryFolderShare.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'share-1',
        folderId: 'folder-1',
        organizationId: 'org-1',
      },
    });
    expect((prisma as any).assetLibraryFolderShare.update).toHaveBeenCalledWith({
      where: { id: 'share-1' },
      data: { revokedAt: expect.any(Date) },
    });
    expect(result.share.active).toBe(false);
  });
});
