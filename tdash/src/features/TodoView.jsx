import React, { useState } from 'react';
import { Plus, Filter, MoreHorizontal } from 'lucide-react';
import CreateTaskModal from './CreateTaskModal';
import TaskDetailsModal from './TaskDetailsModal';
import KanbanCard from './KanbanCard';
import { INITIAL_KANBAN_DATA } from '../data/mockData';

const TodoView = ({ isDark }) => {
    const [columns, setColumns] = useState(INITIAL_KANBAN_DATA);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [expandedTask, setExpandedTask] = useState(null);
    const [expandedColId, setExpandedColId] = useState(null);

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDrop = (e, targetColId) => {
        const taskId = e.dataTransfer.getData('text/plain');
        let sourceColId = null;
        let task = null;

        // Find source column and task
        Object.entries(columns).forEach(([colId, col]) => {
            const found = col.items.find(t => t.id === taskId);
            if (found) {
                sourceColId = colId;
                task = found;
            }
        });

        if (!task || sourceColId === targetColId) return;

        setColumns(prev => {
            const sourceItems = prev[sourceColId].items.filter(t => t.id !== taskId);
            const targetItems = [...prev[targetColId].items, task];

            return {
                ...prev,
                [sourceColId]: { ...prev[sourceColId], items: sourceItems },
                [targetColId]: { ...prev[targetColId], items: targetItems }
            };
        });
    };

    const handleDeleteTask = (taskId) => {
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
    };

    const handleCreateTask = (newTaskData) => {
        const newTask = {
            id: `t-${Date.now()}`,
            content: newTaskData.title, // Map title to content (KanbanCard expects content)
            description: newTaskData.content, // Map description to description
            priority: newTaskData.priority,
            tag: newTaskData.tag,
            assignee: newTaskData.assignee,
            attachments: newTaskData.attachments,
            messages: []
        };

        setColumns(prev => ({
            ...prev,
            todo: {
                ...prev.todo,
                items: [...prev.todo.items, newTask]
            }
        }));
        setIsCreateModalOpen(false);
    };

    const handleExpandTask = (task, colId) => {
        setExpandedTask(task);
        setExpandedColId(colId);
    };

    const handleUpdateTask = (updatedTask) => {
        setColumns(prev => ({
            ...prev,
            [expandedColId]: {
                ...prev[expandedColId],
                items: prev[expandedColId].items.map(t => t.id === updatedTask.id ? updatedTask : t)
            }
        }));
        setExpandedTask(updatedTask); // Keep local modal state in sync
    };

    return (
        <div className="space-y-6 animate-fade-in h-[calc(100vh-8rem)]">

            {/* Create Task Modal */}
            {isCreateModalOpen && (
                <CreateTaskModal
                    onClose={() => setIsCreateModalOpen(false)}
                    onCreate={handleCreateTask}
                    isDark={isDark}
                />
            )}

            {/* Expanded Task Modal */}
            {expandedTask && (
                <TaskDetailsModal
                    task={expandedTask}
                    isDark={isDark}
                    onClose={() => setExpandedTask(null)}
                    onUpdate={handleUpdateTask}
                />
            )}

            <div className="flex justify-between items-center">
                <div>
                    <h2 className={`text-2xl font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Task Manager</h2>
                    <p className={`${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1 text-sm`}>Manage and track team tasks.</p>
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
                        className={`flex-shrink-0 w-80 rounded-xl p-4 flex flex-col ${isDark ? 'bg-[#1e1e1e] shadow-lg shadow-black/20' : 'bg-gray-50 border border-gray-200'}`}
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
