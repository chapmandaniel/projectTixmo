import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import ApprovalsDashboard from '../features/ApprovalsDashboard';

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiDelete = vi.fn();
const apiUpload = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('../lib/api', () => ({
    api: {
        get: (...args) => apiGet(...args),
        post: (...args) => apiPost(...args),
        delete: (...args) => apiDelete(...args),
        upload: (...args) => apiUpload(...args),
    },
}));

vi.mock('react-hot-toast', () => ({
    toast: {
        success: (...args) => toastSuccess(...args),
        error: (...args) => toastError(...args),
    },
}));

vi.mock('../features/ApprovalDetailView', () => ({
    default: ({ approvalId, onBack, onUpdated }) => (
        <div>
            <div>Detail view for {approvalId}</div>
            <button type="button" onClick={onBack}>
                Mock back
            </button>
            <button
                type="button"
                onClick={() => {
                    setTimeout(() => {
                        onUpdated?.({
                            id: approvalId,
                            title: 'Updated approval',
                            latestRevision: { id: 'revision-2', assets: [] },
                            revisions: [{ id: 'revision-2', revisionNumber: 2, assets: [] }],
                            reviewers: [],
                            comments: [],
                        });
                    }, 0);
                }}
            >
                Mock async update
            </button>
        </div>
    ),
}));

const NavigateToApprovals = () => {
    const navigate = useNavigate();

    return (
        <button type="button" onClick={() => navigate('/approvals')}>
            Go to approvals root
        </button>
    );
};

const NavigateToSocial = () => {
    const navigate = useNavigate();

    return (
        <button type="button" onClick={() => navigate('/social')}>
            Go to social
        </button>
    );
};

