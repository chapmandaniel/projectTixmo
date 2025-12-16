import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { catchAsync } from '../../utils/catchAsync';
import { successResponse } from '../../utils/response';
import { ApiError } from '../../utils/ApiError';
import { ticketService } from './service';

export const listTickets = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.role === 'ADMIN' ? undefined : req.user!.userId;

  const result = await ticketService.listTickets({
    ...req.query,
    userId,
  });

  res.json(successResponse(result));
});

export const getTicket = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.role === 'ADMIN' ? undefined : req.user!.userId;

  const ticket = await ticketService.getTicketById(id, userId);

  if (!ticket) {
    throw ApiError.notFound('Ticket not found');
  }

  res.json(successResponse(ticket));
});

export const transferTicket = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { recipientEmail } = req.body as { recipientEmail: string };
  const userId = req.user!.userId;

  const ticket = await ticketService.transferTicket(id, userId, recipientEmail);
  res.json(successResponse(ticket, 'Ticket transferred successfully'));
});

export const cancelTicket = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.userId;

  const ticket = await ticketService.cancelTicket(id, userId);
  res.json(successResponse(ticket, 'Ticket cancelled successfully'));
});

export const validateTicket = catchAsync(async (req: AuthRequest, res: Response) => {
  const { barcode } = req.body as { barcode: string };

  const result = await ticketService.validateTicket(barcode);
  res.json(successResponse(result));
});

export const checkInTicket = catchAsync(async (req: AuthRequest, res: Response) => {
  const { barcode } = req.body as { barcode: string };
  const checkedInBy = req.user!.email;

  const ticket = await ticketService.checkInTicket(barcode, checkedInBy);
  res.json(successResponse(ticket, 'Ticket checked in successfully'));
});

export const getTicketQRCode = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.role === 'ADMIN' ? undefined : req.user!.userId;

  const qrCodeDataUrl = await ticketService.getTicketQRCode(id, userId);

  res.json(successResponse({ qrCode: qrCodeDataUrl }, 'QR code retrieved successfully'));
});

export const regenerateTicketQRCode = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.role === 'ADMIN' ? undefined : req.user!.userId;

  const qrCodeDataUrl = await ticketService.regenerateTicketQRCode(id, userId);

  res.json(successResponse({ qrCode: qrCodeDataUrl }, 'QR code regenerated successfully'));
});
