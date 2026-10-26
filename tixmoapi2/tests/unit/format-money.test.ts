import {
  formatHstAmountLine,
  formatMoney,
  formatVenueAddress,
  includedHstAmount,
  receiptDisclosure,
  receiptHstAmount,
  summarizeTickets,
  venueLine,
} from '../../src/utils/receipt';

describe('Canadian money formatting', () => {
  it('formats CAD as CA$ from one formatter', () => {
    expect(formatMoney(50, 'cad')).toBe('CA$50.00');
    expect(formatMoney('50.5', 'CAD')).toBe('CA$50.50');
    expect(formatMoney({ toNumber: () => 12 }, 'cad')).toBe('CA$12.00');
    expect(formatMoney(-2, 'cad')).toBe('-CA$2.00');
    expect(formatMoney(50, 'cad')).not.toMatch(/\$CAD|CAD\s*50/);
    expect(formatHstAmountLine(6.52, 0.15)).toBe(`Includes HST (15%): ${formatMoney(6.52, 'CAD')}`);
  });

  it('keeps other currencies distinct', () => {
    expect(formatMoney(25, 'usd')).toBe('US$25.00');
  });

  it('rejects amounts that are not finite', () => {
    expect(() => formatMoney('nope', 'cad')).toThrow('Invalid money amount');
  });

  it('formats a venue the same way the storefront does', () => {
    expect(
      formatVenueAddress({
        street: '1 Harbour Dr',
        city: "St. John's",
        state: 'NL',
        postalCode: 'A1C 1A1',
        country: 'Canada',
      })
    ).toBe("1 Harbour Dr, St. John's, NL, A1C 1A1, Canada");
    expect(venueLine('Signal Hall', "1 Harbour Dr, St. John's")).toBe(
      "Signal Hall, 1 Harbour Dr, St. John's"
    );
    expect(venueLine('', '')).toBe('Venue to be announced');
  });

  it('rounds inclusive HST to the cent once, including awkward totals', () => {
    expect(includedHstAmount(50, 0.15)).toBe(6.52);
    expect(includedHstAmount('115', 0.15)).toBe(15);
    expect(includedHstAmount({ toNumber: () => 10.01 }, 0.15)).toBe(1.31);
    expect(includedHstAmount(19.99, 0.15)).toBe(2.61);
    expect(includedHstAmount(33.33, 0.15)).toBe(4.35);
    expect(includedHstAmount(0.01, 0.15)).toBe(0);
    expect(formatHstAmountLine(6.52, 0.15)).toBe('Includes HST (15%): CA$6.52');
    expect(receiptHstAmount(50, 0.15, 6.52)).toBe(6.52);
    expect(receiptHstAmount(50, 0.15, 0)).toBe(includedHstAmount(50, 0.15));
    expect(receiptHstAmount(50, 0.15, null)).toBe(includedHstAmount(50, 0.15));
    expect(receiptDisclosure(50).hstAmount).toBe(
      includedHstAmount(50, receiptDisclosure(50).hstRate)
    );
  });

  it('uses a non-default HST rate for the amount and the label', () => {
    const previousRate = process.env.TIXMO_HST_RATE;
    const previousNumber = process.env.TIXMO_HST_NUMBER;
    jest.resetModules();
    try {
      process.env.TIXMO_HST_RATE = '0.05';
      process.env.TIXMO_HST_NUMBER = '123456789RT0001';
      const loaded = require('../../src/utils/receipt') as typeof import('../../src/utils/receipt');
      expect(loaded.includedHstAmount(100, 0.05)).toBe(4.76);
      expect(loaded.includedHstAmount(9.99, 0.13)).toBe(1.15);
      expect(loaded.includedHstAmount(0.03, 0.2)).toBe(0.01);
      expect(loaded.includedHstAmount(0.01, 1)).toBe(0.01);
      expect(loaded.receiptDisclosure(100)).toMatchObject({ hstRate: 0.05, hstAmount: 4.76 });
      expect(loaded.formatHstAmountLine(4.76, 0.05)).toBe('Includes HST (5%): CA$4.76');
      expect(loaded.formatHstAmountLine(2.88, 0.13)).toBe('Includes HST (13%): CA$2.88');
    } finally {
      if (previousRate === undefined) delete process.env.TIXMO_HST_RATE;
      else process.env.TIXMO_HST_RATE = previousRate;
      if (previousNumber === undefined) delete process.env.TIXMO_HST_NUMBER;
      else process.env.TIXMO_HST_NUMBER = previousNumber;
      jest.resetModules();
    }
  });

  it('summarizes ticket quantities by type', () => {
    expect(
      summarizeTickets([
        { ticketType: { name: 'General Admission' } },
        { ticketType: { name: 'General Admission' } },
        { ticketType: { name: 'VIP' } },
      ])
    ).toBe('2 × General Admission, 1 × VIP');
  });
});
