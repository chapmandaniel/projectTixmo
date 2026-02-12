import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import ApprovalsView from '../features/ApprovalsView';

// Mock dependencies
const apiGet = vi.fn();
vi.mock('../lib/api', () => ({
    api: {
        get: (...args) => apiGet(...args),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    }
}));

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};

describe('ApprovalsView', () => {
    it('renders gallery of approvals', async () => {
        const mockApprovals = [
            {
                id: '1',
                title: 'Test Approval 1',
                status: 'DRAFT',
                priority: 'STANDARD',
                event: { name: 'Event A' },
                assets: [],
                reviewers: [],
            },
            {
                id: '2',
                title: 'Test Approval 2',
                status: 'PENDING',
                priority: 'URGENT',
                event: { name: 'Event B' },
                assets: [],
                reviewers: [],
            }
        ];

        apiGet.mockImplementation((url) => {
            if (url.includes('/approvals')) {
                return Promise.resolve({ approvals: mockApprovals });
            }
            if (url.includes('/events')) {
                return Promise.resolve({ events: [{ id: 'e1', name: 'Event A' }, { id: 'e2', name: 'Event B' }] });
            }
            return Promise.resolve({});
        });

        await act(async () => {
            render(<ApprovalsView isDark={false} user={{}} />);
        });

        expect(screen.getByText('Test Approval 1')).toBeInTheDocument();
        expect(screen.getByText('Test Approval 2')).toBeInTheDocument();
        expect(screen.getByText('All Events')).toBeInTheDocument();
    });

    it('renders empty state safely', async () => {
        apiGet.mockImplementation((url) => {
            if (url.includes('/approvals')) {
                return Promise.resolve({ approvals: [] });
            }
            if (url.includes('/events')) {
                return Promise.resolve({ events: [] });
            }
            return Promise.resolve({});
        });

        await act(async () => {
            render(<ApprovalsView isDark={false} user={{}} />);
        });

        expect(screen.getByText('No approval requests found')).toBeInTheDocument();
    });

    it('renders event filter pills from API', async () => {
        apiGet.mockImplementation((url) => {
            if (url.includes('/approvals')) {
                return Promise.resolve({ approvals: [] });
            }
            if (url.includes('/events')) {
                return Promise.resolve({ events: [{ id: 'e1', name: 'Summer Festival' }] });
            }
            return Promise.resolve({});
        });

        await act(async () => {
            render(<ApprovalsView isDark={true} user={{}} />);
        });

        expect(screen.getByText('Summer Festival')).toBeInTheDocument();
        expect(screen.getByText('All Events')).toBeInTheDocument();
    });
});
