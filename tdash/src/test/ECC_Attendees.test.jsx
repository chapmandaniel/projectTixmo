import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ECC_Attendees from '../features/ECC_Attendees';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../lib/api', () => ({ default: mocks }));

const event = {
    id: 'event-1',
    name: 'Harbor Night',
    status: 'ON_SALE',
    startDatetime: '2026-10-26T22:00:00.000Z',
    endDatetime: '2099-01-01T00:00:00.000Z',
};
const ticket = (id, user, orderNumber = `ORD-${id}`) => ({
    id,
    barcode: `TIX-${id}`,
    status: 'VALID',
    user,
    ticketType: { name: 'General' },
    order: { orderNumber, status: 'PAID', refundStatus: 'NONE' },
});
const ada = ticket('ada', { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' }, 'ORD-ADA');
const grace = ticket('grace', { firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.com' }, 'ORD-GRACE');
const wrapped = (data) => ({ data: { data } });

beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockImplementation((url, config) => {
        if (config?.params?.limit === 100) {
            const page = config.params.page;
            return Promise.resolve(wrapped({
                tickets: page === 1 ? [ada] : page === 2 ? [grace] : [],
                pagination: { total: 2, pages: 2 },
            }));
        }
        return Promise.resolve(wrapped({ tickets: [ada], pagination: { total: 2, pages: 2 } }));
    });
    mocks.post.mockResolvedValue(wrapped({ status: 'USED' }));
});

describe('Attendees search, export, and check-in', () => {
    it('searches the loaded guest list by name and order number', async () => {
        render(<ECC_Attendees event={event} isDark />);
        expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Search attendees'), { target: { value: 'Hopper' } });
        fireEvent.click(screen.getByRole('button', { name: 'Search' }));
        expect(await screen.findByText('Grace Hopper')).toBeInTheDocument();
        expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('Showing 1 attendee matching "Hopper"');
        fireEvent.change(screen.getByLabelText('Search attendees'), { target: { value: 'ORD-ADA' } });
        fireEvent.click(screen.getByRole('button', { name: 'Search' }));
        expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
        expect(screen.queryByText('Grace Hopper')).not.toBeInTheDocument();
    });

    it('exports every attendee page and rejects an incomplete export', async () => {
        let blob;
        URL.createObjectURL = vi.fn((value) => { blob = value; return 'blob:attendees'; });
        URL.revokeObjectURL = vi.fn();
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        render(<ECC_Attendees event={event} isDark />);
        await screen.findByText('Ada Lovelace');
        fireEvent.click(screen.getByRole('button', { name: 'Export List' }));
        await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
        const contents = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsText(blob);
        });
        expect(contents).toContain('ORD-ADA');
        expect(contents).toContain('ORD-GRACE');
        expect(contents).toContain('grace@example.com');
        expect(contents).toContain('Confirmed');
        expect(contents).not.toContain('Barcode');
        expect(contents).not.toContain('TIX-');
        mocks.get.mockImplementation((url, config) => {
            if (config?.params?.limit === 100) {
                return Promise.resolve(wrapped({
                    tickets: config.params.page === 1 ? [ada] : [grace],
                    pagination: { total: config.params.page === 1 ? 2 : 3, pages: 2 },
                }));
            }
            return Promise.resolve(wrapped({ tickets: [ada], pagination: { total: 2, pages: 2 } }));
        });
        fireEvent.click(screen.getByRole('button', { name: 'Export List' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Attendees changed during export. Please try again.');
        expect(click).toHaveBeenCalledTimes(1);
        click.mockRestore();
    });

    it('shows the API check-in refusal and does not open doors on a local clock', async () => {
        const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
        mocks.post.mockRejectedValue({ response: { data: { message: 'Event has not started yet' } } });
        render(<ECC_Attendees event={event} isDark />);
        await screen.findByText('Ada Lovelace');
        fireEvent.click(screen.getByTitle('Check In'));
        await waitFor(() => expect(alert).toHaveBeenCalledWith('Check-in failed: Event has not started yet'));
        expect(mocks.post).toHaveBeenCalledWith('/tickets/check-in', { barcode: 'TIX-ada' });
        expect(screen.getByText('Confirmed')).toBeInTheDocument();
        expect(screen.queryByText('Checked In')).not.toBeInTheDocument();
        expect(screen.queryByText(/doors/i)).not.toBeInTheDocument();
        alert.mockRestore();
    });

    it('shows Cancelled once and checks in only when the admit rule would', async () => {
        const cancelled = {
            ...ada,
            id: 'cancelled',
            status: 'CANCELLED',
            order: { orderNumber: 'ORD-CANCEL', status: 'CANCELLED', refundStatus: 'NONE' },
        };
        const failedRefund = {
            ...grace,
            id: 'failed',
            status: 'VALID',
            order: { orderNumber: 'ORD-FAILED', status: 'PAID', refundStatus: 'FAILED' },
        };
        mocks.get.mockImplementation(() => Promise.resolve(wrapped({
            tickets: [cancelled, failedRefund],
            pagination: { total: 2, pages: 1 },
        })));
        render(<ECC_Attendees event={event} isDark />);
        expect(await screen.findByText('Failed')).toBeInTheDocument();
        expect(screen.getAllByText('Cancelled')).toHaveLength(1);
        expect(screen.getAllByTitle('Check In')).toHaveLength(1);
    });

    it('hides check-in before doors and for a disputed ticket', async () => {
        const earlyEvent = {
            ...event,
            startDatetime: '2099-01-01T12:00:00.000Z',
            endDatetime: '2099-01-01T18:00:00.000Z',
        };
        const disputed = {
            ...ada,
            order: { orderNumber: 'ORD-DISPUTE', status: 'PAID', refundStatus: 'DISPUTED' },
        };
        mocks.get.mockImplementation(() => Promise.resolve(wrapped({
            tickets: [disputed],
            pagination: { total: 1, pages: 1 },
        })));
        const { unmount } = render(<ECC_Attendees event={event} isDark />);
        expect(await screen.findByText('Disputed')).toBeInTheDocument();
        expect(screen.queryByTitle('Check In')).not.toBeInTheDocument();
        unmount();
        mocks.get.mockImplementation(() => Promise.resolve(wrapped({
            tickets: [ada],
            pagination: { total: 1, pages: 1 },
        })));
        render(<ECC_Attendees event={earlyEvent} isDark />);
        expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
        expect(screen.queryByTitle('Check In')).not.toBeInTheDocument();
    });

    it('shows a dispute or refund label and no check-in for a void ticket', async () => {
        const disputed = {
            ...ada,
            id: 'disputed',
            status: 'VALID',
            order: { orderNumber: 'ORD-DISPUTE', status: 'PAID', refundStatus: 'DISPUTED' },
        };
        const refunded = {
            ...grace,
            id: 'refunded',
            status: 'CANCELLED',
            order: { orderNumber: 'ORD-REFUND', status: 'REFUNDED', refundStatus: 'SUCCEEDED' },
        };
        mocks.get.mockImplementation(() => Promise.resolve(wrapped({
            tickets: [disputed, refunded],
            pagination: { total: 2, pages: 1 },
        })));
        render(<ECC_Attendees event={event} isDark />);
        expect(await screen.findByText('Disputed')).toBeInTheDocument();
        expect(screen.getByText('Refunded')).toBeInTheDocument();
        expect(screen.getByText('Cancelled')).toBeInTheDocument();
        expect(screen.queryByTitle('Check In')).not.toBeInTheDocument();
        expect(screen.queryByText('DISPUTED')).not.toBeInTheDocument();
        expect(screen.queryByText('SUCCEEDED')).not.toBeInTheDocument();
        expect(screen.queryByText('VOID_DISPUTED')).not.toBeInTheDocument();
    });

    it('filters the attendee list with the ticket status the API already accepts', async () => {
        render(<ECC_Attendees event={event} isDark />);
        await screen.findByText('Ada Lovelace');
        fireEvent.click(screen.getByRole('button', { name: 'Filter attendees' }));
        await waitFor(() => expect(mocks.get).toHaveBeenCalledWith('/tickets?eventId=event-1&page=1&limit=20&sortBy=createdAt&status=VALID'));
        expect(screen.getByRole('button', { name: 'Filter attendees' })).toHaveTextContent('Filter: Confirmed');
    });
});
