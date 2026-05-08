import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AssetLibraryView from '../features/AssetLibraryView';

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPatch = vi.fn();
const apiDelete = vi.fn();
const apiUpload = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('../lib/api', () => ({
    api: {
        get: (...args) => apiGet(...args),
        post: (...args) => apiPost(...args),
        patch: (...args) => apiPatch(...args),
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

const eventsResponse = [
    { id: 'event-1', name: 'Summer Jam' },
    { id: 'event-2', name: 'Neon Nights' },
];

describe('AssetLibraryView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiGet.mockImplementation((url) => {
            if (url === '/assets') {
                return Promise.resolve({ assets: [], folders: [] });
            }

            if (url.startsWith('/events')) {
                return Promise.resolve({ events: eventsResponse });
            }

            return Promise.resolve({ approvals: approvalsResponse });
        });
        apiUpload.mockResolvedValue({ assets: [] });
        apiPost.mockResolvedValue({ folder: null });
        apiPatch.mockResolvedValue({ asset: null });
        apiDelete.mockResolvedValue({ deleted: true });
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
                writeText: vi.fn().mockResolvedValue(undefined),
            },
        });
        window.open = vi.fn();
        window.confirm = vi.fn().mockReturnValue(true);
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
        expect(screen.getAllByText('Summer Jam').length).toBeGreaterThan(0);

        fireEvent.change(screen.getByLabelText('Asset type filter'), {
            target: { value: 'image' },
        });

        await waitFor(() => {
            expect(screen.getAllByText('Summer Poster 4x5.png').length).toBeGreaterThan(0);
            expect(screen.queryByText('VIP Loop.mp4')).not.toBeInTheDocument();
        });
    });

    it('opens a basic asset preview and copies the asset link', async () => {
        await act(async () => {
            render(
                <MemoryRouter>
                    <AssetLibraryView isDark />
                </MemoryRouter>
            );
        });

        fireEvent.click(screen.getByRole('button', { name: /Summer Poster 4x5\.png/i }));
        fireEvent.click(screen.getByRole('button', { name: /Copy asset link/i }));

        await waitFor(() => {
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
                'https://cdn.example.com/assets/summer-poster.png'
            );
        });
        expect(toastSuccess).toHaveBeenCalledWith('Signed asset URL copied');
    });

    it('does not show approval assets until they are promoted to approved assets', async () => {
        apiGet.mockImplementation((url) => {
            if (url === '/assets') {
                return Promise.resolve({ assets: [], folders: [] });
            }

            if (url.startsWith('/events')) {
                return Promise.resolve({ events: eventsResponse });
            }

            return Promise.resolve({
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
        });

        await act(async () => {
            render(
                <MemoryRouter>
                    <AssetLibraryView isDark />
                </MemoryRouter>
            );
        });

        expect(screen.queryByText('Hidden approved poster.png')).not.toBeInTheDocument();
        expect(screen.getByText('This folder is empty')).toBeInTheDocument();
    });

    it('uploads directly to the asset library without opening approvals', async () => {
        const uploadedAsset = {
            id: 'direct-asset-1',
            folderId: 'folder-1',
            originalName: 'Door Poster.png',
            filename: 'door-poster.png',
            mimeType: 'image/png',
            size: 2048,
            s3Url: 'https://cdn.example.com/assets/door-poster.png',
            usageType: 'BRAND',
            category: 'branding',
            createdAt: '2026-04-25T09:00:00.000Z',
            uploadedBy: {
                id: 'user-1',
                firstName: 'Nina',
                lastName: 'Lopez',
                email: 'nina@example.com',
            },
        };
        apiGet.mockImplementation((url) => {
            if (url === '/assets') {
                return Promise.resolve({
                    assets: [],
                    folders: [
                        {
                            id: 'folder-1',
                            name: 'Brand Photos',
                            category: 'branding',
                            usageType: 'BRAND',
                            eventId: null,
                            parentId: null,
                            createdAt: '2026-04-25T09:00:00.000Z',
                            updatedAt: '2026-04-25T09:00:00.000Z',
                        },
                    ],
                });
            }

            if (url.startsWith('/events')) {
                return Promise.resolve({ events: eventsResponse });
            }

            return Promise.resolve({ approvals: [] });
        });
        apiUpload.mockResolvedValue({ assets: [uploadedAsset] });

        await act(async () => {
            render(
                <MemoryRouter>
                    <AssetLibraryView isDark />
                </MemoryRouter>
            );
        });

        fireEvent.click(screen.getByRole('button', { name: /Upload Assets/i }));
        fireEvent.change(screen.getByLabelText('Upload folder'), {
            target: { value: 'folder-1' },
        });

        await act(async () => {
            fireEvent.change(screen.getByRole('dialog').querySelector('input[type="file"]'), {
                target: {
                    files: [new File(['image'], 'Door Poster.png', { type: 'image/png' })],
                },
            });
        });
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Upload 1 Asset/i }));
        });

        expect(apiUpload).toHaveBeenCalledWith('/assets', expect.any(FormData));
        expect(apiUpload.mock.calls[0][1].get('folderId')).toBe('folder-1');
        expect(apiUpload.mock.calls[0][1].get('usageType')).toBe(null);
        expect(apiUpload).not.toHaveBeenCalledWith(expect.stringContaining('/approvals'), expect.anything());
        await waitFor(() => {
            expect(toastSuccess).toHaveBeenCalledWith('1 file uploaded to the asset library.');
        });

        await waitFor(() => {
            expect(screen.getAllByText('Door Poster.png').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Brand library').length).toBeGreaterThan(0);
        });
    });

    it('requires a folder before uploading assets', async () => {
        apiGet.mockImplementation((url) => {
            if (url === '/assets') {
                return Promise.resolve({ assets: [], folders: [] });
            }

            if (url.startsWith('/events')) {
                return Promise.resolve({ events: eventsResponse });
            }

            return Promise.resolve({ approvals: [] });
        });

        await act(async () => {
            render(
                <MemoryRouter>
                    <AssetLibraryView isDark />
                </MemoryRouter>
            );
        });

        fireEvent.click(screen.getAllByRole('button', { name: /Upload Assets/i })[0]);

        await act(async () => {
            fireEvent.change(screen.getByRole('dialog').querySelector('input[type="file"]'), {
                target: {
                    files: [new File(['image'], 'Unsorted Poster.png', { type: 'image/png' })],
                },
            });
        });

        expect(screen.getByRole('button', { name: /Upload 1 Asset/i })).toBeDisabled();
        expect(apiUpload).not.toHaveBeenCalled();
    });

    it('creates folders from the asset explorer', async () => {
        apiGet.mockImplementation((url) => {
            if (url === '/assets') {
                return Promise.resolve({ assets: [], folders: [] });
            }

            if (url.startsWith('/events')) {
                return Promise.resolve({ events: eventsResponse });
            }

            return Promise.resolve({ approvals: [] });
        });
        apiPost.mockResolvedValue({
            folder: {
                id: 'folder-1',
                name: 'Artist Photos',
                category: 'photography',
                usageType: 'EVENT',
                eventId: 'event-1',
                event: { id: 'event-1', name: 'Summer Jam' },
                parentId: null,
                createdAt: '2026-04-25T09:00:00.000Z',
                updatedAt: '2026-04-25T09:00:00.000Z',
            },
        });

        await act(async () => {
            render(
                <MemoryRouter>
                    <AssetLibraryView isDark />
                </MemoryRouter>
            );
        });

        fireEvent.click(screen.getAllByRole('button', { name: /New Folder/i })[0]);
        fireEvent.change(screen.getByLabelText('Folder name'), {
            target: { value: 'Artist Photos' },
        });
        await act(async () => {
            fireEvent.click(screen.getByText('Create Folder').closest('button'));
        });

        expect(apiPost).toHaveBeenCalledWith('/assets/folders', {
            name: 'Artist Photos',
            category: 'artist photos',
            eventId: undefined,
            parentId: undefined,
        });
        expect(toastSuccess).toHaveBeenCalledWith('Folder created.');
        expect(screen.getAllByText('Artist Photos').length).toBeGreaterThan(0);
    });

    it('creates folders inside selected subdirectories', async () => {
        apiGet.mockImplementation((url) => {
            if (url === '/assets') {
                return Promise.resolve({
                    assets: [],
                    folders: [
                        {
                            id: 'folder-parent',
                            name: 'Brand Photos',
                            category: 'photography',
                            usageType: 'BRAND',
                            eventId: null,
                            parentId: null,
                            createdAt: '2026-04-25T09:00:00.000Z',
                            updatedAt: '2026-04-25T09:00:00.000Z',
                        },
                        {
                            id: 'folder-child',
                            name: 'Headliners',
                            category: 'photography',
                            usageType: 'BRAND',
                            eventId: null,
                            parentId: 'folder-parent',
                            createdAt: '2026-04-25T10:00:00.000Z',
                            updatedAt: '2026-04-25T10:00:00.000Z',
                        },
                    ],
                });
            }

            if (url.startsWith('/events')) {
                return Promise.resolve({ events: eventsResponse });
            }

            return Promise.resolve({ approvals: [] });
        });
        apiPost.mockResolvedValue({
            folder: {
                id: 'folder-grandchild',
                name: 'Press Selects',
                category: 'photography',
                usageType: 'BRAND',
                eventId: null,
                parentId: 'folder-child',
                createdAt: '2026-04-25T11:00:00.000Z',
                updatedAt: '2026-04-25T11:00:00.000Z',
            },
        });

        await act(async () => {
            render(
                <MemoryRouter>
                    <AssetLibraryView isDark />
                </MemoryRouter>
            );
        });

        fireEvent.click(screen.getByRole('button', { name: /New Folder/i }));
        fireEvent.change(screen.getByLabelText('Folder location'), {
            target: { value: 'folder-child' },
        });
        fireEvent.change(screen.getByLabelText('Folder name'), {
            target: { value: 'Press Selects' },
        });

        await act(async () => {
            fireEvent.click(screen.getByText('Create Folder').closest('button'));
        });

        expect(apiPost).toHaveBeenCalledWith('/assets/folders', {
            name: 'Press Selects',
            category: 'photography',
            eventId: undefined,
            parentId: 'folder-child',
        });
        expect(screen.getAllByText('Press Selects').length).toBeGreaterThan(0);
    });

    it('uploads directly into a selected folder when available', async () => {
        apiGet.mockImplementation((url) => {
            if (url === '/assets') {
                return Promise.resolve({
                    assets: [],
                    folders: [
                        {
                            id: 'folder-1',
                            name: 'Brand Photos',
                            category: 'photography',
                            usageType: 'BRAND',
                            eventId: null,
                            parentId: null,
                            createdAt: '2026-04-25T09:00:00.000Z',
                            updatedAt: '2026-04-25T09:00:00.000Z',
                        },
                    ],
                });
            }

            if (url.startsWith('/events')) {
                return Promise.resolve({ events: eventsResponse });
            }

            return Promise.resolve({ approvals: [] });
        });
        apiUpload.mockResolvedValue({ assets: [] });

        await act(async () => {
            render(
                <MemoryRouter>
                    <AssetLibraryView isDark />
                </MemoryRouter>
            );
        });

        fireEvent.click(screen.getByRole('button', { name: /Upload Assets/i }));
        fireEvent.change(screen.getByLabelText('Upload folder'), {
            target: { value: 'folder-1' },
        });

        await act(async () => {
            fireEvent.change(screen.getByRole('dialog').querySelector('input[type="file"]'), {
                target: {
                    files: [new File(['image'], 'Brand Photo.png', { type: 'image/png' })],
                },
            });
        });
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Upload 1 Asset/i }));
        });

        expect(apiUpload).toHaveBeenCalledWith('/assets', expect.any(FormData));
        expect(apiUpload.mock.calls[0][1].get('folderId')).toBe('folder-1');
        expect(apiUpload.mock.calls[0][1].get('usageType')).toBe(null);
    });

    it('moves uploaded assets by dragging them into saved folders', async () => {
        apiGet.mockImplementation((url) => {
            if (url === '/assets') {
                return Promise.resolve({
                    assets: [
                        {
                            id: 'direct-asset-1',
                            folderId: 'folder-source',
                            folder: {
                                id: 'folder-source',
                                name: 'Source Folder',
                                parentId: null,
                                category: 'photography',
                            },
                            originalName: 'Move Me.png',
                            filename: 'move-me.png',
                            mimeType: 'image/png',
                            size: 2048,
                            s3Url: 'https://cdn.example.com/assets/move-me.png',
                            usageType: 'BRAND',
                            category: 'photography',
                            createdAt: '2026-04-25T09:00:00.000Z',
                            uploadedBy: {
                                id: 'user-1',
                                firstName: 'Nina',
                                lastName: 'Lopez',
                                email: 'nina@example.com',
                            },
                        },
                    ],
                    folders: [
                        {
                            id: 'folder-source',
                            name: 'Source Folder',
                            category: 'photography',
                            usageType: 'BRAND',
                            eventId: null,
                            parentId: null,
                            createdAt: '2026-04-25T09:00:00.000Z',
                            updatedAt: '2026-04-25T09:00:00.000Z',
                        },
                        {
                            id: 'folder-target',
                            name: 'Target Folder',
                            category: 'photography',
                            usageType: 'BRAND',
                            eventId: null,
                            parentId: null,
                            createdAt: '2026-04-25T10:00:00.000Z',
                            updatedAt: '2026-04-25T10:00:00.000Z',
                        },
                    ],
                });
            }

            if (url.startsWith('/events')) {
                return Promise.resolve({ events: eventsResponse });
            }

            return Promise.resolve({ approvals: [] });
        });
        apiPatch.mockResolvedValue({
            asset: {
                id: 'direct-asset-1',
                folderId: 'folder-target',
                folder: {
                    id: 'folder-target',
                    name: 'Target Folder',
                    parentId: null,
                    category: 'photography',
                },
                originalName: 'Move Me.png',
                filename: 'move-me.png',
                mimeType: 'image/png',
                size: 2048,
                s3Url: 'https://cdn.example.com/assets/move-me.png',
                usageType: 'BRAND',
                category: 'photography',
                createdAt: '2026-04-25T09:00:00.000Z',
                uploadedBy: {
                    id: 'user-1',
                    firstName: 'Nina',
                    lastName: 'Lopez',
                    email: 'nina@example.com',
                },
            },
        });
        const dataTransfer = {
            effectAllowed: '',
            setData: vi.fn(),
            getData: vi.fn(),
        };

        await act(async () => {
            render(
                <MemoryRouter>
                    <AssetLibraryView isDark />
                </MemoryRouter>
            );
        });

        await act(async () => {
            fireEvent.dragStart(screen.getByRole('button', { name: /Move Me\.png/i }), { dataTransfer });
        });
        fireEvent.click(screen.getByLabelText('Expand Brand library'));
        await act(async () => {
            fireEvent.drop(screen.getAllByText('Target Folder')[0].closest('div'), { dataTransfer });
        });

        expect(apiPatch).toHaveBeenCalledWith('/assets/direct-asset-1/folder', {
            folderId: 'folder-target',
        });
        expect(toastSuccess).toHaveBeenCalledWith('Moved Move Me.png to Target Folder.');
    });

    it('uploads event assets into a selected event folder', async () => {
        apiGet.mockImplementation((url) => {
            if (url === '/assets') {
                return Promise.resolve({
                    assets: [],
                    folders: [
                        {
                            id: 'folder-event',
                            name: 'Summer Jam Posters',
                            category: 'posters',
                            usageType: 'EVENT',
                            eventId: 'event-1',
                            event: { id: 'event-1', name: 'Summer Jam' },
                            parentId: null,
                            createdAt: '2026-04-25T09:00:00.000Z',
                            updatedAt: '2026-04-25T09:00:00.000Z',
                        },
                    ],
                });
            }

            if (url.startsWith('/events')) {
                return Promise.resolve({ events: eventsResponse });
            }

            return Promise.resolve({ approvals: [] });
        });
        apiUpload.mockResolvedValue({
            assets: [
                {
                    id: 'direct-asset-2',
                    folderId: 'folder-event',
                    originalName: 'Stage Poster.png',
                    filename: 'stage-poster.png',
                    mimeType: 'image/png',
                    size: 2048,
                    s3Url: 'https://cdn.example.com/assets/stage-poster.png',
                    usageType: 'EVENT',
                    eventId: 'event-1',
                    event: { id: 'event-1', name: 'Summer Jam' },
                    createdAt: '2026-04-25T09:00:00.000Z',
                    uploadedBy: {
                        id: 'user-1',
                        firstName: 'Nina',
                        lastName: 'Lopez',
                        email: 'nina@example.com',
                    },
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

        fireEvent.click(screen.getByRole('button', { name: /Upload Assets/i }));
        fireEvent.change(screen.getByLabelText('Upload folder'), {
            target: { value: 'folder-event' },
        });

        await act(async () => {
            fireEvent.change(screen.getByRole('dialog').querySelector('input[type="file"]'), {
                target: {
                    files: [new File(['image'], 'Stage Poster.png', { type: 'image/png' })],
                },
            });
        });
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Upload 1 Asset/i }));
        });

        expect(apiUpload).toHaveBeenCalledWith('/assets', expect.any(FormData));
        expect(apiUpload.mock.calls[0][1].get('folderId')).toBe('folder-event');
        expect(apiUpload.mock.calls[0][1].get('usageType')).toBe(null);

        await waitFor(() => {
            expect(screen.getAllByText('Stage Poster.png').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Summer Jam').length).toBeGreaterThan(0);
        });
    });

    it('deletes uploaded assets from the preview modal', async () => {
        apiGet.mockImplementation((url) => {
            if (url === '/assets') {
                return Promise.resolve({
                    assets: [
                        {
                            id: 'direct-asset-1',
                            folderId: 'folder-1',
                            folder: {
                                id: 'folder-1',
                                name: 'Brand Photos',
                                parentId: null,
                                category: 'photography',
                            },
                            originalName: 'Delete Me.png',
                            filename: 'delete-me.png',
                            mimeType: 'image/png',
                            size: 2048,
                            s3Url: 'https://cdn.example.com/assets/delete-me.png',
                            usageType: 'BRAND',
                            category: 'photography',
                            createdAt: '2026-04-25T09:00:00.000Z',
                            uploadedBy: {
                                id: 'user-1',
                                firstName: 'Nina',
                                lastName: 'Lopez',
                                email: 'nina@example.com',
                            },
                        },
                    ],
                    folders: [
                        {
                            id: 'folder-1',
                            name: 'Brand Photos',
                            category: 'photography',
                            usageType: 'BRAND',
                            eventId: null,
                            parentId: null,
                            createdAt: '2026-04-25T09:00:00.000Z',
                            updatedAt: '2026-04-25T09:00:00.000Z',
                        },
                    ],
                });
            }

            return Promise.resolve({ approvals: [] });
        });

        await act(async () => {
            render(
                <MemoryRouter>
                    <AssetLibraryView isDark />
                </MemoryRouter>
            );
        });

        fireEvent.click(screen.getByRole('button', { name: /Delete Me\.png/i }));
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Delete Asset/i }));
        });

        expect(apiDelete).toHaveBeenCalledWith('/assets/direct-asset-1');
        expect(toastSuccess).toHaveBeenCalledWith('Asset deleted.');
        await waitFor(() => {
            expect(screen.queryByText('Delete Me.png')).not.toBeInTheDocument();
        });
    });

    it('deletes empty saved folders from the active folder header', async () => {
        apiGet.mockImplementation((url) => {
            if (url === '/assets') {
                return Promise.resolve({
                    assets: [],
                    folders: [
                        {
                            id: 'folder-1',
                            name: 'Brand Photos',
                            category: 'photography',
                            usageType: 'BRAND',
                            eventId: null,
                            parentId: null,
                            createdAt: '2026-04-25T09:00:00.000Z',
                            updatedAt: '2026-04-25T09:00:00.000Z',
                        },
                    ],
                });
            }

            return Promise.resolve({ approvals: [] });
        });

        await act(async () => {
            render(
                <MemoryRouter>
                    <AssetLibraryView isDark />
                </MemoryRouter>
            );
        });

        fireEvent.click(screen.getAllByText('Brand Photos')[0]);
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Delete Folder/i }));
        });

        expect(apiDelete).toHaveBeenCalledWith('/assets/folders/folder-1');
        expect(toastSuccess).toHaveBeenCalledWith('Folder deleted.');
        await waitFor(() => {
            expect(screen.queryByRole('button', { name: /Delete Folder/i })).not.toBeInTheDocument();
        });
    });
});
