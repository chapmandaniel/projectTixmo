import { describe, expect, it } from 'vitest';
import {
    HST_INCLUDED_NOTE,
    PRICE_INCLUDES_NOTE,
    formatEventMoney,
    hstAmountLine,
    hstRegistrationLine,
    includedHstAmount,
} from '../lib/money';

describe('Canadian money formatting', () => {
    it('formats CAD as CA$ from one formatter', () => {
        expect(formatEventMoney(50, 'cad')).toBe('CA$50.00');
        expect(formatEventMoney('50.5', 'CAD')).toBe('CA$50.50');
        expect(formatEventMoney(50, 'cad')).not.toMatch(/\$CAD|CAD\s*50/);
        expect(hstAmountLine(6.52, 0.15, 6.52)).toBe(`Includes HST (15%): ${formatEventMoney(6.52, 'CAD')}`);
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

    it('rounds inclusive HST to the cent once, including awkward totals', () => {
        expect(includedHstAmount(50, 0.15)).toBe(6.52);
        expect(includedHstAmount(115, 0.15)).toBe(15);
        expect(includedHstAmount(10.01, 0.15)).toBe(1.31);
        expect(includedHstAmount(19.99, 0.15)).toBe(2.61);
        expect(includedHstAmount(33.33, 0.15)).toBe(4.35);
        expect(includedHstAmount(0.01, 0.15)).toBe(0);
        expect(hstAmountLine(25, 0.15)).toBe('Includes HST (15%): CA$3.26');
    });

    it('uses a non-default rate for the amount and the percentage label', () => {
        expect(includedHstAmount(100, 0.05)).toBe(4.76);
        expect(includedHstAmount(9.99, 0.13)).toBe(1.15);
        expect(includedHstAmount(0.03, 0.2)).toBe(0.01);
        expect(hstAmountLine(25, 0.13)).toBe('Includes HST (13%): CA$2.88');
        expect(hstAmountLine(25, 0.13, 1.15)).toBe('Includes HST (13%): CA$1.15');
    });
});
