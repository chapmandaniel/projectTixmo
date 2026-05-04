import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AssetLibraryView from '../features/AssetLibraryView';

const apiGet = vi.fn();
const apiUpload = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('../lib/api', () => ({
    api: {
        get: (...args) => apiGet(...args),
        upload: (...args) => apiUpload(...args),
    },
}));

vi.mock('react-hot-toast', () => ({
    toast: {
        success: (...args) => toastSuccess(...args),
        error: (...args) => toastError(...args),
    },
}));

const approvalsResponse = [
    {
        id: 'approval-1',
        title: 'Summer Launch Poster',
        status: 'PENDING_REVIEW',
        description: 'Primary social poster.',
        event: { id: 'event-1', name: 'Summer Jam' },
        latestRevision: { id: 'revision-2' },
        reviewers: [
            {
                id: 'reviewer-1',
                email: 'manager@example.com',
                name: 'Manager',
                association: 'MANAGEMENT',
                reviewerType: 'EXTERNAL',
                tokenExpiresAt: '2026-05-01T12:00:00.000Z',
                reviewUrl: 'https://dashboard.example.com/review/reviewer-1-token',
            },
        ],
        revisions: [
            {
                id: 'revision-2',
                revisionNumber: 2,
                createdAt: '2026-04-22T12:00:00.000Z',
                assets: [
                    {
                        id: 'asset-1',
                        originalName: 'Summer Poster 4x5.png',
                        filename: 'summer-poster.png',
                        mimeType: 'image/png',
                        size: 1048576,
                        s3Url: 'https://cdn.example.com/assets/summer-poster.png',
                        approvedForLibraryAt: '2026-04-22T13:00:00.000Z',
                        createdAt: '2026-04-22T12:30:00.000Z',
                    },
                ],
            },
        ],
    },
    {
        id: 'approval-2',
        title: 'VIP Entrance Loop',
        status: 'APPROVED',
        description: 'LED entrance animation.',
        event: { id: 'event-2', name: 'Neon Nights' },
        latestRevision: { id: 'revision-4' },
        reviewers: [],
        revisions: [
            {
                id: 'revision-4',
                revisionNumber: 4,
                createdAt: '2026-04-20T09:00:00.000Z',
                assets: [
                    {
                        id: 'asset-2',
                        originalName: 'VIP Loop.mp4',
                        filename: 'vip-loop.mp4',
                        mimeType: 'video/mp4',
                        size: 7340032,
                        s3Url: 'https://cdn.example.com/assets/vip-loop.mp4',
                        approvedForLibraryAt: '2026-04-20T10:00:00.000Z',
                        createdAt: '2026-04-20T09:15:00.000Z',
                    },
                ],
            },
        ],
    },
];

describe('AssetLibraryView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiGet.mockResolvedValue({ approvals: approvalsResponse });
        apiUpload.mockResolvedValue({ assets: [] });
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
                writeText: vi.fn().mockResolvedValue(undefined),
            },
        });
        window.open = vi.fn();
    });

    it('renders uploaded assets and filters by asset type', async () => {
        await act(async () => {
            render(
                <MemoryRouter>
                    <AssetLibraryView isDark />
                </MemoryRouter>
            );
        });

        expect(apiGet).toHaveBeenCalledWith('/approvals?limit=100&includeArchived=true');
        expect(screen.getByRole('heading', { name: 'Asset Library' })).toBeInTheDocument();
        expect(screen.getAllByText('Summer Poster 4x5.png').length).toBeGreaterThan(0);
        expect(screen.getAllByText('VIP Loop.mp4').length).toBeGreaterThan(0);

        fireEvent.change(screen.getByLabelText('Asset type filter'), {
            target: { value: 'image' },
        });

        await waitFor(() => {
            expect(screen.getAllByText('Summer Poster 4x5.png').length).toBeGreaterThan(0);
            expect(screen.queryByText('VIP Loop.mp4')).not.toBeInTheDocument();
        });
    });

    it('copies a reviewer share link for the selected asset', async () => {
        await act(async () => {
            render(
                <MemoryRouter>
                    <AssetLibraryView isDark />
                </MemoryRouter>
            );
        });

        fireEvent.click(screen.getByRole('button', { name: /Summer Poster 4x5\.png/i }));
        fireEvent.click(screen.getByLabelText('Copy review link for manager@example.com'));

        await waitFor(() => {
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
                'https://dashboard.example.com/review/reviewer-1-token'
            );
        });
        expect(toastSuccess).toHaveBeenCalledWith('Review link copied');
    });

    it('does not show approval assets until they are promoted to approved assets', async () => {
        apiGet.mockResolvedValue({
            approvals: [
                {
                    id: 'approval-3',
                    title: 'Approved But Not Added',
                    status: 'APPROVED',
                    event: { id: 'event-3', name: 'Late Night' },
                    latestRevision: { id: 'revision-5' },
                    reviewers: [],
                    revisions: [
                        {
                            id: 'revision-5',
                            revisionNumber: 1,
                            createdAt: '2026-04-24T09:00:00.000Z',
                            assets: [
                                {
                                    id: 'asset-3',
                                    originalName: 'Hidden approved poster.png',
                                    filename: 'hidden-approved-poster.png',
                                    mimeType: 'image/png',
                                    size: 512000,
                                    s3Url: 'https://cdn.example.com/assets/hidden-approved-poster.png',
                                    createdAt: '2026-04-24T09:10:00.000Z',
                                },
                            ],
                        },
                    ],
                },
            ],
        });

        await act(async () => {
            render(
                <MemoryRouter>
                    <AssetLibraryView isDark />
                </MemoryRouter>
            );
        });

        expect(screen.queryByText('Hidden approved poster.png')).not.toBeInTheDocument();
        expect(screen.getByText('No assets match these filters')).toBeInTheDocument();
    });

    it('uploads directly to the asset library without opening approvals', async () => {
        const uploadedAsset = {
            id: 'direct-asset-1',
            originalName: 'Door Poster.png',
            filename: 'door-poster.png',
            mimeType: 'image/png',
            size: 2048,
            s3Url: 'https://cdn.example.com/assets/door-poster.png',
            createdAt: '2026-04-25T09:00:00.000Z',
            uploadedBy: {
                id: 'user-1',
                firstName: 'Nina',
                lastName: 'Lopez',
                email: 'nina@example.com',
            },
        };
        apiUpload.mockResolvedValue({ assets: [uploadedAsset] });

        let container;
        await act(async () => {
            ({ container } = render(
                <MemoryRouter>
                    <AssetLibraryView isDark />
                </MemoryRouter>
            ));
        });

        await act(async () => {
            fireEvent.change(container.querySelector('input[type="file"]'), {
                target: {
                    files: [new File(['image'], 'Door Poster.png', { type: 'image/png' })],
                },
            });
        });

        expect(apiUpload).toHaveBeenCalledWith('/assets', expect.any(FormData));
        expect(apiUpload).not.toHaveBeenCalledWith(expect.stringContaining('/approvals'), expect.anything());
        expect(toastSuccess).toHaveBeenCalledWith('1 file uploaded to the asset library.');

        await waitFor(() => {
            expect(screen.getAllByText('Door Poster.png').length).toBeGreaterThan(0);
        });
    });
});
