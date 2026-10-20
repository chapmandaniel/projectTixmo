import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AcceptInvitationView from '../features/AcceptInvitationView';

const acceptInvitation = vi.fn();
vi.mock('../lib/auth', () => ({ auth: { acceptInvitation: (...args) => acceptInvitation(...args) } }));

describe('Invitation password setup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.history.replaceState(null, '', `/invite#${'a'.repeat(64)}`);
    });
    it('accepts a valid link and removes its capability from browser history', async () => {
        const user = { id: 'new-staff', role: 'TEAM_MEMBER' };
        acceptInvitation.mockResolvedValue(user);
        const accepted = vi.fn();
        render(<AcceptInvitationView onAccepted={accepted} />);
        expect(window.location.hash).toBe('');
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'SecurePass123!' } });
        fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'SecurePass123!' } });
        fireEvent.click(screen.getByRole('button', { name: 'Join team' }));
        await waitFor(() => expect(accepted).toHaveBeenCalledWith(user));
        expect(acceptInvitation).toHaveBeenCalledWith('a'.repeat(64), 'SecurePass123!');
    });
    it('keeps expired links in an actionable error state', async () => {
        acceptInvitation.mockRejectedValue({ response: { data: { message: 'Invitation is invalid or expired' } } });
        render(<AcceptInvitationView onAccepted={vi.fn()} />);
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'SecurePass123!' } });
        fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'SecurePass123!' } });
        fireEvent.click(screen.getByRole('button', { name: 'Join team' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Invitation is invalid or expired');
    });
    it('does not submit an incomplete invitation', () => {
        window.history.replaceState(null, '', '/invite');
        render(<AcceptInvitationView onAccepted={vi.fn()} />);
        expect(screen.getByRole('alert')).toHaveTextContent('complete invitation link');
        expect(acceptInvitation).not.toHaveBeenCalled();
    });
    it('accepts a reopened email link while already on the invitation page', async () => {
        window.history.replaceState(null, '', '/invite');
        render(<AcceptInvitationView onAccepted={vi.fn()} />);
        act(() => {
            window.location.hash = 'b'.repeat(64);
            window.dispatchEvent(new HashChangeEvent('hashchange'));
        });
        await waitFor(() => expect(screen.getByLabelText('Password')).toBeInTheDocument());
        expect(window.location.hash).toBe('');
    });
});
