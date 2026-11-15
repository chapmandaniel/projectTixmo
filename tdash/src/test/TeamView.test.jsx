import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TeamView from '../features/TeamView';

const apiGet = vi.fn();
const apiPut = vi.fn();
const apiDelete = vi.fn();
const apiPost = vi.fn();

vi.mock('../lib/api', () => ({
    default: {
        get: (...args) => apiGet(...args),
        put: (...args) => apiPut(...args),
        delete: (...args) => apiDelete(...args),
        post: (...args) => apiPost(...args),
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
                            invitationPending: true,
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

    it('resends a pending invitation and reports delivery failure before retry', async () => {
        apiPost.mockRejectedValueOnce({ response: { data: { message: 'Invitation email could not be sent. Please retry Resend invitation.' } } })
            .mockResolvedValueOnce({ data: { success: true } });
        render(<TeamView isDark user={adminUser} />);
        fireEvent.click(await screen.findByText('Resend invitation'));
        expect(await screen.findByRole('status')).toHaveTextContent('could not be sent');
        await waitFor(() => expect(screen.getByText('Resend invitation')).not.toBeDisabled());
        fireEvent.click(screen.getByText('Resend invitation'));
        await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Invitation sent.'));
        expect(apiPost).toHaveBeenCalledWith('/users/promoter-1/invitation');
    });

    const rosterFor = (actor) => ({
        data: {
            data: {
                users: [
                    {
                        id: actor.id,
                        firstName: 'Current',
                        lastName: 'User',
                        email: 'current@example.com',
                        role: actor.role,
                        organizationId: actor.organizationId || null,
                        emailVerified: true,
                    },
                    {
                        id: 'member-1',
                        firstName: 'Sam',
                        lastName: 'Staff',
                        email: 'sam@example.com',
                        role: 'TEAM_MEMBER',
                        organizationId: 'org-1',
                        emailVerified: true,
                    },
                ],
            },
        },
    });

    it.each([
        ['MANAGER', { id: 'manager-1', role: 'MANAGER', organizationId: 'org-1' }],
        ['PROMOTER', { id: 'promoter-2', role: 'PROMOTER', organizationId: 'org-1' }],
    ])('hides Remove member for %s', async (_label, actor) => {
        apiGet.mockResolvedValue(rosterFor(actor));
        render(<TeamView isDark user={actor} />);
        expect(await screen.findByText('Sam Staff')).toBeInTheDocument();
        expect(screen.queryByTitle('Remove member')).not.toBeInTheDocument();
    });

    it.each([
        ['OWNER', { id: 'owner-1', role: 'OWNER', organizationId: 'org-1' }],
        ['ADMIN', { id: 'admin-2', role: 'ADMIN', organizationId: 'org-1' }],
        ['platform admin', { id: 'platform-1', role: 'ADMIN', isPlatformAdmin: true }],
    ])('shows Remove member for %s', async (_label, actor) => {
        apiGet.mockResolvedValue(rosterFor(actor));
        render(<TeamView isDark user={actor} />);
        expect(await screen.findByText('Sam Staff')).toBeInTheDocument();
        expect(screen.getByTitle('Remove member')).toBeInTheDocument();
    });

    it('locks the signed-in admin from changing their own role', async () => {
        render(<TeamView isDark user={adminUser} />);
        await waitFor(() => expect(screen.getByText('Ava Admin')).toBeInTheDocument());
        expect(screen.getByTitle('Role locked')).toBeDisabled();
        fireEvent.click(screen.getByTitle('Role locked'));
        expect(screen.queryByLabelText('Role for Ava Admin')).not.toBeInTheDocument();
        expect(apiPut).not.toHaveBeenCalled();
    });

    it('limits the admin role dropdown to roles below ADMIN', async () => {
        render(<TeamView isDark user={adminUser} />);
        await waitFor(() => expect(screen.getByText('Pat Promoter')).toBeInTheDocument());
        fireEvent.click(screen.getByTitle('Change role'));
        const options = Array.from(screen.getByLabelText('Role for Pat Promoter').querySelectorAll('option')).map(
            (option) => option.value
        );
        expect(options).toEqual(['MANAGER', 'PROMOTER', 'TEAM_MEMBER', 'SCANNER']);
        expect(options).not.toContain('OWNER');
        expect(options).not.toContain('ADMIN');
    });

    it('hides role and remove controls for a TEAM_MEMBER', async () => {
        const actor = { id: 'member-actor', role: 'TEAM_MEMBER', organizationId: 'org-1' };
        apiGet.mockResolvedValue(rosterFor(actor));
        render(<TeamView isDark user={actor} />);
        expect(await screen.findByText('Sam Staff')).toBeInTheDocument();
        expect(screen.queryByTitle('Remove member')).not.toBeInTheDocument();
        expect(screen.queryByTitle('Change role')).not.toBeInTheDocument();
        expect(screen.getAllByTitle('Role locked').length).toBeGreaterThan(0);
    });

    it('renders TeamMemberWizard from the Add member action', async () => {
        render(<TeamView isDark user={adminUser} />);
        await waitFor(() => expect(screen.getByText('Pat Promoter')).toBeInTheDocument());
        fireEvent.click(screen.getByText('Add member'));
        expect(screen.getByRole('heading', { name: 'Add Team Member' })).toBeInTheDocument();
        expect(screen.getByLabelText(/First Name/)).toBeInTheDocument();
        expect(screen.getByText('Basic Info')).toBeInTheDocument();
        expect(apiPost).not.toHaveBeenCalled();
    });

    it('opens the invite wizard and posts a new member', async () => {
        apiPost.mockResolvedValue({
            data: { data: { id: 'invited-1', invitationDelivered: true } },
        });
        render(<TeamView isDark user={adminUser} />);
        await waitFor(() => expect(screen.getByText('Pat Promoter')).toBeInTheDocument());
        fireEvent.click(screen.getByText('Add member'));
        fireEvent.change(screen.getByLabelText(/First Name/), { target: { value: 'Jane' } });
        fireEvent.change(screen.getByLabelText(/Last Name/), { target: { value: 'Doe' } });
        fireEvent.change(screen.getByLabelText(/Email Address/), { target: { value: 'jane@example.com' } });
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));
        await waitFor(() => {
            expect(apiPost).toHaveBeenCalledWith(
                '/users',
                expect.objectContaining({
                    firstName: 'Jane',
                    lastName: 'Doe',
                    email: 'jane@example.com',
                    role: 'TEAM_MEMBER',
                    organizationId: 'org-1',
                })
            );
        });
        expect(await screen.findByRole('status')).toHaveTextContent('Invitation sent.');
    });
});

