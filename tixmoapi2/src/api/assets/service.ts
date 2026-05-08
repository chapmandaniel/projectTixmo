import { StatusCodes } from 'http-status-codes';
import { createHash, randomBytes } from 'crypto';
import prisma from '../../config/prisma';
import { config } from '../../config/environment';
import { logger } from '../../config/logger';
import { uploadService, UploadResult } from '../../services/upload.service';
import { ApiError } from '../../utils/ApiError';

type AssetUserContext = {
  id: string;
  organizationId: string;
  role: string;
};

type AssetLibraryUsageType = 'BRAND' | 'EVENT';

type AssetUploadContext = {
  usageType?: string;
  eventId?: string;
  category?: string;
  folderId?: string;
};

type NormalizedAssetUploadContext = {
  usageType: AssetLibraryUsageType;
  eventId: string | null;
  category: string | null;
  folderId: string | null;
};

type CreateFolderInput = {
  name?: string;
  parentId?: string;
  eventId?: string;
  category?: string;
};

type CreateFolderShareInput = {
  recipientLabel?: string;
  expiresInDays?: number;
  dashboardOrigin?: string;
};

const normalizeUsageType = (value: string | null | undefined, eventId?: string | null): AssetLibraryUsageType => {
  const usageType = String(value || '').trim().toUpperCase();
  return usageType === 'EVENT' || eventId ? 'EVENT' : 'BRAND';
};

const FOLDER_SHARE_DEFAULT_DAYS = 14;
const FOLDER_SHARE_MAX_DAYS = 90;

const assetLibraryFolderShare = (prisma as any).assetLibraryFolderShare;

const hashShareToken = (token: string) => createHash('sha256').update(token).digest('hex');

