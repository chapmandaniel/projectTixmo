import React, { useEffect, useRef, useState } from 'react';
import {
    Home, Calendar, BarChart3, Bell,
    Users, CheckSquare, Sun, Moon,
    MessageCircle, Wand2, Settings, LogOut, CheckCircle, User, BrainCircuit, Image
} from 'lucide-react';

import api from '../lib/api';
import { Link } from 'react-router-dom';
import { DashboardIconButton } from '../components/dashboard/DashboardPrimitives';
import { cn } from '../lib/utils';

const navItems = [
    { id: 'dashboard', icon: Home, label: 'HOME' },
    { id: 'events', icon: Calendar, label: 'EVENTS' },
    { id: 'todo', icon: CheckSquare, label: 'TASKS' },
    { id: 'team', icon: Users, label: 'TEAM' },
    { id: 'social', icon: MessageCircle, label: 'SOCIAL' },
    { id: 'creative', icon: Wand2, label: 'ProMo' },
    { id: 'assets', icon: Image, label: 'ASSETS' },
    { id: 'approvals', icon: CheckCircle, label: 'Review Portal' },
    { id: 'quantmo', icon: BrainCircuit, label: 'QuantMo' },
    { id: 'analytics', icon: BarChart3, label: 'ANALYTICS' },
    { id: 'settings', icon: Settings, label: 'SETTINGS' },
];

const DASHBOARD_POLL_INTERVAL_MS = 2 * 60 * 1000;

