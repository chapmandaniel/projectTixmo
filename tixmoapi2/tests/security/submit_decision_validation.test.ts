/* eslint-disable @typescript-eslint/unbound-method */
import request from 'supertest';
import express from 'express';
// import { StatusCodes } from 'http-status-codes';

// Mock the dependencies before importing the app or routes
jest.mock('../../src/config/prisma', () => ({
  __esModule: true,
  default: {
    approvalReviewer: {
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    approvalRequest: {
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../src/config/redis', () => ({
  getRedisClient: jest.fn().mockReturnValue({
    sendCommand: jest.fn(),
    connect: jest.fn(),
    on: jest.fn(),
  }),
}));

jest.mock('../../src/services/approval-email.service', () => ({
  approvalEmailService: {
    sendDecisionNotification: jest.fn().mockResolvedValue(true),
  },
}));

// Mock the approvalService
jest.mock('../../src/api/approvals/service', () => {
  return {
    approvalService: {
      submitDecision: jest.fn(),
      getByToken: jest.fn(),
    },
  };
});

import { approvalService } from '../../src/api/approvals/service';
import reviewRoutes from '../../src/api/review/routes';
import { errorHandler } from '../../src/middleware/errorHandler';

// Create a simple express app for testing the route
const app = express();
app.use(express.json());
app.use('/v1/review', reviewRoutes);
app.use(errorHandler);

describe('POST /v1/review/:token/decision', () => {
  const validToken = 'valid-token';
  const mockReviewer = {
    id: 'reviewer-1',
    decision: 'APPROVED',
    decisionAt: new Date(),
    decisionNote: 'Looks good',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 Bad Request for invalid decision value', async () => {
    // Mock service to ensure it's NOT called if validation works
    (approvalService.submitDecision as jest.Mock).mockResolvedValue(mockReviewer);

    const response = await request(app).post(`/v1/review/${validToken}/decision`).send({
      decision: 'INVALID_DECISION', // Invalid enum value
      note: 'Some note',
    });

    expect(response.status).toBe(400); // Bad Request
    expect(response.body).toHaveProperty('message');
    // Service should NOT be called
    expect(approvalService.submitDecision).not.toHaveBeenCalled();
  });

  it('should return 400 Bad Request for empty body', async () => {
    const response = await request(app).post(`/v1/review/${validToken}/decision`).send({});

    expect(response.status).toBe(400);
    expect(approvalService.submitDecision).not.toHaveBeenCalled();
  });

  it('should return 400 Bad Request for missing decision', async () => {
    const response = await request(app).post(`/v1/review/${validToken}/decision`).send({
      note: 'Just a note',
    });

    expect(response.status).toBe(400);
    expect(approvalService.submitDecision).not.toHaveBeenCalled();
  });

  it('should return 200 OK for valid decision', async () => {
    (approvalService.submitDecision as jest.Mock).mockResolvedValue(mockReviewer);

    const response = await request(app).post(`/v1/review/${validToken}/decision`).send({
      decision: 'APPROVED',
      note: 'Looks good',
    });

    expect(response.status).toBe(200);
    expect(approvalService.submitDecision).toHaveBeenCalledWith(
      validToken,
      'APPROVED',
      'Looks good'
    );
  });
});
