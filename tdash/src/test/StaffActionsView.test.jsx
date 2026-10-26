import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StaffActionsView from '../features/StaffActionsView';
import api from '../lib/api';

vi.mock('../lib/api', () => ({ default: { get: vi.fn() } }));

test('shows recorded staff actions for an admin', async () => {
    api.get.mockResolvedValue({
        data: {
            success: true,
            data: [{
                id: 'audit-1',
                action: 'SCANNER_REVOKE',
                subjectType: 'SCANNER',
                subjectId: 'scanner-1',
                actorId: 'user-1',
                reason: 'Lost phone',
                createdAt: '2026-10-26T12:00:00.000Z',
            }],
        },
    });
    render(
        <MemoryRouter>
            <StaffActionsView isDark user={{ role: 'ADMIN' }} />
        </MemoryRouter>
    );
    expect(await screen.findByText(/SCANNER_REVOKE/)).toBeInTheDocument();
    expect(screen.getByText('Lost phone')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/staff-actions', { params: { page: 1, limit: 50 } });
});

test('does not fetch the log for a manager', () => {
    api.get.mockClear();
    render(
        <MemoryRouter>
            <StaffActionsView isDark user={{ role: 'MANAGER' }} />
        </MemoryRouter>
    );
    expect(screen.getByText('Only an owner or admin can read this log.')).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
});
