import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ScannersView from '../features/ScannersView';

const apiGet = vi.fn();
const apiDelete = vi.fn();

vi.mock('../lib/api', () => ({
    default: {
        get: (...args) => apiGet(...args),
        delete: (...args) => apiDelete(...args),
    },
}));

vi.mock('../features/RegisterScannerModal', () => ({
    default: () => <div>Register scanner modal</div>,
}));

describe('ScannersView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiDelete.mockResolvedValue({ data: { success: true } });
        apiGet.mockImplementation((url) => {
            if (url === '/scanners/logs') {
                return Promise.resolve({
                    data: {
                        success: true,
                        data: {
                            scanLogs: [
                                {
                                    id: 'log-1',
                                    scannedAt: '2026-06-03T12:00:00.000Z',
                                    scanType: 'ENTRY',
                                    scanner: { name: 'Main Gate' },
                                    ticketId: 'ticket-123456789',
                                    success: true,
                                },
                            ],
                            pagination: { pages: 1 },
                        },
                    },
                });
            }

            return Promise.resolve({
                data: {
                    success: true,
                    data: {
                        scanners: [
                            {
                                id: 'scanner-1',
                                name: 'Harborlight Main Gate',
                                deviceId: 'iphone-ops-01',
                                status: 'ACTIVE',
                                lastUsedAt: '2026-06-03T11:00:00.000Z',
                            },
                        ],
                        pagination: { pages: 1 },
                    },
                },
            });
        });
    });

    it('renders a scanner card layout for mobile while preserving the desktop table', async () => {
        await act(async () => {
            render(<ScannersView isDark user={{ role: 'ADMIN' }} />);
        });

        await waitFor(() => expect(screen.getAllByText('Harborlight Main Gate').length).toBeGreaterThan(0));

        expect(screen.getByTestId('scanner-mobile-cards')).toHaveClass('md:hidden');
        expect(screen.getAllByText('iphone-ops-01').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Revoke access')[0]).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'Device ID' })).toBeInTheDocument();
    });

    it('renders scan logs as mobile cards after switching tabs', async () => {
        await act(async () => {
            render(<ScannersView isDark user={{ role: 'ADMIN' }} />);
        });

        await waitFor(() => expect(screen.getAllByText('Harborlight Main Gate').length).toBeGreaterThan(0));

        fireEvent.click(screen.getByRole('button', { name: /scan logs/i }));

        await waitFor(() => expect(screen.getAllByText('Main Gate').length).toBeGreaterThan(0));

        expect(screen.getByTestId('scan-log-mobile-cards')).toHaveClass('md:hidden');
        expect(screen.getAllByText('ticket-123456789').length).toBeGreaterThan(0);
        expect(screen.getAllByText('SUCCESS').length).toBeGreaterThan(0);
    });
});

const scanner = { id: 'scanner-page', name: 'API Gate', status: 'ACTIVE' };
const log = { id: 'log-page', scanner: { name: 'API Gate' }, scanType: 'ENTRY', success: true };

const legacyBodies = (items, key) => [
    ['array', { success: true, data: items, pagination: { pages: 3 } }],
    ['top-level', { success: true, [key]: items, pagination: { pages: 3 } }],
    ['nested', { success: true, data: { [key]: items, pagination: { pages: 3 } } }],
    ['double-nested', { success: true, data: { data: { [key]: items } }, pagination: { pages: 3 } }],
];

const showTab = async (tab) => {
    render(<ScannersView isDark user={{ role: 'ADMIN' }} />);
    await screen.findAllByText('API Gate');
    if (tab === 'logs') {
        fireEvent.click(screen.getByRole('button', { name: 'Scan Logs' }));
        await screen.findByTestId('scan-log-mobile-cards');
    }
};

