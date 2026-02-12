import request from 'supertest';
import express from 'express';
import paymentRouter from '../../src/api/payments/routes';

// Mock dependencies
jest.mock('../../src/api/payments/service');
jest.mock('../../src/middleware/auth', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { userId: 'mock-user-id', role: 'CUSTOMER' };
    next();
  },
}));

// Mock logger to avoid noise
jest.mock('../../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Create a minimal app for testing
const app = express();
app.use(express.json());
app.use('/api/v1/payments', paymentRouter);

// Error handler to catch errors from async handlers
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: any, res: any, _next: any) => {
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message,
    errors: err.errors, // For validation errors
  });
});

describe('Payment Validation Security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 Bad Request when orderId is missing', async () => {
    const res = await request(app)
      .post('/api/v1/payments/create-intent')
      .send({}); // Empty body

    console.log('Missing orderId response:', res.status, res.body);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Validation failed');
  });

  it('should return 400 Bad Request when orderId is invalid type', async () => {
    const res = await request(app)
      .post('/api/v1/payments/create-intent')
      .send({ orderId: 12345 });

    console.log('Invalid orderId response:', res.status, res.body);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Validation failed');
  });

  it('should return 400 Bad Request when orderId is invalid UUID', async () => {
    const res = await request(app)
      .post('/api/v1/payments/create-intent')
      .send({ orderId: 'invalid-uuid' });

    console.log('Invalid UUID response:', res.status, res.body);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Validation failed');
  });
});
