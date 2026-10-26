import { afterEach, describe, expect, it, vi } from 'vitest';
import { admissionMessage, disputeVoidMessage, SCANNER_INVALID_KEY, SCANNER_REVOKED, SCANNER_UNAVAILABLE, scannerRequest, wrongEventMessage } from '../lib/scannerClient';

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
    async function rejected(endpoint, key = 'sk_scanner_a') {
        try {
            await scannerRequest(endpoint, key, {});
        } catch (error) {
            return error;
        }
        throw new Error('expected the scanner request to fail');
    }

    it('keeps a 403 assignment body and names the event only when that body includes it', async () => {
        const assigned = { success: false, message: 'Scanner is not assigned to this event' };
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(403, assigned)));
        const rejection = await rejected('scan');
        expect(rejection).toMatchObject({
            message: 'Ticket is for a different event', status: 403, wrongEvent: true, body: assigned,
        });
        expect(rejection.forgetKey).toBeUndefined();
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

    it('clears a revoked scanner only for the pinned 403 message or a revoked code', async () => {
        const revoked = { success: false, message: 'Scanner is revoked' };
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(403, revoked)));
        const rejection = await rejected('auth');
        expect(rejection).toMatchObject({ message: SCANNER_REVOKED, status: 403, forgetKey: true, body: revoked });
        expect(rejection.wrongEvent).toBeUndefined();
        fetch.mockResolvedValueOnce(json(403, { success: false, errors: { code: 'SCANNER_REVOKED' } }));
        await expect(rejected('auth')).resolves.toMatchObject({ message: SCANNER_REVOKED, forgetKey: true });
    });

    it('clears an unknown key only for the pinned 401 message or an invalid-key code', async () => {
        const invalid = { success: false, message: 'Invalid API key' };
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(401, invalid)));
        const rejection = await rejected('auth', 'sk_scanner_missing');
        expect(rejection).toMatchObject({ message: SCANNER_INVALID_KEY, status: 401, forgetKey: true, body: invalid });
        fetch.mockResolvedValueOnce(json(401, { success: false, errors: { code: 'INVALID_API_KEY' } }));
        await expect(rejected('auth', 'sk_scanner_missing')).resolves.toMatchObject({ message: SCANNER_INVALID_KEY, forgetKey: true });
        fetch.mockResolvedValueOnce(json(401, { success: false, message: 'Unauthorized' }));
        const other = await rejected('auth', 'sk_scanner_missing');
        expect(other).toMatchObject({ message: SCANNER_UNAVAILABLE, status: 401 });
        expect(other.forgetKey).toBeUndefined();
    });

    it('keeps the saved key for other 403s, including an inactive scanner', async () => {
        vi.stubGlobal('fetch', vi.fn());
        for (const message of ['Scanner is not active', 'Scanner is disabled', 'Forbidden']) {
            const body = { success: false, message };
            fetch.mockResolvedValueOnce(json(403, body));
            const rejection = await rejected('scan');
            expect(rejection).toMatchObject({ message: SCANNER_UNAVAILABLE, status: 403, body });
            expect(rejection.forgetKey).toBeUndefined();
            expect(rejection.wrongEvent).toBeUndefined();
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
