import { describe, expect, it } from 'vitest';
import {
    HST_INCLUDED_NOTE,
    PRICE_INCLUDES_NOTE,
    formatEventMoney,
    hstRegistrationLine,
} from '../lib/money';

describe('Canadian money formatting', () => {
    it('formats CAD with en-CA instead of a $CAD prefix', () => {
        expect(formatEventMoney(50, 'cad')).toBe('$50.00');
        expect(formatEventMoney('50.5', 'CAD')).toBe('$50.50');
        expect(formatEventMoney(50, 'cad')).not.toMatch(/\$CAD|CAD\s*50/);
    });

    it('keeps other currencies distinct', () => {
        expect(formatEventMoney(25, 'usd')).toBe('US$25.00');
    });

    it('shows an HST registration line only when a number is present', () => {
        expect(hstRegistrationLine('123456789RT0001')).toBe(
            'HST no. 123456789RT0001',
        );
        expect(hstRegistrationLine('')).toBe('');
        expect(hstRegistrationLine(null)).toBe('');
        expect(hstRegistrationLine('   ')).toBe('');
        expect(HST_INCLUDED_NOTE).toBe('Includes HST and all fees');
        expect(PRICE_INCLUDES_NOTE).toBe('Price includes HST and all fees.');
    });
});
