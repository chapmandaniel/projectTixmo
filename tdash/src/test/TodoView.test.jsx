import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import TodoView from '../features/TodoView';

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPatch = vi.fn();
const apiDelete = vi.fn();

vi.mock('../lib/api', () => ({
    default: {
        get: (...args) => apiGet(...args),
        post: (...args) => apiPost(...args),
        patch: (...args) => apiPatch(...args),
        delete: (...args) => apiDelete(...args),
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() },
        },
    },
}));

vi.mock('../lib/auth', () => ({
    auth: {
        getUser: () => ({ id: 'owner-1', firstName: 'Avery', role: 'OWNER' }),
        isAuthenticated: () => true,
    },
}));

const owner = { id: 'owner-1', firstName: 'Avery', lastName: 'Stone', role: 'OWNER' };
const teammate = { id: 'user-2', firstName: 'Sam', lastName: 'Lee', email: 'sam@example.test' };
const nightShow = { id: 'event-1', name: 'Night Show' };

const todoTask = {
    id: 'task-todo',
    title: 'Print wristbands',
    description: 'Pack 400 bands',
    status: 'TO_DO',
    priority: 'HIGH',
    tag: 'OPS',
    eventId: 'event-1',
    event: nightShow,
    assignee: teammate,
    comments: [],
};

const progressTask = {
    id: 'task-progress',
    title: 'Review artwork',
    description: 'Poster v3',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    tag: 'DESIGN',
    comments: [
        {
            id: 'c1',
            content: 'Looks good',
            createdAt: '2026-11-15T12:00:00.000Z',
            user: teammate,
        },
    ],
};

const usersPayload = { data: { data: { users: [owner, teammate] } } };
const eventsPayload = { data: { data: { events: [nightShow] } } };

const mockBoard = (tasks = [todoTask, progressTask]) => {
    apiGet.mockImplementation(async (url) => {
        if (url === '/tasks') return { data: tasks };
        if (url === '/users') return usersPayload;
        if (url === '/events') return eventsPayload;
        throw new Error(`Unexpected GET ${url}`);
    });
};

const submitCreate = () => {
    const modal = screen.getByRole('heading', { name: 'Create New Task' }).closest('.fixed');
    fireEvent.click(within(modal).getByRole('button', { name: 'Create Task' }));
};

describe('TodoView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Element.prototype.scrollIntoView = vi.fn();
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        vi.spyOn(window, 'alert').mockImplementation(() => {});
        mockBoard();
        apiPost.mockResolvedValue({ data: { id: 'task-new' } });
        apiPatch.mockResolvedValue({ data: { id: todoTask.id, status: 'IN_PROGRESS' } });
        apiDelete.mockResolvedValue({});
    });

    it('loads tasks into To Do and In Progress columns', async () => {
        render(<TodoView isDark={false} user={owner} />);

        expect(await screen.findByText('Print wristbands')).toBeInTheDocument();
        expect(screen.getByText('Review artwork')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'To Do' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'In Progress' })).toBeInTheDocument();
        expect(apiGet).toHaveBeenCalledWith('/tasks', { params: {} });
        expect(apiGet).toHaveBeenCalledWith('/users');
        expect(apiGet).toHaveBeenCalledWith('/events', { params: { page: 1, limit: 100 } });
    });

    it('creates a task from the modal after a title is provided', async () => {
        render(<TodoView isDark={false} user={owner} />);
        await screen.findByText('Print wristbands');

        fireEvent.click(screen.getByRole('button', { name: 'Create Task' }));
        expect(screen.getByRole('heading', { name: 'Create New Task' })).toBeInTheDocument();

        submitCreate();
        expect(screen.getByText('Title is required')).toBeInTheDocument();
        expect(apiPost).not.toHaveBeenCalled();

        fireEvent.change(screen.getByLabelText(/Task Title/), {
            target: { value: 'Confirm radios' },
        });
        submitCreate();

        await waitFor(() => {
            expect(apiPost).toHaveBeenCalledWith('/tasks', {
                title: 'Confirm radios',
                description: '',
                priority: 'MEDIUM',
                tag: 'GENERAL',
                assigneeId: undefined,
                eventId: undefined,
            });
        });
        await waitFor(() => {
            expect(screen.queryByRole('heading', { name: 'Create New Task' })).not.toBeInTheDocument();
        });
    });

    it('keeps the create modal open and alerts when the API refuses the create', async () => {
        apiPost.mockRejectedValueOnce({
            response: { data: { message: 'Title is required' } },
            message: 'Request failed',
        });
        render(<TodoView isDark={false} user={owner} />);
        await screen.findByText('Print wristbands');

        fireEvent.click(screen.getByRole('button', { name: 'Create Task' }));
        fireEvent.change(screen.getByLabelText(/Task Title/), { target: { value: 'Will fail' } });
        submitCreate();

        await waitFor(() => {
            expect(window.alert).toHaveBeenCalledWith('Failed to create task: Title is required');
        });
        expect(screen.getByRole('heading', { name: 'Create New Task' })).toBeInTheDocument();
    });

    it('deletes a task after confirmation and skips delete when cancelled', async () => {
        render(<TodoView isDark={false} user={owner} />);
        await screen.findByText('Print wristbands');

        fireEvent.click(screen.getAllByTitle('Delete Task')[0]);
        await waitFor(() => {
            expect(apiDelete).toHaveBeenCalledWith('/tasks/task-todo');
        });
        expect(screen.queryByText('Print wristbands')).not.toBeInTheDocument();

        window.confirm.mockReturnValueOnce(false);
        fireEvent.click(screen.getAllByTitle('Delete Task')[0]);
        expect(apiDelete).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Review artwork')).toBeInTheDocument();
    });

    it('refetches the board when delete is forbidden', async () => {
        apiDelete.mockRejectedValueOnce({ response: { status: 403 } });
        render(<TodoView isDark={false} user={owner} />);
        await screen.findByText('Print wristbands');

        const taskGetsBefore = apiGet.mock.calls.filter((call) => call[0] === '/tasks').length;
        fireEvent.click(screen.getAllByTitle('Delete Task')[0]);
        await waitFor(() => {
            expect(apiGet.mock.calls.filter((call) => call[0] === '/tasks').length).toBeGreaterThan(
                taskGetsBefore
            );
        });
        expect(await screen.findByText('Print wristbands')).toBeInTheDocument();
    });

    it('opens task details from a card View control', async () => {
        render(<TodoView isDark={false} user={owner} />);
        await screen.findByText('Print wristbands');

        fireEvent.click(screen.getAllByRole('button', { name: /View/ })[0]);

        expect(await screen.findByText('Pack 400 bands')).toBeInTheDocument();
        expect(screen.getByText('ID: task-todo')).toBeInTheDocument();
    });

    it('refetches tasks when the event filter changes', async () => {
        render(<TodoView isDark={false} user={owner} />);
        await screen.findByText('Print wristbands');

        fireEvent.change(screen.getByLabelText('Filter tasks by event'), {
            target: { value: 'event-1' },
        });

        await waitFor(() => {
            expect(apiGet).toHaveBeenCalledWith('/tasks', { params: { eventId: 'event-1' } });
        });
    });
});
