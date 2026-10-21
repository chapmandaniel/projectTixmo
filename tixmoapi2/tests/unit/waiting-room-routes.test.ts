// Actual app and API index/selected routers; every controller/transport boundary is mocked.
// No integration setup, service imports, database, Redis connection or provider calls.
import request from 'supertest';
import { createServer } from 'node:http';
import { Request, Response, NextFunction } from 'express';
const pass = (_req: Request, _res: Response, next: NextFunction) => next();
const auth = (req: any, res: Response, next: NextFunction) => {
  if (!req.headers['x-test-role']) return res.status(401).json({ denied: 'auth' });
  req.user = { role: req.headers['x-test-role'] };
  return next();
};
const controller = jest.fn((req: Request, res: Response) => res.json({ handled: true, raw: Buffer.isBuffer(req.body), body: Buffer.isBuffer(req.body) ? req.body.toString() : undefined }));
const evalLease = jest.fn().mockResolvedValue(0);
jest.doMock('../../src/config/redis', () => ({ getRedisClient: () => ({ isReady: true, eval: evalLease, zRem: jest.fn() }) }));
jest.doMock('../../src/config/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn() } }));
jest.doMock('../../src/config/environment', () => ({ config: { nodeEnv: 'test', apiVersion: 'v1', waitingRoomMaxConcurrentRequests: 17 } }));
jest.doMock('../../src/services/readiness.service', () => ({ checkReadiness: async () => ({ database: false, redis: false }) }));
jest.doMock('../../src/config/sentry', () => ({ initSentry: jest.fn(), Sentry: {} }));
jest.doMock('../../src/config/swagger', () => ({ swaggerSpec: {} }));
jest.doMock('../../src/utils/clientOrigin', () => ({ isTrustedClientOrigin: () => true }));
jest.doMock('../../src/middleware/requestLogger', () => ({ requestLogger: pass }));
jest.doMock('../../src/middleware/rateLimiter', () => ({ apiReadRateLimiter: pass, apiWriteRateLimiter: pass, authRateLimiter: pass }));
jest.doMock('../../src/middleware/auth', () => ({ authenticate: auth, optionalAuthenticate: pass }));
jest.doMock('../../src/middleware/scannerAuth', () => ({ authenticateScanner: auth }));
jest.doMock('../../src/middleware/validate', () => ({ validate: () => (req: Request, res: Response, next: NextFunction) => req.headers['x-test-invalid'] ? res.status(400).json({ denied: 'validation' }) : next() }));
jest.doMock('../../src/middleware/errorHandler', () => ({ errorHandler: (err: any, _req: Request, res: Response, _next: NextFunction) => res.status(err.statusCode || 500).json({ error: err.message }) }));
jest.doMock('../../src/api/orders/controller', () => ({cancelOrder: controller, createOrder: controller, getConsumerOrderRecovery: controller, getOrder: controller, listMyOrders: controller, listOrders: controller, refundOrder: controller, requestRefund: controller, resendReceipt: controller}));
jest.doMock('../../src/api/payments/controller', () => ({createPaymentIntent: controller, handleWebhook: controller}));
jest.doMock('../../src/api/scanners/controller', () => ({authenticateScanner: controller, deleteScanner: controller, getScanLogs: controller, getScanner: controller, listScanners: controller, registerScanner: controller, scanTicket: controller, syncOfflineScans: controller, syncTickets: controller, updateScanner: controller}));
jest.doMock('../../src/api/tickets/controller', () => ({cancelTicket: controller, checkInTicket: controller, getTicket: controller, getTicketQRCode: controller, listMyTickets: controller, listTickets: controller, regenerateTicketQRCode: controller, transferTicket: controller, validateTicket: controller}));
jest.doMock('../../src/api/auth/controller', () => ({acceptInvitation: controller, getCurrentUser: controller, login: controller, logout: controller, refreshToken: controller, register: controller}));
jest.doMock('../../src/api/users/controller', () => ({createUser: controller, deleteUser: controller, getUser: controller, listUsers: controller, resendInvitation: controller, updateUser: controller}));
jest.doMock('../../src/api/organizations/controller', () => ({addMember: controller, createOrganization: controller, deleteOrganization: controller, getOrganization: controller, listOrganizations: controller, removeMember: controller, updateOrganization: controller}));
jest.doMock('../../src/api/waitlists/routes', () => require('express').Router());
jest.doMock('../../src/api/reports/routes', () => require('express').Router());
jest.doMock('../../src/api/approvals/routes', () => require('express').Router());
jest.doMock('../../src/api/ticket-types/routes', () => require('express').Router());
jest.doMock('../../src/api/notifications/routes', () => require('express').Router());
jest.doMock('../../src/api/analytics/routes', () => require('express').Router());
jest.doMock('../../src/api/promo-codes/routes', () => require('express').Router());
jest.doMock('../../src/api/review/routes', () => require('express').Router());
jest.doMock('../../src/api/tasks/routes', () => require('express').Router());
jest.doMock('../../src/api/assets/routes', () => require('express').Router());
jest.doMock('../../src/api/venues/routes', () => require('express').Router());
jest.doMock('../../src/api/ticket-tiers/routes', () => require('express').Router());
jest.doMock('../../src/api/events/routes', () => require('express').Router());
jest.doMock('../../src/api/events/public.routes', () => require('express').Router());
const app = require('../../src/app').default;
// QA416 harness only: explicit authorized loopback listener, OS-assigned port.
const server = createServer(app);
beforeAll(async () => { await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); });
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); expect(server.listening).toBe(false); });
const scanners: [string, string][] = [
  ['post', '/scanners/register'], ['post', '/scanners/auth'], ['get', '/scanners/sync'],
  ['post', '/scanners/validate'], ['get', '/scanners'], ['post', '/scanners/scan'],
  ['get', '/scanners/logs'], ['get', '/scanners/id'], ['put', '/scanners/id'], ['delete', '/scanners/id'],
];
const send = (method: string, path: string, role?: string, invalid = false) => {
  const req = (request(server) as any)[method](path);
  if (role) req.set('x-test-role', role);
  if (invalid) req.set('x-test-invalid', 'yes');
  return req;
};
beforeEach(() => { evalLease.mockClear(); controller.mockClear(); });
it.each(['/orders', '/orders/?query=1', '/payments/create-intent', '/payments/create-intent/?query=1'])('only target POST %s admits after fences', async path => {
  expect((await send('post', '/api/v1' + path)).status).toBe(401);
  expect(evalLease).not.toHaveBeenCalled();
  expect((await send('post', '/api/v1' + path, 'OWNER', true)).status).toBe(400);
  expect(evalLease).not.toHaveBeenCalled();
  const response = await send('post', '/api/v1' + path, 'OWNER');
  expect(response.status).toBe(503);
  expect(response.body.code).toBe('WAITING_ROOM_ACTIVE');
  expect(Number(response.headers['retry-after'])).toBe(response.body.retryAfter);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(evalLease).toHaveBeenCalledTimes(1);
  expect(controller).not.toHaveBeenCalled();
});
it.each(scanners)('%s %s bypasses while preserving auth and authorized handler', async (method, path) => {
  const publicAuth = path === '/scanners/auth';
  expect((await send(method, '/api/v1' + path)).status).toBe(publicAuth ? 200 : 401);
  expect((await send(method, '/api/v1' + path, 'OWNER')).status).toBe(200);
  expect(evalLease).not.toHaveBeenCalled();
});
it.each(scanners.filter(([,path]) => ['/scanners/register','/scanners','/scanners/logs','/scanners/id'].includes(path)))('%s %s retains role denial', async (method, path) => {
  expect((await send(method, '/api/v1' + path, 'CUSTOMER')).status).toBe(403);
  expect(evalLease).not.toHaveBeenCalled();
});
it('scanner PUT retains validation and does not acquire', async () => {
  expect((await send('put', '/api/v1/scanners/id', 'OWNER', true)).status).toBe(400);
  expect(controller).not.toHaveBeenCalled();
  expect(evalLease).not.toHaveBeenCalled();
});
it.each([
  ['post', '/auth/accept-invitation'], ['post','/auth/register'], ['post','/auth/login'],
  ['post','/auth/refresh'], ['post','/auth/logout'], ['get','/auth/me'],
  ['post','/tickets/validate'], ['post','/tickets/check-in'], ['delete','/users/id'],
  ['delete','/organizations/id'], ['get','/orders'], ['get','/orders/mine'], ['get','/orders/id'],
  ['post','/orders/id/cancel'], ['post','/orders/id/refund'], ['post','/orders/id/request-refund'], ['post','/orders/id/receipt'],
])('%s %s non-target bypasses', async (method, path) => {
  expect((await send(method, '/api/v1' + path, 'OWNER')).status).toBe(200);
  expect(evalLease).not.toHaveBeenCalled();
});
it.each([['delete','/users/id'], ['delete','/organizations/id'], ['post','/orders/id/refund']])('admin %s %s retains denial', async (method, path) => {
  expect((await send(method, '/api/v1' + path)).status).toBe(401);
  expect((await send(method, '/api/v1' + path, 'CUSTOMER')).status).toBe(403);
  expect(evalLease).not.toHaveBeenCalled();
});
it.each([['/health',200], ['/ready',503], ['/api/v1/health',200], ['/metrics',404], ['/unknown',404], ['/api/v1/docs/',200]])('operational/docs %s bypasses', async (path, status) => {
  expect((await request(server).get(path as string)).status).toBe(status);
  expect(evalLease).not.toHaveBeenCalled();
});
it('webhook receives exact raw body at mocked signature/controller boundary while full', async () => {
  const body = '{ "id": "evt_test", "preserve": true }';
  const response = await request(server).post('/api/v1/payments/webhook').set('Content-Type', 'application/json').send(body);
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ handled: true, raw: true, body });
  expect(evalLease).not.toHaveBeenCalled();
});

it.each([
  ['post','/auth/logout'], ['get','/auth/me'], ['post','/tickets/validate'], ['post','/tickets/check-in'],
  ['get','/orders'], ['get','/orders/id'], ['post','/orders/id/cancel'], ['post','/orders/id/receipt'],
])('protected non-target %s %s retains authentication', async (method, path) => {
  expect((await send(method, '/api/v1' + path)).status).toBe(401);
  expect(evalLease).not.toHaveBeenCalled();
});
