import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import EventSalesControl from '../features/EventSalesControl';
const mocks = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock('../lib/api', () => ({ api: mocks }));
const event = { id: 'event', salesPaused: false };
const user = { id: 'manager', role: 'MANAGER' };
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const submit = () => {
    fireEvent.change(screen.getByLabelText('Operational reason (no credentials)'), { target: { value: 'Incident review' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pause new sales' }));
};
it('refreshes acknowledged current state and propagates it to the parent', async () => {
    const updated = { ...event, salesPaused: true };
    mocks.post.mockImplementation(async (_url, request) => ({ data: { eventId: event.id, requestId: request.requestId, salesPaused: request.paused } }));
    mocks.get.mockResolvedValue({ data: updated });
    const onUpdate = vi.fn();
    const view = render(<EventSalesControl event={event} user={user} onUpdate={onUpdate} />);
    submit();
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(updated));
    view.rerender(<EventSalesControl event={updated} user={user} onUpdate={onUpdate} />);
    expect(screen.getByText('New ticket sales: paused')).toBeInTheDocument();
});
it('retains identical request across ambiguity, but allows explicit discard after definitive rejection', async () => {
    mocks.post.mockRejectedValueOnce(new Error('Lost response')).mockRejectedValueOnce({ response: { status: 403, data: { message: 'Denied' } } });
    render(<EventSalesControl event={event} user={user} />);
    submit();
    await screen.findByText('Lost response');
    fireEvent.click(screen.getByRole('button', { name: 'Retry same request' }));
    await screen.findByText('Denied');
    expect(mocks.post.mock.calls[0][1]).toBe(mocks.post.mock.calls[1][1]);
    fireEvent.click(screen.getByRole('button', { name: 'Discard rejected request' }));
    expect(screen.getByLabelText('Operational reason (no credentials)')).toHaveValue('');
    expect(mocks.post).toHaveBeenCalledTimes(2);
});
it('does not expose organizer controls to a customer', () => {
    render(<EventSalesControl event={event} user={{ id: 'buyer', role: 'CUSTOMER' }} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
