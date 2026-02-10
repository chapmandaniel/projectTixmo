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
    };
});

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
        it(`should show/hide reviewer buttons correctly for status: ${status}`, () => {
            render(
                <ApprovalDetailView
                    approval={{ ...mockApproval, status }}
                    isDark={false}
                    user={{ id: 'u1' }}
                    onBack={() => {}}
                    onUpdate={() => {}}
                    onDelete={() => {}}
                />
            );

            // "Add" reviewer button usually has text "Add" and a Plus icon
            // In the component:
            /*
            <button ...>
                <Plus ... />
                Add
            </button>
            */
            const addButton = screen.queryByText('Add', { selector: 'button' });

            // "Remove" reviewer button has X icon
            // In the component:
            /*
            <button ...>
                <X ... />
            </button>
            */
            // We can find it by looking for the X icon and getting its parent button
            const removeIcon = screen.queryByTestId('icon-x');
            const removeButton = removeIcon ? removeIcon.closest('button') : null;

            if (['DRAFT', 'PENDING', 'CHANGES_REQUESTED'].includes(status)) {
                expect(addButton).toBeInTheDocument();
                // Check that the remove button is present (X icon inside a button)
                // Note: There might be other X icons (like in error message), but initially no error is shown.
                // To be safe, we check if removeIcon is present in the reviewer list item.
                // But given the simplicity, just checking existence is a good start.
                expect(removeButton).toBeInTheDocument();
            } else {
                expect(addButton).not.toBeInTheDocument();
                // For APPROVED/REJECTED, remove button should not be there
                // Note: If there are no other X icons, this works.
                // If there are other X icons (e.g. modal close), this might be flaky.
                // But ApprovalDetailView doesn't seem to have other X icons visible initially (error is hidden).
                expect(removeButton).not.toBeInTheDocument();
            }
        });
    });
});
