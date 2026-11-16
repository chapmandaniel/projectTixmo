import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DashboardLayout from '../layouts/DashboardLayout';
import NotificationsView from '../features/NotificationsView';
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

const items = [
    { id: 'n1', subject: 'Doors open: Kitchen Party Social', message: 'Two scanners are live at the Battery Club.', createdAt: '2026-11-16T01:12:00.000Z', readAt: null },
    { id: 'n2', subject: 'Sold out: Late Show Comedy Club', message: 'The late show is now on the waitlist.', createdAt: '2026-11-15T20:00:00.000Z', readAt: null },
];

const renderApp = (entry = '/dashboard') => render(
    <MemoryRouter initialEntries={[entry]}>
        <Routes>
            <Route
                path="*"
                element={(
                    <DashboardLayout activeView={entry.replace('/', '') || 'dashboard'} isDark user={{ firstName: 'Avery', lastName: 'Quinlan' }} onLogout={vi.fn()}>
                        <Routes>
                            <Route path="/notifications" element={<NotificationsView isDark />} />
                            <Route path="*" element={<div>Dashboard Content</div>} />
                        </Routes>
                    </DashboardLayout>
                )}
            />
        </Routes>
    </MemoryRouter>
);

describe('Notifications inbox', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        api.get.mockImplementation((url) => {
            if (String(url).startsWith('/notifications')) {
                return Promise.resolve({ data: { notifications: items, pagination: { page: 1, limit: 50, total: 2, pages: 1 } } });
            }
            return Promise.resolve({ data: { notifications: items }, approvals: [] });
        });
        api.put.mockResolvedValue({});
    });

    it('VIEW ALL in the bell opens the notifications page', async () => {
        renderApp('/dashboard');
        fireEvent.click(await screen.findByRole('button', { name: 'Notifications' }));
        expect(screen.getByText('Doors open: Kitchen Party Social')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('link', { name: 'VIEW ALL' }));
        expect(await screen.findByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
        expect(screen.getByText('Two scanners are live at the Battery Club.')).toBeInTheDocument();
        expect(screen.getByText('Sold out: Late Show Comedy Club')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeInTheDocument();
    });

    it('marks one notification and all notifications as read', async () => {
        renderApp('/notifications');
        expect(await screen.findByText('Doors open: Kitchen Party Social')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Doors open: Kitchen Party Social'));
        await waitFor(() => expect(api.put).toHaveBeenCalledWith('/notifications/n1/read'));
        fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
        await waitFor(() => expect(api.put).toHaveBeenCalledWith('/notifications/read-all'));
        await waitFor(() => expect(screen.queryByRole('button', { name: 'Mark all as read' })).not.toBeInTheDocument());
    });
});
