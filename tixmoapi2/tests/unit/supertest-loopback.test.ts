import http from 'http';
import net, { AddressInfo } from 'net';
import { once } from 'events';
import request from 'supertest';

it('targets its IPv6 HTTP listener when a different IPv4 service owns the same port', async () => {
  const foreign = net.createServer((socket) => socket.end('SSH-2.0-owned-fixture\r\n'));
  const owned = http.createServer((_req, res) => res.end('owned-http-response'));
  try {
    foreign.listen(0, '127.0.0.1');
    await once(foreign, 'listening');
    const port = (foreign.address() as AddressInfo).port;
    owned.listen({ port, host: '::1', ipv6Only: true });
    await once(owned, 'listening');
    const response = await request(owned).get('/');
    expect(response.status).toBe(200);
    expect(response.text).toBe('owned-http-response');
  } finally {
    if (owned.listening) await new Promise<void>((resolve) => owned.close(() => resolve()));
    if (foreign.listening) await new Promise<void>((resolve) => foreign.close(() => resolve()));
  }
});

it('continues to target an explicit IPv4 listener', async () => {
  const owned = http.createServer((_req, res) => res.end('owned-ipv4-response'));
  try {
    owned.listen(0, '127.0.0.1');
    await once(owned, 'listening');
    const response = await request(owned).get('/');
    expect(response.text).toBe('owned-ipv4-response');
  } finally {
    if (owned.listening) await new Promise<void>((resolve) => owned.close(() => resolve()));
  }
});
