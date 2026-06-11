import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TeamView from '../features/TeamView';

const apiGet = vi.fn();
const apiPut = vi.fn();
const apiDelete = vi.fn();

vi.mock('../lib/api', () => ({
    default: {
        get: (...args) => apiGet(...args),
        put: (...args) => apiPut(...args),
        delete: (...args) => apiDelete(...args),
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() },
        },
    },
}));

vi.mock('../lib/session', () => ({
    getStoredUser: vi.fn(() => null),
}));

const adminUser = {
    id: 'admin-1',
    role: 'ADMIN',
    organizationId: 'org-1',
};

describe('TeamView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiGet.mockResolvedValue({
            data: {
                data: {
                    users: [
                        {
                            id: 'admin-1',
                            firstName: 'Ava',
                            lastName: 'Admin',
                            email: 'ava@example.com',
                            role: 'ADMIN',
                            organizationId: 'org-1',
                            emailVerified: true,
                        },
                        {
                            id: 'promoter-1',
                            firstName: 'Pat',
                            lastName: 'Promoter',
                            email: 'pat@example.com',
                            role: 'PROMOTER',
                            organizationId: 'org-1',
                            emailVerified: false,
                        },
                    ],
                },
            },
        });
        apiPut.mockResolvedValue({ data: { success: true } });
    });

    it('lets a scoped admin downgrade a lower-role team member', async () => {
        render(<TeamView isDark user={adminUser} />);

        await waitFor(() => expect(screen.getByText('Pat Promoter')).toBeInTheDocument());

        fireEvent.click(screen.getByText('PROMOTER').closest('button'));
        fireEvent.change(screen.getByLabelText('Role for Pat Promoter'), {
            target: { value: 'TEAM_MEMBER' },
        });
        fireEvent.click(screen.getByTitle('Save role'));

        await waitFor(() => {
            expect(apiPut).toHaveBeenCalledWith('/users/promoter-1', { role: 'TEAM_MEMBER' });
        });

        expect(screen.getByText('TEAM MEMBER')).toBeInTheDocument();
    });
});
