import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { catchAsync } from '../../utils/catchAsync';
import { successResponse } from '../../utils/response';
import { ApiError } from '../../utils/ApiError';
import { venueService } from './service';

export const createVenue = catchAsync(async (req: AuthRequest, res: Response) => {
  const payload = req.body as Parameters<typeof venueService.createVenue>[0];
  const venue = await venueService.createVenue(payload);
  res.status(201).json(successResponse(venue, 'Venue created successfully'));
});

export const getVenue = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const venue = await venueService.getVenueById(id);

  if (!venue) {
    throw ApiError.notFound('Venue not found');
  }

  res.json(successResponse(venue));
});

export const updateVenue = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const payload = req.body as Parameters<typeof venueService.updateVenue>[1];

  const venue = await venueService.updateVenue(id, payload);
  res.json(successResponse(venue, 'Venue updated successfully'));
});

export const deleteVenue = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  await venueService.deleteVenue(id);
  res.status(204).send();
});

export const listVenues = catchAsync(async (req: AuthRequest, res: Response) => {
  const query = req.query as Record<string, unknown>;
  const result = await venueService.listVenues(query);
  res.json(successResponse(result));
});
