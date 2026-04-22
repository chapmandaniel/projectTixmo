const sendMail = jest.fn();

jest.mock('../../src/config/environment', () => ({
    config: {
        clientUrl: 'https://dashboard.example.com',
    },
}));

jest.mock('../../src/config/logger', () => ({
    logger: {
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
    },
}));

jest.mock('../../src/config/email', () => ({
    transporter: {
        sendMail,
    },
    emailFrom: {
        name: 'TixMo',
        address: 'noreply@tixmo.com',
    },
}));

import { approvalEmailService } from '../../src/services/approval-email.service';

describe('ApprovalEmailService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        sendMail.mockResolvedValue({});
    });

    it('sends comment notifications with per-recipient links', async () => {
        await approvalEmailService.sendCommentNotification(
            [
                {
                    email: 'owner@example.com',
                    name: 'Owner',
                },
                {
                    email: 'external@example.com',
                    name: 'External Reviewer',
                    reviewerToken: 'secure-token-123',
                },
            ],
            {
                title: 'Launch poster',
                eventName: 'Summer Jam',
                revisionNumber: 2,
                deadline: new Date('2026-03-30T10:00:00.000Z'),
                approvalId: 'approval-123',
            },
            'Nina Lopez',
            'Please review the updated lockup.'
        );

        expect(sendMail).toHaveBeenCalledTimes(2);
        expect(sendMail).toHaveBeenNthCalledWith(1, expect.objectContaining({
            to: 'owner@example.com',
            html: expect.stringContaining('https://dashboard.example.com/approvals?approvalId=approval-123'),
            text: expect.stringContaining('https://dashboard.example.com/approvals?approvalId=approval-123'),
        }));
        expect(sendMail).toHaveBeenNthCalledWith(2, expect.objectContaining({
            to: 'external@example.com',
            html: expect.stringContaining('https://dashboard.example.com/review/secure-token-123'),
            text: expect.stringContaining('https://dashboard.example.com/review/secure-token-123'),
        }));
    });

    it('uses an explicit dashboard origin for reviewer links when one is provided', async () => {
        await approvalEmailService.sendReviewRequest(
            {
                email: 'external@example.com',
                name: 'External Reviewer',
                token: 'secure-token-456',
            },
            {
                firstName: 'Nina',
                lastName: 'Lopez',
                email: 'nina@example.com',
            },
            {
                title: 'Launch poster',
                eventName: 'Summer Jam',
                revisionNumber: 2,
                deadline: new Date('2026-03-30T10:00:00.000Z'),
            },
            'https://mightyquinton.tixmo.co'
        );

        expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
            to: 'external@example.com',
            html: expect.stringContaining('https://mightyquinton.tixmo.co/review/secure-token-456'),
            text: expect.stringContaining('https://mightyquinton.tixmo.co/review/secure-token-456'),
        }));
    });
});
