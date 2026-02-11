import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import DashboardLayout from '../layouts/DashboardLayout';
import DashboardHome from '../features/DashboardHome';
import api from '../lib/api';

// Mock API
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

describe('Notification Resilience', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('DashboardLayout should not crash when notifications is not an array', async () => {
        // Mock API to return an object instead of an array (the crash case)
        api.get.mockResolvedValue({
            data: {
                notifications: { id: '1', message: 'Not an array!' } // CRASH CASE
            }
        });

        await act(async () => {
            render(
                <DashboardLayout
                    activeView="dashboard"
                    user={{ firstName: 'Test' }}
                >
                    <div>Dashboard Content</div>
                </DashboardLayout>
            );
        });

        expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
    });

    it('DashboardHome should not crash when notifications is not an array', async () => {
        // Mock API to return an object instead of an array (the crash case)
        api.get.mockResolvedValue({
            data: {
                success: true,
                data: {
                    notifications: { id: '1', message: 'Not an array!' } // CRASH CASE
                }
            }
        });

        await act(async () => {
            render(<DashboardHome isDark={false} user={{ firstName: 'Test' }} />);
        });

        // If it renders without throwing, the fix is working
        expect(screen.getByText(/Test/)).toBeInTheDocument();
    });

    it('DashboardHome should not crash when tasks is not an array', async () => {
        // Mock API to return an object instead of an array for tasks
        api.get.mockImplementation((url) => {
            if (url === '/tasks') {
                return Promise.resolve({ data: { success: true, data: { id: 'invalid' } } });
            }
            return Promise.resolve({ data: { success: true, data: { notifications: [] } } });
        });

        await act(async () => {
            render(<DashboardHome isDark={false} user={{ firstName: 'Test' }} />);
        });

        expect(screen.getByText(/Test/)).toBeInTheDocument();
    });
});
