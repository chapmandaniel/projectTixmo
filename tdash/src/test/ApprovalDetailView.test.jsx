import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ApprovalDetailView from '../features/ApprovalDetailView';

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiUpload = vi.fn();

vi.mock('../lib/api', () => ({
    api: {
        get: (...args) => apiGet(...args),
        post: (...args) => apiPost(...args),
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
            id: 'comment-1',
            revisionId: 'revision-2',
            content: 'Need a bit more breathing room above the sponsor row.',
            createdAt: '2026-03-09T12:30:00.000Z',
            author: { name: 'Reviewer', email: 'reviewer@example.com' },
        },
    ],
};

describe('ApprovalDetailView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiGet.mockResolvedValue(approvalFixture);
    });

    it('renders revision history and reviewer controls for the latest revision', async () => {
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

        expect(screen.getByText('Main stage artwork')).toBeInTheDocument();
        expect(screen.getAllByText('Revision 2').length).toBeGreaterThan(0);
        expect(screen.getByText('Threaded feedback')).toBeInTheDocument();
        expect(screen.getAllByText('Upload revision').length).toBeGreaterThan(0);
    });

    it('posts a comment against the selected revision', async () => {
        apiPost.mockResolvedValue({});

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

        fireEvent.change(screen.getByPlaceholderText(/Add feedback/i), {
            target: { value: 'Looks better now.' },
        });

        await act(async () => {
            fireEvent.click(screen.getByText('Post comment'));
        });

        await waitFor(() =>
            expect(apiPost).toHaveBeenCalledWith('/approvals/approval-1/comments', {
                content: 'Looks better now.',
                revisionId: 'revision-2',
                parentCommentId: undefined,
            })
        );
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
                    user={{ email: 'reviewer@example.com' }}
                    onBack={() => {}}
                    onUpdated={() => {}}
                />
            );
        });

        fireEvent.click(screen.getByRole('button', { name: 'Expand poster.png' }));

        expect(screen.getByRole('dialog', { name: 'Expanded preview for poster.png' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Close preview' })).toBeInTheDocument();
    });
});