describe('ScannersView pagination response contracts', () => {
    beforeEach(() => vi.clearAllMocks());

    it('uses API meta.pages for both tabs, keeps request limits, Previous and tab reset', async () => {
        apiGet.mockImplementation((url) => Promise.resolve({ data: {
            success: true,
            data: url === '/scanners' ? [scanner] : [log],
            meta: { pages: 3 },
        } }));
        await showTab('scanners');
        expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        await waitFor(() => expect(apiGet).toHaveBeenLastCalledWith('/scanners', { params: { page: 2, limit: 10 } }));
        expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
        await waitFor(() => expect(apiGet).toHaveBeenLastCalledWith('/scanners', { params: { page: 1, limit: 10 } }));
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        await screen.findByText('Page 2 of 3');
        fireEvent.click(screen.getByRole('button', { name: 'Scan Logs' }));
        await screen.findByTestId('scan-log-mobile-cards');
        expect(apiGet).toHaveBeenLastCalledWith('/scanners/logs', { params: { page: 1, limit: 20 } });
        expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        await waitFor(() => expect(apiGet).toHaveBeenLastCalledWith('/scanners/logs', { params: { page: 2, limit: 20 } }));
        fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
        await waitFor(() => expect(apiGet).toHaveBeenLastCalledWith('/scanners/logs', { params: { page: 1, limit: 20 } }));
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        await screen.findByText('Page 2 of 3');
        fireEvent.click(screen.getByRole('button', { name: 'Active Scanners' }));
        await screen.findByTestId('scanner-mobile-cards');
        expect(apiGet).toHaveBeenLastCalledWith('/scanners', { params: { page: 1, limit: 10 } });
        expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    });

    for (const [tab, item, key] of [['scanners', scanner, 'scanners'], ['logs', log, 'scanLogs']]) {
        it.each(legacyBodies([item], key))(`preserves ${tab} legacy %s envelopes`, async (_name, body) => {
            apiGet.mockImplementation((url) => Promise.resolve({ data: url === '/scanners' && tab === 'logs'
                ? { success: true, data: [scanner] } : body }));
            await showTab(tab);
            expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument();
            expect(screen.getByTestId(tab === 'logs' ? 'scan-log-mobile-cards' : 'scanner-mobile-cards')).toHaveTextContent('API Gate');
        });

        it.each([
            ['missing data', { success: true }],
            ['null data', { success: true, data: null }],
            ['empty object', { success: true, data: {} }],
            ['empty array', { success: true, data: [] }],
            ['empty legacy collection', { success: true, data: { [key]: [] } }],
            ['empty API collection', { success: true, data: [], meta: { pages: 0 } }],
        ])(`preserves ${tab} %s empty state without pagination`, async (_name, body) => {
            apiGet.mockImplementation((url) => Promise.resolve({ data: url === '/scanners' && tab === 'logs'
                ? { success: true, data: [scanner] } : body }));
            render(<ScannersView isDark />);
            if (tab === 'logs') {
                await screen.findByTestId('scanner-mobile-cards');
                fireEvent.click(screen.getByRole('button', { name: 'Scan Logs' }));
            }
            await screen.findByText(tab === 'logs' ? 'No scan logs found' : 'No scanners registered');
            expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
        });
    }

    it('preserves the legacy logs alias', async () => {
        apiGet.mockImplementation((url) => Promise.resolve({ data: url === '/scanners'
            ? { success: true, data: [scanner] }
            : { success: true, data: { logs: [log], pagination: { pages: 3 } } } }));
        await showTab('logs');
        expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument();
    });
});


describe('ScannersView fetch recovery', () => {
    beforeEach(() => vi.resetAllMocks());

    it.each(['rejected', 'unsuccessful'])('shows an initial %s failure distinctly and retries the same request', async (failure) => {
        if (failure === 'rejected') apiGet.mockRejectedValueOnce(new Error('offline'));
        else apiGet.mockResolvedValueOnce({ data: { success: false } });
        apiGet.mockResolvedValue({ data: { success: true, data: [scanner], meta: { pages: 3 } } });
        render(<ScannersView isDark />);
        expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load scanners');
        expect(screen.queryByText('No scanners registered')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        await screen.findByTestId('scanner-mobile-cards');
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(apiGet).toHaveBeenLastCalledWith('/scanners', { params: { page: 1, limit: 10 } });
    });

    it.each(['scanners', 'logs'])('hides stale %s page data and retries the failed page without resetting tabs', async (tab) => {
        apiGet.mockImplementation((url) => Promise.resolve({ data: {
            success: true, data: url === '/scanners' ? [scanner] : [log], meta: { pages: 3 },
        } }));
        await showTab(tab);
        apiGet.mockRejectedValueOnce(new Error('offline'));
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Page 2 could not be loaded');
        expect(screen.queryByText('API Gate')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(apiGet).toHaveBeenLastCalledWith(tab === 'scanners' ? '/scanners' : '/scanners/logs', {
            params: { page: 2, limit: tab === 'scanners' ? 10 : 20 },
        });
    });

    it('shows a failed tab load and clears it after successfully retrying', async () => {
        apiGet.mockResolvedValue({ data: { success: true, data: [scanner] } });
        await showTab('scanners');
        apiGet.mockRejectedValueOnce(new Error('offline'));
        fireEvent.click(screen.getByRole('button', { name: 'Scan Logs' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load scan logs');
        expect(screen.queryByText('No scan logs found')).not.toBeInTheDocument();
        apiGet.mockResolvedValueOnce({ data: { success: true, data: [log] } });
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        await screen.findByTestId('scan-log-mobile-cards');
        expect(apiGet).toHaveBeenLastCalledWith('/scanners/logs', { params: { page: 1, limit: 20 } });
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
});


it('ignores a late failure from a previous tab', async () => {
    let rejectScanners;
    apiGet.mockReset();
    apiGet.mockImplementation((url) => url === '/scanners'
        ? new Promise((_resolve, reject) => { rejectScanners = reject; })
        : Promise.resolve({ data: { success: true, data: [log] } }));
    render(<ScannersView isDark />);
    fireEvent.click(screen.getByRole('button', { name: 'Scan Logs' }));
    await screen.findByTestId('scan-log-mobile-cards');
    await act(async () => rejectScanners(new Error('late failure')));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('scan-log-mobile-cards')).toHaveTextContent('API Gate');
});
