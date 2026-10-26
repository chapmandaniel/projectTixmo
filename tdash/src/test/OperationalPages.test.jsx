import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SettingsView from '../features/SettingsView';
import ECC_Settings from '../features/ECC_Settings';
import ECC_Overview from '../features/ECC_Overview';
import ECC_Orders from '../features/ECC_Orders';
import KanbanCard from '../features/KanbanCard';
import { ordersToCsv } from '../lib/ordersCsv';
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock('../lib/api', () => ({ default: mocks }));
vi.mock('../features/OrderDetailModal', () => ({ default: ({ order }) => <aside>Detailed {order.orderNumber}: {order.tickets.length} tickets</aside> }));
const owner = { id: 'owner', role: 'OWNER', organizationId: 'actual-org' };
const event = { id: 'event', name: 'Recorded event', status: 'DRAFT', timezone: 'America/St_Johns' };
const order = (id = 'order-1') => ({ id, orderNumber: `REC-${id}`, totalAmount: 15, currency: 'cad', status: 'PAID', createdAt: '2026-10-04T03:05:00Z', user: { firstName: 'Real', lastName: 'Buyer', email: 'buyer@test.com' }, tickets: [{}] });
const wrapped = (data) => ({ data: { data } });
beforeEach(() => { vi.clearAllMocks(); mocks.post.mockResolvedValue(wrapped({})); mocks.delete.mockResolvedValue({}); });

describe('Recycle bin and event deletion', () => {
    it('uses the signed-in organization, searches on the server, and restores drafts', async () => {
        mocks.get.mockResolvedValue(wrapped({ events: [{ ...event, deletedAt: '2026-10-04T03:05:00Z' }], pagination: { pages: 1 } }));
        render(<SettingsView isDark user={owner} />);
        await screen.findByText('Recorded event');
        expect(mocks.get).toHaveBeenCalledWith('/events/deleted', expect.objectContaining({ params: expect.objectContaining({ organizationId: 'actual-org' }) }));
        fireEvent.change(screen.getByLabelText('Search deleted events'), { target: { value: 'Recorded' } });
        fireEvent.click(screen.getByRole('button', { name: 'Search' }));
        await waitFor(() => expect(mocks.get).toHaveBeenCalledWith('/events/deleted', expect.objectContaining({ params: expect.objectContaining({ search: 'Recorded' }) })));
        fireEvent.click(await screen.findByRole('button', { name: 'Restore' }));
        await screen.findByText('Event restored as a draft.');
        expect(mocks.post).toHaveBeenCalledWith('/events/event/restore');
        expect(screen.queryByText(/permanently deleted after/)).not.toBeInTheDocument();
    });
    it('reports a load failure without claiming the bin is empty', async () => {
        mocks.get.mockRejectedValue(new Error('Unavailable'));
        render(<SettingsView isDark user={owner} />);
        expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load deleted events');
        expect(screen.queryByText('No deleted events found')).not.toBeInTheDocument();
    });
    it('requires confirmation and retains backend deletion errors', async () => {
        mocks.delete.mockRejectedValue({ response: { data: { message: 'Cannot delete event with existing tickets.' } } });
        const onDeleted = vi.fn();
        render(<ECC_Settings event={event} isDark user={owner} onDeleted={onDeleted} />);
        fireEvent.click(screen.getByRole('button', { name: 'Delete Event' }));
        expect(mocks.delete).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }));
        await screen.findByText('Cannot delete event with existing tickets.');
        expect(onDeleted).not.toHaveBeenCalled();
    });
    it('hides deletion from staff who cannot delete events', () => {
        render(<ECC_Settings event={event} isDark user={{ role: 'MANAGER' }} />);
        expect(screen.queryByRole('button', { name: 'Delete Event' })).not.toBeInTheDocument();
    });
});

