import { Response } from 'express';
import { catchAsync } from '../../utils/catchAsync';
import { successResponse } from '../../utils/response';
import { AuthRequest } from '../../middleware/auth';
import { getActorScope, requireOrganizationId } from '../../utils/tenantScope';
import { vendorImportService } from '../../services/vendors/import-service';
import { receiveShowpassWebhook } from '../../services/vendors/webhook-inbox';

const organizationIdFrom = async (req: AuthRequest) => {
  const actor = await getActorScope(req);
  return requireOrganizationId(actor, req.params.organizationId);
};

export const connect = catchAsync(async (req: AuthRequest, res: Response) => {
  const organizationId = await organizationIdFrom(req);
  const connection = await vendorImportService.connect(
    organizationId,
    req.body as { apiKey: string; vendorVenueId: string; webhookSecret?: string }
  );
  res.status(201).json(successResponse(connection, 'Showpass connected'));
});

export const show = catchAsync(async (req: AuthRequest, res: Response) => {
  const organizationId = await organizationIdFrom(req);
  res.json(successResponse(await vendorImportService.getConnection(organizationId)));
});

export const saveConfig = catchAsync(async (req: AuthRequest, res: Response) => {
  const organizationId = await organizationIdFrom(req);
  res.json(
    successResponse(
      await vendorImportService.saveConfig(
        organizationId,
        req.body as {
          vendorVenueId: string;
          currency?: string;
          timezone?: string | null;
          syncIntervalMinutes?: number;
          vendorOwnedFields?: string[];
          ticketTypeMappings?: Array<{ externalTicketTypeId: string; tierName: string }>;
          webhookSecret?: string;
        }
      )
    )
  );
});

export const preview = catchAsync(async (req: AuthRequest, res: Response) => {
  const organizationId = await organizationIdFrom(req);
  const vendorVenueId = typeof req.query.vendorVenueId === 'string' ? req.query.vendorVenueId : '';
  res.json(successResponse(await vendorImportService.preview(organizationId, vendorVenueId)));
});

export const importEvents = catchAsync(async (req: AuthRequest, res: Response) => {
  const organizationId = await organizationIdFrom(req);
  const body = req.body as { vendorVenueId: string; externalItemIds: string[] };
  const result = await vendorImportService.importEvents(
    organizationId,
    body.vendorVenueId,
    body.externalItemIds
  );
  res.status(201).json(successResponse(result, 'Showpass events imported'));
});

export const sync = catchAsync(async (req: AuthRequest, res: Response) => {
  const organizationId = await organizationIdFrom(req);
  res.json(successResponse(await vendorImportService.syncOrganization(organizationId)));
});

export const soldCounts = catchAsync(async (req: AuthRequest, res: Response) => {
  const organizationId = await organizationIdFrom(req);
  const eventId = typeof req.query.eventId === 'string' ? req.query.eventId : undefined;
  res.json(successResponse(await vendorImportService.listSoldCounts(organizationId, eventId)));
});

export const webhook = catchAsync(async (req: AuthRequest, res: Response) => {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
  res.json(successResponse(await receiveShowpassWebhook(raw, req.headers)));
});
