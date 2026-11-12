import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TeamMemberWizard from '../features/TeamMemberWizard';

const apiPost = vi.fn();

vi.mock('../lib/api', () => ({
    default: {
        post: (...args) => apiPost(...args),
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() },
        },
    },
}));

const ownerUser = { id: 'owner-1', role: 'OWNER', organizationId: 'org-1' };
const adminUser = { id: 'admin-1', role: 'ADMIN', organizationId: 'org-1' };

const fillIdentity = () => {
    fireEvent.change(screen.getByLabelText(/First Name/), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText(/Last Name/), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText(/Email Address/), { target: { value: 'jane@example.com' } });
    fireEvent.change(screen.getByLabelText(/Job Title/), { target: { value: 'Door lead' } });
};

describe('TeamMemberWizard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiPost.mockResolvedValue({
            data: { data: { id: 'invited-1', invitationDelivered: true, invitationPending: true } },
        });
    });

    it('does not offer a role at or above an admin caller', () => {
        render(<TeamMemberWizard onClose={vi.fn()} onSuccess={vi.fn()} isDark={false} currentUser={adminUser} />);
        fillIdentity();
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        expect(screen.queryByText('Owner')).not.toBeInTheDocument();
        expect(screen.queryByText('Admin')).not.toBeInTheDocument();
        expect(screen.getByText('Manager')).toBeInTheDocument();
        expect(screen.getByText('Promoter')).toBeInTheDocument();
        expect(screen.getByText('Team Member')).toBeInTheDocument();
        expect(screen.getByText('Scanner')).toBeInTheDocument();
    });

    it('lets an owner invite a team member through the wizard', async () => {
        const onSuccess = vi.fn();
        const onClose = vi.fn();
        render(
            <TeamMemberWizard onClose={onClose} onSuccess={onSuccess} isDark={false} currentUser={ownerUser} />
        );

        fillIdentity();
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByText('Owner')).toBeInTheDocument();
        expect(screen.getByText('Admin')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Manage Events'));
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByText('Send Invite')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));

        await waitFor(() => {
            expect(apiPost).toHaveBeenCalledWith('/users', {
                firstName: 'Jane',
                lastName: 'Doe',
                email: 'jane@example.com',
                title: 'Door lead',
                role: 'TEAM_MEMBER',
                permissions: {
                    manageEvents: true,
                    viewAnalytics: false,
                    manageTickets: false,
                    scanTickets: false,
                    manageTeam: false,
                },
                organizationId: 'org-1',
            });
        });
        expect(onSuccess).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
    });

    it('blocks continuing with an incomplete identity step', () => {
        render(<TeamMemberWizard onClose={vi.fn()} onSuccess={vi.fn()} isDark={false} currentUser={adminUser} />);
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByText('Please fill in all required fields')).toBeInTheDocument();
        expect(apiPost).not.toHaveBeenCalled();
    });
});
