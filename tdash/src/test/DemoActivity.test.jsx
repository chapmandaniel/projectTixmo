import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import KanbanCard from '../features/KanbanCard';
import HomePulse, { summarizePulse } from '../features/home/HomePulse';
import MemberAvatar, { avatarGradient, relativeActive } from '../components/dashboard/MemberAvatar';

const apiGet = vi.fn();
vi.mock('../lib/api', () => ({
    default: {
        get: (...args) => apiGet(...args),
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    },
}));

const NOW = new Date('2026-11-15T23:30:00Z').getTime();
const HOUR = 3600000;

describe('MemberAvatar', () => {
    it('shows initials on a stable gradient and formats last-active times', () => {
        render(<MemberAvatar firstName="Hana" lastName="Sato" email="hana@example.com" />);
        expect(screen.getByTestId('member-avatar')).toHaveTextContent('HS');
        expect(avatarGradient('Hana Sato')).toBe(avatarGradient('Hana Sato'));
        expect(relativeActive(new Date(NOW - 30 * 1000).toISOString(), NOW)).toBe('Active now');
        expect(relativeActive(new Date(NOW - 12 * 60000).toISOString(), NOW)).toBe('Active 12 min ago');
        expect(relativeActive(new Date(NOW - 5 * HOUR).toISOString(), NOW)).toBe('Active 5 hr ago');
        expect(relativeActive(null, NOW)).toBeNull();
    });
});

describe('KanbanCard', () => {
    it('shows the event, due date, assignee avatar and comment count', () => {
        const item = {
            id: 't1', content: 'Door staffing plan', tag: 'OPS', priority: 'HIGH', status: 'TO_DO',
            eventName: 'Harbour Lights Festival', dueDate: new Date(Date.now() - 2 * 24 * HOUR).toISOString(),
            assignee: 'u1', assigneeDetails: { id: 'u1', firstName: 'Dev', lastName: 'Kapoor' },
            messages: [{ id: 'm1' }, { id: 'm2' }],
        };
        render(<KanbanCard item={item} isDark onDelete={() => {}} onExpand={() => {}} />);
        const meta = screen.getByTestId('kanban-card-meta');
        expect(within(meta).getByText('Harbour Lights Festival')).toBeInTheDocument();
        expect(within(meta).getByText(/Overdue/)).toBeInTheDocument();
        expect(screen.getByText('High')).toBeInTheDocument();
        expect(screen.getByTestId('member-avatar')).toHaveTextContent('DK');
        expect(screen.getByTestId('kanban-comment-count')).toHaveTextContent('2');
    });
});

describe('HomePulse', () => {
    const events = [
        { id: 'e1', name: 'Kitchen Party Social', status: 'ON_SALE', startDatetime: new Date(NOW - HOUR).toISOString(), endDatetime: new Date(NOW + 3 * HOUR).toISOString() },
        { id: 'e2', name: 'Aurora After Dark', status: 'ON_SALE', startDatetime: new Date(NOW + 12 * 24 * HOUR).toISOString(), endDatetime: new Date(NOW + 12.2 * 24 * HOUR).toISOString() },
        { id: 'e3', name: 'Quiet Harbour Acoustic', status: 'COMPLETED', startDatetime: new Date(NOW - 9 * 24 * HOUR).toISOString(), endDatetime: new Date(NOW - 8.9 * 24 * HOUR).toISOString() },
    ];
    const tasks = [
        { id: 't1', status: 'TO_DO', dueDate: new Date(NOW - 24 * HOUR).toISOString() },
        { id: 't2', status: 'IN_PROGRESS', dueDate: new Date(NOW + 5 * 24 * HOUR).toISOString() },
        { id: 't3', status: 'DONE', dueDate: new Date(NOW - 24 * HOUR).toISOString() },
    ];

    it('summarizes today, live events and open work, and tolerates bad shapes', () => {
        const s = summarizePulse({
            today: { totalTicketsSold: 64, totalOrders: 31, totalRevenue: 2400 },
            month: { sales: { totalRevenue: 210000, totalTicketsSold: 3100 } },
            trend: { salesByDay: [{ date: new Date(NOW).toISOString().slice(0, 10), tickets: 64, revenue: 2400 }] },
            events, tasks, now: NOW,
        });
        expect(s.ticketsToday).toBe(64);
        expect(s.live.map((e) => e.name)).toEqual(['Kitchen Party Social']);
        expect(s.onSale).toBe(2);
        expect(s.next.name).toBe('Aurora After Dark');
        expect(s.openTasks).toBe(2);
        expect(s.dueSoon).toBe(1);
        expect(s.days).toHaveLength(14);
        expect(s.days[13].tickets).toBe(64);
        expect(summarizePulse({ events: { bad: true }, tasks: 'nope', now: NOW }).openTasks).toBe(0);
    });

    beforeEach(() => {
        apiGet.mockReset();
        apiGet.mockImplementation((url) => {
            const ok = (data) => Promise.resolve({ data: { success: true, data } });
            if (url === '/analytics/sales') return ok({ totalTicketsSold: 64, totalOrders: 31, totalRevenue: 2400, salesByDay: [] });
            if (url === '/analytics/dashboard') return ok({ sales: { totalRevenue: 210000, totalTicketsSold: 3100 } });
            if (url === '/events') return ok({ events });
            if (url === '/tasks') return Promise.resolve({ data: tasks });
            if (url === '/notifications') return ok({ notifications: [{ id: 'n1', subject: 'Doors open: Kitchen Party Social', message: 'Two scanners are live.', createdAt: new Date(NOW - 6 * 60000).toISOString() }] });
            return Promise.reject(new Error('unexpected'));
        });
    });

    it('renders the daily tiles, chart and activity feed', async () => {
        render(<MemoryRouter><HomePulse isDark pendingApprovals={5} now={NOW} /></MemoryRouter>);
        await waitFor(() => expect(screen.getByTestId('home-pulse')).toBeInTheDocument());
        expect(screen.getByText('Tickets sold today')).toBeInTheDocument();
        expect(screen.getByText('64')).toBeInTheDocument();
        expect(screen.getByText('Live now: Kitchen Party Social')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
        expect(screen.getByTestId('home-sales-chart').children).toHaveLength(14);
        expect(within(screen.getByTestId('home-activity')).getByText('Doors open: Kitchen Party Social')).toBeInTheDocument();
        expect(within(screen.getByTestId('home-activity')).getByText('6 min ago')).toBeInTheDocument();
    });
});
