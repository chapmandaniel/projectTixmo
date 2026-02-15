import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ApprovalDetailView from '../features/ApprovalDetailView';

// Mock api
vi.mock('../lib/api', () => ({
    api: {
        post: vi.fn(),
        delete: vi.fn(),
        upload: vi.fn(),
    },
}));

// Mock lucide-react icons to be easily queryable
vi.mock('lucide-react', async () => {
    return {
        ArrowLeft: () => <span data-testid="icon-arrow-left" />,
        Upload: () => <span data-testid="icon-upload" />,
        Users: () => <span data-testid="icon-users" />,
        Send: () => <span data-testid="icon-send" />,
        Trash2: () => <span data-testid="icon-trash-2" />,
        Edit3: () => <span data-testid="icon-edit-3" />,
        CheckCircle: () => <span data-testid="icon-check-circle" />,
        XCircle: () => <span data-testid="icon-x-circle" />,
        Clock: () => <span data-testid="icon-clock" />,
        MessageSquare: () => <span data-testid="icon-message-square" />,
        FileText: () => <span data-testid="icon-file-text" />,
        Image: () => <span data-testid="icon-image" />,
        X: () => <span data-testid="icon-x" />,
        Plus: () => <span data-testid="icon-plus" />,
        RefreshCw: () => <span data-testid="icon-refresh-cw" />,
        Download: () => <span data-testid="icon-download" />,
        ExternalLink: () => <span data-testid="icon-external-link" />,
        AlertTriangle: () => <span data-testid="icon-alert-triangle" />,
        Paperclip: () => <span data-testid="icon-paperclip" />,
        Eye: () => <span data-testid="icon-eye" />,
        MoreHorizontal: () => <span data-testid="icon-more-horizontal" />,
        ChevronRight: () => <span data-testid="icon-chevron-right" />,
    };
});

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe('ApprovalDetailView', () => {
    const mockApproval = {
        id: '123',
        title: 'Test Approval',
        status: 'DRAFT',
        reviewers: [
            { id: 'r1', email: 'test@example.com', name: 'Test User' },
        ],
        assets: [],
        comments: [],
        version: 1,
        event: { name: 'Test Event' },
    };

    const statuses = ['DRAFT', 'PENDING', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED'];

    statuses.forEach((status) => {
        it(`should render correctly for status: ${status}`, () => {
            render(
                <ApprovalDetailView
                    approval={{ ...mockApproval, status }}
                    isDark={false}
                    user={{ id: 'u1' }}
                    onBack={() => { }}
                    onUpdate={() => { }}
                    onDelete={() => { }}
                />
            );

            // Check for Manage button
            const manageButton = screen.queryByText('Manage', { selector: 'button' });
            expect(manageButton).toBeInTheDocument();
        });
    });
});
