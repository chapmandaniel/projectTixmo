import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ApprovalsDashboard from '../features/ApprovalsDashboard';

const apiGet = vi.fn();
const apiUpload = vi.fn();

vi.mock('../lib/api', () => ({
    api: {
        get: (...args) => apiGet(...args),
        upload: (...args) => apiUpload(...args),
        post: vi.fn(),
    },
}));

vi.mock('../features/ApprovalDetailView', () => ({
    default: ({ approvalId }) => <div>Detail view for {approvalId}</div>,
}));

describe('ApprovalsDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('loads the creative approvals dashboard and filters by search', async () => {
        apiGet.mockImplementation((url) => {
            if (url.startsWith('/events')) {
                return Promise.resolve({
                    events: [
                        { id: 'event-1', name: 'Summer Jam' },
                        { id: 'event-2', name: 'Neon Nights' },
                    ],
                });
            }

            return Promise.resolve({
                approvals: [
                    {
                        id: 'approval-1',
                        title: 'Main poster',
                        status: 'PENDING_REVIEW',
                        latestRevisionNumber: 1,
                        submittedAt: '2026-03-09T10:00:00.000Z',
                        deadline: '2026-03-12T10:00:00.000Z',
                        event: { name: 'Summer Jam' },
                        latestRevision: { assets: [] },
                        reviewers: [],
                    },
                    {
                        id: 'approval-2',
                        title: 'Sponsor lockup',
                        status: 'PENDING_REVIEW',
                        latestRevisionNumber: 2,
                        submittedAt: '2026-03-09T12:00:00.000Z',
                        deadline: '2026-03-11T10:00:00.000Z',
                        event: { name: 'Neon Nights' },
                        latestRevision: { assets: [] },
                        reviewers: [],
                    },
                ],
            });
        });

        await act(async () => {
            render(
                <MemoryRouter>
                    <ApprovalsDashboard user={{ email: 'designer@example.com' }} />
                </MemoryRouter>
            );
        });

        expect(screen.getByText('Approvals Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Main poster')).toBeInTheDocument();
        expect(screen.getByText('Sponsor lockup')).toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText('Search by asset title or event'), {
            target: { value: 'main' },
        });

        expect(screen.getByText('Main poster')).toBeInTheDocument();
        expect(screen.queryByText('Sponsor lockup')).not.toBeInTheDocument();
    });

    it('opens the create submission modal and uploads a new approval', async () => {
        apiGet.mockImplementation((url) => {
            if (url.startsWith('/events')) {
                return Promise.resolve({
                    events: [{ id: 'event-1', name: 'Summer Jam' }],
                });
            }

            return Promise.resolve({ approvals: [] });
        });

        apiUpload.mockResolvedValue({
            id: 'approval-99',
            title: 'VIP poster',
            status: 'PENDING_REVIEW',
            latestRevisionNumber: 1,
            latestRevision: { id: 'revision-1', assets: [] },
            revisions: [{ id: 'revision-1', revisionNumber: 1, assets: [] }],
            reviewers: [],
            event: { name: 'Summer Jam' },
        });

        await act(async () => {
            render(
                <MemoryRouter>
                    <ApprovalsDashboard user={{ email: 'designer@example.com' }} />
                </MemoryRouter>
            );
        });

        fireEvent.click(screen.getByText('New submission'));

        fireEvent.change(screen.getByLabelText('Event'), {
            target: { value: 'event-1' },
        });

        fireEvent.change(screen.getByPlaceholderText(/Festival poster/i), {
            target: { value: 'VIP poster' },
        });

        fireEvent.change(screen.getByPlaceholderText('reviewer@example.com'), {
            target: { value: 'manager@example.com' },
        });
        fireEvent.click(screen.getByText('Add'));

        fireEvent.change(screen.getByLabelText('Deadline'), {
            target: { value: '2026-03-12T10:00' },
        });

        const file = new File(['file'], 'poster.png', { type: 'image/png' });
        const fileInput = screen.getByLabelText(/Asset files/i);
        fireEvent.change(fileInput, { target: { files: [file] } });

        await act(async () => {
            fireEvent.submit(screen.getByText('Create approval').closest('form'));
        });

        await waitFor(() => expect(apiUpload).toHaveBeenCalled());
        expect(screen.getByText('Detail view for approval-99')).toBeInTheDocument();
    });
});
