import net from 'net';
import { once } from 'events';

const loadTransport = (overrides: Record<string, unknown>) => {
  jest.resetModules();
  jest.dontMock('nodemailer');
  jest.doMock('../../src/config/environment', () => ({
    config: {
      nodeEnv: 'production',
      postmarkServerToken: '',
      fromName: 'Tixmo',
      fromEmail: 'sender@example.com',
      ...overrides,
    },
  }));
  return require('../../src/config/email').transporter;
};

afterEach(() => jest.dontMock('../../src/config/environment'));

it('sends through the real JSON transport without external delivery', async () => {
  const transport = loadTransport({ nodeEnv: 'test' });
  const result = await transport.sendMail({
    to: { name: 'Test buyer', address: 'buyer@example.com' },
    subject: 'Receipt',
    text: 'Your order is recorded.',
  });
  expect(result.messageId).toMatch(/^<.+@example\.com>$/);
});

it('verifies and sends through the configured SMTP transport on owned loopback', async () => {
  const sockets = new Set<net.Socket>();
  const recipients: string[] = [];
  const messages: string[] = [];
  let authenticated = false;
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
    socket.write('220 loopback ESMTP\r\n');
    let pending = '',
      data = false,
      message = '';
    socket.on('data', (chunk) => {
      pending += chunk.toString();
      let newline;
      while ((newline = pending.indexOf('\r\n')) !== -1) {
        const line = pending.slice(0, newline);
        pending = pending.slice(newline + 2);
        if (data) {
          if (line === '.') {
            data = false;
            messages.push(message);
            socket.write('250 accepted\r\n');
          } else message += `${line}\r\n`;
        } else if (line.startsWith('EHLO') || line.startsWith('HELO')) {
          socket.write('250-loopback\r\n250 AUTH PLAIN\r\n');
        } else if (line.startsWith('AUTH PLAIN ')) {
          const credentials = Buffer.from(line.slice(11), 'base64').toString();
          authenticated = credentials === '\0test-user\0test-password';
          socket.write(authenticated ? '235 authenticated\r\n' : '535 rejected\r\n');
        } else if (line.startsWith('RCPT TO:')) {
          recipients.push(line.slice(8));
          socket.write('250 recipient accepted\r\n');
        } else if (line === 'DATA') {
          data = true;
          message = '';
          socket.write('354 send message\r\n');
        } else if (line === 'QUIT') {
          socket.end('221 goodbye\r\n');
        } else socket.write('250 OK\r\n');
      }
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const transport = loadTransport({
      emailHost: '127.0.0.1',
      emailPort: (server.address() as net.AddressInfo).port,
      emailUser: 'test-user',
      emailPassword: 'test-password',
    });
    expect(await transport.verify()).toBe(true);
    const result = await transport.sendMail({
      to: [{ name: 'Buyer', address: 'buyer@example.com' }, 'other@example.com'],
      subject: 'Recorded receipt',
      text: 'Plain receipt body',
      html: '<p>Receipt body</p>',
      headers: { 'X-Tixmo-Test': 'owned-loopback' },
    });
    expect(result.messageId).toMatch(/^<.+@example\.com>$/);
    expect(authenticated).toBe(true);
    expect(recipients).toEqual(['<buyer@example.com>', '<other@example.com>']);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('Subject: Recorded receipt');
    expect(messages[0]).toContain('X-Tixmo-Test: owned-loopback');
    expect(messages[0]).toContain('Plain receipt body');
    expect(messages[0]).toContain('<p>Receipt body</p>');
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

it.each(['rejected', 'lost-ack'])('classifies actual loopback SMTP %s after DATA', async (mode) => {
  const sockets = new Set<net.Socket>();
  let handedOff = false;
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
    socket.write('220 owned-loopback ESMTP\r\n');
    let pending = '',
      data = false;
    socket.on('data', (chunk) => {
      pending += chunk.toString();
      let newline;
      while ((newline = pending.indexOf('\r\n')) !== -1) {
        const line = pending.slice(0, newline);
        pending = pending.slice(newline + 2);
        if (data) {
          if (line === '.') {
            handedOff = true;
            if (mode === 'rejected') socket.end('451 Message not accepted\r\n');
            else socket.destroy();
          }
        } else if (line.startsWith('EHLO'))
          socket.write('250-owned-loopback\r\n250 AUTH PLAIN\r\n');
        else if (line.startsWith('AUTH')) socket.write('235 authenticated\r\n');
        else if (line === 'DATA') {
          data = true;
          socket.write('354 Send message\r\n');
        } else socket.write('250 OK\r\n');
      }
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const transport = loadTransport({
      emailHost: '127.0.0.1',
      emailPort: (server.address() as net.AddressInfo).port,
      emailUser: 'owned-user',
      emailPassword: 'owned-fixture-password',
    });
    const { classifyMailFailure } = require('../../src/services/email-delivery');
    const outcome = await transport
      .sendMail({ to: 'recipient@test.invalid', subject: 'Fixture', text: 'Owned loopback only' })
      .catch(classifyMailFailure);
    expect(handedOff).toBe(true);
    expect(outcome).toMatchObject(
      mode === 'rejected' ? { status: 'FAILED', retryable: true } : { status: 'UNCERTAIN' }
    );
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
