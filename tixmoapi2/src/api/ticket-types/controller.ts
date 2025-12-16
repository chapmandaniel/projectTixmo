import { Response } from 'express';
import { AuthRequest } from '@middleware/auth';
import { catchAsync } from '@utils/catchAsync';
import { successResponse } from '@utils/response';
import { ApiError } from '@utils/ApiError';
import { ticketTypeService } from './service';

export const createTicketType = catchAsync(async (req: AuthRequest, res: Response) => {
  const payload = req.body as Parameters<typeof ticketTypeService.createTicketType>[0];
  const ticketType = await ticketTypeService.createTicketType(payload);
  res.status(201).json(successResponse(ticketType, 'Ticket type created successfully'));
});

export const getTicketType = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const ticketType = await ticketTypeService.getTicketTypeById(id);

  if (!ticketType) {
    throw ApiError.notFound('Ticket type not found');
  }

  res.json(successResponse(ticketType));
});

export const updateTicketType = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const payload = req.body as Parameters<typeof ticketTypeService.updateTicketType>[1];

  const ticketType = await ticketTypeService.updateTicketType(id, payload);
  res.json(successResponse(ticketType, 'Ticket type updated successfully'));
});

export const deleteTicketType = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  await ticketTypeService.deleteTicketType(id);
  res.status(204).send();
});

export const listTicketTypes = catchAsync(async (req: AuthRequest, res: Response) => {
  const { eventId } = req.query;

  const ticketTypes = await ticketTypeService.listTicketTypesByEvent(eventId as string);
  res.json(successResponse(ticketTypes));
});

export const checkAvailability = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { quantity } = req.body as { quantity?: number };

  const isAvailable = await ticketTypeService.checkAvailability(id, quantity || 1);
  res.json(successResponse({ available: isAvailable }));
});
