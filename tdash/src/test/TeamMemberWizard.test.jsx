import React from 'react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
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

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('only offers Team Member when the caller has no role', () => {
        render(<TeamMemberWizard onClose={vi.fn()} onSuccess={vi.fn()} isDark={false} currentUser={{ id: 'staff-1', organizationId: 'org-1' }} />);
        fillIdentity();
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByText('Team Member')).toBeInTheDocument();
        expect(screen.queryByText('Owner')).not.toBeInTheDocument();
        expect(screen.queryByText('Admin')).not.toBeInTheDocument();
        expect(screen.queryByText('Manager')).not.toBeInTheDocument();
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

    it('blocks continuing with an invalid email address', () => {
        render(<TeamMemberWizard onClose={vi.fn()} onSuccess={vi.fn()} isDark={false} currentUser={adminUser} />);
        fireEvent.change(screen.getByLabelText(/First Name/), { target: { value: 'Jane' } });
        fireEvent.change(screen.getByLabelText(/Last Name/), { target: { value: 'Doe' } });
        fireEvent.change(screen.getByLabelText(/Email Address/), { target: { value: 'not-an-email' } });
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
        expect(screen.queryByText('Manager')).not.toBeInTheDocument();
        expect(apiPost).not.toHaveBeenCalled();
    });

    it('goes back from role selection to identity and keeps the filled fields', () => {
        render(<TeamMemberWizard onClose={vi.fn()} onSuccess={vi.fn()} isDark={false} currentUser={ownerUser} />);
        fillIdentity();
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByText('Manager')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
        expect(screen.getByLabelText(/First Name/)).toHaveValue('Jane');
        expect(screen.getByLabelText(/Email Address/)).toHaveValue('jane@example.com');
        expect(screen.queryByText('Manager')).not.toBeInTheDocument();
    });

    it('goes back from review to role selection', () => {
        render(<TeamMemberWizard onClose={vi.fn()} onSuccess={vi.fn()} isDark={false} currentUser={ownerUser} />);
        fillIdentity();
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByRole('button', { name: 'Send Invite' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
        expect(screen.getByText('Manager')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Send Invite' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    });

    it('closes from the first step without posting', () => {
        const onClose = vi.fn();
        render(<TeamMemberWizard onClose={onClose} onSuccess={vi.fn()} isDark={false} currentUser={adminUser} />);
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onClose).toHaveBeenCalled();
        expect(apiPost).not.toHaveBeenCalled();
    });

    it('invites a manager without custom permissions', async () => {
        render(<TeamMemberWizard onClose={vi.fn()} onSuccess={vi.fn()} isDark={false} currentUser={ownerUser} />);
        fillIdentity();
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        fireEvent.click(screen.getByText('Manager'));
        expect(screen.queryByText('Manage Events')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByText('MANAGER')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));

        await waitFor(() => {
            expect(apiPost).toHaveBeenCalledWith('/users', {
                firstName: 'Jane',
                lastName: 'Doe',
                email: 'jane@example.com',
                title: 'Door lead',
                role: 'MANAGER',
                permissions: {
                    manageEvents: false,
                    viewAnalytics: false,
                    manageTickets: false,
                    scanTickets: false,
                    manageTeam: false,
                },
                organizationId: 'org-1',
            });
        });
    });

    it('surfaces the API error and stays open when invite fails', async () => {
        const onSuccess = vi.fn();
        const onClose = vi.fn();
        apiPost.mockRejectedValue({ response: { data: { message: 'Email already invited' } } });
        vi.spyOn(console, 'error').mockImplementation(() => {});
        render(<TeamMemberWizard onClose={onClose} onSuccess={onSuccess} isDark={false} currentUser={ownerUser} />);

        fillIdentity();
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));

        expect(await screen.findByText('Email already invited')).toBeInTheDocument();
        expect(onSuccess).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Send Invite' })).not.toBeDisabled();
    });

    it('surfaces a generic failure when the API has no message', async () => {
        apiPost.mockRejectedValue(new Error('network down'));
        vi.spyOn(console, 'error').mockImplementation(() => {});
        render(<TeamMemberWizard onClose={vi.fn()} onSuccess={vi.fn()} isDark={false} currentUser={ownerUser} />);

        fillIdentity();
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));

        expect(await screen.findByText('Failed to create team member')).toBeInTheDocument();
        expect(apiPost).toHaveBeenCalled();
    });
});

