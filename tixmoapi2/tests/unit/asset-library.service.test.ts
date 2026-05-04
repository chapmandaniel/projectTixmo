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
      create: jest.fn(),
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
    (uploadService.uploadMultiple as jest.Mock).mockResolvedValue([uploadedAsset]);
    (uploadService.resolveFileUrl as jest.Mock).mockImplementation((key, url) => Promise.resolve(url || key));
    (prisma.assetLibraryAsset.create as jest.Mock).mockResolvedValue(createdAsset);
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
        eventId: 'event-1',
        usageType: 'EVENT',
        category: 'event',
      }),
    }));
    expect(result.assets[0]).toMatchObject({
      id: 'asset-1',
      eventId: 'event-1',
      usageType: 'EVENT',
      category: 'event',
    });
  });
});
