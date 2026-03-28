import React, { useState, useEffect } from 'react';
import {
    Home, Calendar, Ticket, BarChart3, Bell, Search,
    Users, CheckSquare, Sun, Moon,
    MessageCircle, Wand2, Settings, LogOut, CheckCircle, ChevronLeft, ChevronRight, User, Terminal, BrainCircuit
} from 'lucide-react';

import api from '../lib/api';
import { Link } from 'react-router-dom';

const navItems = [
    { id: 'dashboard', icon: Home, label: 'HOME' },
    { id: 'events', icon: Calendar, label: 'EVENTS' },
    { id: 'todo', icon: CheckSquare, label: 'TASKS' },
    { id: 'team', icon: Users, label: 'TEAM' },
    { id: 'social', icon: MessageCircle, label: 'SOCIAL' },
    { id: 'creative', icon: Wand2, label: 'ProMo' },
    { id: 'approvals', icon: CheckCircle, label: 'Review Portal' },
    { id: 'quantmo', icon: BrainCircuit, label: 'QuantMo' },
    { id: 'analytics', icon: BarChart3, label: 'ANALYTICS' },
    { id: 'settings', icon: Settings, label: 'SETTINGS' },
];

const TopbarItem = ({ item, activeView, onNavigate, isDark, pendingApprovalsCount }) => {
    const active = activeView === item.id;
    const badge = item.id === 'approvals' && pendingApprovalsCount > 0 ? pendingApprovalsCount : null;

    return (
        <Link
            to={`/${item.id}`}
            className={`flex items-center justify-center px-4 py-2 h-10 rounded-md transition-all min-w-[64px] group relative ${active
                ? (isDark ? 'bg-[#2a2b40] text-white shadow-[0_0_15px_rgba(255,255,255,0.05)]' : 'bg-indigo-50 text-indigo-600 shadow-sm')
                : (isDark ? 'text-[#8e8fa6] hover:bg-[#232336] hover:text-gray-200' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900')
                }`}
        >
            <div className="relative flex items-center justify-center transition-all duration-200 group-hover:opacity-0 group-hover:scale-75">
                <item.icon size={20} className={active ? 'drop-shadow-sm' : ''} />
                {badge && (
                    <span className="absolute -top-2 -right-3 w-4 h-4 flex items-center justify-center text-[9px] font-medium text-white bg-[#ff3366] rounded-full border-2 border-[#1e1e2d] dark:border-[#1e1e2d] shadow-sm">
                        {badge > 9 ? '9+' : badge}
                    </span>
                )}
            </div>
            <span className={`absolute flex items-center justify-center text-[12px] font-light tracking-wide w-full text-center px-2 whitespace-nowrap transition-all duration-200 opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100`}>
                {item.label}
            </span>
        </Link>
    );
};

