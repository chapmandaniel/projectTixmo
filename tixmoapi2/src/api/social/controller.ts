import { Request, Response } from 'express';
import { z } from 'zod';
import { socialCommandCenterService } from './service';
import { logger } from '../../config/logger';

const filtersSchema = z.object({
  eventId: z.string().optional(),
  artistId: z.string().optional(),
  platform: z.enum(['instagram', 'facebook', 'tiktok']).optional(),
  status: z.enum(['flagged', 'watch', 'clear', 'resolved', 'attention']).optional(),
});

const settingsSchema = z.object({
  hourlyWindowDays: z.number().int().min(1).max(5),
  dailyWindowDays: z.number().int().min(4).max(14),
  dailyUpdateHour: z.number().int().min(5).max(11),
  maxAICallsPerDay: z.number().int().min(10).max(500),
});

export class SocialCommandCenterController {
  async getCommandCenter(req: Request, res: Response) {
    try {
      const filters = filtersSchema.parse(req.query);
      return res.json({
        success: true,
        data: socialCommandCenterService.getCommandCenter(filters),
      });
    } catch (error) {
      logger.error('Social command center fetch failed:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: error.errors });
      }

      return res.status(500).json({ success: false, error: 'Failed to load social command center' });
    }
  }

  async updateSettings(req: Request, res: Response) {
    try {
      const settings = settingsSchema.parse(req.body);
      return res.json({
        success: true,
        data: socialCommandCenterService.updateSettings(settings),
      });
    } catch (error) {
      logger.error('Social settings update failed:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: error.errors });
      }

      return res.status(500).json({ success: false, error: 'Failed to update social settings' });
    }
  }

  async resolvePost(req: Request, res: Response) {
    try {
      const post = socialCommandCenterService.resolvePost(req.params.postId);

      if (!post) {
        return res.status(404).json({ success: false, error: 'Post not found' });
      }

      return res.json({
        success: true,
        data: post,
      });
    } catch (error) {
      logger.error('Resolve social post failed:', error);
      return res.status(500).json({ success: false, error: 'Failed to resolve social post' });
    }
  }

  async refreshPost(req: Request, res: Response) {
    try {
      const post = await socialCommandCenterService.refreshPost(req.params.postId);

      if (!post) {
        return res.status(404).json({ success: false, error: 'Post not found' });
      }

      return res.json({
        success: true,
        data: post,
      });
    } catch (error) {
      logger.error('Refresh social post failed:', error);

      const statusCode = typeof error === 'object' && error && 'statusCode' in error
        ? Number(error.statusCode)
        : undefined;

      if (statusCode === 429) {
        return res.status(429).json({
          success: false,
          error: error instanceof Error ? error.message : 'Daily AI analysis cap reached',
        });
      }

      return res.status(500).json({ success: false, error: 'Failed to refresh social post' });
    }
  }
}

export const socialCommandCenterController = new SocialCommandCenterController();
