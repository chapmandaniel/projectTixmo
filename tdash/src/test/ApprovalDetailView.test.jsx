import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ApprovalDetailView from '../features/ApprovalDetailView';

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiDelete = vi.fn();
const apiUpload = vi.fn();

vi.mock('../lib/api', () => ({
    api: {
        get: (...args) => apiGet(...args),
        post: (...args) => apiPost(...args),
        delete: (...args) => apiDelete(...args),
        upload: (...args) => apiUpload(...args),
    },
}));

const approvalFixture = {
    id: 'approval-1',
    title: 'Main stage artwork',
    status: 'UPDATED',
    deadline: '2026-03-12T10:00:00.000Z',
    submittedAt: '2026-03-09T10:00:00.000Z',
    latestRevisionNumber: 2,
    lastCommentAt: '2026-03-09T12:00:00.000Z',
    event: { name: 'Summer Jam' },
    createdBy: { firstName: 'Nina', lastName: 'Lopez' },
    reviewers: [
        {
            id: 'reviewer-1',
            email: 'reviewer@example.com',
            name: 'Lead Reviewer',
            reviewerType: 'INTERNAL',
            latestDecision: null,
        },
    ],
    latestRevision: {
        id: 'revision-2',
        revisionNumber: 2,
        createdAt: '2026-03-09T12:00:00.000Z',
        assets: [],
    },
    revisions: [
        {
            id: 'revision-2',
            revisionNumber: 2,
            summary: 'Adjusted headline contrast.',
            createdAt: '2026-03-09T12:00:00.000Z',
            uploadedBy: { firstName: 'Nina', lastName: 'Lopez' },
            assets: [],
        },
        {
            id: 'revision-1',
            revisionNumber: 1,
            summary: 'Initial upload.',
            createdAt: '2026-03-09T10:00:00.000Z',
            uploadedBy: { firstName: 'Nina', lastName: 'Lopez' },
            assets: [],
        },
    ],
    comments: [
        {
            id: 'comment-3',
            revisionId: 'revision-2',
            visibility: 'INTERNAL',
            content: 'Private alignment note for the team only.',
            createdAt: '2026-03-10T10:15:00.000Z',
            author: { id: 'user-2', type: 'INTERNAL', name: 'Producer', email: 'producer@example.com' },
        },
        {
            id: 'comment-2',
            revisionId: 'revision-1',
            visibility: 'GLOBAL',
            content: 'Newest note from the approval thread.',
            createdAt: '2026-03-10T09:15:00.000Z',
            author: { id: 'reviewer-2', type: 'EXTERNAL', association: 'MANAGEMENT', name: 'Producer', email: 'producer@example.com' },
        },
        {
            id: 'comment-1',
            revisionId: 'revision-2',
            visibility: 'GLOBAL',
            content: 'Older note from the approval thread.',
            createdAt: '2026-03-09T12:30:00.000Z',
            author: { id: 'user-1', type: 'INTERNAL', name: 'Reviewer', email: 'reviewer@example.com' },
        },
    ],
};

const currentUser = {
    id: 'user-1',
    email: 'reviewer@example.com',
};

