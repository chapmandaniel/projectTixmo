import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { AUTH_EXPIRED_EVENT, AUTH_EXPIRED_REASONS } from '../lib/session';

vi.mock('../lib/api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() }
        }
    },
    api: {
        get: vi.fn(),
        post: vi.fn(),
        upload: vi.fn(),
    },
}));

vi.mock('../lib/auth', () => ({
    auth: {
        getCurrentUser: () => null,
        logout: vi.fn().mockResolvedValue(undefined),
        login: vi.fn(),
        isAuthenticated: () => false,
    }
}));

describe('App session messaging', () => {
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
        expect(screen.getByText(/sign in to tixmo dashboard/i)).toBeInTheDocument();
    });
});