const buildFolderShareUrl = (token: string, dashboardOrigin?: string) => {
  const baseUrl = dashboardOrigin || config.clientUrl;
  return new URL(`/assets/shared/${token}`, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
};

const normalizeShareExpiry = (value?: number) => {
  const days = Number.isFinite(value) ? Number(value) : FOLDER_SHARE_DEFAULT_DAYS;
  const clampedDays = Math.min(Math.max(Math.round(days), 1), FOLDER_SHARE_MAX_DAYS);
  return new Date(Date.now() + clampedDays * 24 * 60 * 60 * 1000);
};

class AssetLibraryService {
  private async getUserContext(userId: string): Promise<AssetUserContext> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        organizationId: true,
        role: true,
      },
    });

    if (!user || !user.organizationId) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'User does not belong to an organization');
    }

    return {
      id: user.id,
      organizationId: user.organizationId,
      role: user.role,
    };
  }

  private assertCanManageAssets(user: AssetUserContext): void {
    if (!['ADMIN', 'OWNER', 'MANAGER', 'PROMOTER'].includes(user.role)) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'Only organization operators can manage asset library uploads');
    }
  }

  private async serializeAsset(asset: {
    id: string;
    organizationId: string;
    folderId: string | null;
    eventId: string | null;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    s3Key: string;
    s3Url: string;
    category: string | null;
    usageType: string;
    createdAt: Date;
    updatedAt: Date;
    uploadedBy: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    event: {
      id: string;
      name: string;
    } | null;
    folder?: {
      id: string;
      name: string;
      parentId: string | null;
      category: string | null;
    } | null;
  }) {
    return {
      id: asset.id,
      organizationId: asset.organizationId,
      folderId: asset.folderId,
      folder: asset.folder || null,
      eventId: asset.eventId,
      event: asset.event,
      filename: asset.filename,
      originalName: asset.originalName,
      mimeType: asset.mimeType,
      size: asset.size,
      s3Key: asset.s3Key,
      s3Url: await uploadService.resolveFileUrl(asset.s3Key, asset.s3Url),
      category: asset.category,
      usageType: asset.usageType,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
      uploadedBy: asset.uploadedBy,
    };
  }

  private serializeFolder(folder: {
    id: string;
    organizationId: string;
    parentId: string | null;
    eventId: string | null;
    name: string;
    category: string | null;
    usageType: string;
    createdAt: Date;
    updatedAt: Date;
    event?: { id: string; name: string } | null;
    _count?: { assets: number; children: number };
  }) {
    return {
      id: folder.id,
      organizationId: folder.organizationId,
      parentId: folder.parentId,
      eventId: folder.eventId,
      event: folder.event || null,
      name: folder.name,
      category: folder.category,
      usageType: folder.usageType,
      assetCount: folder._count?.assets || 0,
      childCount: folder._count?.children || 0,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
    };
  }

  private serializeFolderShare(share: {
    id: string;
    folderId: string;
    recipientLabel: string | null;
    expiresAt: Date;
    revokedAt: Date | null;
    lastViewedAt: Date | null;
    viewCount: number;
    createdAt: Date;
    updatedAt: Date;
    token?: string;
  }, dashboardOrigin?: string) {
    const active = !share.revokedAt && share.expiresAt > new Date();

    return {
      id: share.id,
      folderId: share.folderId,
      recipientLabel: share.recipientLabel,
      expiresAt: share.expiresAt,
      revokedAt: share.revokedAt,
      lastViewedAt: share.lastViewedAt,
      viewCount: share.viewCount,
      createdAt: share.createdAt,
      updatedAt: share.updatedAt,
      active,
      shareUrl: share.token ? buildFolderShareUrl(share.token, dashboardOrigin) : undefined,
    };
  }

  private async serializePublicAsset(asset: {
    id: string;
    folderId: string | null;
    eventId: string | null;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    s3Key: string;
    s3Url: string;
    category: string | null;
    usageType: string;
    createdAt: Date;
    updatedAt: Date;
    event: {
      id: string;
      name: string;
    } | null;
    folder?: {
      id: string;
      name: string;
      parentId: string | null;
      category: string | null;
    } | null;
  }) {
    return {
      id: asset.id,
      folderId: asset.folderId,
      folder: asset.folder || null,
      eventId: asset.eventId,
      event: asset.event,
      filename: asset.filename,
      originalName: asset.originalName,
      mimeType: asset.mimeType,
      size: asset.size,
      s3Url: await uploadService.resolveFileUrl(asset.s3Key, asset.s3Url),
      category: asset.category,
      usageType: asset.usageType,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    };
  }

  private async getFolderForOrganization(folderId: string, organizationId: string) {
    return prisma.assetLibraryFolder.findFirst({
      where: { id: folderId, organizationId },
      select: {
        id: true,
        parentId: true,
        eventId: true,
        name: true,
        category: true,
        usageType: true,
      },
    });
  }

  private async normalizeUploadContext(
    user: AssetUserContext,
    context: AssetUploadContext
  ): Promise<NormalizedAssetUploadContext> {
    if (context.folderId?.trim()) {
      const folder = await this.getFolderForOrganization(context.folderId.trim(), user.organizationId);

      if (!folder) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Folder not found for this organization');
      }

      return {
        usageType: normalizeUsageType(folder.usageType, folder.eventId),
        eventId: folder.eventId,
        category: folder.category || folder.name.trim().toLowerCase(),
        folderId: folder.id,
      };
    }

    const usageType = String(context.usageType || '').trim().toUpperCase();

    if (usageType !== 'BRAND' && usageType !== 'EVENT') {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Choose Brand library or Event assets before uploading');
    }

    const category = context.category?.trim() || (usageType === 'BRAND' ? 'branding' : null);

    if (usageType === 'BRAND') {
      return {
        usageType,
        eventId: null,
        category,
        folderId: null,
      };
    }

    const eventId = context.eventId?.trim();
    if (!eventId) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Select an event before uploading event assets');
    }

    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        organizationId: user.organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!event) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Event not found for this organization');
    }

    return {
      usageType,
      eventId,
      category,
      folderId: null,
    };
  }

  async list(userId: string) {
    const user = await this.getUserContext(userId);

    const assets = await prisma.assetLibraryAsset.findMany({
      where: { organizationId: user.organizationId },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        event: { select: { id: true, name: true } },
        folder: { select: { id: true, name: true, parentId: true, category: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 250,
    });

    const folders = await prisma.assetLibraryFolder.findMany({
      where: { organizationId: user.organizationId },
      include: {
        event: { select: { id: true, name: true } },
        _count: { select: { assets: true, children: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
      take: 250,
    });

    return {
      folders: folders.map((folder) => this.serializeFolder(folder)),
      assets: await Promise.all(assets.map((asset) => this.serializeAsset(asset))),
    };
  }

  async createFolder(userId: string, input: CreateFolderInput) {
    const user = await this.getUserContext(userId);
    this.assertCanManageAssets(user);

    const name = input.name?.trim();
    if (!name) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Folder name is required');
    }

    let parentFolder: Awaited<ReturnType<AssetLibraryService['getFolderForOrganization']>> = null;
    if (input.parentId?.trim()) {
      parentFolder = await this.getFolderForOrganization(input.parentId.trim(), user.organizationId);
      if (!parentFolder) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Parent folder not found for this organization');
      }
    }

    const eventId = input.eventId?.trim() || parentFolder?.eventId || null;
    if (eventId) {
      const event = await prisma.event.findFirst({
        where: {
          id: eventId,
          organizationId: user.organizationId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!event) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Event not found for this organization');
      }
    }

    const category = input.category?.trim() || parentFolder?.category || name.trim().toLowerCase();
    const usageType = eventId ? 'EVENT' : 'BRAND';
    const folder = await prisma.assetLibraryFolder.create({
      data: {
        organizationId: user.organizationId,
        parentId: parentFolder?.id || null,
        eventId,
        createdById: user.id,
        name,
        category,
        usageType,
      },
      include: {
        event: { select: { id: true, name: true } },
        _count: { select: { assets: true, children: true } },
      },
    });

    return {
      folder: this.serializeFolder(folder),
    };
  }

  async moveAssetToFolder(userId: string, assetId: string, folderId: string) {
    const user = await this.getUserContext(userId);
    this.assertCanManageAssets(user);

    const normalizedAssetId = assetId?.trim();
    const normalizedFolderId = folderId?.trim();

    if (!normalizedAssetId || !normalizedFolderId) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Asset and folder are required');
    }

    const folder = await this.getFolderForOrganization(normalizedFolderId, user.organizationId);
    if (!folder) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Folder not found for this organization');
    }

    const asset = await prisma.assetLibraryAsset.findFirst({
      where: {
        id: normalizedAssetId,
        organizationId: user.organizationId,
      },
      select: { id: true },
    });

    if (!asset) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Asset not found for this organization');
    }

    const movedAsset = await prisma.assetLibraryAsset.update({
      where: { id: normalizedAssetId },
      data: {
        folderId: folder.id,
        eventId: folder.eventId,
        usageType: normalizeUsageType(folder.usageType, folder.eventId),
        category: folder.category || folder.name.trim().toLowerCase(),
      },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        event: { select: { id: true, name: true } },
        folder: { select: { id: true, name: true, parentId: true, category: true } },
      },
    });

    return {
      asset: await this.serializeAsset(movedAsset),
    };
  }

  async deleteAsset(userId: string, assetId: string) {
    const user = await this.getUserContext(userId);
    this.assertCanManageAssets(user);

    const normalizedAssetId = assetId?.trim();
    if (!normalizedAssetId) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Asset is required');
    }

    const asset = await prisma.assetLibraryAsset.findFirst({
      where: {
        id: normalizedAssetId,
        organizationId: user.organizationId,
      },
      select: {
        id: true,
        s3Key: true,
      },
    });

    if (!asset) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Asset not found for this organization');
    }

    await prisma.assetLibraryAsset.delete({
      where: { id: normalizedAssetId },
    });

    try {
      await uploadService.deleteFile(asset.s3Key);
    } catch (error) {
      logger.error(`Failed to delete asset library file ${asset.s3Key}: ${(error as Error).message}`);
    }

    return { id: normalizedAssetId, deleted: true };
  }

  async deleteFolder(userId: string, folderId: string) {
    const user = await this.getUserContext(userId);
    this.assertCanManageAssets(user);

    const normalizedFolderId = folderId?.trim();
    if (!normalizedFolderId) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Folder is required');
    }

    const folder = await prisma.assetLibraryFolder.findFirst({
      where: {
        id: normalizedFolderId,
        organizationId: user.organizationId,
      },
      select: {
        id: true,
        _count: {
          select: {
            assets: true,
            children: true,
          },
        },
      },
    });

    if (!folder) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Folder not found for this organization');
    }

    if (folder._count.assets > 0 || folder._count.children > 0) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Delete assets and subfolders before deleting this folder');
    }

    await prisma.assetLibraryFolder.delete({
      where: { id: normalizedFolderId },
    });

    return { id: normalizedFolderId, deleted: true };
  }

  async listFolderShares(userId: string, folderId: string, dashboardOrigin?: string) {
    const user = await this.getUserContext(userId);
    this.assertCanManageAssets(user);

    const normalizedFolderId = folderId?.trim();
    if (!normalizedFolderId) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Folder is required');
    }

    const folder = await this.getFolderForOrganization(normalizedFolderId, user.organizationId);
    if (!folder) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Folder not found for this organization');
    }

    const shares = await assetLibraryFolderShare.findMany({
      where: {
        folderId: normalizedFolderId,
        organizationId: user.organizationId,
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });

    return {
      shares: shares.map((share: any) => this.serializeFolderShare(share, dashboardOrigin)),
    };
  }

  async createFolderShare(userId: string, folderId: string, input: CreateFolderShareInput) {
    const user = await this.getUserContext(userId);
    this.assertCanManageAssets(user);

    const normalizedFolderId = folderId?.trim();
    if (!normalizedFolderId) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Folder is required');
    }

    const folder = await this.getFolderForOrganization(normalizedFolderId, user.organizationId);
    if (!folder) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Folder not found for this organization');
    }

    const token = randomBytes(32).toString('base64url');
    const share = await assetLibraryFolderShare.create({
      data: {
        organizationId: user.organizationId,
        folderId: normalizedFolderId,
        createdById: user.id,
        tokenHash: hashShareToken(token),
        recipientLabel: input.recipientLabel?.trim() || null,
        expiresAt: normalizeShareExpiry(input.expiresInDays),
      },
    });

    return {
      share: this.serializeFolderShare({ ...share, token }, input.dashboardOrigin),
    };
  }

  async revokeFolderShare(userId: string, folderId: string, shareId: string) {
    const user = await this.getUserContext(userId);
    this.assertCanManageAssets(user);

    const normalizedFolderId = folderId?.trim();
    const normalizedShareId = shareId?.trim();
    if (!normalizedFolderId || !normalizedShareId) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Folder and share are required');
    }

    const share = await assetLibraryFolderShare.findFirst({
      where: {
        id: normalizedShareId,
        folderId: normalizedFolderId,
        organizationId: user.organizationId,
      },
    });

    if (!share) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Folder share not found for this organization');
    }

    const revokedShare = await assetLibraryFolderShare.update({
      where: { id: normalizedShareId },
      data: { revokedAt: new Date() },
    });

    return {
      share: this.serializeFolderShare(revokedShare),
    };
  }

  private async collectDescendantFolderIds(folderId: string, organizationId: string) {
    const folderIds = [folderId];
    let pendingIds = [folderId];

    while (pendingIds.length > 0 && folderIds.length < 250) {
      const children = await prisma.assetLibraryFolder.findMany({
        where: {
          organizationId,
          parentId: { in: pendingIds },
        },
        select: { id: true },
        take: 250,
      });

      pendingIds = children
        .map((folder) => folder.id)
        .filter((id) => !folderIds.includes(id));
      folderIds.push(...pendingIds);
    }

    return folderIds;
  }

  async getSharedFolder(token: string) {
    const normalizedToken = token?.trim();
    if (!normalizedToken) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Invalid or expired folder share link');
    }

    const now = new Date();
    const share = await assetLibraryFolderShare.findUnique({
      where: { tokenHash: hashShareToken(normalizedToken) },
      include: {
        organization: { select: { id: true, name: true } },
        folder: {
          include: {
            event: { select: { id: true, name: true } },
            _count: { select: { assets: true, children: true } },
          },
        },
      },
    });

    if (!share || share.revokedAt || share.expiresAt <= now) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Invalid or expired folder share link');
    }

    const folderIds = await this.collectDescendantFolderIds(share.folderId, share.organizationId);

    const [folders, assets] = await Promise.all([
      prisma.assetLibraryFolder.findMany({
        where: {
          organizationId: share.organizationId,
          id: { in: folderIds },
        },
        include: {
          event: { select: { id: true, name: true } },
          _count: { select: { assets: true, children: true } },
        },
        orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
      }),
      prisma.assetLibraryAsset.findMany({
        where: {
          organizationId: share.organizationId,
          folderId: { in: folderIds },
        },
        include: {
          event: { select: { id: true, name: true } },
          folder: { select: { id: true, name: true, parentId: true, category: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 250,
      }),
    ]);

    await assetLibraryFolderShare.update({
      where: { id: share.id },
      data: {
        lastViewedAt: now,
        viewCount: { increment: 1 },
      },
    });

    return {
      share: {
        id: share.id,
        recipientLabel: share.recipientLabel,
        expiresAt: share.expiresAt,
      },
      organization: {
        name: share.organization.name,
      },
      folder: this.serializeFolder(share.folder),
      folders: folders.map((folder) => this.serializeFolder(folder)),
      assets: await Promise.all(assets.map((asset) => this.serializePublicAsset(asset))),
    };
  }

  async upload(userId: string, files: Express.Multer.File[], context: AssetUploadContext) {
    const user = await this.getUserContext(userId);
    this.assertCanManageAssets(user);

    if (files.length === 0) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'At least one file is required');
    }

    const uploadContext = await this.normalizeUploadContext(user, context);
    const uploadedAssets = await uploadService.uploadMultiple(files, `assets/${user.organizationId}`);

    try {
      const createdAssets = await prisma.$transaction(
        uploadedAssets.map((asset) =>
          prisma.assetLibraryAsset.create({
            data: {
              organizationId: user.organizationId,
              uploadedById: user.id,
              folderId: uploadContext.folderId,
              eventId: uploadContext.eventId,
              filename: asset.filename,
              originalName: asset.originalName,
              mimeType: asset.mimeType,
              size: asset.size,
              s3Key: asset.s3Key,
              s3Url: asset.s3Url,
              usageType: uploadContext.usageType,
              category: uploadContext.category,
            },
            include: {
              uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
              event: { select: { id: true, name: true } },
              folder: { select: { id: true, name: true, parentId: true, category: true } },
            },
          })
        )
      );

      return {
        assets: await Promise.all(createdAssets.map((asset) => this.serializeAsset(asset))),
      };
    } catch (error) {
      await this.deleteUploadedFiles(uploadedAssets);
      throw error;
    }
  }

  private async deleteUploadedFiles(uploadedAssets: UploadResult[]) {
    await Promise.all(uploadedAssets.map(async (asset) => {
      try {
        await uploadService.deleteFile(asset.s3Key);
      } catch (error) {
        logger.error(`Failed to roll back asset library upload ${asset.s3Key}: ${(error as Error).message}`);
      }
    }));
  }
}

export const assetLibraryService = new AssetLibraryService();
