import React, { useState } from 'react';
import { Plus, Trash2, CheckCircle, Circle, ListTodo } from 'lucide-react';

const PersonalTodoView = ({ isDark }) => {
    const [tasks, setTasks] = useState([
        { id: 1, text: 'Review quarterly goals', completed: false },
        { id: 2, text: 'Schedule dentist appointment', completed: true },
        { id: 3, text: 'Update project documentation', completed: false },
    ]);
    const [newTask, setNewTask] = useState('');
    const [activeTab, setActiveTab] = useState('active');

    const handleAddTask = (e) => {
        e.preventDefault();
        if (!newTask.trim()) return;

        setTasks([
            ...tasks,
            { id: Date.now(), text: newTask, completed: false }
        ]);
        setNewTask('');
    };

    const toggleTask = (id) => {
        setTasks(tasks.map(t =>
            t.id === id ? { ...t, completed: !t.completed } : t
        ));
    };

    const deleteTask = (id) => {
        setTasks(tasks.filter(t => t.id !== id));
    };

    const filteredTasks = tasks.filter(t =>
        activeTab === 'active' ? !t.completed : t.completed
    );

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            <div className="flex items-center space-x-3 mb-6">
                <div className={`p-2 rounded-lg ${isDark ? 'bg-indigo-500/10' : 'bg-indigo-50'}`}>
                    <ListTodo className={isDark ? 'text-indigo-400' : 'text-indigo-600'} size={24} />
                </div>
                <div>
                    <h2 className={`text-2xl font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>My TODO's</h2>
                    <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Manage your personal tasks and reminders.</p>
                </div>
            </div>

            {/* Input Area */}
            <form onSubmit={handleAddTask} className="relative">
                <input
                    type="text"
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    placeholder="Add a new task..."
                    className={`w-full p-4 pl-5 rounded-xl border transition-all outline-none ${isDark
                            ? 'bg-[#1e1e1e] border-[#333] text-gray-200 focus:border-indigo-500 placeholder-gray-600'
                            : 'bg-white border-gray-200 text-gray-800 focus:border-indigo-500 placeholder-gray-400 shadow-sm'
                        }`}
                />
                <button
                    type="submit"
                    disabled={!newTask.trim()}
                    className={`absolute right-2 top-2 bottom-2 px-4 rounded-lg font-medium transition-colors flex items-center ${isDark
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:hover:bg-indigo-600'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:hover:bg-indigo-600'
                        }`}
                >
                    <Plus size={18} className="mr-1" /> Add
                </button>
            </form>

            <div className={`rounded-xl overflow-hidden min-h-[400px] flex flex-col ${isDark ? 'bg-[#1e1e1e] shadow-lg shadow-black/20' : 'bg-white shadow-sm border border-gray-100'}`}>
                {/* Tabs */}
                <div className={`flex border-b ${isDark ? 'border-[#2a2a2a]' : 'border-gray-100'}`}>
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors relative ${activeTab === 'active'
                                ? (isDark ? 'text-indigo-400' : 'text-indigo-600')
                                : (isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700')
                            }`}
                    >
                        Active ({tasks.filter(t => !t.completed).length})
                        {activeTab === 'active' && (
                            <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${isDark ? 'bg-indigo-500' : 'bg-indigo-600'}`} />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('completed')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors relative ${activeTab === 'completed'
                                ? (isDark ? 'text-indigo-400' : 'text-indigo-600')
                                : (isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700')
                            }`}
                    >
                        Completed ({tasks.filter(t => t.completed).length})
                        {activeTab === 'completed' && (
                            <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${isDark ? 'bg-indigo-500' : 'bg-indigo-600'}`} />
                        )}
                    </button>
                </div>

                {/* Task List */}
                <div className="flex-1 p-2 space-y-1 overflow-y-auto max-h-[600px] custom-scrollbar">
                    {filteredTasks.length === 0 ? (
                        <div className="h-40 flex flex-col items-center justify-center text-center opacity-50">
                            <ListTodo size={48} className={`mb-2 ${isDark ? 'text-gray-700' : 'text-gray-300'}`} />
                            <p className={`${isDark ? 'text-gray-600' : 'text-gray-400'}`}>No {activeTab} tasks found</p>
                        </div>
                    ) : (
                        filteredTasks.map(task => (
                            <div
                                key={task.id}
                                className={`group flex items-center justify-between p-3 rounded-lg transition-all ${isDark ? 'hover:bg-[#252525]' : 'hover:bg-gray-50'
                                    }`}
                            >
                                <div className="flex items-center space-x-3 flex-1">
                                    <button
                                        onClick={() => toggleTask(task.id)}
                                        className={`flex-shrink-0 transition-colors ${task.completed
                                                ? (isDark ? 'text-emerald-500' : 'text-emerald-600')
                                                : (isDark ? 'text-gray-600 hover:text-gray-400' : 'text-gray-300 hover:text-indigo-500')
                                            }`}
                                    >
                                        {task.completed ? <CheckCircle size={20} /> : <Circle size={20} />}
                                    </button>
                                    <span className={`text-sm transition-all ${task.completed
                                            ? (isDark ? 'text-gray-500 line-through' : 'text-gray-400 line-through')
                                            : (isDark ? 'text-gray-200' : 'text-gray-700')
                                        }`}>
                                        {task.text}
                                    </span>
                                </div>
                                <button
                                    onClick={() => deleteTask(task.id)}
                                    className={`opacity-0 group-hover:opacity-100 p-1.5 rounded-md transition-all ${isDark
                                            ? 'text-gray-600 hover:bg-rose-500/10 hover:text-rose-400'
                                            : 'text-gray-400 hover:bg-rose-50 hover:text-rose-500'
                                        }`}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default PersonalTodoView;