const TopbarItem = ({ item, activeView, isDark, pendingApprovalsCount }) => {
    const active = activeView === item.id;
    const badge = item.id === 'approvals' && pendingApprovalsCount > 0 ? pendingApprovalsCount : null;

    return (
        <Link
            to={`/${item.id}`}
            className={cn(
                'group relative flex h-10 w-10 items-center justify-center rounded-[10px] transition-all duration-200',
                active
                    ? (isDark ? 'bg-[#2a2b40] text-white shadow-[0_0_15px_rgba(255,255,255,0.05)]' : 'bg-slate-900 text-white shadow-sm')
                    : (isDark ? 'text-[#8e8fa6] hover:bg-[#232336] hover:text-zinc-100' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900')
            )}
        >
            <div className="relative flex items-center justify-center">
                <item.icon size={20} className={active ? 'drop-shadow-sm' : ''} />
                {badge && (
                    <span className={cn(
                        'absolute -right-3 -top-2 flex h-4 w-4 items-center justify-center rounded-full border-2 text-[9px] font-medium text-white shadow-sm',
                        isDark ? 'bg-[#ff3366] border-[#1f1e30]' : 'bg-rose-500 border-white'
                    )}>
                        {badge > 9 ? '9+' : badge}
                    </span>
                )}
            </div>
        </Link>
    );
};

const DashboardLayout = ({ children, activeView, onNavigate, isDark, toggleTheme, user, onLogout }) => {
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
    const isFetchingDashboardDataRef = useRef(false);
    // Fetch notifications and stats
    const fetchDashboardData = async ({ force = false } = {}) => {
        if (!force && typeof document !== 'undefined' && document.visibilityState !== 'visible') {
            return;
        }

        if (isFetchingDashboardDataRef.current) {
            return;
        }

        isFetchingDashboardDataRef.current = true;
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
        } finally {
            isFetchingDashboardDataRef.current = false;
        }
    };

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchDashboardData({ force: true });
            }
        };

        fetchDashboardData({ force: true });
        const interval = setInterval(() => {
            fetchDashboardData();
        }, DASHBOARD_POLL_INTERVAL_MS);

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [activeView]);

    const toggleNotifications = () => {
        if (!showNotifications) fetchDashboardData({ force: true });
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
        <div className={cn('min-h-screen flex flex-col transition-colors duration-300', isDark ? 'bg-[#151521] text-zinc-100 selection:bg-[#ff3366]/30' : 'bg-[#f5f6fa] text-slate-900 selection:bg-slate-200')}>
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.4); border-radius: 20px; }
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
            <header className={`sticky top-0 z-50 flex h-[72px] items-center justify-between px-5 sm:px-6 lg:px-7 transition-colors ${isDark ? 'bg-[#1f1e30]' : 'border-b border-gray-200 bg-white/95 backdrop-blur-xl'}`}>
                <Link to="/dashboard" className="mr-5 flex shrink-0 cursor-pointer items-center space-x-3 lg:mr-9">
                    <img src="https://tixmo.co/images/tixmo_logo.png" alt="TixMo Logo" className="h-8 w-auto object-contain" />
                </Link>

                <div className="relative flex h-full flex-1 items-center overflow-hidden">
                    <nav
                        ref={scrollContainerRef}
                        className="hide-scrollbar flex w-full items-center gap-2 overflow-x-auto px-2 py-2.5 scroll-smooth"
                    >
                        {navItems.map(item => (
                            <TopbarItem
                                key={item.id}
                                item={item}
                                activeView={activeView}
                                isDark={isDark}
                                pendingApprovalsCount={pendingApprovalsCount}
                            />
                        ))}
                    </nav>
                </div>

                <div className={cn('ml-5 flex shrink-0 items-center gap-2 border-l pl-5 sm:gap-3', isDark ? 'border-[#2b2b40]/60' : 'border-slate-200/80')}>
                    <DashboardIconButton isDark={isDark} onClick={toggleTheme} aria-label="Toggle theme" className="h-9 w-9 rounded-md">
                        {isDark ? <Sun size={18} /> : <Moon size={18} />}
                    </DashboardIconButton>

                    <div className="relative">
                        <DashboardIconButton isDark={isDark} onClick={toggleNotifications} aria-label="Notifications" className="relative h-9 w-9 rounded-md">
                            <Bell size={18} />
                            {unreadCount > 0 ? (
                                <span className={cn(
                                    'absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2',
                                    isDark ? 'bg-[#ff3366] border-[#1f1e30]' : 'bg-rose-500 border-white'
                                )} />
                            ) : null}
                        </DashboardIconButton>

                        {showNotifications && (
                            <div className={cn(
                                'absolute right-0 mt-3 w-80 rounded-md shadow-2xl border overflow-hidden z-[100]',
                                isDark ? 'bg-[#1f1f31] border-[#31324a]' : 'bg-white border-gray-100'
                            )}>
                                <div className={cn('px-4 py-3 border-b flex justify-between items-center', isDark ? 'border-[#2b2b40]/60' : 'border-gray-100')}>
                                    <h3 className={cn('font-light', isDark ? 'text-zinc-100' : 'text-slate-900')}>Notifications</h3>
                                    <button onClick={() => setShowNotifications(false)} className={isDark ? 'text-[#8e8fa6]' : 'text-slate-500'}>
                                        <span className="text-xs font-light tracking-wider">CLOSE</span>
                                    </button>
                                </div>
                                <div className="max-h-80 overflow-y-auto custom-scrollbar">
                                    {notifications.length === 0 ? (
                                        <div className={cn('p-8 text-center text-sm flex flex-col items-center font-light', isDark ? 'text-[#a1a5b7]' : 'text-slate-600')}>
                                            <Bell size={32} className="opacity-20 mb-2" />
                                            No notifications
                                        </div>
                                    ) : (
                                        notifications.map(n => (
                                            <div
                                                key={n.id}
                                                onClick={() => !n.readAt && handleMarkRead(n.id)}
                                                className={cn(
                                                    'p-4 border-b last:border-0 cursor-pointer transition-colors',
                                                    !n.readAt ? (isDark ? 'bg-[#232336]' : 'bg-indigo-50') : 'bg-transparent',
                                                    isDark ? 'border-[#31324a] hover:bg-[#2a2b40]' : 'border-gray-100 hover:bg-gray-50'
                                                )}
                                            >
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className={`text-sm font-light ${isDark ? 'text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-orange-400' : 'text-indigo-600'}`}>{n.subject}</span>
                                                    {!n.readAt && <span className="w-2 h-2 rounded-full bg-fuchsia-500 mt-1 shadow-sm shadow-fuchsia-500/50"></span>}
                                                </div>
                                                <p className={cn('text-xs mb-2 leading-relaxed font-light', isDark ? 'text-[#a1a5b7]' : 'text-slate-600')}>{n.message}</p>
                                                <span className={cn('text-[10px] uppercase tracking-wider font-light', isDark ? 'text-[#5e6278]' : 'text-slate-400')}>
                                                    {new Date(n.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div className={cn('p-3 text-center border-t', isDark ? 'border-[#2b2b40]/60 bg-[#151521]' : 'border-gray-100 bg-gray-50')}>
                                    <button className={cn('text-sm font-light tracking-wide', isDark ? 'text-[#8e8fa6]' : 'text-slate-600')}>
                                        VIEW ALL
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {(user?.role === 'OWNER' || user?.role === 'ADMIN') && (
                        <Link
                            to="/dev"
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-light transition-colors ${isDark ? 'text-indigo-400 hover:bg-[#232336] hover:text-indigo-300' : 'text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50'}`}
                            title="Developer Terminal"
                        >
                            &gt;_
                        </Link>
                    )}

                    <div className="flex items-center gap-2">
                        <div className={cn(
                            'flex h-10 items-center justify-center space-x-1.5 overflow-hidden rounded-md border px-3',
                            isDark ? 'bg-[#232336] border-[#3a3a5a] text-white' : 'bg-white border-gray-200 text-indigo-700 shadow-sm'
                        )}>
                            <User size={14} className="opacity-70" />
                            <span className="text-[11px] font-medium tracking-widest uppercase pt-px">
                                {user?.firstName?.[0]}{user?.lastName?.[0]}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={onLogout}
                            className={`hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors ${isDark ? 'text-[#8e8fa6] hover:bg-[#232336] hover:text-[#ff3366]' : 'text-gray-400 hover:text-rose-600 hover:bg-gray-100'}`}
                            aria-label="Sign out"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </header>
            <main className="custom-scrollbar flex-1 overflow-y-auto px-6 pb-8 pt-10 sm:px-8">
                <div className="mx-auto h-full w-full max-w-[1680px]">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default DashboardLayout;
