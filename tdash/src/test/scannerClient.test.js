import { afterEach, describe, expect, it, vi } from 'vitest';
import { admissionMessage, disputeVoidMessage, scannerRequest, wrongEventMessage } from '../lib/scannerClient';

describe('scanner admission messages', () => {
    it('names a different event only from the response fields', () => {
        expect(wrongEventMessage({ success: false, message: 'Scanner is not assigned to this event' })).toBe('Ticket is for a different event');
        expect(wrongEventMessage({
            success: false,
            message: 'Scanner is not assigned to this event',
            errors: { code: 'WRONG_EVENT', eventName: 'Harbor Night' },
        })).toBe('Ticket is for a different event: Harbor Night');
        expect(wrongEventMessage({ message: 'Ticket is for a different event: Late Show' })).toBe('Ticket is for a different event: Late Show');
    });

    it('maps dispute void reason codes and leaves other denials unchanged', () => {
        for (const reasonCode of ['DISPUTED', 'DISPUTE', 'VOID_DISPUTED', 'CHARGEBACK', 'VOIDED_BY_DISPUTE']) {
            expect(admissionMessage({ success: false, reasonCode, reason: 'Ticket voided' })).toBe('VOID: disputed, see gate lead');
        }
        expect(disputeVoidMessage({ status: 'VOID', voidReason: 'DISPUTE', reason: 'held' })).toBe('VOID: disputed, see gate lead');
        expect(disputeVoidMessage({ status: 'VOID', reason: 'disputed at the bank' })).toBe('VOID: disputed, see gate lead');
        expect(admissionMessage({ success: false, status: 'VOID' })).toBe('Admission denied');
        expect(admissionMessage({ success: false, reason: 'Ticket has been cancelled' })).toBe('Ticket has been cancelled');
        expect(admissionMessage({ success: false, reason: 'Ticket has already been used' })).toBe('Already used');
        expect(admissionMessage({ success: false })).toBe('Admission denied');
    });
});

describe('scanner HTTP bodies', () => {
    const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
    afterEach(() => vi.unstubAllGlobals());

    it('keeps a 403 assignment body and names the event only when that body includes it', async () => {
        const assigned = { success: false, message: 'Scanner is not assigned to this event' };
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(403, assigned)));
        await expect(scannerRequest('scan', 'sk_scanner_a', {})).rejects.toMatchObject({
            message: 'Ticket is for a different event', status: 403, wrongEvent: true, body: assigned,
        });
        const named = { success: false, message: 'Scanner is not assigned to this event', errors: { code: 'WRONG_EVENT', eventName: 'Harbor Night' } };
        fetch.mockResolvedValueOnce(json(403, named));
        await expect(scannerRequest('scan', 'sk_scanner_a', {})).rejects.toMatchObject({
            message: 'Ticket is for a different event: Harbor Night', wrongEvent: true, body: named,
        });
        fetch.mockResolvedValueOnce(json(403, { success: false, errors: { code: 'WRONG_EVENT', eventName: 'Late Show' } }));
        await expect(scannerRequest('scan', 'sk_scanner_a', {})).rejects.toMatchObject({
            message: 'Ticket is for a different event: Late Show', wrongEvent: true,
        });
    });

    it('keeps the generic text for a bad key and an inactive scanner', async () => {
        const bodies = [
            [401, { success: false, message: 'Invalid API key' }],
            [403, { success: false, message: 'Scanner is not active' }],
            [403, { success: false, message: 'Scanner is revoked' }],
        ];
        vi.stubGlobal('fetch', vi.fn());
        for (const [status, body] of bodies) {
            fetch.mockResolvedValueOnce(json(status, body));
            await expect(scannerRequest('scan', 'sk_scanner_a', {})).rejects.toMatchObject({
                message: 'Scanner key rejected or scanner unavailable. Check its assignment and active status.',
                status,
                forgetKey: true,
                body,
            });
        }
    });

    it('maps the used-ticket reason and the 409 race to Already used', async () => {
        const race = { success: false, message: 'Ticket has already been used' };
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(409, race)));
        await expect(scannerRequest('scan', 'sk_scanner_a', {})).rejects.toMatchObject({
            message: 'Already used', status: 409, alreadyUsed: true, body: race,
        });
        expect(admissionMessage({ success: false, reason: 'Ticket has already been used' })).toBe('Already used');
    });
});