const DashboardLayout = ({ children, activeView, onNavigate, isDark, toggleTheme, user, onLogout }) => {
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

    // Fetch notifications and stats
    const fetchDashboardData = async () => {
        try {
            const notifRes = await api.get('/notifications?limit=10').catch(() => null);
            if (notifRes) {
                const data = notifRes.data || {};
                let notifs = [];
                if (Array.isArray(data.notifications)) {
                    notifs = data.notifications;
                } else if (data.data && Array.isArray(data.data.notifications)) {
                    notifs = data.data.notifications;
                }

                if (JSON.stringify(notifs) !== JSON.stringify(notifications)) {
                    setNotifications(notifs);
                    setUnreadCount(notifs.filter(n => n && !n.readAt).length);
                }
            }

            if (activeView !== 'approvals') {
                const approvalRes = await api.get('/approvals?status=PENDING_REVIEW').catch(() => null);
                if (approvalRes) {
                    const approvals = approvalRes.approvals || approvalRes.data?.approvals || [];
                    setPendingApprovalsCount(approvals.length);
                }
            }
        } catch (error) {
            console.error('Failed to fetch dashboard data', error);
        }
    };

    useEffect(() => {
        fetchDashboardData();
        const interval = setInterval(fetchDashboardData, 30000);
        return () => clearInterval(interval);
    }, [activeView]);

    const toggleNotifications = () => {
        if (!showNotifications) fetchDashboardData();
        setShowNotifications(!showNotifications);
    };

    const handleMarkRead = async (id) => {
        try {
            await api.put(`/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Failed to mark read', error);
        }
    };

    // Horizontal Scrolling
    const scrollContainerRef = React.useRef(null);

    return (
        <div
            className={`min-h-screen flex flex-col transition-colors duration-300 ${isDark ? 'bg-[#151521] text-[#e0e0e0] selection:bg-fuchsia-500/30' : 'bg-[#fafafa] text-gray-900 selection:bg-gray-200'}`}
            style={{ fontFamily: "'Exo', sans-serif" }}
        >
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Exo:ital,wght@0,100..900;1,100..900&display=swap');
                .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.4); border-radius: 20px; }
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>

            {/* Top Navigation Bar */}
            <header className={`h-16 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-50 transition-colors shadow-sm ${isDark ? 'bg-[#1e1e2d]/95 backdrop-blur-xl' : 'bg-white/95 backdrop-blur-xl'}`}>

                {/* Brand Logo */}
                <Link to="/dashboard" className="flex items-center space-x-3 mr-4 lg:mr-8 shrink-0 cursor-pointer">
                    <img src="https://tixmo.co/images/tixmo_logo.png" alt="TixMo Logo" className="h-8 w-auto object-contain" />
                </Link>

                {/* Central Icon Navigation Area */}
                <div className="flex-1 flex items-center relative overflow-hidden h-full">
                    <nav
                        ref={scrollContainerRef}
                        className="flex items-center gap-1 sm:gap-2 overflow-x-auto hide-scrollbar scroll-smooth w-full px-2 py-2"
                    >
                        {navItems.map(item => (
                            <TopbarItem
                                key={item.id}
                                item={item}
                                activeView={activeView}
                                onNavigate={onNavigate}
                                isDark={isDark}
                                pendingApprovalsCount={pendingApprovalsCount}
                            />
                        ))}
                    </nav>
                </div>

                {/* Right Area: Tools */}
                <div className="flex items-center space-x-2 sm:space-x-4 pl-4 shrink-0 border-l border-gray-200/60 dark:border-[#2b2b40]/60">

                    <button
                        onClick={toggleTheme}
                        className={`p-2 rounded-md transition-colors ${isDark ? 'text-[#8e8fa6] hover:text-amber-400 hover:bg-[#232336]' : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'}`}
                    >
                        {isDark ? <Sun size={20} /> : <Moon size={20} />}
                    </button>

                    <div className="relative">
                        <button
                            onClick={toggleNotifications}
                            className={`relative p-2 rounded-md transition-colors ${isDark ? 'text-[#8e8fa6] hover:text-white hover:bg-[#232336]' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
                        >
                            <Bell size={20} />
                            {unreadCount > 0 && <span className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#ff3366] rounded-full border-2 ${isDark ? 'border-[#1e1e2d]' : 'border-white'} shadow-sm`}></span>}
                        </button>

                        {/* Dropdown */}
                        {showNotifications && (
                            <div className={`absolute right-0 mt-3 w-80 rounded-md shadow-2xl border overflow-hidden z-[100] animate-in slide-in-from-top-2 origin-top-right ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40]/60' : 'bg-white border-gray-100'}`}>
                                <div className={`px-4 py-3 border-b flex justify-between items-center ${isDark ? 'border-[#2b2b40]/60' : 'border-gray-100'}`}>
                                    <h3 className={`font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Notifications</h3>
                                    <button onClick={() => setShowNotifications(false)} className={isDark ? 'text-[#8e8fa6] hover:text-white' : 'text-gray-400 hover:text-gray-600'}>
                                        <span className="text-xs font-light tracking-wider">CLOSE</span>
                                    </button>
                                </div>
                                <div className="max-h-80 overflow-y-auto custom-scrollbar">
                                    {notifications.length === 0 ? (
                                        <div className="p-8 text-center text-sm text-gray-500 flex flex-col items-center font-light">
                                            <Bell size={32} className="opacity-20 mb-2" />
                                            No notifications
                                        </div>
                                    ) : (
                                        notifications.map(n => (
                                            <div
                                                key={n.id}
                                                onClick={() => !n.readAt && handleMarkRead(n.id)}
                                                className={`p-4 border-b last:border-0 cursor-pointer transition-colors ${!n.readAt ? (isDark ? 'bg-[#232336]' : 'bg-indigo-50') : 'bg-transparent'} ${isDark ? 'border-[#2b2b40]/60 hover:bg-[#2a2b40]' : 'border-gray-100 hover:bg-gray-50'}`}
                                            >
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className={`text-sm font-light ${isDark ? 'text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-orange-400' : 'text-indigo-600'}`}>{n.subject}</span>
                                                    {!n.readAt && <span className="w-2 h-2 rounded-full bg-fuchsia-500 mt-1 shadow-sm shadow-fuchsia-500/50"></span>}
                                                </div>
                                                <p className={`text-xs mb-2 leading-relaxed font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-600'}`}>{n.message}</p>
                                                <span className={`text-[10px] uppercase tracking-wider font-light ${isDark ? 'text-[#5e6278]' : 'text-gray-400'}`}>
                                                    {new Date(n.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div className={`p-3 text-center border-t ${isDark ? 'bg-[#151521] border-[#2b2b40]/60' : 'bg-gray-50 border-gray-100'}`}>
                                    <button className={`text-sm font-light tracking-wide ${isDark ? 'text-[#8e8fa6] hover:text-white' : 'text-indigo-600 hover:text-indigo-700'}`}>
                                        VIEW ALL
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="h-6 w-px bg-gray-200 dark:bg-[#2b2b40] hidden sm:block mx-2"></div>

                    {/* Dev Mode (Admin/Owner Only) */}
                    {(user?.role === 'OWNER' || user?.role === 'ADMIN') && (
                        <Link
                            to="/dev"
                            className={`p-2 rounded-md transition-colors mr-1 sm:mr-3 ${isDark ? 'text-indigo-400 hover:text-indigo-300 hover:bg-[#232336]' : 'text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50'}`}
                            title="Developer Terminal"
                        >
                            <Terminal size={20} />
                        </Link>
                    )}

                    {/* Profile & Logout */}
                    <div className="flex items-center space-x-2">
                        <div className={`h-9 px-2 rounded-md overflow-hidden ${isDark ? 'bg-gradient-to-br from-[#2a2b40] to-[#1e1e2d] border-[#3a3a5a] text-white shadow-[0_0_10px_rgba(0,0,0,0.5)]' : 'bg-gradient-to-br from-indigo-100 to-purple-100 border-white text-indigo-700 shadow-sm'} border-2 flex items-center justify-center space-x-1.5 cursor-pointer hover:opacity-80 transition-opacity`}>
                            <User size={14} className="opacity-70" />
                            <span className="text-[11px] font-medium tracking-widest uppercase pt-px">
                                {user?.firstName?.[0]}{user?.lastName?.[0]}
                            </span>
                        </div>
                        <button
                            onClick={onLogout}
                            className={`hidden sm:flex p-2 rounded-md transition-colors ${isDark ? 'text-[#8e8fa6] hover:text-[#ff3366] hover:bg-[#232336]' : 'text-gray-400 hover:text-rose-600 hover:bg-gray-100'}`}
                            title="Sign Out"
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Expansive Main Content Area */}
            <main className="flex-1 w-full overflow-y-auto custom-scrollbar p-6 sm:p-8">
                <div className="h-full w-full max-w-[1600px] mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default DashboardLayout;
