import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TaskDetailsModal from '../features/TaskDetailsModal';

const apiPost = vi.fn();

vi.mock('../lib/api', () => ({
    default: {
        post: (...args) => apiPost(...args),
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() },
        },
    },
}));

const users = [
    { id: 'user-2', firstName: 'Sam', lastName: 'Lee' },
    { id: 'owner-1', firstName: 'Avery', lastName: 'Stone' },
];

const task = {
    id: 'task-todo',
    content: 'Print wristbands',
    description: 'Pack 400 bands',
    priority: 'HIGH',
    tag: 'OPS',
    assignee: 'user-2',
    messages: [
        {
            id: 'c1',
            text: 'Looks good',
            sender: 'Sam Lee',
            time: '12:00',
        },
    ],
};

describe('TaskDetailsModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Element.prototype.scrollIntoView = vi.fn();
        vi.spyOn(window, 'alert').mockImplementation(() => {});
        apiPost.mockResolvedValue({ data: { id: 'c2' } });
    });

    it('posts a comment and does not post blank comments', async () => {
        const onUpdate = vi.fn();
        render(
            <TaskDetailsModal
                task={task}
                onClose={vi.fn()}
                onUpdate={onUpdate}
                isDark={false}
                users={users}
            />
        );

        expect(screen.getByText('Print wristbands')).toBeInTheDocument();
        expect(screen.getByText('Looks good')).toBeInTheDocument();

        const commentBox = screen.getByPlaceholderText(/Write a comment/);
        fireEvent.keyDown(commentBox, { key: 'Enter' });
        expect(apiPost).not.toHaveBeenCalled();

        fireEvent.change(commentBox, { target: { value: 'Printer booked' } });
        fireEvent.keyDown(commentBox, { key: 'Enter' });

        await waitFor(() => {
            expect(apiPost).toHaveBeenCalledWith('/tasks/task-todo/comments', { content: 'Printer booked' });
        });
        expect(onUpdate).toHaveBeenCalled();
    });

    it('alerts and keeps the comment when the API refuses it', async () => {
        apiPost.mockRejectedValueOnce({ response: { status: 403 } });
        render(
            <TaskDetailsModal
                task={task}
                onClose={vi.fn()}
                onUpdate={vi.fn()}
                isDark={false}
                users={users}
            />
        );

        fireEvent.change(screen.getByPlaceholderText(/Write a comment/), {
            target: { value: 'Should fail' },
        });
        fireEvent.keyDown(screen.getByPlaceholderText(/Write a comment/), { key: 'Enter' });

        await waitFor(() => {
            expect(window.alert).toHaveBeenCalledWith('Failed to send comment');
        });
        expect(apiPost).toHaveBeenCalledWith('/tasks/task-todo/comments', { content: 'Should fail' });
    });

    it('saves an edited title through onUpdate', () => {
        const onUpdate = vi.fn();
        render(
            <TaskDetailsModal
                task={task}
                onClose={vi.fn()}
                onUpdate={onUpdate}
                isDark={false}
                users={users}
            />
        );

        fireEvent.click(screen.getByTitle('Edit Task'));
        fireEvent.change(screen.getByDisplayValue('Print wristbands'), {
            target: { value: 'Print and pack wristbands' },
        });
        fireEvent.click(screen.getByTitle('Save'));

        expect(onUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'task-todo',
                content: 'Print and pack wristbands',
                description: 'Pack 400 bands',
            })
        );
    });

    it('assigns a teammate through onUpdate', () => {
        const onUpdate = vi.fn();
        render(
            <TaskDetailsModal
                task={{ ...task, assignee: '' }}
                onClose={vi.fn()}
                onUpdate={onUpdate}
                isDark={false}
                users={users}
            />
        );

        fireEvent.change(screen.getByDisplayValue('Unassigned'), { target: { value: 'user-2' } });
        expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ assignee: 'user-2' }));
    });

    it('sends API enum priority values when the operator edits priority (TaskDetailsModal.jsx:123)', () => {
        const onUpdate = vi.fn();
        render(
            <TaskDetailsModal
                task={task}
                onClose={vi.fn()}
                onUpdate={onUpdate}
                isDark={false}
                users={users}
            />
        );
        fireEvent.click(screen.getByTitle('Edit Task'));
        fireEvent.change(screen.getByDisplayValue('High'), { target: { value: 'LOW' } });
        fireEvent.click(screen.getByTitle('Save'));
        expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ priority: 'LOW' }));
    });
});
