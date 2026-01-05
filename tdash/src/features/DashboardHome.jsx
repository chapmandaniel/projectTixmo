import React, { useState, useEffect } from 'react';
import { Calendar, Bell, CheckSquare, Ticket, ArrowRight, Clock, AlertCircle, ChevronRight } from 'lucide-react';
import api from '../lib/api';
import TaskDetailsModal from './TaskDetailsModal';
import StatusBadge from '../components/StatusBadge';

const DashboardHome = ({ isDark, user }) => {
    const [tasks, setTasks] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedTask, setSelectedTask] = useState(null);
    const [stats, setStats] = useState({ total: 0, overdue: 0, personal: 0 });

    useEffect(() => {
        const fetchDashboardData = async () => {
            setIsLoading(true);
            try {
                const [tasksRes, notifRes] = await Promise.all([
                    api.get('/tasks', { params: { assigneeId: user?.id } }),
                    api.get('/notifications', { params: { limit: 5 } }),
                ]);

                // Tasks API returns array or { data: [] }
                const taskData = Array.isArray(tasksRes.data) ? tasksRes.data : (tasksRes.data.data || []);
                // Filter out Done tasks to keep dashboard focused
                const activeTasks = taskData.filter(t => t.status !== 'DONE');
                setTasks(activeTasks);

                // Calculate stats
                const overdue = activeTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date()).length;

                // Get personal todos from localStorage
                let personalCount = 0;
                try {
                    const saved = localStorage.getItem('tixmo_personal_todos');
                    if (saved) {
                        const parsed = JSON.parse(saved);
                        personalCount = parsed.filter(t => !t.completed).length;
                    }
                } catch (e) {
                    console.error('Failed to parse local todos', e);
                }

                setStats({
                    total: activeTasks.length,
                    overdue: overdue,
                    personal: personalCount
                });

                // Notifications API returns { success: true, data: { notifications: [] } }
                if (notifRes.data.success && notifRes.data.data) {
                    setNotifications(notifRes.data.data.notifications || []);
                }
            } catch (error) {
                console.error('Failed to fetch dashboard data', error);
            } finally {
                setIsLoading(false);
            }
        };

        if (user) {
            fetchDashboardData();
        } else {
            setIsLoading(false);
        }
    }, [user]);

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'HIGH': return 'text-rose-500 bg-rose-500/10';
            case 'MEDIUM': return 'text-amber-500 bg-amber-500/10';
            case 'LOW': return 'text-emerald-500 bg-emerald-500/10';
            default: return 'text-gray-500 bg-gray-500/10';
        }
    };

    return (
        <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
            {selectedTask && (
                <TaskDetailsModal
                    task={selectedTask}
                    users={[]} // View only mostly, or pass users if needed
                    isDark={isDark}
                    onClose={() => setSelectedTask(null)}
                    onUpdate={() => { }} // Read only on dashboard for simplicity? Or refresh
                />
            )}

            <div className="flex justify-between items-end">
                <div>
                    <h2 className={`text-2xl font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                        Welcome back, {user?.firstName || 'User'}
                    </h2>
                    <p className={`${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1 text-sm font-normal`}>
                        Here's what's on your plate today.
                    </p>
                </div>
                <div className="flex space-x-3">
                    <div className={`px-4 py-2 text-sm font-normal rounded-lg flex items-center ${isDark ? 'bg-[#1e1e1e] text-gray-300' : 'bg-white text-gray-600 shadow-sm'}`}>
                        <Calendar size={16} className="mr-2 opacity-70" />
                        {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: My Tasks Report */}
                <div className={`lg:col-span-2 rounded-xl p-6 flex flex-col ${isDark ? 'bg-[#1e1e1e] shadow-lg shadow-black/20' : 'bg-white shadow-sm border border-gray-100'}`}>
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center space-x-2">
                            <CheckSquare size={20} className={isDark ? 'text-indigo-400' : 'text-indigo-600'} />
                            <h3 className={`text-lg font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>My Tasks Report</h3>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex-1 flex justify-center items-center py-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 h-full">
                            <div className={`flex flex-col items-center justify-center p-6 rounded-lg ${isDark ? 'bg-[#252525]' : 'bg-indigo-50'}`}>
                                <span className={`text-4xl font-bold mb-2 ${isDark ? 'text-white' : 'text-indigo-600'}`}>{stats.total}</span>
                                <span className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-indigo-600/70'}`}>Active Tasks</span>
                            </div>
                            <div className={`flex flex-col items-center justify-center p-6 rounded-lg ${isDark ? 'bg-[#252525]' : 'bg-rose-50'}`}>
                                <span className={`text-4xl font-bold mb-2 ${isDark ? 'text-rose-400' : 'text-rose-500'}`}>{stats.overdue}</span>
                                <span className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-rose-600/70'}`}>Overdue Tasks</span>
                            </div>
                            <div className={`flex flex-col items-center justify-center p-6 rounded-lg ${isDark ? 'bg-[#252525]' : 'bg-emerald-50'}`}>
                                <span className={`text-4xl font-bold mb-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{stats.personal}</span>
                                <span className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-emerald-600/70'}`}>Personal Todos</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column: Notifications & Tickets */}
                <div className="space-y-6">
                    {/* Notifications */}
                    <div className={`rounded-xl p-6 ${isDark ? 'bg-[#1e1e1e] shadow-lg shadow-black/20' : 'bg-white shadow-sm border border-gray-100'}`}>
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center space-x-2">
                                <Bell size={20} className={isDark ? 'text-amber-400' : 'text-amber-500'} />
                                <h3 className={`text-lg font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Notifications</h3>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {isLoading ? (
                                <div className="text-center py-4 text-sm text-gray-500">Loading...</div>
                            ) : notifications.length === 0 ? (
                                <div className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    <p>No new notifications</p>
                                </div>
                            ) : (
                                notifications.map((notif) => (
                                    <div key={notif.id} className={`p-3 rounded-lg flex items-start space-x-3 ${isDark ? 'bg-[#252525]' : 'bg-gray-50'}`}>
                                        <div className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${notif.read ? 'bg-gray-500' : 'bg-indigo-500'}`}></div>
                                        <div>
                                            <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{notif.title}</p>
                                            <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{new Date(notif.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Ticket Management Placeholder */}
                    <div className={`rounded-xl p-6 relative overflow-hidden group ${isDark ? 'bg-[#1e1e1e] shadow-lg shadow-black/20' : 'bg-white shadow-sm border border-gray-100'}`}>
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center space-x-2">
                                <Ticket size={20} className={isDark ? 'text-rose-400' : 'text-rose-500'} />
                                <h3 className={`text-lg font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>My Tickets</h3>
                            </div>
                        </div>

                        <div className={`p-4 rounded-lg flex flex-col items-center text-center ${isDark ? 'bg-[#252525]/50' : 'bg-gray-50'}`}>
                            <AlertCircle size={32} className={`mb-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                            <h4 className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Coming Soon</h4>
                            <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                Enhanced ticket management and personal assignments will be available here soon.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardHome;
