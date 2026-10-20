import { EventEmitter } from 'events';

const load = (statusCode: number, body: string, hold = false) => {
  jest.resetModules();
  const payloads: string[] = [];
  let timeout: () => void = () => undefined;
  let activeResponse: EventEmitter | undefined;
  jest.doMock('../../src/config/environment', () => ({
    config: {
      nodeEnv: 'production',
      postmarkServerToken: 'owned-fixture-token',
      fromEmail: 'sender@test.invalid',
      fromName: 'Fixture',
      postmarkMessageStream: 'outbound',
    },
  }));
  jest.doMock('node:https', () => ({
    request: (_options: unknown, callback: (response: any) => void) => {
      const request = new EventEmitter() as any;
      request.setTimeout = (_milliseconds: number, handler: () => void) => {
        timeout = handler;
      };
      request.write = (value: string) => payloads.push(value);
      request.destroy = (error: Error) => process.nextTick(() => request.emit('error', error));
      request.end = () => {
        const startResponse = () => {
          const response = new EventEmitter() as any;
          activeResponse = response;
          response.statusCode = statusCode;
          response.setEncoding = () => undefined;
          callback(response);
          if (!hold) {
            response.emit('data', body);
            response.emit('end');
          }
        };
        if (hold) startResponse();
        else process.nextTick(startResponse);
      };
      return request;
    },
  }));
  const module = require('../../src/config/email');
  return {
    transport: module.transporter,
    payloads,
    timeout: () => timeout(),
    chunk: (value: string) => activeResponse?.emit('data', value),
  };
};

afterEach(() => {
  jest.dontMock('node:https');
  jest.dontMock('../../src/config/environment');
});

it('requires a confirmed Postmark acceptance ID and forwards reconciliation metadata', async () => {
  const data = load(200, JSON.stringify({ ErrorCode: 0, MessageID: 'owned-postmark-receipt' }));
  await expect(
    data.transport.sendMail({
      to: 'recipient@test.invalid',
      subject: 'Fixture',
      text: 'Fixture',
      metadata: { tixmoReminderId: 'reminder-fixture' },
      tag: 'approval-reminder',
      headers: { 'X-Tixmo-Reminder-ID': 'reminder-fixture' },
    })
  ).resolves.toEqual({ messageId: 'owned-postmark-receipt' });
  expect(JSON.parse(data.payloads[0])).toMatchObject({
    Metadata: { tixmoReminderId: 'reminder-fixture' },
    Tag: 'approval-reminder',
    Headers: [{ Name: 'X-Tixmo-Reminder-ID', Value: 'reminder-fixture' }],
  });
});

it.each([
  [200, '{malformed', 'UNCERTAIN', false],
  [200, JSON.stringify({ ErrorCode: 0 }), 'UNCERTAIN', false],
  [200, JSON.stringify({ ErrorCode: -1 }), 'UNCERTAIN', false],
  [200, JSON.stringify({ ErrorCode: 0.1 }), 'UNCERTAIN', false],
  [200, JSON.stringify({ ErrorCode: 300 }), 'REJECTED', false],
  [422, JSON.stringify({ ErrorCode: 300 }), 'REJECTED', false],
  [429, '{}', 'REJECTED', true],
  [503, '{}', 'UNCERTAIN', false],
])(
  'classifies provider status %s without assuming an ambiguous request was rejected',
  async (status, body, delivery, retryable) => {
    const data = load(status, body);
    await expect(
      data.transport.sendMail({ to: 'recipient@test.invalid', subject: 'Fixture', text: 'Fixture' })
    ).rejects.toMatchObject({ delivery, retryable });
  }
);

it('returns an uncertain outcome for a timeout after the request was handed off', async () => {
  const data = load(200, '', true);
  const promise = data.transport.sendMail({
    to: 'recipient@test.invalid',
    subject: 'Fixture',
    text: 'Fixture',
  });
  const assertion = expect(promise).rejects.toMatchObject({
    delivery: 'UNCERTAIN',
    retryable: false,
  });
  data.timeout();
  await assertion;
});

it('rejects an oversized response before a later end callback can reinterpret it as acceptance', async () => {
  const data = load(
    200,
    JSON.stringify({ ErrorCode: 0, MessageID: 'owned-receipt', padding: 'x'.repeat(1024 * 1024) })
  );
  await expect(
    data.transport.sendMail({ to: 'recipient@test.invalid', subject: 'Fixture', text: 'Fixture' })
  ).rejects.toMatchObject({
    delivery: 'UNCERTAIN',
    message: 'Postmark response exceeded its allowed size.',
  });
});

it('bounds total time even while response data arrives before the inactivity timeout', async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick'] });
  const data = load(200, '', true);
  let outcome: any;
  const running = data.transport
    .sendMail({ to: 'recipient@test.invalid', subject: 'Fixture', text: 'Fixture' })
    .catch((error: unknown) => {
      outcome = error;
    });
  try {
    for (let interval = 0; interval < 4; interval++) {
      await jest.advanceTimersByTimeAsync(2000);
      data.chunk(' ');
    }
    expect(outcome).toBeUndefined();
    await jest.advanceTimersByTimeAsync(2000);
    expect(outcome).toMatchObject({ delivery: 'UNCERTAIN', retryable: false });
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    data.timeout();
    await running;
    jest.useRealTimers();
  }
});
