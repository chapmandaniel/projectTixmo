import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SharedAssetFolderPage from '../pages/SharedAssetFolderPage';

vi.mock('../lib/runtimeConfig', () => ({
    getApiBaseUrl: () => 'https://api.example.com/api/v1',
}));

const sharedFolderResponse = {
    share: {
        id: 'share-1',
        expiresAt: '2026-05-18T12:00:00.000Z',
    },
    organization: {
        name: 'Mighty Quinton',
    },
    folder: {
        id: 'folder-root',
        name: 'Press Kit',
        parentId: null,
        assetCount: 1,
    },
    folders: [
        {
            id: 'folder-root',
            name: 'Press Kit',
            parentId: null,
            assetCount: 1,
        },
        {
            id: 'folder-photos',
            name: 'Artist Photos',
            parentId: 'folder-root',
            assetCount: 1,
        },
        {
            id: 'folder-stage',
            name: 'Stage Shots',
            parentId: 'folder-photos',
            assetCount: 1,
        },
    ],
    assets: [
        {
            id: 'asset-root',
            folderId: 'folder-root',
            originalName: 'Press release.pdf',
            mimeType: 'application/pdf',
            size: 1024,
            s3Url: 'https://cdn.example.com/press-release.pdf',
            folder: {
                id: 'folder-root',
                name: 'Press Kit',
            },
        },
        {
            id: 'asset-photo',
            folderId: 'folder-photos',
            originalName: 'Headliner portrait.png',
            mimeType: 'image/png',
            size: 2048,
            s3Url: 'https://cdn.example.com/headliner.png',
            folder: {
                id: 'folder-photos',
                name: 'Artist Photos',
            },
        },
        {
            id: 'asset-stage',
            folderId: 'folder-stage',
            originalName: 'Stage wide.png',
            mimeType: 'image/png',
            size: 4096,
            s3Url: 'https://cdn.example.com/stage-wide.png',
            folder: {
                id: 'folder-stage',
                name: 'Stage Shots',
            },
        },
    ],
};

describe('SharedAssetFolderPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(sharedFolderResponse),
        });
    });

    it('lets external visitors browse nested shared folders', async () => {
        render(
            <MemoryRouter initialEntries={['/assets/shared/share-token']}>
                <Routes>
                    <Route path="/assets/shared/:token" element={<SharedAssetFolderPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Press Kit' })).toBeInTheDocument();
        });

        expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/api/v1/assets/shares/share-token');
        expect(screen.getByText('Press release.pdf')).toBeInTheDocument();
        expect(screen.queryByText('Headliner portrait.png')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Artist Photos/i }));

        expect(screen.getByRole('heading', { name: 'Artist Photos' })).toBeInTheDocument();
        expect(screen.getByText('Headliner portrait.png')).toBeInTheDocument();
        expect(screen.queryByText('Press release.pdf')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Stage Shots/i })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /^Press Kit$/i }));

        expect(screen.getByRole('heading', { name: 'Press Kit' })).toBeInTheDocument();
        expect(screen.getByText('Press release.pdf')).toBeInTheDocument();
    });
});
