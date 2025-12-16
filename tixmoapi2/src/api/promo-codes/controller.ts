import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { catchAsync } from '../../utils/catchAsync';
import { successResponse } from '../../utils/response';
import { ApiError } from '../../utils/ApiError';
import { promoCodeService } from './service';

export const createPromoCode = catchAsync(async (req: AuthRequest, res: Response) => {
  const payload = req.body as Parameters<typeof promoCodeService.createPromoCode>[0];
  const promoCode = await promoCodeService.createPromoCode(payload);
  res.status(201).json(successResponse(promoCode, 'Promo code created successfully'));
});

export const getPromoCode = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const promoCode = await promoCodeService.getPromoCodeById(id);

  if (!promoCode) {
    throw ApiError.notFound('Promo code not found');
  }

  res.json(successResponse(promoCode));
});

export const updatePromoCode = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const payload = req.body as Parameters<typeof promoCodeService.updatePromoCode>[1];

  const promoCode = await promoCodeService.updatePromoCode(id, payload);
  res.json(successResponse(promoCode, 'Promo code updated successfully'));
});

export const deletePromoCode = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  await promoCodeService.deletePromoCode(id);
  res.status(204).send();
});

export const listPromoCodes = catchAsync(async (req: AuthRequest, res: Response) => {
  const query = req.query as Parameters<typeof promoCodeService.listPromoCodes>[0];
  const result = await promoCodeService.listPromoCodes(query);
  res.json(successResponse(result));
});

export const validatePromoCode = catchAsync(async (req: AuthRequest, res: Response) => {
  const { code, eventId, orderAmount } = req.body as {
    code: string;
    eventId?: string;
    orderAmount?: number;
  };
  const userId = req.user!.userId;

  const result = await promoCodeService.validatePromoCode(code, userId, eventId, orderAmount);
  res.json(successResponse(result));
});