describe('ApprovalDetailView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiGet.mockResolvedValue(approvalFixture);
        vi.spyOn(window, 'confirm').mockReturnValue(true);
    });

    it('renders version controls and reviewer actions for the latest version', async () => {
        let container;

        await act(async () => {
            ({ container } = render(
                <ApprovalDetailView
                    approvalId="approval-1"
                    initialApproval={approvalFixture}
                    user={currentUser}
                    onBack={() => {}}
                    onUpdated={() => {}}
                />
            ));
        });

        expect(screen.getByText('Review Portal')).toBeInTheDocument();
        expect(screen.getAllByText('Main stage artwork').length).toBeGreaterThan(0);
        expect(screen.getAllByText('v2').length).toBeGreaterThan(0);
        expect(screen.getByText('Discussion')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Internal \/ Private/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Global/i })).toBeInTheDocument();
        expect(screen.getByText('You have not responded yet.')).toBeInTheDocument();
        expect(screen.getAllByText('Upload version').length).toBeGreaterThan(0);
        expect(screen.getByText('reviewer@example.com')).toBeInTheDocument();
        expect(screen.queryByText('Lead Reviewer')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Pending')).toBeInTheDocument();
        expect(screen.getByText('Summer Jam')).toBeInTheDocument();

        const aside = container.querySelector('aside');
        expect(aside).not.toBeNull();

        const reviewersHeading = within(aside).getByText('Reviewers');
        const discussionHeading = within(aside).getByText('Discussion');
        expect(reviewersHeading.compareDocumentPosition(discussionHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('shows newest approval comments first in the shared thread', async () => {
        await act(async () => {
            render(
                <ApprovalDetailView
                    approvalId="approval-1"
                    initialApproval={approvalFixture}
                    user={currentUser}
                    onBack={() => {}}
                    onUpdated={() => {}}
                />
            );
        });

        const commentCards = screen.getAllByTestId('approval-comment-card');
        expect(within(commentCards[0]).getByText('Newest note from the approval thread.')).toBeInTheDocument();
        expect(within(commentCards[1]).getByText('Older note from the approval thread.')).toBeInTheDocument();
        expect(screen.getByText('Management')).toBeInTheDocument();
        expect(screen.queryByText('Private alignment note for the team only.')).not.toBeInTheDocument();
    });

    it('switches to the internal chat card for private team discussion', async () => {
        await act(async () => {
            render(
                <ApprovalDetailView
                    approvalId="approval-1"
                    initialApproval={approvalFixture}
                    user={currentUser}
                    onBack={() => {}}
                    onUpdated={() => {}}
                />
            );
        });

        fireEvent.click(screen.getByRole('button', { name: /Internal \/ Private/i }));

        expect(screen.getByText('Private alignment note for the team only.')).toBeInTheDocument();
        expect(screen.queryByText('Newest note from the approval thread.')).not.toBeInTheDocument();
    });

    it('posts a comment against the selected revision', async () => {
        apiPost.mockResolvedValue({});

        await act(async () => {
            render(
                <ApprovalDetailView
                    approvalId="approval-1"
                    initialApproval={approvalFixture}
                    user={currentUser}
                    onBack={() => {}}
                    onUpdated={() => {}}
                />
            );
        });

        fireEvent.change(screen.getByPlaceholderText(/Message the global chat/i), {
            target: { value: 'Looks better now.' },
        });

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Send comment' }));
        });

        await waitFor(() =>
            expect(apiPost).toHaveBeenCalledWith('/approvals/approval-1/comments', {
                content: 'Looks better now.',
                revisionId: 'revision-2',
                parentCommentId: undefined,
                visibility: 'GLOBAL',
            })
        );
    });

    it('deletes a message authored by the current user', async () => {
        apiDelete.mockResolvedValue({
            ...approvalFixture,
            comments: approvalFixture.comments.filter((item) => item.id !== 'comment-1'),
        });

        await act(async () => {
            render(
                <ApprovalDetailView
                    approvalId="approval-1"
                    initialApproval={approvalFixture}
                    user={currentUser}
                    onBack={() => {}}
                    onUpdated={() => {}}
                />
            );
        });

        fireEvent.click(screen.getByRole('button', { name: 'Delete message from Reviewer' }));

        expect(window.confirm).toHaveBeenCalledWith('Delete this message?');

        await waitFor(() =>
            expect(apiDelete).toHaveBeenCalledWith('/approvals/approval-1/comments/comment-1')
        );

        expect(screen.queryByText('Older note from the approval thread.')).not.toBeInTheDocument();
    });

    it('keeps the current view mounted during a background approval refresh', async () => {
        let resolveFetch;
        apiGet.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolveFetch = resolve;
                })
        );

        await act(async () => {
            render(
                <ApprovalDetailView
                    approvalId="approval-1"
                    initialApproval={approvalFixture}
                    user={currentUser}
                    onBack={() => {}}
                    onUpdated={() => {}}
                />
            );
        });

        await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/approvals/approval-1'));

        expect(screen.getByText('Main stage artwork')).toBeInTheDocument();
        expect(screen.queryByText('Loading review workspace...')).not.toBeInTheDocument();
        expect(screen.getByText('Refreshing')).toBeInTheDocument();

        await act(async () => {
            resolveFetch(approvalFixture);
        });

        await waitFor(() => expect(screen.queryByText('Refreshing')).not.toBeInTheDocument());
    });

    it('opens a modal and submits a new reviewer email', async () => {
        const updatedApproval = {
            ...approvalFixture,
            reviewers: [
                ...approvalFixture.reviewers,
                {
                    id: 'reviewer-2',
                    email: 'new-reviewer@example.com',
                    reviewerType: 'EXTERNAL',
                    latestDecision: { decision: 'APPROVED' },
                },
            ],
        };

        apiPost.mockResolvedValue(updatedApproval);

        await act(async () => {
            render(
                <ApprovalDetailView
                    approvalId="approval-1"
                    initialApproval={approvalFixture}
                    user={currentUser}
                    onBack={() => {}}
                    onUpdated={() => {}}
                />
            );
        });

        fireEvent.click(screen.getByRole('button', { name: /Add reviewer/i }));

        const dialog = screen.getByRole('dialog', { name: 'Add reviewer' });
        expect(dialog).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Reviewer email'), {
            target: { value: 'new-reviewer@example.com' },
        });
        fireEvent.change(screen.getByLabelText('Association'), {
            target: { value: 'MANAGEMENT' },
        });

        await act(async () => {
            fireEvent.click(within(dialog).getByRole('button', { name: /^Add reviewer$/i }));
        });

        await waitFor(() =>
            expect(apiPost).toHaveBeenCalledWith('/approvals/approval-1/reviewers', {
                reviewers: [{ email: 'new-reviewer@example.com', association: 'MANAGEMENT' }],
            })
        );

        expect(screen.getByText('new-reviewer@example.com')).toBeInTheDocument();
        expect(screen.getByLabelText('Approved')).toBeInTheDocument();
        expect(screen.queryByRole('dialog', { name: 'Add reviewer' })).not.toBeInTheDocument();
    });

    it('resends a reviewer invite from the reviewer row', async () => {
        apiPost.mockResolvedValue(approvalFixture);

        await act(async () => {
            render(
                <ApprovalDetailView
                    approvalId="approval-1"
                    initialApproval={approvalFixture}
                    user={currentUser}
                    onBack={() => {}}
                    onUpdated={() => {}}
                />
            );
        });

        fireEvent.click(screen.getByRole('button', { name: 'Resend reviewer invite for reviewer@example.com' }));

        await waitFor(() =>
            expect(apiPost).toHaveBeenCalledWith('/approvals/approval-1/reviewers/reviewer-1/resend')
        );
    });

    it('removes a reviewer from the reviewer row after confirmation', async () => {
        apiDelete.mockResolvedValue({
            ...approvalFixture,
            reviewers: [],
        });

        await act(async () => {
            render(
                <ApprovalDetailView
                    approvalId="approval-1"
                    initialApproval={approvalFixture}
                    user={{ email: 'reviewer@example.com' }}
                    onBack={() => {}}
                    onUpdated={() => {}}
                />
            );
        });

        fireEvent.click(screen.getByRole('button', { name: 'Remove reviewer reviewer@example.com' }));

        expect(window.confirm).toHaveBeenCalledWith('Remove reviewer reviewer@example.com?');

        await waitFor(() =>
            expect(apiDelete).toHaveBeenCalledWith('/approvals/approval-1/reviewers/reviewer-1')
        );

        expect(screen.queryByText('reviewer@example.com')).not.toBeInTheDocument();
    });

    it('expands the selected image asset in a full-screen preview', async () => {
        const approvalWithImage = {
            ...approvalFixture,
            latestRevision: {
                ...approvalFixture.latestRevision,
                assets: [
                    {
                        id: 'asset-1',
                        mimeType: 'image/png',
                        originalName: 'poster.png',
                        s3Url: 'https://example.com/poster.png',
                    },
                    {
                        id: 'asset-2',
                        mimeType: 'image/png',
                        originalName: 'poster-alt.png',
                        s3Url: 'https://example.com/poster-alt.png',
                    },
                ],
            },
            revisions: approvalFixture.revisions.map((revision) =>
                revision.id === 'revision-2'
                    ? {
                          ...revision,
                          assets: [
                              {
                                  id: 'asset-1',
                                  mimeType: 'image/png',
                                  originalName: 'poster.png',
                                  s3Url: 'https://example.com/poster.png',
                              },
                              {
                                  id: 'asset-2',
                                  mimeType: 'image/png',
                                  originalName: 'poster-alt.png',
                                  s3Url: 'https://example.com/poster-alt.png',
                              },
                          ],
                      }
                    : revision
            ),
        };

        apiGet.mockResolvedValue(approvalWithImage);

        await act(async () => {
            render(
                <ApprovalDetailView
                    approvalId="approval-1"
                    initialApproval={approvalWithImage}
                    user={currentUser}
                    onBack={() => {}}
                    onUpdated={() => {}}
                />
            );
        });

        expect(screen.getByText('Version options')).toBeInTheDocument();
        expect(screen.getByText('poster-alt')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Expand poster.png' }));

        expect(screen.getByRole('dialog', { name: 'Expanded preview for poster.png' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Close preview' })).toBeInTheDocument();
    });
});