describe('Recorded event operations', () => {
    it('loads recorded metrics, changes currency, and reports unavailable traffic', async () => {
        mocks.get.mockImplementation((url, options) => Promise.resolve(wrapped(url === '/analytics/sales' ? { totalRevenue: options.params.currency === 'cad' ? 150 : 400, totalOrders: 2, salesByDay: [] } : url.endsWith('/stats') ? { ticketsSold: 4, ticketsUsed: 1 } : { orders: [order()] })));
        render(<ECC_Overview event={event} isDark />);
        await screen.findByText(/CAD.*150/);
        expect(screen.getByText(/Page views and conversion rate are unavailable/)).toBeInTheDocument();
        expect(screen.queryByText('Alex M.')).not.toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Revenue currency'), { target: { value: 'usd' } });
        await screen.findByText(/USD.*400/);
        expect(mocks.get).toHaveBeenCalledWith('/analytics/sales', expect.objectContaining({ params: expect.objectContaining({ eventId: event.id, currency: 'usd' }) }));
    });
    it('preserves failure instead of displaying fabricated zero revenue', async () => {
        mocks.get.mockRejectedValue(new Error('Offline'));
        render(<ECC_Overview event={event} isDark />);
        await screen.findByRole('alert');
        expect(screen.queryByText('Paid revenue')).not.toBeInTheDocument();
    });
    it('filters order queries and loads authoritative order detail', async () => {
        mocks.get.mockImplementation((url) => Promise.resolve(wrapped(url.startsWith('/orders/') ? { ...order(), tickets: [{}, {}] } : { orders: [order()], pagination: { total: 1 } })));
        render(<ECC_Orders event={event} isDark />);
        await screen.findByText('REC-order-1');
        fireEvent.change(screen.getByLabelText('Search orders'), { target: { value: 'buyer' } });
        fireEvent.click(screen.getByRole('button', { name: 'Search' }));
        fireEvent.change(screen.getByLabelText('Order status'), { target: { value: 'PAID' } });
        await waitFor(() => expect(mocks.get).toHaveBeenCalledWith('/orders', { params: { eventId: 'event', page: 1, limit: 20, search: 'buyer', status: 'PAID' } }));
        fireEvent.click(await screen.findByRole('button', { name: 'View order' }));
        await screen.findByText('Detailed REC-order-1: 2 tickets');
        expect(mocks.get).toHaveBeenCalledWith('/orders/order-1');
    });
    it('exports every filtered page and rejects incomplete exports', async () => {
        const rows = Array.from({ length: 101 }, (_, index) => order(`order-${index}`));
        let blob;
        URL.createObjectURL = vi.fn((value) => { blob = value; return 'blob:test'; });
        URL.revokeObjectURL = vi.fn();
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        mocks.get.mockImplementation((_url, { params }) => Promise.resolve(wrapped({ orders: params.limit === 100 ? rows.slice((params.page - 1) * 100, params.page * 100) : rows.slice(0, 20), pagination: { total: 101, pages: params.limit === 100 ? 2 : 6 } })));
        render(<ECC_Orders event={event} isDark />);
        await screen.findByText('REC-order-0');
        fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
        await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
        const contents = await new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blob); });
        expect(contents).toContain('REC-order-100');
        expect(contents.split('\r\n')).toHaveLength(102);
        expect(mocks.get).toHaveBeenCalledWith('/orders', { params: { eventId: 'event', page: 2, limit: 100 } });
        mocks.get.mockResolvedValue(wrapped({ orders: [order()], pagination: { total: 2, pages: 1 } }));
        fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
        await screen.findByText('Orders changed during export. Please try again.');
        expect(click).toHaveBeenCalledTimes(1);
        click.mockRestore();
    });
    it('uses the task relation when a separate staff directory is unavailable', () => {
        render(<KanbanCard isDark item={{ id: 'task', content: 'Task', assignee: 'actual-user', assigneeDetails: { id: 'actual-user', firstName: 'Real', lastName: 'Colleague' } }} />);
        expect(screen.getByTitle('Assigned to Real Colleague')).toBeInTheDocument();
    });
});

it('exports customer-controlled values as text with CSV quotes escaped', () => {
    const csv = ordersToCsv([{ ...order(), user: { firstName: '=HYPERLINK("example")', lastName: 'Buyer', email: '\tformula' } }]);
    expect(csv).toContain('"\'=HYPERLINK(""example"") Buyer"');
    expect(csv).toContain('"\'\tformula"');
    expect(csv).toContain('"CAD","15.00"');
});

it('exports a missing order currency as the configured payment currency', () => {
    const csv = ordersToCsv([{ orderNumber: 'REC-missing', createdAt: '2026-10-04T03:05:00Z', status: 'PAID', totalAmount: 10, tickets: [] }]);
    expect(csv).toContain('"CAD","10.00"');
    expect(csv).not.toContain('"USD"');
});
