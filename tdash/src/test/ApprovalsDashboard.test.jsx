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
        window.sessionStorage.clear();
    });

    it('loads the creative approvals dashboard and filters by event and status', async () => {
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
                        event: { id: 'event-1', name: 'Summer Jam' },
                        latestRevision: { assets: [] },
                        reviewers: [],
                    },
                    {
                        id: 'approval-2',
                        title: 'Sponsor lockup',
                        status: 'APPROVED',
                        latestRevisionNumber: 2,
                        submittedAt: '2026-03-09T12:00:00.000Z',
                        deadline: '2026-04-11T10:00:00.000Z',
                        event: { id: 'event-2', name: 'Neon Nights' },
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

        expect(screen.getByText('Approvals')).toBeInTheDocument();
        expect(screen.getByText('Main poster')).toBeInTheDocument();
        expect(screen.getByText('Sponsor lockup')).toBeInTheDocument();
        expect(screen.getByText('Overdue')).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Status filter'), {
            target: { value: 'APPROVED' },
        });

        expect(screen.queryByText('Main poster')).not.toBeInTheDocument();
        expect(screen.getByText('Sponsor lockup')).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Status filter'), {
            target: { value: '' },
        });

        fireEvent.change(screen.getByLabelText('Event filter'), {
            target: { value: 'event-1' },
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

        fireEvent.change(screen.getAllByLabelText('Event')[0], {
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

    it('opens a deep-linked approval from the dashboard query string', async () => {
        apiGet.mockImplementation((url) => {
            if (url.startsWith('/events')) {
                return Promise.resolve({
                    events: [{ id: 'event-1', name: 'Summer Jam' }],
                });
            }

            if (url === '/approvals/approval-2') {
                return Promise.resolve({
                    id: 'approval-2',
                    title: 'Sponsor lockup',
                    latestRevision: { id: 'revision-2', assets: [] },
                    revisions: [{ id: 'revision-2', revisionNumber: 1, assets: [] }],
                    reviewers: [],
                    comments: [],
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
                ],
            });
        });

        await act(async () => {
            render(
                <MemoryRouter initialEntries={['/approvals?approvalId=approval-2']}>
                    <ApprovalsDashboard user={{ email: 'designer@example.com' }} />
                </MemoryRouter>
            );
        });

        await waitFor(() => {
            expect(apiGet).toHaveBeenCalledWith('/approvals/approval-2');
        });
        expect(screen.getByText('Detail view for approval-2')).toBeInTheDocument();
    });

    it('renders cached approvals immediately while refreshing in the background', async () => {
        window.sessionStorage.setItem(
            'tixmo:approvals-dashboard-cache',
            JSON.stringify({
                approvals: [
                    {
                        id: 'approval-cached',
                        title: 'Cached poster',
                        status: 'PENDING_REVIEW',
                        latestRevisionNumber: 1,
                        deadline: '2026-04-12T10:00:00.000Z',
                        event: { id: 'event-1', name: 'Summer Jam' },
                        latestRevision: { assets: [] },
                    },
                ],
                events: [{ id: 'event-1', name: 'Summer Jam' }],
            })
        );

        apiGet.mockImplementation((url) => {
            if (url.startsWith('/events')) {
                return Promise.resolve({
                    events: [{ id: 'event-1', name: 'Summer Jam' }],
                });
            }

            return Promise.resolve({
                approvals: [
                    {
                        id: 'approval-fresh',
                        title: 'Fresh poster',
                        status: 'APPROVED',
                        latestRevisionNumber: 2,
                        deadline: '2026-04-13T10:00:00.000Z',
                        event: { id: 'event-1', name: 'Summer Jam' },
                        latestRevision: { assets: [] },
                    },
                ],
            });
        });

        render(
            <MemoryRouter>
                <ApprovalsDashboard user={{ email: 'designer@example.com' }} />
            </MemoryRouter>
        );

        expect(screen.getByText('Cached poster')).toBeInTheDocument();
        expect(screen.queryByText('Loading approvals…')).not.toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText('Fresh poster')).toBeInTheDocument();
        });
    });
});
