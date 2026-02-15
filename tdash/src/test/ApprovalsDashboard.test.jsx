import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import ApprovalsDashboard from '../features/ApprovalsDashboard';

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

// Mock child components
vi.mock('../features/ApprovalGalleryCard', () => ({
    default: ({ approval }) => <div data-testid="approval-card">{approval.title}</div>
}));

vi.mock('../features/CreateApprovalModal', () => ({
    default: () => <div>Create Modal</div>
}));

vi.mock('../features/ApprovalDetailView', () => ({
    default: () => <div>Detail View</div>
}));

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};

describe('ApprovalsDashboard', () => {
    it('renders gallery of approvals and filters', async () => {
        const mockApprovals = [
            {
                id: '1',
                title: 'Test Approval 1',
                status: 'DRAFT',
                event: { name: 'Event A' },
                assets: [],
                reviewers: [],
            },
            {
                id: '2',
                title: 'Test Approval 2',
                status: 'PENDING', // This one should show by default
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
                return Promise.resolve({ data: { events: [{ id: 'e1', name: 'Event A' }, { id: 'e2', name: 'Event B' }] } });
            }
            return Promise.resolve({});
        });

        await act(async () => {
            render(<ApprovalsDashboard isDark={false} user={{}} />);
        });

        expect(screen.getByText('Client Approvals')).toBeInTheDocument();

        // The default filter is PENDING, so 'Test Approval 2' should be visible
        expect(screen.getByText('Test Approval 2')).toBeInTheDocument();

        // 'Test Approval 1' (DRAFT) should NOT be visible initially
        expect(screen.queryByText('Test Approval 1')).not.toBeInTheDocument();

        // Check for Status Filter Pills
        expect(screen.getByText('Pending Review')).toBeInTheDocument();
        expect(screen.getByText('All')).toBeInTheDocument();
    });

    it('filters approvals when clicking status pills', async () => {
        const mockApprovals = [
            { id: '1', title: 'Draft Item', status: 'DRAFT', event: {} },
            { id: '2', title: 'Pending Item', status: 'PENDING', event: {} }
        ];

        apiGet.mockImplementation((url) => {
            if (url.includes('/approvals')) return Promise.resolve({ approvals: mockApprovals });
            if (url.includes('/events')) return Promise.resolve({ events: [] });
            return Promise.resolve({});
        });

        await act(async () => {
            render(<ApprovalsDashboard isDark={false} user={{}} />);
        });

        // Initially shows Pending Item
        expect(screen.getByText('Pending Item')).toBeInTheDocument();
        expect(screen.queryByText('Draft Item')).not.toBeInTheDocument();

        // Click "Drafts" filter
        const draftFilter = screen.getByText('Drafts');
        fireEvent.click(draftFilter);

        // Now shows Draft Item
        expect(screen.getByText('Draft Item')).toBeInTheDocument();
        expect(screen.queryByText('Pending Item')).not.toBeInTheDocument();
    });

    it('renders empty state correctly by status', async () => {
        apiGet.mockImplementation((url) => {
            if (url.includes('/approvals')) return Promise.resolve({ approvals: [] });
            if (url.includes('/events')) return Promise.resolve({ events: [] });
            return Promise.resolve({});
        });

        await act(async () => {
            render(<ApprovalsDashboard isDark={false} user={{}} />);
        });

        // Default is PENDING
        expect(screen.getByText("No projects found with status 'pending'.")).toBeInTheDocument();
    });
});
