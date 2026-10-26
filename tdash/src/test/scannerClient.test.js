import { describe, expect, it } from 'vitest';
import { admissionMessage, disputeVoidMessage, wrongEventMessage } from '../lib/scannerClient';

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
        expect(admissionMessage({ success: false, reason: 'Ticket has already been used' })).toBe('Ticket has already been used');
        expect(admissionMessage({ success: false })).toBe('Admission denied');
    });
});
