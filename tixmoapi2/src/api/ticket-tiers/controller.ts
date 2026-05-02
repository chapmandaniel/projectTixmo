import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { catchAsync } from '../../utils/catchAsync';
import { successResponse } from '../../utils/response';
import { ticketTierService } from './service';
import {
  assertTicketTierAccess,
  assertTicketTypeAccess,
  getActorScope,
} from '../../utils/tenantScope';

export const createTier = catchAsync(async (req: AuthRequest, res: Response) => {
  const actor = await getActorScope(req);
  await assertTicketTypeAccess(actor, req.body.ticketTypeId);

  const tier = await ticketTierService.createTier(req.body);
  res.status(201).json(successResponse(tier, 'Ticket tier created successfully'));
});

export const updateTier = catchAsync(async (req: AuthRequest, res: Response) => {
  const actor = await getActorScope(req);
  await assertTicketTierAccess(actor, req.params.id);

  const tier = await ticketTierService.updateTier(req.params.id, req.body);
  res.json(successResponse(tier, 'Ticket tier updated successfully'));
});

export const deleteTier = catchAsync(async (req: AuthRequest, res: Response) => {
  const actor = await getActorScope(req);
  await assertTicketTierAccess(actor, req.params.id);

  await ticketTierService.deleteTier(req.params.id);
  res.json(successResponse(null, 'Ticket tier deleted successfully'));
});

export const getTier = catchAsync(async (req: AuthRequest, res: Response) => {
  const actor = await getActorScope(req);
  await assertTicketTierAccess(actor, req.params.id);

  const tier = await ticketTierService.getTier(req.params.id);
  res.json(successResponse(tier));
});

export const listTiers = catchAsync(async (req: AuthRequest, res: Response) => {
  const actor = await getActorScope(req);
  await assertTicketTypeAccess(actor, req.query.ticketTypeId as string);

  const tiers = await ticketTierService.listTiersByTicketType(req.query.ticketTypeId as string);
  res.json(successResponse(tiers));
});

export const getActiveTier = catchAsync(async (req: AuthRequest, res: Response) => {
  const actor = await getActorScope(req);
  await assertTicketTypeAccess(actor, req.query.ticketTypeId as string);

  const tier = await ticketTierService.getActiveTier(req.query.ticketTypeId as string);
  res.json(successResponse(tier));
});

export const reorderTiers = catchAsync(async (req: AuthRequest, res: Response) => {
  const { ticketTypeId, tierIds } = req.body;
  const actor = await getActorScope(req);
  await assertTicketTypeAccess(actor, ticketTypeId);

  const tiers = await ticketTierService.reorderTiers(ticketTypeId, tierIds);
  res.json(successResponse(tiers, 'Tiers reordered successfully'));
});
