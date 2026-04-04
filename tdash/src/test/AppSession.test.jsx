import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { AUTH_EXPIRED_EVENT, AUTH_EXPIRED_REASONS } from '../lib/session';

const loginMock = vi.fn();
const logoutMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../lib/api', () => ({
    default: {
        get: vi.fn().mockResolvedValue({ data: { notifications: [], approvals: [], data: { notifications: [], approvals: [] } } }),
        post: vi.fn().mockResolvedValue({ data: {} }),
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() }
        }
    },
    api: {
        get: vi.fn().mockResolvedValue({ approvals: [], events: [], data: { notifications: [], approvals: [], events: [] } }),
        post: vi.fn().mockResolvedValue({}),
        upload: vi.fn(),
    },
}));

vi.mock('../lib/auth', () => ({
    auth: {
        getCurrentUser: () => null,
        logout: (...args) => logoutMock(...args),
        login: (...args) => loginMock(...args),
        isAuthenticated: () => false,
    }
}));

describe('App session messaging', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        loginMock.mockResolvedValue({ id: '1', firstName: 'Test', role: 'ADMIN' });
    });

    it('shows an inactivity notice when the session expires', async () => {
        await act(async () => {
            render(
                <MemoryRouter>
                    <App />
                </MemoryRouter>
            );
        });

        await act(async () => {
            window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, {
                detail: { reason: AUTH_EXPIRED_REASONS.idle },
            }));
        });

        expect(screen.getByText(/signed out after 30 minutes of inactivity/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/name@example.com/i)).toBeInTheDocument();
    });

    it('lands on the main dashboard after signing in from a deep route', async () => {
        await act(async () => {
            render(
                <MemoryRouter initialEntries={['/events/some-deep-link']}>
                    <App />
                </MemoryRouter>
            );
        });

        fireEvent.change(screen.getByPlaceholderText(/name@example.com/i), {
            target: { value: 'test@example.com' },
        });
        fireEvent.change(screen.getByPlaceholderText(/enter your password/i), {
            target: { value: 'password123' },
        });

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /continue/i }));
        });

        await waitFor(() => {
            expect(screen.getByText(/welcome back, test/i)).toBeInTheDocument();
        });
    });
});
