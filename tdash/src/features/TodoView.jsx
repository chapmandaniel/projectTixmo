import React, { useState, useEffect } from 'react';
import { Plus, Filter, MoreHorizontal, LogIn, ListTodo } from 'lucide-react';
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

    const COLUMN_GRADIENTS = {
        todo: 'from-pink-500 to-orange-400',
        inProgress: 'from-cyan-400 to-blue-500',
        review: 'from-fuchsia-500 to-purple-600',
        done: 'from-emerald-400 to-teal-500'
    };

    return (
        <div className="flex flex-col gap-6 animate-fade-in max-w-[1500px] mx-auto h-full min-h-[600px]">

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

            <section className={`relative overflow-hidden rounded-md border p-6 sm:p-8 shrink-0 ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40] shadow-2xl shadow-black/20' : 'bg-white border-gray-200 shadow-sm'}`}>
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-fuchsia-500/10 blur-3xl" />
                    <div className="absolute left-10 bottom-0 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
                </div>
                <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className={`flex flex-wrap items-baseline gap-3 text-3xl sm:text-4xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                            <span className="inline-flex items-center gap-2">
                                <span>Task Manager</span>
                                <ListTodo className={`h-6 w-6 sm:h-7 sm:w-7 ${isDark ? 'text-fuchsia-300' : 'text-fuchsia-700'}`} />
                            </span>
                        </h2>
                    </div>
                    <div className="flex space-x-3">
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className={`flex items-center space-x-2 px-4 py-2 text-sm font-normal rounded-md transition-all shadow-lg ${isDark ? 'bg-indigo-500 text-white hover:bg-indigo-400 shadow-indigo-500/20' : 'bg-gray-800 text-white hover:bg-gray-700 shadow-gray-400/20'}`}
                        >
                            <Plus size={16} />
                            <span>Create Task</span>
                        </button>
                        <button className={`flex items-center space-x-2 px-3 py-2 text-sm font-light rounded-md border transition-colors ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40]/60 text-[#a1a5b7] hover:text-gray-200 hover:bg-[#232336]' : 'bg-white border-gray-200/60 text-gray-600 hover:bg-gray-50'}`}>
                            <Filter size={14} />
                            <span>Filter</span>
                        </button>
                    </div>
                </div>
            </section>

            <div className="flex-1 flex gap-4 overflow-x-auto overflow-y-hidden min-h-0 pb-2">
                {Object.entries(columns).map(([colId, col]) => (
                    <div
                        key={colId}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, colId)}
                        className={`relative h-full flex-shrink-0 w-72 lg:flex-1 min-w-[280px] rounded-md p-4 flex flex-col transition-all border overflow-hidden ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40]/60 shadow-lg shadow-black/20' : 'bg-gray-50 border-gray-200/60'}`}
                    >
                        <div className={`absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r ${COLUMN_GRADIENTS[colId]} opacity-70`}></div>

                        <div className="flex justify-between items-center mb-4 z-10 pt-1">
                            <div className="flex items-center space-x-2">
                                <h3 className={`font-light tracking-tight text-lg ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>{col.title}</h3>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isDark ? 'bg-[#151521] text-gray-400 border border-[#2b2b40]/60' : 'bg-white text-gray-600 border border-gray-200/60'}`}>
                                    {col.items.length}
                                </span>
                            </div>
                            <div className="flex space-x-1">
                                <button className={`p-1 rounded-md transition-colors ${isDark ? 'text-gray-500 hover:text-white hover:bg-[#232336]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-200'}`}>
                                    <MoreHorizontal size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto min-h-[100px] custom-scrollbar z-10 pr-2 -mr-2">
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
