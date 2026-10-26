import {
  formatMoney,
  formatVenueAddress,
  summarizeTickets,
  venueLine,
} from '../../src/utils/receipt';

describe('Canadian money formatting', () => {
  it('formats CAD with en-CA instead of a $CAD prefix', () => {
    expect(formatMoney(50, 'cad')).toBe('$50.00');
    expect(formatMoney('50.5', 'CAD')).toBe('$50.50');
    expect(formatMoney({ toNumber: () => 12 }, 'cad')).toBe('$12.00');
    expect(formatMoney(50, 'cad')).not.toMatch(/\$CAD|CAD\s*50/);
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
