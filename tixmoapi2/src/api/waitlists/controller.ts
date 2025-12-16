import { Response, NextFunction } from 'express';
import { waitlistService } from './service';
import { successResponse } from '../../utils/response';
import { AuthRequest } from '../../middleware/auth';
import { z } from 'zod';

// Validation schemas
const joinWaitlistSchema = z.object({
  body: z.object({
    eventId: z.string().uuid(),
  }),
});

const leaveWaitlistSchema = z.object({
  body: z.object({
    eventId: z.string().uuid(),
  }),
});

/**
 * Join waitlist
 */
export const joinWaitlist = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { eventId } = req.body;
    const userId = req.user!.userId;

    const waitlistEntry = await waitlistService.joinWaitlist(userId, eventId);
    res.status(201).json(successResponse(waitlistEntry, 'Joined waitlist successfully'));
  } catch (error) {
    console.error('Join Waitlist Error:', error);
    next(error);
  }
};

/**
 * Leave waitlist
 */
export const leaveWaitlist = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { eventId } = req.body;
    const userId = req.user!.userId;

    await waitlistService.leaveWaitlist(userId, eventId);
    res.json(successResponse(null, 'Left waitlist successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get waitlist status
 */
export const getWaitlistStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const eventId = req.query.eventId as string;
    const userId = req.user!.userId;

    if (!eventId) {
      res.status(400).json({ success: false, message: 'eventId query parameter is required' });
      return;
    }

    const status = await waitlistService.getWaitlistStatus(userId, eventId);
    res.json(successResponse(status, 'Waitlist status retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

export { joinWaitlistSchema, leaveWaitlistSchema };
