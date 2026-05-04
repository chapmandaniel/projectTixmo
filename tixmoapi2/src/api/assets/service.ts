import { StatusCodes } from 'http-status-codes';
import prisma from '../../config/prisma';
import { logger } from '../../config/logger';
import { uploadService, UploadResult } from '../../services/upload.service';
import { ApiError } from '../../utils/ApiError';

type AssetUserContext = {
  id: string;
  organizationId: string;
  role: string;
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
    eventId: string | null;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    s3Key: string;
    s3Url: string;
    category: string | null;
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
  }) {
    return {
      id: asset.id,
      organizationId: asset.organizationId,
      eventId: asset.eventId,
      event: asset.event,
      filename: asset.filename,
      originalName: asset.originalName,
      mimeType: asset.mimeType,
      size: asset.size,
      s3Key: asset.s3Key,
      s3Url: await uploadService.resolveFileUrl(asset.s3Key, asset.s3Url),
      category: asset.category,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
      uploadedBy: asset.uploadedBy,
    };
  }

  async list(userId: string) {
    const user = await this.getUserContext(userId);

    const assets = await prisma.assetLibraryAsset.findMany({
      where: { organizationId: user.organizationId },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        event: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 250,
    });

    return {
      assets: await Promise.all(assets.map((asset) => this.serializeAsset(asset))),
    };
  }

  async upload(userId: string, files: Express.Multer.File[]) {
    const user = await this.getUserContext(userId);
    this.assertCanManageAssets(user);

    if (files.length === 0) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'At least one file is required');
    }

    const uploadedAssets = await uploadService.uploadMultiple(files, `assets/${user.organizationId}`);

    try {
      const createdAssets = await prisma.$transaction(
        uploadedAssets.map((asset) =>
          prisma.assetLibraryAsset.create({
            data: {
              organizationId: user.organizationId,
              uploadedById: user.id,
              filename: asset.filename,
              originalName: asset.originalName,
              mimeType: asset.mimeType,
              size: asset.size,
              s3Key: asset.s3Key,
              s3Url: asset.s3Url,
            },
            include: {
              uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
              event: { select: { id: true, name: true } },
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
