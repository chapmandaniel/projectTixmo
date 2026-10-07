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
