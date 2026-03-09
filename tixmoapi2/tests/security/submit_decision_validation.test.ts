import express from 'express';
import request from 'supertest';

jest.mock('../../src/api/approvals/service', () => ({
    approvalService: {
        submitDecisionByToken: jest.fn(),
    },
}));

import reviewRoutes from '../../src/api/review/routes';
import { errorHandler } from '../../src/middleware/errorHandler';
import { approvalService } from '../../src/api/approvals/service';

const app = express();
app.use(express.json());
app.use('/v1/review', reviewRoutes);
app.use(errorHandler);

describe('Review decision validation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('rejects unknown decision values', async () => {
        const response = await request(app)
            .post('/v1/review/token-123/decisions')
            .send({
                decision: 'REJECTED',
            });

        expect(response.status).toBe(400);
        expect(approvalService.submitDecisionByToken).not.toHaveBeenCalled();
    });

    it('accepts valid creative approval decisions', async () => {
        (approvalService.submitDecisionByToken as jest.Mock).mockResolvedValue({
            id: 'decision-1',
            decision: 'DECLINED',
        });

        const response = await request(app)
            .post('/v1/review/token-123/decisions')
            .send({
                decision: 'DECLINED',
                note: 'Brand guidelines are not met.',
            });

        expect(response.status).toBe(200);
        expect(approvalService.submitDecisionByToken).toHaveBeenCalledWith('token-123', {
            decision: 'DECLINED',
            note: 'Brand guidelines are not met.',
        });
    });
});
