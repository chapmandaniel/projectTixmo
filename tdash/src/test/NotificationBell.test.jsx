import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import api from '../lib/api';

vi.mock('../lib/api', () => ({
    default: {
        get: vi.fn(),
        put: vi.fn(),
        post: vi.fn(),
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() },
        },
    },
}));

const unread = {
    id: 'n-unread',
    subject: 'Door briefing',
    message: 'Radios are in the office',
    createdAt: '2026-11-15T12:00:00.000Z',
    readAt: null,
};
const alreadyRead = {
    id: 'n-read',
    subject: 'Wristbands printed',
    message: 'Packed in bin A',
    createdAt: '2026-11-14T12:00:00.000Z',
    readAt: '2026-11-14T18:00:00.000Z',
};

const owner = { firstName: 'Avery', lastName: 'Stone', role: 'OWNER', email: 'avery@example.test' };

const renderLayout = () =>
    render(
        <MemoryRouter>
            <DashboardLayout activeView="dashboard" isDark={false} user={owner} onLogout={vi.fn()}>
                <div>Dashboard Content</div>
            </DashboardLayout>
        </MemoryRouter>
    );

describe('Notification bell', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        api.get.mockImplementation(async (url = '') => {
            if (String(url).startsWith('/notifications')) {
                return { data: { data: { notifications: [unread, alreadyRead] } } };
            }
            if (String(url).startsWith('/approvals')) {
                return { data: { approvals: [] } };
            }
            return { data: {} };
        });
        api.put.mockResolvedValue({ data: { success: true } });
    });

    it('shows an unread badge, lists the bell items, and marks one as read on click', async () => {
        renderLayout();

        const bell = await screen.findByRole('button', { name: 'Notifications' });
        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith('/notifications?limit=10');
        });
        expect(bell.querySelector('span.rounded-full')).toBeTruthy();

        fireEvent.click(bell);
        expect(await screen.findByText('Door briefing')).toBeInTheDocument();
        expect(screen.getByText('Wristbands printed')).toBeInTheDocument();
        expect(screen.getByText('Radios are in the office')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Door briefing'));
        await waitFor(() => {
            expect(api.put).toHaveBeenCalledWith('/notifications/n-unread/read');
        });

        fireEvent.click(screen.getByText('Wristbands printed'));
        expect(api.put).toHaveBeenCalledTimes(1);

        await waitFor(() => {
            expect(bell.querySelector('span.rounded-full')).toBeNull();
        });
    });

    it('does not show an unread badge when every notification is already read', async () => {
        api.get.mockImplementation(async (url = '') => {
            if (String(url).startsWith('/notifications')) {
                return { data: { data: { notifications: [{ ...unread, readAt: '2026-11-15T13:00:00.000Z' }, alreadyRead] } } };
            }
            return { data: { approvals: [] } };
        });
        renderLayout();
        const bell = await screen.findByRole('button', { name: 'Notifications' });
        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith('/notifications?limit=10');
        });
        expect(bell.querySelector('span.rounded-full')).toBeNull();
    });

    it('does not mark read when the mark-read request is forbidden', async () => {
        api.put.mockRejectedValueOnce({ response: { status: 403 } });
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        renderLayout();
        const bell = await screen.findByRole('button', { name: 'Notifications' });
        await waitFor(() => expect(api.get).toHaveBeenCalled());
        fireEvent.click(bell);
        fireEvent.click(await screen.findByText('Door briefing'));
        await waitFor(() => {
            expect(api.put).toHaveBeenCalledWith('/notifications/n-unread/read');
        });
        expect(bell.querySelector('span.rounded-full')).toBeTruthy();
        errorSpy.mockRestore();
    });

    it('marks every notification as read from the bell (DashboardLayout.jsx:342-346)', async () => {
        renderLayout();
        fireEvent.click(await screen.findByRole('button', { name: 'Notifications' }));
        fireEvent.click(await screen.findByRole('button', { name: 'MARK ALL READ' }));
        await waitFor(() => {
            expect(api.put).toHaveBeenCalledWith('/notifications/read-all');
        });
        expect(
            within(screen.getByRole('button', { name: 'Notifications' })).queryByText('', {
                selector: 'span.rounded-full',
            })
        ).toBeNull();
    });
});
