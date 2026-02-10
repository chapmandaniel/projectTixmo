import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';
import DashboardLayout from '../layouts/DashboardLayout';
import { BrowserRouter } from 'react-router-dom';

// Mock dependencies
vi.mock('../lib/api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() }
        }
    }
}));

vi.mock('../lib/auth', () => ({
    getUser: () => ({ id: '1', firstName: 'Test', role: 'Promoter' }),
    isAuthenticated: () => true,
    logout: vi.fn()
}));

// Mock ResizeObserver for Recharts
global.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};

describe('Smoke Tests', () => {
    it('renders DashboardLayout without crashing', () => {
        render(
            <BrowserRouter>
                <DashboardLayout
                    activeView="dashboard"
                    user={{ firstName: 'Test' }}
                >
                    <div>Content</div>
                </DashboardLayout>
            </BrowserRouter>
        );
        expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('renders App without crashing', () => {
        // App uses BrowserRoutes inside, so we don't wrap it here
        // But it might need router if it doesn't have one.
        // Assuming App has Router. If not, we wrap it.
        // App.jsx usually has the Router or the main layout.
        // Checking App.jsx content briefly... it has checks for auth.
        render(<App />);
    });
});
