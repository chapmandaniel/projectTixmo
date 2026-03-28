import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExternalReviewPage from '../pages/ExternalReviewPage';

vi.mock('../lib/runtimeConfig', () => ({
    getApiBaseUrl: () => 'https://api.example.com',
}));

describe('ExternalReviewPage', () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
        window.history.pushState({}, '', '/review/token-123');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        window.history.pushState({}, '', '/');
    });

    it('renders the refreshed external review workspace shell', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                reviewer: {
                    id: 'reviewer-1',
                    email: 'reviewer@example.com',
                    name: 'External Reviewer',
                    tokenExpiresAt: '2026-04-15T10:00:00.000Z',
                },
                approval: {
                    id: 'approval-1',
                    title: 'Creative Briefing',
                    description: 'Review the hero artwork and launch copy.',
                    status: 'PENDING_REVIEW',
                    deadline: '2026-04-10T18:00:00.000Z',
                    event: { name: 'Summer Jam' },
                    createdBy: {
                        firstName: 'Nina',
                        lastName: 'Lopez',
                        email: 'nina@example.com',
                    },
                    revisions: [
                        {
                            id: 'revision-1',
                            revisionNumber: 1,
                            summary: 'Initial submission',
                            createdAt: '2026-04-01T12:00:00.000Z',
                            assets: [],
                        },
                    ],
                    latestRevision: {
                        id: 'revision-1',
                        revisionNumber: 1,
                        summary: 'Initial submission',
                        createdAt: '2026-04-01T12:00:00.000Z',
                        assets: [],
                    },
                    comments: [
                        {
                            id: 'comment-1',
                            content: 'Please confirm the final headline.',
                            createdAt: '2026-04-02T09:00:00.000Z',
                            author: {
                                name: 'Nina Lopez',
                            },
                        },
                    ],
                    myReview: null,
                },
            }),
        });

        render(<ExternalReviewPage />);

        expect(await screen.findByText('Review Portal')).toBeInTheDocument();
        expect(screen.getByText('Secure External Review')).toBeInTheDocument();
        expect(screen.getByText('Creative Briefing')).toBeInTheDocument();
        expect(screen.getByText('Decision controls')).toBeInTheDocument();
        expect(screen.getByText('Version history')).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/review/token-123');
    });
});
