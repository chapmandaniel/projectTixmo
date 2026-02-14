import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreateApprovalModal from '../features/CreateApprovalModal';

// Mock API
const apiPost = vi.fn();
vi.mock('../lib/api', () => ({
    api: {
        post: (...args) => apiPost(...args),
        upload: vi.fn(),
        get: vi.fn().mockResolvedValue({ approval: { id: '123' } }),
    }
}));

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn();

describe('CreateApprovalModal', () => {
    it('submits correctly formatted ISO date', async () => {
        const handleCreate = vi.fn();
        const onClose = vi.fn();

        render(
            <CreateApprovalModal
                isDark={false}
                events={[{ id: 'e1', name: 'Test Event' }]}
                onClose={onClose}
                onCreate={handleCreate}
            />
        );

        // Fill form
        fireEvent.change(screen.getByLabelText(/event/i), { target: { value: 'e1' } });
        fireEvent.change(screen.getByPlaceholderText(/event poster/i), { target: { value: 'Test Title' } });

        // select date - userEvent doesn't work well with date inputs sometimes, use fireEvent
        const dateInput = screen.getByLabelText(/due date/i);
        fireEvent.change(dateInput, { target: { value: '2026-05-20' } });

        // Submit
        const saveButton = screen.getByText('Save Draft');
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(apiPost).toHaveBeenCalled();
        });

        // Verify payload has ISO date
        const callArgs = apiPost.mock.calls[0];
        const payload = callArgs[1];

        // Zod datetime() expects ISO string, including time if checks are strict, 
        // but 'YYYY-MM-DD' is definitely NOT enough.
        // We expect it to be converted to something like '2026-05-20T00:00:00.000Z' or minimal ISO
        expect(payload.dueDate).toContain('2026-05-20');
        expect(payload.dueDate).toContain('T');
    });
});
