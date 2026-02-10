import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { catchAsync } from '../../utils/catchAsync';
import { successResponse } from '../../utils/response';
import { ticketTierService } from './service';

export const createTier = catchAsync(async (req: AuthRequest, res: Response) => {
    const tier = await ticketTierService.createTier(req.body);
    res.status(201).json(successResponse(tier, 'Ticket tier created successfully'));
});

export const updateTier = catchAsync(async (req: AuthRequest, res: Response) => {
    const tier = await ticketTierService.updateTier(req.params.id, req.body);
    res.json(successResponse(tier, 'Ticket tier updated successfully'));
});

export const deleteTier = catchAsync(async (req: AuthRequest, res: Response) => {
    await ticketTierService.deleteTier(req.params.id);
    res.json(successResponse(null, 'Ticket tier deleted successfully'));
});

export const getTier = catchAsync(async (req: AuthRequest, res: Response) => {
    const tier = await ticketTierService.getTier(req.params.id);
    res.json(successResponse(tier));
});

export const listTiers = catchAsync(async (req: AuthRequest, res: Response) => {
    const tiers = await ticketTierService.listTiersByTicketType(req.query.ticketTypeId as string);
    res.json(successResponse(tiers));
});

export const getActiveTier = catchAsync(async (req: AuthRequest, res: Response) => {
    const tier = await ticketTierService.getActiveTier(req.query.ticketTypeId as string);
    res.json(successResponse(tier));
});

export const reorderTiers = catchAsync(async (req: AuthRequest, res: Response) => {
    const { ticketTypeId, tierIds } = req.body;
    const tiers = await ticketTierService.reorderTiers(ticketTypeId, tierIds);
    res.json(successResponse(tiers, 'Tiers reordered successfully'));
});
