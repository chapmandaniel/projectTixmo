import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RegisterScannerModal from '../features/RegisterScannerModal';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock('../lib/api', () => ({ default: mocks }));

const harbor = '11111111-1111-4111-8111-111111111111';
const late = '22222222-2222-4222-8222-222222222222';
const events = [
    { id: harbor, name: 'Harbor Night' },
    { id: late, name: 'Late Show' },
];

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('user', JSON.stringify({ organizationId: '33333333-3333-4333-8333-333333333333' }));
    mocks.get.mockResolvedValue({ data: { data: { events, pagination: { pages: 1 } } } });
    mocks.post.mockResolvedValue({ data: { data: { apiKey: 'sk_scanner_new' } } });
    mocks.put.mockResolvedValue({ data: { data: { id: 'scanner-1' } } });
});

describe('RegisterScannerModal event binding', () => {
    it('registers a scanner bound to the selected event', async () => {
        render(<RegisterScannerModal isDark onClose={vi.fn()} onSuccess={vi.fn()} />);
        expect(await screen.findByRole('option', { name: 'Harbor Night' })).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Scanner Name'), { target: { value: 'North gate' } });
        fireEvent.change(screen.getByLabelText('Event'), { target: { value: harbor } });
        fireEvent.click(screen.getByRole('button', { name: 'Generate Key' }));
        await screen.findByText('sk_scanner_new');
        expect(mocks.post).toHaveBeenCalledWith('/scanners/register', {
            name: 'North gate',
            deviceId: undefined,
            organizationId: '33333333-3333-4333-8333-333333333333',
            eventId: harbor,
        });
        expect(mocks.get).toHaveBeenCalledWith('/events', { params: { page: 1, limit: 100 } });
    });

    it('requires an event before registering a new scanner', async () => {
        render(<RegisterScannerModal isDark onClose={vi.fn()} onSuccess={vi.fn()} />);
        await screen.findByRole('option', { name: 'Late Show' });
        expect(screen.getByLabelText('Event')).toBeRequired();
        fireEvent.change(screen.getByLabelText('Scanner Name'), { target: { value: 'Spare phone' } });
        fireEvent.click(screen.getByRole('button', { name: 'Generate Key' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Choose an event. A new scanner must be bound to one event.');
        expect(mocks.post).not.toHaveBeenCalled();
        fireEvent.change(screen.getByLabelText('Event'), { target: { value: late } });
        fireEvent.click(screen.getByRole('button', { name: 'Generate Key' }));
        await screen.findByText('sk_scanner_new');
        expect(mocks.post).toHaveBeenCalledWith('/scanners/register', expect.objectContaining({ eventId: late }));
    });

    it('rebinds an existing scanner and can clear the event', async () => {
        const scanner = { id: 'scanner-1', name: 'North gate', eventId: harbor, event: { name: 'Harbor Night' } };
        const { rerender } = render(<RegisterScannerModal isDark scanner={scanner} onClose={vi.fn()} onSuccess={vi.fn()} />);
        expect(await screen.findByRole('heading', { name: 'Change scanner event' })).toBeInTheDocument();
        expect(screen.getByLabelText('Event')).toHaveValue(harbor);
        fireEvent.change(screen.getByLabelText('Event'), { target: { value: late } });
        fireEvent.click(screen.getByRole('button', { name: 'Save event' }));
        expect(await screen.findByText('North gate is bound to Late Show.')).toBeInTheDocument();
        expect(mocks.put).toHaveBeenCalledWith('/scanners/scanner-1', { eventId: late });
        expect(screen.queryByText(/won't be shown again/)).not.toBeInTheDocument();
        rerender(<div />);
        render(<RegisterScannerModal isDark scanner={{ ...scanner, eventId: late, event: { name: 'Late Show' } }} onClose={vi.fn()} onSuccess={vi.fn()} />);
        fireEvent.change(await screen.findByLabelText('Event'), { target: { value: '' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save event' }));
        expect(await screen.findByText('North gate is not bound to an event.')).toBeInTheDocument();
        expect(mocks.put).toHaveBeenCalledWith('/scanners/scanner-1', { eventId: null });
    });
});
