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
