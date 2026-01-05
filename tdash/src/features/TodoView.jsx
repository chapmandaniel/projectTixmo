import React, { useState, useEffect } from 'react';
import { Plus, Filter, MoreHorizontal, LogIn } from 'lucide-react';
import CreateTaskModal from './CreateTaskModal';
import TaskDetailsModal from './TaskDetailsModal';
import KanbanCard from './KanbanCard';
import api from '../lib/api';
import { auth } from '../lib/auth';

const STATUS_MAP = {
    'TO_DO': 'todo',
    'IN_PROGRESS': 'inProgress',
    'REVIEW': 'review',
    'DONE': 'done'
};

const REVERSE_STATUS_MAP = {
    'todo': 'TO_DO',
    'inProgress': 'IN_PROGRESS',
    'review': 'REVIEW',
    'done': 'DONE'
};

const TodoView = ({ isDark, user }) => {
    const [columns, setColumns] = useState({
        todo: { title: 'To Do', items: [] },
        inProgress: { title: 'In Progress', items: [] },
        review: { title: 'Review', items: [] },
        done: { title: 'Done', items: [] }
    });
    const [users, setUsers] = useState([]);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [expandedTask, setExpandedTask] = useState(null);
    const [expandedColId, setExpandedColId] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        fetchTasks();
        fetchUsers();
    }, []);

    const fetchTasks = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/tasks');
            const tasks = response.data;
            // ... (rest of the logic remains similar but simplified if needed)
            const newColumns = {
                todo: { title: 'To Do', items: [] },
                inProgress: { title: 'In Progress', items: [] },
                review: { title: 'Review', items: [] },
                done: { title: 'Done', items: [] }
            };

            // Handle potential array wrapper { data: [...] } or direct array [...]
            const taskList = Array.isArray(tasks) ? tasks : (tasks.data || []);

            taskList.forEach(task => {
                const colKey = STATUS_MAP[task.status] || 'todo';
                if (newColumns[colKey]) {
                    newColumns[colKey].items.push({
                        ...task,
                        content: task.title,
                        assignee: task.assignee?.id,
                        assigneeName: task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : null,
                        messages: task.comments?.map(c => ({
                            id: c.id,
                            text: c.content,
                            sender: c.user ? `${c.user.firstName} ${c.user.lastName}` : 'Unknown',
                            time: new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            isMe: c.user?.id === user?.id
                        })) || []
                    });
                }
            });

            setColumns(newColumns);
        } catch (error) {
            console.error('Failed to fetch tasks', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const response = await api.get('/users');
            if (response.data.data && response.data.data.users) {
                setUsers(response.data.data.users);
            }
        } catch (error) {
            console.error('Failed to fetch users', error);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDrop = async (e, targetColId) => {
        const taskId = e.dataTransfer.getData('text/plain');
        let sourceColId = null;
        let task = null;

        Object.entries(columns).forEach(([colId, col]) => {
            const found = col.items.find(t => t.id === taskId);
            if (found) {
                sourceColId = colId;
                task = found;
            }
        });

        if (!task || sourceColId === targetColId) return;

        // Optimistic Update
        setColumns(prev => {
            const sourceItems = prev[sourceColId].items.filter(t => t.id !== taskId);
            const targetItems = [...prev[targetColId].items, { ...task, status: REVERSE_STATUS_MAP[targetColId] }];
            return {
                ...prev,
                [sourceColId]: { ...prev[sourceColId], items: sourceItems },
                [targetColId]: { ...prev[targetColId], items: targetItems }
            };
        });

        // API Call
        try {
            await api.patch(`/tasks/${taskId}`, {
                status: REVERSE_STATUS_MAP[targetColId]
            });
        } catch (error) {
            console.error('Failed to update task status', error);
            fetchTasks(); // Revert on error
        }
    };

    const handleDeleteTask = async (taskId) => {
        if (!window.confirm('Delete this task?')) return;

        // Optimistic Update
        setColumns(prev => {
            const newCols = {};
            Object.entries(prev).forEach(([colId, col]) => {
                newCols[colId] = {
                    ...col,
                    items: col.items.filter(t => t.id !== taskId)
                };
            });
            return newCols;
        });

        try {
            await api.delete(`/tasks/${taskId}`);
        } catch (error) {
            console.error('Failed to delete task', error);
            fetchTasks();
        }
    };

    const handleCreateTask = async (newTaskData) => {
        try {
            const payload = {
                title: newTaskData.title,
                description: newTaskData.content,
                priority: newTaskData.priority.toUpperCase(),
                tag: newTaskData.tag.toUpperCase(),
                assigneeId: newTaskData.assignee || undefined,
            };

            await api.post('/tasks', payload);
            fetchTasks();
            setIsCreateModalOpen(false);
        } catch (error) {
            console.error('Failed to create task', error);
            alert('Failed to create task: ' + (error.response?.data?.message || error.message));
        }
    };

    const handleExpandTask = (task, colId) => {
        setExpandedTask(task);
        setExpandedColId(colId);
    };

    const handleUpdateTask = async (updatedTask) => {
        setExpandedTask(updatedTask);
        try {
            const payload = {
                title: updatedTask.content,
                description: updatedTask.description,
                priority: updatedTask.priority,
                tag: updatedTask.tag,
                assigneeId: updatedTask.assignee || null,
            };

            await api.patch(`/tasks/${updatedTask.id}`, payload);
            fetchTasks();
        } catch (error) {
            console.error('Failed to update task', error);
        }
    };

    const COLUMN_COLORS = {
        todo: 'border-t-4 border-indigo-500',
        inProgress: 'border-t-4 border-emerald-500',
        review: 'border-t-4 border-yellow-500',
        done: 'border-t-4 border-transparent'
    };

    return (
        <div className="space-y-6 animate-fade-in h-[calc(100vh-8rem)]">

            {/* Create Task Modal */}
            {isCreateModalOpen && (
                <CreateTaskModal
                    onClose={() => setIsCreateModalOpen(false)}
                    onCreate={handleCreateTask}
                    users={users}
                    isDark={isDark}
                />
            )}

            {/* Expanded Task Modal */}
            {expandedTask && (
                <TaskDetailsModal
                    task={expandedTask}
                    users={users}
                    isDark={isDark}
                    onClose={() => setExpandedTask(null)}
                    onUpdate={handleUpdateTask}
                />
            )}

            <div className="flex justify-between items-center">
                <div>
                    <h2 className={`text-2xl font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Team Tasks</h2>
                    <p className={`${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1 text-sm`}>
                        {isLoading ? 'Syncing...' : 'Manage and track team tasks.'}
                    </p>
                </div>
                <div className="flex space-x-3">
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center shadow-lg transition-all ${isDark ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'}`}
                    >
                        <Plus size={16} className="mr-2" />
                        Create Task
                    </button>
                    <button className={`px-4 py-2 text-sm font-normal rounded-lg flex items-center ${isDark ? 'bg-[#1e1e1e] text-gray-300 hover:bg-[#252525]' : 'bg-white text-gray-600 hover:bg-gray-50 shadow-sm'}`}>
                        <Filter size={16} className="mr-2" />
                        Filter
                    </button>
                </div>
            </div>

            <div className="flex gap-5 overflow-x-auto h-full pb-4">
                {Object.entries(columns).map(([colId, col]) => (
                    <div
                        key={colId}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, colId)}
                        className={`flex-shrink-0 w-80 rounded-xl p-4 flex flex-col transition-all ${COLUMN_COLORS[colId]} ${isDark ? 'bg-[#1e1e1e] shadow-lg shadow-black/20' : 'bg-gray-50 border-x border-b border-gray-200'}`}
                    >
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center space-x-2">
                                <h3 className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{col.title}</h3>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-[#2a2a2a] text-gray-400' : 'bg-gray-200 text-gray-600'}`}>
                                    {col.items.length}
                                </span>
                            </div>
                            <div className="flex space-x-1">
                                <button className={`p-1 rounded hover:bg-gray-500/10 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    <MoreHorizontal size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto min-h-[100px] custom-scrollbar">
                            {col.items.map(item => (
                                <KanbanCard
                                    key={item.id}
                                    item={item}
                                    isDark={isDark}
                                    isCompact={colId === 'done'}
                                    onDelete={handleDeleteTask}
                                    onExpand={(task) => handleExpandTask(task, colId)}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TodoView;
