import { formatHealthRelease } from '../../src/config/healthRelease';

const FULL_SHA = '0123456789abcdef0123456789abcdef01234567';

describe('formatHealthRelease', () => {
  it('shortens a 40-character git SHA to 7 characters', () => {
    expect(FULL_SHA).toHaveLength(40);
    expect(formatHealthRelease(FULL_SHA)).toBe('0123456');
  });

  it('keeps a short SHA', () => {
    expect(formatHealthRelease('abc1234')).toBe('abc1234');
  });

  it('normalizes uppercase hex to lowercase', () => {
    expect(formatHealthRelease('ABCDEF0123456789ABCDEF0123456789ABCDEF01')).toBe('abcdef0');
    expect(formatHealthRelease('ABC1234')).toBe('abc1234');
  });

  it('passes a non-SHA release label through', () => {
    expect(formatHealthRelease('api@1.4.2')).toBe('api@1.4.2');
  });

  it('returns null when the release is unset', () => {
    expect(formatHealthRelease(undefined)).toBeNull();
    expect(formatHealthRelease(null)).toBeNull();
    expect(formatHealthRelease('   ')).toBeNull();
  });

  it('trims whitespace before classifying the value', () => {
    expect(formatHealthRelease(`  ${FULL_SHA}  `)).toBe('0123456');
    expect(formatHealthRelease('  api@1.4.2  ')).toBe('api@1.4.2');
  });

  it('caps a long non-SHA label at 64 characters', () => {
    const label = `release-${'x'.repeat(80)}`;
    const formatted = formatHealthRelease(label);

    expect(formatted).toBe(label.slice(0, 64));
    expect(formatted).toHaveLength(64);
  });
});
