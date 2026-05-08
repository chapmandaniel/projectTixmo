import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginView from '../features/LoginView';

const loginMock = vi.fn();

vi.mock('../lib/auth', () => ({
    auth: {
        login: (...args) => loginMock(...args),
    },
}));

describe('LoginView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        loginMock.mockResolvedValue({ id: 'user-1', email: 'member@example.com' });
    });

    it('renders the brand-only login surface without internal workspace data', () => {
        render(<LoginView onLogin={vi.fn()} />);

        expect(screen.getByAltText('TixMo Logo')).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Tixmo Dashboard' })).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
        expect(screen.getByLabelText('Email address')).toBeInTheDocument();
        expect(screen.getByLabelText('Password')).toBeInTheDocument();
        expect(screen.queryByText('Live events')).not.toBeInTheDocument();
        expect(screen.queryByText('Pending reviews')).not.toBeInTheDocument();
        expect(screen.queryByText('Today in workspace')).not.toBeInTheDocument();
        expect(screen.queryByText('Asset library')).not.toBeInTheDocument();
    });

    it('submits credentials through auth login', async () => {
        const onLogin = vi.fn();
        render(<LoginView onLogin={onLogin} />);

        fireEvent.change(screen.getByLabelText('Email address'), {
            target: { value: 'member@example.com' },
        });
        fireEvent.change(screen.getByLabelText('Password'), {
            target: { value: 'Password123!' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        await waitFor(() => {
            expect(loginMock).toHaveBeenCalledWith('member@example.com', 'Password123!');
        });
        expect(onLogin).toHaveBeenCalledWith({ id: 'user-1', email: 'member@example.com' });
    });
});
