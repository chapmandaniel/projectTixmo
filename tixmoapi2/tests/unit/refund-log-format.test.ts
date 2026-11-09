jest.unmock('../../src/config/logger');

import { formatLogLine } from '../../src/api/payments/refund-log-format';

const ORDER_ID = '11111111-1111-4111-8111-111111111111';

const committed = {
  level: 'info',
  event: 'refund.finalize',
  message: 'refund.finalize',
  actor: 'scheduler',
  subpath: 'interval',
  invocationId: '33333333-3333-4333-8333-333333333333',
  orderId: ORDER_ID,
  refundId: '22222222-2222-4222-8222-222222222222',
  providerRefundId: 're_testRefund123',
  attempt: 1,
  outcome: 'committed',
  reason: null,
  startedAt: '2026-11-09T00:00:00.000Z',
  finishedAt: '2026-11-09T00:00:01.000Z',
  durationMs: 1000,
  release: '82905ae',
  pid: 1,
  instanceId: 'replica-1',
};

// Railway structured filters are @attr:value against top-level JSON fields.
// The plain-text fallback is the same fields as serialized by JSON.stringify.
const RAILWAY_QUERY =
  '@event:refund.finalize @actor:scheduler @outcome:committed @orderId:11111111-1111-4111-8111-111111111111';
const PLAIN_TEXT_QUERY =
  '"event":"refund.finalize" "actor":"scheduler" "outcome":"committed" "orderId":"11111111-1111-4111-8111-111111111111"';

const captureStdout = () => {
  const written: string[] = [];
  const stdout = (console as unknown as { _stdout: NodeJS.WriteStream })._stdout;
  const write = jest.spyOn(stdout, 'write').mockImplementation((chunk) => {
    written.push(String(chunk));
    return true;
  });
  return { written, restore: () => write.mockRestore() };
};

describe('refund log serialization', () => {
  it('emits one JSON object whose fields match the Railway attribute query', () => {
    const { logger } =
      jest.requireActual<typeof import('../../src/config/logger')>('../../src/config/logger');
    const captured = captureStdout();
    logger.info(committed.message, { structuredPayload: committed });
    captured.restore();

    const line = captured.written.map((item) => item.trim()).find((item) => item.startsWith('{'));
    if (!line) throw new Error('missing json log line');
    expect(line).toBe(JSON.stringify(committed));
    const parsed = JSON.parse(line) as Record<string, unknown>;
    for (const filter of RAILWAY_QUERY.split(' ')) {
      const separator = filter.indexOf(':');
      const key = filter.slice(1, separator);
      const value = filter.slice(separator + 1);
      expect(parsed[key]).toBe(value);
    }
    for (const fragment of PLAIN_TEXT_QUERY.split(' ')) expect(line).toContain(fragment);
    expect(line).not.toContain('\u001b');
  });

  it('keeps ordinary log lines in the existing text format', () => {
    const { logger } =
      jest.requireActual<typeof import('../../src/config/logger')>('../../src/config/logger');
    const captured = captureStdout();
    logger.info('hello plain');
    captured.restore();
    expect(captured.written.join('\n')).toContain('hello plain');
    expect(captured.written.some((line) => line.trim().startsWith('{'))).toBe(false);
  });

  it('does not serialize a structured payload that carries a forbidden key', () => {
    const line = formatLogLine({
      timestamp: '2026-11-09 00:00:00:000',
      level: 'info',
      message: 'refund.finalize',
      structuredPayload: { ...committed, email: 'buyer@example.com', userId: 'staff-user-id' },
    });
    expect(line).not.toContain('buyer@example.com');
    expect(line).not.toContain('staff-user-id');
    expect(line).not.toContain('"email"');
    expect(line).toContain('refund.finalize');
  });
});
