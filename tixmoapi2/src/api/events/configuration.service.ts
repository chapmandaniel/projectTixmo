import { z } from 'zod';
import prisma from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { eventService } from './service';
import { ticketTypeService } from '../ticket-types/service';
import { ticketTierService } from '../ticket-tiers/service';
import { eventConfigurationSchema } from './validation';
import { StaffAudit } from '../../services/staff-action-audit';

type Configuration = z.infer<typeof eventConfigurationSchema>['body'];

export async function saveEventConfiguration(data: Configuration, id?: string, audit?: StaffAudit) {
  return prisma.$transaction(
    async (tx) => {
      if (id) await tx.$queryRaw`SELECT id FROM events WHERE id = ${id} FOR UPDATE`;
      const current = id ? await tx.event.findUnique({ where: { id } }) : null;
      if (id && !current) throw ApiError.notFound('Event not found');
      if (
        current &&
        (current.deletedAt || ['CANCELLED', 'COMPLETED', 'DELETED'].includes(current.status))
      ) {
        throw ApiError.badRequest('Cannot configure a closed or deleted event');
      }
      const event = current
        ? await eventService.updateEvent(
            current.id,
            { ...data.event, status: current.status } as Parameters<
              typeof eventService.updateEvent
            >[1],
            tx,
            audit
          )
        : await eventService.createEvent(
            { ...data.event, status: 'DRAFT' } as Parameters<typeof eventService.createEvent>[0],
            tx
          );
      // Checkout and stock transitions use the same stable type lock order.
      const existing = await tx.ticketType.findMany({
        where: { eventId: event.id },
        orderBy: { id: 'asc' },
        include: { tiers: true, _count: { select: { tickets: true } } },
      });
      for (const type of existing)
        await tx.$queryRaw`SELECT id FROM ticket_types WHERE id = ${type.id} FOR UPDATE`;
      const seenTypes = new Set<string>(),
        seenTiers = new Set<string>();
      for (const item of data.ticketTypes) {
        if (item.id && seenTypes.has(item.id)) throw ApiError.badRequest('Duplicate ticket type');
        const prior = item.id ? existing.find((type) => type.id === item.id) : undefined;
        if (item.id && !prior)
          throw ApiError.badRequest('Ticket type does not belong to this event');
        const { id: _ignoredId, tiers, ...typeData } = item;
        const saved = prior
          ? await ticketTypeService.updateTicketTypeInTransaction(tx, prior.id, typeData)
          : await ticketTypeService.createTicketType({ ...typeData, eventId: event.id }, tx);
        seenTypes.add(saved.id);
        for (const tier of tiers) {
          if (tier.id && seenTiers.has(tier.id)) throw ApiError.badRequest('Duplicate ticket tier');
          if (tier.id && !prior?.tiers.some((old) => old.id === tier.id))
            throw ApiError.badRequest('Ticket tier does not belong to this ticket type');
          const { id: _ignoredTier, ...tierData } = tier;
          const savedTier = tier.id
            ? await ticketTierService.updateTierInTransaction(tx, tier.id, tierData)
            : await ticketTierService.createTier({ ...tierData, ticketTypeId: saved.id }, tx);
          seenTiers.add(savedTier.id);
        }
        for (const old of prior?.tiers || []) {
          if (seenTiers.has(old.id)) continue;
          if (
            old.quantitySold ||
            old.quantityHeld ||
            (await tx.ticket.count({ where: { tierId: old.id } }))
          ) {
            throw ApiError.badRequest('Cannot remove an allocated tier. Deactivate it instead.');
          }
          await tx.ticketTier.delete({ where: { id: old.id } });
        }
      }
      for (const type of existing) {
        if (seenTypes.has(type.id)) continue;
        if (type._count.tickets || type.quantityHeld || type.quantitySold) {
          throw ApiError.badRequest('Cannot remove an allocated ticket type. Hide it instead.');
        }
        await tx.ticketType.delete({ where: { id: type.id } });
      }
      if (data.publish && event.status === 'DRAFT')
        return eventService.publishEvent(event.id, tx, audit);
      return tx.event.findUniqueOrThrow({ where: { id: event.id } });
    },
    { timeout: 15000 }
  );
}
