import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ExternalReviewPage from '../pages/ExternalReviewPage';

vi.mock('../lib/runtimeConfig', () => ({
    getApiBaseUrl: () => 'https://api.example.com',
}));

describe('ExternalReviewPage', () => {
    const fetchMock = vi.fn();
    const baseReview = {
        reviewer: {
            id: 'reviewer-1',
            email: 'reviewer@example.com',
            name: 'External Reviewer',
            association: 'AGENT',
            reviewerType: 'EXTERNAL',
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
                    decisions: [],
                },
            ],
            latestRevision: {
                id: 'revision-1',
                revisionNumber: 1,
                summary: 'Initial submission',
                createdAt: '2026-04-01T12:00:00.000Z',
                assets: [],
                decisions: [],
            },
            comments: [
                {
                    id: 'comment-1',
                    content: 'Please confirm the final headline.',
                    createdAt: '2026-04-02T09:00:00.000Z',
                    author: {
                        id: 'reviewer-1',
                        name: 'Nina Lopez',
                        type: 'EXTERNAL',
                        association: 'MANAGEMENT',
                    },
                },
            ],
            myReview: null,
        },
    };

    beforeEach(() => {
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        window.history.pushState({}, '', '/review/token-123');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        window.history.pushState({}, '', '/');
    });

    it('renders the simplified external review workspace shell', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => baseReview,
        });

        render(<ExternalReviewPage />);

        expect(await screen.findByText('Review Portal')).toBeInTheDocument();
        expect(screen.getByText('Creative Briefing')).toBeInTheDocument();
        expect(screen.getByText('Discussion')).toBeInTheDocument();
        expect(screen.getByText('Management')).toBeInTheDocument();
        expect(screen.queryByText('External Reviewer')).not.toBeInTheDocument();
        expect(screen.getByText('v1')).toBeInTheDocument();
        expect(screen.getByText('Link expires')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/review/token-123');
    });

    it('opens a note modal for request changes and adds the note to discussion after submit', async () => {
        fetchMock
            .mockResolvedValueOnce({
                ok: true,
                json: async () => baseReview,
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'decision-1' }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    ...baseReview,
                    approval: {
                        ...baseReview.approval,
                        status: 'CHANGES_REQUESTED',
                        latestRevision: {
                            ...baseReview.approval.latestRevision,
                            decisions: [
                                {
                                    id: 'decision-1',
                                    decision: 'CHANGES_REQUESTED',
                                    note: 'Please adjust the headline lockup.',
                                    createdAt: '2026-04-02T10:00:00.000Z',
                                    reviewer: {
                                        email: 'reviewer@example.com',
                                        name: 'External Reviewer',
                                        reviewerType: 'EXTERNAL',
                                        association: 'AGENT',
                                    },
                                },
                            ],
                        },
                        revisions: [
                            {
                                ...baseReview.approval.revisions[0],
                                decisions: [
                                    {
                                        id: 'decision-1',
                                        decision: 'CHANGES_REQUESTED',
                                        note: 'Please adjust the headline lockup.',
                                        createdAt: '2026-04-02T10:00:00.000Z',
                                        reviewer: {
                                            email: 'reviewer@example.com',
                                            name: 'External Reviewer',
                                            reviewerType: 'EXTERNAL',
                                            association: 'AGENT',
                                        },
                                    },
                                ],
                            },
                        ],
                        myReview: {
                            decision: 'CHANGES_REQUESTED',
                        },
                    },
                }),
            });

        render(<ExternalReviewPage />);

        expect(await screen.findByText('Creative Briefing')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Request Changes' }));

        expect(screen.getByRole('dialog', { name: 'Request changes note' })).toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText('Explain what needs to change'), {
            target: { value: 'Please adjust the headline lockup.' },
        });

        fireEvent.click(screen.getByRole('button', { name: 'Submit note' }));

        await waitFor(() =>
            expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/review/token-123/decisions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    decision: 'CHANGES_REQUESTED',
                    note: 'Please adjust the headline lockup.',
                    revisionId: 'revision-1',
                }),
            })
        );

        expect(await screen.findByText('Please adjust the headline lockup.')).toBeInTheDocument();
        expect(screen.getByLabelText('Changes requested note')).toBeInTheDocument();
    });

    it('keeps the current review visible while a background refresh is in flight', async () => {
        let resolveRefresh;

        fetchMock
            .mockResolvedValueOnce({
                ok: true,
                json: async () => baseReview,
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'comment-2' }),
            })
            .mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        resolveRefresh = resolve;
                    })
            );

        render(<ExternalReviewPage />);

        expect(await screen.findByText('Creative Briefing')).toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText('Add a comment'), {
            target: { value: 'Need one more logo adjustment.' },
        });

        fireEvent.click(screen.getByRole('button', { name: 'Send comment' }));

        await waitFor(() =>
            expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/review/token-123/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: 'Need one more logo adjustment.',
                    revisionId: 'revision-1',
                }),
            })
        );

        await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/review/token-123'));

        expect(screen.getByText('Creative Briefing')).toBeInTheDocument();
        expect(screen.queryByText('Loading review workspace...')).not.toBeInTheDocument();
        expect(screen.getByText('Refreshing')).toBeInTheDocument();

        await act(async () => {
            resolveRefresh({
                ok: true,
                json: async () => baseReview,
            });
        });

        await waitFor(() => expect(screen.queryByText('Refreshing')).not.toBeInTheDocument());
    });

    it('shows a delete action for the reviewer’s own message and removes it', async () => {
        const ownCommentReview = {
            ...baseReview,
            approval: {
                ...baseReview.approval,
                comments: [
                    {
                        id: 'comment-1',
                        content: 'Please confirm the final headline.',
                        createdAt: '2026-04-02T09:00:00.000Z',
                        author: {
                            id: 'reviewer-1',
                            name: 'External Reviewer',
                            email: 'reviewer@example.com',
                        },
                    },
                ],
            },
        };

        fetchMock
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ownCommentReview,
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ approval: baseReview.approval, reviewer: baseReview.reviewer }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => baseReview,
            });

        render(<ExternalReviewPage />);

        expect(await screen.findByText('Please confirm the final headline.')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Delete message' }));

        expect(window.confirm).toHaveBeenCalledWith('Delete this message?');

        await waitFor(() =>
            expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/review/token-123/comments/comment-1', {
                method: 'DELETE',
            })
        );

        await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/review/token-123'));
    });
});
