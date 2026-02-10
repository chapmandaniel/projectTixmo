import { ApiError } from '@utils/ApiError';
import { TicketTier, Prisma } from '@prisma/client';
import prisma from '../../config/prisma';

interface CreateTierInput {
    ticketTypeId: string;
    name: string;
    price: number;
    quantityLimit?: number | null;
    startsAt?: string | null;
    endsAt?: string | null;
    sortOrder?: number;
}

interface UpdateTierInput {
    name?: string;
    price?: number;
    quantityLimit?: number | null;
    startsAt?: string | null;
    endsAt?: string | null;
    sortOrder?: number;
    isActive?: boolean;
}

class TicketTierService {
    /**
     * Create a new tier for a ticket type
     */
    async createTier(data: CreateTierInput): Promise<TicketTier> {
        // Verify ticket type exists
        const ticketType = await prisma.ticketType.findUnique({
            where: { id: data.ticketTypeId },
        });

        if (!ticketType) {
            throw ApiError.notFound('Ticket type not found');
        }

        return await prisma.ticketTier.create({
            data: {
                ticketTypeId: data.ticketTypeId,
                name: data.name,
                price: new Prisma.Decimal(data.price),
                quantityLimit: data.quantityLimit ?? null,
                startsAt: data.startsAt ? new Date(data.startsAt) : null,
                endsAt: data.endsAt ? new Date(data.endsAt) : null,
                sortOrder: data.sortOrder ?? 0,
            },
        });
    }

    /**
     * Update an existing tier
     */
    async updateTier(id: string, data: UpdateTierInput): Promise<TicketTier> {
        const tier = await prisma.ticketTier.findUnique({ where: { id } });
        if (!tier) {
            throw ApiError.notFound('Ticket tier not found');
        }

        const updateData: Prisma.TicketTierUpdateInput = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.price !== undefined) updateData.price = new Prisma.Decimal(data.price);
        if (data.quantityLimit !== undefined) updateData.quantityLimit = data.quantityLimit;
        if (data.startsAt !== undefined) updateData.startsAt = data.startsAt ? new Date(data.startsAt) : null;
        if (data.endsAt !== undefined) updateData.endsAt = data.endsAt ? new Date(data.endsAt) : null;
        if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
        if (data.isActive !== undefined) updateData.isActive = data.isActive;

        return await prisma.ticketTier.update({
            where: { id },
            data: updateData,
        });
    }

    /**
     * Delete a tier (only if no tickets have been sold at this tier's price)
     */
    async deleteTier(id: string): Promise<void> {
        const tier = await prisma.ticketTier.findUnique({ where: { id } });
        if (!tier) {
            throw ApiError.notFound('Ticket tier not found');
        }

        if (tier.quantitySold > 0) {
            throw ApiError.badRequest('Cannot delete a tier that has sold tickets. Deactivate it instead.');
        }

        await prisma.ticketTier.delete({ where: { id } });
    }

    /**
     * Get a single tier by ID
     */
    async getTier(id: string): Promise<TicketTier> {
        const tier = await prisma.ticketTier.findUnique({
            where: { id },
            include: { ticketType: { select: { id: true, name: true, eventId: true } } },
        });

        if (!tier) {
            throw ApiError.notFound('Ticket tier not found');
        }

        return tier;
    }

    /**
     * List all tiers for a ticket type, ordered by sortOrder
     */
    async listTiersByTicketType(ticketTypeId: string): Promise<TicketTier[]> {
        return await prisma.ticketTier.findMany({
            where: { ticketTypeId },
            orderBy: { sortOrder: 'asc' },
        });
    }

    /**
     * Determine the currently active tier for a ticket type.
     *
     * Tier activation logic:
     *   1. Must be isActive = true
     *   2. If startsAt is set, current time must be >= startsAt
     *   3. If endsAt is set, current time must be < endsAt
     *   4. If quantityLimit is set, quantitySold must be < quantityLimit
     *   5. Among qualifying tiers, pick the one with the lowest sortOrder
     *
     * Returns null if no tier is active (falls back to base ticket type price).
     */
    async getActiveTier(ticketTypeId: string): Promise<TicketTier | null> {
        const now = new Date();

        const tiers = await prisma.ticketTier.findMany({
            where: {
                ticketTypeId,
                isActive: true,
            },
            orderBy: { sortOrder: 'asc' },
        });

        for (const tier of tiers) {
            // Check date window
            if (tier.startsAt && now < tier.startsAt) continue;
            if (tier.endsAt && now >= tier.endsAt) continue;

            // Check quantity limit
            if (tier.quantityLimit !== null && tier.quantitySold >= tier.quantityLimit) continue;

            return tier; // First qualifying tier wins
        }

        return null; // No active tier — use base price
    }

    /**
     * Reorder tiers for a ticket type
     */
    async reorderTiers(ticketTypeId: string, tierIds: string[]): Promise<TicketTier[]> {
        // Verify all tier IDs belong to this ticket type
        const existingTiers = await prisma.ticketTier.findMany({
            where: { ticketTypeId },
            select: { id: true },
        });

        const existingIds = new Set(existingTiers.map((t) => t.id));
        for (const id of tierIds) {
            if (!existingIds.has(id)) {
                throw ApiError.badRequest(`Tier ${id} does not belong to this ticket type`);
            }
        }

        // Update sort orders in a transaction
        await prisma.$transaction(
            tierIds.map((id, index) =>
                prisma.ticketTier.update({
                    where: { id },
                    data: { sortOrder: index },
                })
            )
        );

        return this.listTiersByTicketType(ticketTypeId);
    }
}

export const ticketTierService = new TicketTierService();
