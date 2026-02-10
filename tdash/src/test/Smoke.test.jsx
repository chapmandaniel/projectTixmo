import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import App from '../App';
import DashboardLayout from '../layouts/DashboardLayout';

// Mock dependencies
vi.mock('../lib/api', () => ({
    default: {
        get: vi.fn().mockResolvedValue({ data: { notifications: [], stats: {}, recentSales: [], events: [], salesTrend: [] } }),
        post: vi.fn().mockResolvedValue({ data: {} }),
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() }
        }
    }
}));

vi.mock('../lib/auth', () => ({
    auth: {
        getUser: () => ({ id: '1', firstName: 'Test', role: 'Promoter' }),
        isAuthenticated: () => true,
        logout: vi.fn(),
        getCurrentUser: () => ({ id: '1', firstName: 'Test', role: 'Promoter' })
    }
}));

// Mock ResizeObserver for Recharts
global.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};

describe('Smoke Tests', () => {
    it('renders DashboardLayout without crashing', async () => {
        await act(async () => {
             render(
                <DashboardLayout
                    activeView="dashboard"
                    user={{ firstName: 'Test' }}
                >
                    <div>Content</div>
                </DashboardLayout>
            );
        });
        expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('renders App without crashing', async () => {
        await act(async () => {
            render(<App />);
        });
    });
});