describe('ApprovalsDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.sessionStorage.clear();
        window.confirm = vi.fn(() => true);
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
        expect(screen.getAllByText('Overdue').length).toBeGreaterThan(0);

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

    it('lets admins add approved images to the asset library and archive gallery approvals', async () => {
        const approvedApproval = {
            id: 'approval-3',
            title: 'Approved poster',
            status: 'APPROVED',
            latestRevisionNumber: 1,
            deadline: '2026-06-12T10:00:00.000Z',
            event: { id: 'event-1', name: 'Summer Jam' },
            latestRevision: {
                id: 'revision-3',
                assets: [
                    {
                        id: 'asset-3',
                        originalName: 'approved-poster.png',
                        mimeType: 'image/png',
                        s3Url: 'https://cdn.example.com/approved-poster.png',
                    },
                ],
            },
            reviewers: [],
        };

        apiGet.mockImplementation((url) => {
            if (url.startsWith('/events')) {
                return Promise.resolve({
                    events: [{ id: 'event-1', name: 'Summer Jam' }],
                });
            }

            return Promise.resolve({ approvals: [approvedApproval] });
        });

        apiPost.mockImplementation((url) => {
            if (url === '/approvals/approval-3/approved-assets') {
                return Promise.resolve({
                    ...approvedApproval,
                    latestRevision: {
                        ...approvedApproval.latestRevision,
                        assets: [
                            {
                                ...approvedApproval.latestRevision.assets[0],
                                approvedForLibraryAt: '2026-05-02T12:00:00.000Z',
                            },
                        ],
                    },
                });
            }

            return Promise.resolve({});
        });

        await act(async () => {
            render(
                <MemoryRouter>
                    <ApprovalsDashboard user={{ email: 'admin@example.com', role: 'ADMIN' }} />
                </MemoryRouter>
            );
        });

        fireEvent.click(screen.getByRole('button', { name: /Add to approved assets/i }));

        await waitFor(() => {
            expect(apiPost).toHaveBeenCalledWith('/approvals/approval-3/approved-assets');
            expect(screen.getByText('In approved assets')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /^Archive$/i }));

        await waitFor(() => {
            expect(apiPost).toHaveBeenCalledWith('/approvals/approval-3/archive');
            expect(screen.queryByText('Approved poster')).not.toBeInTheDocument();
        });

        expect(toastSuccess).toHaveBeenCalledWith('Approval archived');
    });

    it('lets admins delete gallery approvals after confirmation', async () => {
        apiGet.mockImplementation((url) => {
            if (url.startsWith('/events')) {
                return Promise.resolve({
                    events: [{ id: 'event-1', name: 'Summer Jam' }],
                });
            }

            return Promise.resolve({
                approvals: [
                    {
                        id: 'approval-delete',
                        title: 'Delete me',
                        status: 'PENDING_REVIEW',
                        latestRevisionNumber: 1,
                        deadline: '2026-06-12T10:00:00.000Z',
                        event: { id: 'event-1', name: 'Summer Jam' },
                        latestRevision: { assets: [] },
                        reviewers: [],
                    },
                ],
            });
        });
        apiDelete.mockResolvedValue({ id: 'approval-delete', deleted: true });

        await act(async () => {
            render(
                <MemoryRouter>
                    <ApprovalsDashboard user={{ email: 'owner@example.com', role: 'OWNER' }} />
                </MemoryRouter>
            );
        });

        fireEvent.click(screen.getByRole('button', { name: /^Delete$/i }));

        await waitFor(() => {
            expect(apiDelete).toHaveBeenCalledWith('/approvals/approval-delete');
            expect(screen.queryByText('Delete me')).not.toBeInTheDocument();
        });
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

    it('returns to the approvals grid from the detail back action', async () => {
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
                        deadline: '2026-03-12T10:00:00.000Z',
                        event: { id: 'event-1', name: 'Summer Jam' },
                        latestRevision: { assets: [] },
                        reviewers: [],
                    },
                ],
            });
        });

        render(
            <MemoryRouter initialEntries={['/approvals?approvalId=approval-2']}>
                <ApprovalsDashboard user={{ email: 'designer@example.com' }} />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Detail view for approval-2')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Mock back'));

        await waitFor(() => {
            expect(screen.getByText('Main poster')).toBeInTheDocument();
        });
    });

    it('clears the selected approval when the route returns to plain approvals', async () => {
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
                        deadline: '2026-03-12T10:00:00.000Z',
                        event: { id: 'event-1', name: 'Summer Jam' },
                        latestRevision: { assets: [] },
                        reviewers: [],
                    },
                ],
            });
        });

        render(
            <MemoryRouter initialEntries={['/approvals?approvalId=approval-2']}>
                <Routes>
                    <Route
                        path="/approvals"
                        element={(
                            <>
                                <NavigateToApprovals />
                                <ApprovalsDashboard user={{ email: 'designer@example.com' }} />
                            </>
                        )}
                    />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Detail view for approval-2')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Go to approvals root'));

        await waitFor(() => {
            expect(screen.getByText('Main poster')).toBeInTheDocument();
        });
    });

    it('does not force the router back to approvals after leaving the page', async () => {
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
                        deadline: '2026-03-12T10:00:00.000Z',
                        event: { id: 'event-1', name: 'Summer Jam' },
                        latestRevision: { assets: [] },
                        reviewers: [],
                    },
                ],
            });
        });

        render(
            <MemoryRouter initialEntries={['/approvals?approvalId=approval-2']}>
                <Routes>
                    <Route
                        path="/approvals"
                        element={(
                            <>
                                <NavigateToSocial />
                                <ApprovalsDashboard user={{ email: 'designer@example.com' }} />
                            </>
                        )}
                    />
                    <Route path="/social" element={<div>Social view</div>} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Detail view for approval-2')).toBeInTheDocument();
        });

        vi.useFakeTimers();
        fireEvent.click(screen.getByText('Mock async update'));
        fireEvent.click(screen.getByText('Go to social'));

        expect(screen.getByText('Social view')).toBeInTheDocument();

        await act(async () => {
            vi.runAllTimers();
        });

        expect(screen.getByText('Social view')).toBeInTheDocument();
        expect(screen.queryByText('Detail view for approval-2')).not.toBeInTheDocument();

        vi.useRealTimers();
    });
});
