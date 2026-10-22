import { describe, expect, it } from 'vitest';
import { checkoutTicketState } from '../lib/checkoutEligibility';

const now = Date.parse('2026-11-09T13:30:00Z');
const at = (offset) => new Date(now + offset).toISOString();
const event = { status: 'ON_SALE', salesStart: at(0), salesEnd: at(100), startDatetime: at(200) };
const ticket = { status: 'ACTIVE', tierInventoryStatus: 'READY', price: 25, maxPerOrder: 4, quantityAvailable: 8, tiers: [] };
const state = (eventChanges = {}, ticketChanges = {}, time = now) => checkoutTicketState({ ...event, ...eventChanges }, { ...ticket, ...ticketChanges }, time);

describe('checkout advisory eligibility contract', () => {
    it.each([-1, 0, 1, 99, 100, 101])('matches half-open event bounds at offset %s', (offset) => {
        expect(state({}, {}, now + offset).max).toBe(offset >= 0 && offset < 100 ? 4 : 0);
    });
    it.each(['DRAFT', 'SOLD_OUT', 'CANCELLED', 'COMPLETED', 'DELETED'])('rejects lifecycle %s', (status) => {
        expect(state({ status }).max).toBe(0);
    });
    it('preserves event-start cutoff, deletion, ticket status and inventory readiness', () => {
        expect(state({ startDatetime: at(0) }).max).toBe(0);
        expect(state({ deletedAt: at(-1) }).max).toBe(0);
        expect(state({}, { status: 'INACTIVE' }).max).toBe(0);
        expect(state({}, { tierInventoryStatus: 'PENDING' }).max).toBe(0);
    });
    it('does not let a wider ticket window extend event eligibility', () => {
        expect(state({}, { salesStart: at(-100), salesEnd: at(500) }, now + 100).max).toBe(0);
    });
    it('blocks a configured schedule when the public DTO filters every tier', () => {
        expect(state({}, { hasConfiguredTiers: true, tiers: [] }).max).toBe(0);
        expect(state({}, { hasConfiguredTiers: false, tiers: [] }).max).toBe(4);
    });
    it('blocks gaps, inactive and exhausted tiers rather than falling back to the base price', () => {
        for (const tier of [
            { isActive: false }, { isActive: true, startsAt: at(1) },
            { isActive: true, endsAt: at(0) },
            { isActive: true, quantityLimit: 2, quantitySold: 1, quantityHeld: 1 },
        ]) expect(state({}, { tiers: [tier] }).max).toBe(0);
    });
    it('keeps the minimum of stock, per-order and remaining tier capacity', () => {
        const tiers = [{ isActive: true, price: 12, quantityLimit: 8, quantitySold: 3, quantityHeld: 2 }];
        expect(state({}, { tiers })).toEqual({ price: 12, max: 3 });
        expect(state({}, { tiers, quantityAvailable: 1 }).max).toBe(1);
        expect(state({}, { tiers, maxPerOrder: 0 }).max).toBe(0);
    });
});
