import { expect, it, vi } from 'vitest';
import { commitSalesPause, isSalesPausedError, isDefinitiveSalesControlFailure } from '../lib/salesPause';
import { checkoutTicketState } from '../lib/checkoutEligibility';
it('refreshes current state rather than applying historical replay evidence', async () => {
    const request = { paused: true, reason: 'Incident', requestId: 'same-key' };
    const api = { post: vi.fn().mockResolvedValue({ data: { eventId: 'e', requestId: request.requestId, salesPaused: true } }), get: vi.fn().mockResolvedValue({ data: { id: 'e', salesPaused: false } }) };
    expect(await commitSalesPause(api, 'e', request)).toEqual({ id: 'e', salesPaused: false });
    expect(api.post).toHaveBeenCalledWith('/events/e/sales-pause', request);
});
it('does not refresh or claim success for mismatched acknowledgement', async () => {
    const api = { post: vi.fn().mockResolvedValue({ data: {} }), get: vi.fn() };
    await expect(commitSalesPause(api, 'e', { paused: true, requestId: 'r' })).rejects.toThrow('not acknowledged');
    expect(api.get).not.toHaveBeenCalled();
});
it('recognizes only stable error envelope and distinguishes definitive rejection', () => {
    expect(isSalesPausedError({ response: { data: { errors: { code: 'SALES_PAUSED' } } } })).toBe(true);
    expect(isSalesPausedError({ response: { data: { code: 'SALES_PAUSED' } } })).toBe(false);
    expect(isDefinitiveSalesControlFailure({ response: { status: 403 } })).toBe(true);
    expect(isDefinitiveSalesControlFailure({ response: { status: 503 } })).toBe(false);
});
it.each(['ON_SALE', 'PUBLISHED'])('new selection respects paused %s without changing the underlying offer', status => {
    const ticket = { status: 'ACTIVE', tierInventoryStatus: 'READY', price: 10, quantityAvailable: 3, maxPerOrder: 2, tiers: [] };
    expect(checkoutTicketState({ status, salesPaused: true }, ticket, Date.now()).max).toBe(0);
    expect(checkoutTicketState({ status, salesPaused: false }, ticket, Date.now()).max).toBe(2);
});
