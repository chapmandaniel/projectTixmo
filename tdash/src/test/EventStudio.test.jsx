import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EventStudio from '../features/EventStudio';

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn() }));
vi.mock('../lib/api', () => ({ default: mocks }));
const event = { id: '10000000-0000-4000-8000-000000000001', name: 'Saved event', timezone: 'America/St_Johns',
    startDatetime: '2026-10-04T21:30:15.000Z', endDatetime: '2026-10-05T01:30:00.000Z', status: 'DRAFT' };
const type = { id: '10000000-0000-4000-8000-000000000002', name: 'Admission', price: 10, quantityTotal: 10,
    tiers: [{ id: '10000000-0000-4000-8000-000000000003', name: 'Early', price: 8, quantityLimit: 5,
        startsAt: '2026-10-03T21:30:15.000Z', endsAt: null, isActive: true, sortOrder: 0 }] };
beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockImplementation(url => Promise.resolve({ data: { data: url.startsWith('/venues') ? { venues: [] } : { ticketTypes: [type] } } }));
    mocks.put.mockResolvedValue({ data: { data: event } }); mocks.post.mockResolvedValue({ data: { data: event } });
});
const show = (initialData = event) => render(<EventStudio user={{ organizationId: 'organization' }} initialData={initialData} isDark embedded />);
describe('Event Studio persistence', () => {
    it('round-trips unchanged event and tier instants through one atomic configuration request', async () => {
        show();
        await screen.findAllByText('Admission');
        expect(screen.getByLabelText('Start')).toHaveValue('2026-10-04T19:00');
        fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
        await waitFor(() => expect(mocks.put).toHaveBeenCalledTimes(1));
        expect(mocks.put).toHaveBeenCalledWith(`/events/${event.id}/configuration`, expect.objectContaining({
            publish: false, event: expect.objectContaining({ startDateTime: event.startDatetime, timezone: event.timezone }),
            ticketTypes: [expect.objectContaining({ id: type.id, tiers: [expect.objectContaining({ startsAt: type.tiers[0].startsAt })] })],
        }));
        expect(mocks.post).not.toHaveBeenCalled();
    });
    it.each([
        ['Nov 9 standard time', '2026-11-09T15:30:27.123Z', '2026-11-09T12:00'],
        ['DST first occurrence', '2026-11-01T04:00:27.123Z', '2026-11-01T01:30'],
        ['DST second occurrence', '2026-11-01T05:00:27.123Z', '2026-11-01T01:30'],
    ])('preserves %s event, ticket and tier windows without rewriting inventory', async (_, opening, local) => {
        const saved = { ...event, startDatetime: opening, salesStart: opening, salesEnd: '2026-11-10T20:00:00.000Z' };
        const stock = { ...type, quantity: 2, quantityTotal: 100, quantityAvailable: 63, quantitySold: 30, quantityHeld: 7,
            maxPerOrder: 4, salesStart: opening, salesEnd: '2026-11-10T20:00:00.000Z',
            tiers: [{ ...type.tiers[0], startsAt: opening, endsAt: '2026-11-10T20:00:00.000Z', quantitySold: 3, quantityHeld: 1 }] };
        mocks.get.mockImplementation(url => Promise.resolve({ data: { data: url.startsWith('/venues') ? { venues: [] } : { ticketTypes: [stock] } } }));
        show(saved); await screen.findAllByText('Admission');
        expect(screen.getByLabelText('Start')).toHaveValue(local);
        fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
        await waitFor(() => expect(mocks.put).toHaveBeenCalledTimes(1));
        const request = mocks.put.mock.calls[0][1];
        expect(request.event.startDateTime).toBe(opening);
        expect(request.ticketTypes[0]).toMatchObject({ quantity: 100, maxPerOrder: 4, salesStart: opening,
            salesEnd: stock.salesEnd, tiers: [expect.objectContaining({ startsAt: opening, endsAt: stock.salesEnd })] });
        // Counters belong to the server: never send stale sold/held/available values.
        for (const counter of ['quantitySold', 'quantityHeld', 'quantityAvailable', 'sold']) {
            expect(request.ticketTypes[0]).not.toHaveProperty(counter);
            expect(request.ticketTypes[0].tiers[0]).not.toHaveProperty(counter);
        }
    });
    it('does not replace an unknown total with remaining inventory', async () => {
        mocks.get.mockImplementation(url => Promise.resolve({ data: { data: url.startsWith('/venues') ? { venues: [] } : {
            ticketTypes: [{ ...type, quantityTotal: undefined, quantityAvailable: 6, quantitySold: 4 }],
        } } }));
        show(); await screen.findAllByText('Admission');
        fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
        await screen.findByText(/total quantity/i);
        expect(mocks.put).not.toHaveBeenCalled();
    });
    it('rejects a missing daylight-saving wall time before any write', async () => {
        show(); await screen.findAllByText('Admission');
        fireEvent.change(screen.getByLabelText('Start'), { target: { value: '2027-03-14T02:30' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
        await screen.findByText(/does not exist/); expect(mocks.put).not.toHaveBeenCalled();
    });
    it('blocks saves when existing ticket configuration could not be loaded', async () => {
        mocks.get.mockImplementation(url => url.startsWith('/venues') ? Promise.resolve({ data: { data: { venues: [] } } }) : Promise.reject(new Error('Unavailable')));
        show(); await screen.findByText(/could not be loaded/);
        fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
        expect(mocks.put).not.toHaveBeenCalled(); expect(mocks.post).not.toHaveBeenCalled();
    });
    it('defaults a blank timezone to America/St_Johns and preserves an explicit timezone', async () => {
        show(null);
        const zone = screen.getByLabelText('Event timezone');
        expect(zone).toHaveValue('America/St_Johns');
        fireEvent.change(zone, { target: { value: '   ' } });
        fireEvent.change(screen.getByLabelText('Event Title'), { target: { value: 'Harbour show' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
        await screen.findByText('Draft saved.');
        expect(mocks.post.mock.calls[0][1].event.timezone).toBe('America/St_Johns');

        fireEvent.change(screen.getByLabelText('Event timezone'), { target: { value: 'America/Halifax' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
        await waitFor(() => expect(mocks.put).toHaveBeenCalledTimes(1));
        expect(mocks.put.mock.calls[0][1].event.timezone).toBe('America/Halifax');
    });
    it('retains a newly saved draft identity for subsequent saves', async () => {
        show(null);
        fireEvent.change(screen.getByLabelText('Event Title'), { target: { value: 'Saved event' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
        await screen.findByText('Draft saved.');
        fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
        await waitFor(() => expect(mocks.put).toHaveBeenCalledTimes(1));
        expect(mocks.post).toHaveBeenCalledTimes(1);
    });
});
