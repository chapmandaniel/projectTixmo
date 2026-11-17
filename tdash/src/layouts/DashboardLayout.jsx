import React, { useEffect, useRef, useState } from 'react';
import {
    Home, Calendar, BarChart3, Bell,
    Users, CheckSquare, Sun, Moon,
    LogOut, CheckCircle, User, Image,
    Menu, X, Share2, ShieldCheck
} from 'lucide-react';
import { isSocialDashboardNavVisible } from '../features/socialDashboard/flag';

import api from '../lib/api';
import { Link } from 'react-router-dom';
import { DashboardIconButton } from '../components/dashboard/DashboardPrimitives';
import { cn } from '../lib/utils';
import { accentClasses, getSectionAccent, sectionAccentStyle } from '../lib/sectionAccents';

const navItems = [
    { id: 'dashboard', icon: Home, label: 'Home' },
    { id: 'events', icon: Calendar, label: 'Events' },
    { id: 'todo', icon: CheckSquare, label: 'Tasks' },
    { id: 'team', icon: Users, label: 'Team' },
    { id: 'assets', icon: Image, label: 'Assets' },
    { id: 'approvals', icon: CheckCircle, label: 'Reviews' },
    { id: 'analytics', icon: BarChart3, label: 'Analytics' },
    { id: 'security', icon: ShieldCheck, label: 'Security' },
];

const DASHBOARD_POLL_INTERVAL_MS = 2 * 60 * 1000;

const MobileNavLink = ({ item, activeView, isDark, pendingApprovalsCount, onNavigate }) => {
    const active = activeView === item.id;
    const badge = item.id === 'approvals' && pendingApprovalsCount > 0 ? pendingApprovalsCount : null;

    return (
        <Link
            to={`/${item.id}`}
            onClick={onNavigate}
            data-section={item.id}
            style={sectionAccentStyle(item.id)}
            className={cn(
                'relative flex min-h-11 shrink-0 items-center gap-3 rounded-[10px] px-3.5 text-sm font-light',
                active
                    ? cn(accentClasses.tint, isDark ? 'text-white' : 'text-slate-900')
                    : (isDark ? 'text-[#8e8fa6] hover:bg-[#232336] hover:text-zinc-100' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900')
            )}
            aria-current={active ? 'page' : undefined}
        >
            {active ? <span aria-hidden="true" data-testid="nav-active-indicator" className={cn('absolute inset-y-2 left-0 w-[3px] rounded-full', accentClasses.bar)} /> : null}
            <item.icon size={18} className={cn('shrink-0', accentClasses.text, active ? '' : 'opacity-80')} />
            <span className="leading-none">{item.label}</span>
            <span aria-hidden="true" data-testid="nav-accent-dot" className={cn('ml-auto h-1.5 w-1.5 shrink-0 rounded-full', accentClasses.bar)} />
            {badge ? (
                <span className={cn(
                    'flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-medium text-white',
                    isDark ? 'bg-[#ff3366]' : 'bg-rose-500'
                )}>
                    {badge > 9 ? '9+' : badge}
                </span>
            ) : null}
        </Link>
    );
};

const TopbarItem = ({ item, activeView, isDark, pendingApprovalsCount }) => {
    const active = activeView === item.id;
    const badge = item.id === 'approvals' && pendingApprovalsCount > 0 ? pendingApprovalsCount : null;

    return (
        <Link
            to={`/${item.id}`}
            data-section={item.id}
            style={sectionAccentStyle(item.id)}
            className={cn(
                'group relative flex h-10 shrink-0 items-center justify-center gap-2 rounded-[10px] px-2.5 text-sm font-light transition-all duration-200',
                active
                    ? cn(accentClasses.tint, isDark ? 'text-white' : 'text-slate-900')
                    : (isDark ? 'text-[#8e8fa6] hover:bg-[#232336] hover:text-zinc-100' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900')
            )}
            aria-current={active ? 'page' : undefined}
        >
            {/* T135: every tab carries its section accent (dot below 1400px, tinted icon from 1400px) so colors are learnable. */}
            <span aria-hidden="true" data-testid="nav-accent-dot" className={cn('h-1.5 w-1.5 shrink-0 rounded-full min-[1400px]:hidden', accentClasses.bar, active ? '' : 'opacity-80')} />
            {/* Demo build: icons only from 1400px so every tab fits on a 1280-1440px presentation screen. */}
            <div className="relative hidden items-center justify-center min-[1400px]:flex">
                <item.icon size={18} className={cn('shrink-0', accentClasses.text, active ? 'drop-shadow-sm' : 'opacity-80')} />
            </div>
            <span className="whitespace-nowrap leading-none">{item.label}</span>
            {active ? <span aria-hidden="true" data-testid="nav-active-indicator" className={cn('absolute inset-x-2.5 -bottom-[5px] h-[2px] rounded-full', accentClasses.bar)} /> : null}
            {badge ? (
                <span className={cn(
                    'flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-medium text-white',
                    isDark ? 'bg-[#ff3366]' : 'bg-rose-500'
                )}>
                    {badge > 9 ? '9+' : badge}
                </span>
            ) : null}
        </Link>
    );
};

const DashboardLayout = ({ children, activeView, onNavigate, isDark, toggleTheme, user, onLogout }) => {
    const [showNotifications, setShowNotifications] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [mobileNavMaxHeight, setMobileNavMaxHeight] = useState(null);
    const headerRef = useRef(null);
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
        setMobileNavOpen(false);
    };

    const closeMobileNav = () => setMobileNavOpen(false);

    const visibleNavItems = [
        ...navItems.filter((item) => !item.roles || item.roles.includes(user?.role)),
        ...(isSocialDashboardNavVisible() ? [{ id: 'social', icon: Share2, label: 'Social' }] : []),
    ];

    useEffect(() => {
        setMobileNavOpen(false);
    }, [activeView]);

    useEffect(() => {
        if (!mobileNavOpen) {
            return undefined;
        }

        const updateMaxHeight = () => {
            const bottom = headerRef.current?.getBoundingClientRect().bottom ?? 0;
            setMobileNavMaxHeight(Math.max(window.innerHeight - bottom, 0));
        };
        updateMaxHeight();

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                setMobileNavOpen(false);
            }
        };

        document.addEventListener('keydown', onKeyDown);
        window.addEventListener('resize', updateMaxHeight);

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const desktopQuery = typeof window.matchMedia === 'function'
            ? window.matchMedia('(min-width: 768px)')
            : null;
        const closeOnDesktop = () => {
            if (desktopQuery?.matches) {
                setMobileNavOpen(false);
            }
        };
        closeOnDesktop();
        desktopQuery?.addEventListener('change', closeOnDesktop);

        return () => {
            document.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('resize', updateMaxHeight);
            document.body.style.overflow = previousOverflow;
            desktopQuery?.removeEventListener('change', closeOnDesktop);
        };
    }, [mobileNavOpen]);

    const handleMarkRead = async (id) => {
        try {
            await api.put(`/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Failed to mark read', error);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await api.put('/notifications/read-all');
            const readAt = new Date().toISOString();
            setNotifications(prev => prev.map(n => (n.readAt ? n : { ...n, readAt })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Failed to mark all read', error);
        }
    };

    // Horizontal Scrolling
    const scrollContainerRef = React.useRef(null);
    const sectionAccent = getSectionAccent(activeView);

    return (
        <div
            data-section={sectionAccent.section}
            style={sectionAccentStyle(sectionAccent.section)}
            className={cn('min-h-screen flex flex-col transition-colors duration-300', isDark ? 'bg-[#151521] text-zinc-100 selection:bg-[rgb(var(--section-accent-rgb)/0.3)]' : 'bg-[#f5f6fa] text-slate-900 selection:bg-slate-200')}
        >
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.4); border-radius: 20px; }
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
            {mobileNavOpen ? (
                <button
                    type="button"
                    aria-label="Dismiss navigation"
                    className="fixed inset-0 z-40 bg-black/40 md:hidden"
                    onClick={closeMobileNav}
                />
            ) : null}
            <header ref={headerRef} className={`sticky top-0 z-50 flex h-[72px] items-center justify-between px-5 sm:px-6 lg:px-7 transition-colors ${isDark ? 'bg-[#1f1e30]' : 'border-b border-gray-200 bg-white/95 backdrop-blur-xl'}`}>
                <Link to="/dashboard" className="mr-5 flex shrink-0 cursor-pointer items-center space-x-3 lg:mr-9">
                    <img src="https://tixmo.co/images/tixmo_logo.png" alt="Tixmo Logo" className="h-8 w-auto object-contain" />
                </Link>

                <div className="relative hidden h-full min-w-0 flex-1 items-center overflow-hidden md:flex">
                    <nav
                        ref={scrollContainerRef}
                        aria-label="Primary"
                        className="hide-scrollbar flex w-full items-center gap-1 overflow-x-auto px-2 py-2.5 scroll-smooth"
                    >
                        {visibleNavItems.map(item => (
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

                <div className="ml-auto flex shrink-0 items-center md:ml-0">
                <div className="md:hidden">
                    <DashboardIconButton
                        isDark={isDark}
                        onClick={() => {
                            setShowNotifications(false);
                            setMobileNavOpen((open) => !open);
                        }}
                        aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
                        aria-expanded={mobileNavOpen}
                        aria-controls="dashboard-mobile-nav"
                        className="h-9 w-9 rounded-md"
                    >
                        {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
                    </DashboardIconButton>
                </div>

                <div className={cn('ml-1 flex shrink-0 items-center gap-1 border-l pl-1 sm:ml-5 sm:gap-3 sm:pl-5', isDark ? 'border-[#2b2b40]/60' : 'border-slate-200/80')}>
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
                                                    <span className={`text-sm font-light ${isDark ? accentClasses.text : 'text-indigo-600'}`}>{n.subject}</span>
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
                                    <div className="flex items-center justify-center gap-4">
                                        <button
                                            type="button"
                                            onClick={handleMarkAllRead}
                                            className={cn('text-sm font-light tracking-wide', isDark ? 'text-[#8e8fa6] hover:text-zinc-100' : 'text-slate-600 hover:text-slate-900')}
                                        >
                                            MARK ALL READ
                                        </button>
                                        <Link
                                            to="/notifications"
                                            onClick={() => setShowNotifications(false)}
                                            className={cn('text-sm font-light tracking-wide', isDark ? 'text-[#8e8fa6] hover:text-zinc-100' : 'text-slate-600 hover:text-slate-900')}
                                        >
                                            VIEW ALL
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Demo build: developer terminal shortcut hidden from the header (route /dev still exists). */}

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
                </div>
                {mobileNavOpen ? (
                    <nav
                        id="dashboard-mobile-nav"
                        aria-label="Dashboard"
                        style={mobileNavMaxHeight == null ? undefined : { maxHeight: `${mobileNavMaxHeight}px` }}
                        className={cn(
                            'absolute inset-x-0 top-full z-50 overflow-y-auto overscroll-contain border-b px-3 py-3 md:hidden',
                            isDark ? 'border-[#2b2b40]/60 bg-[#1f1e30]' : 'border-gray-200 bg-white'
                        )}
                    >
                        <div className="flex flex-col gap-1">
                            {visibleNavItems.map((item) => (
                                <MobileNavLink
                                    key={item.id}
                                    item={item}
                                    activeView={activeView}
                                    isDark={isDark}
                                    pendingApprovalsCount={pendingApprovalsCount}
                                    onNavigate={closeMobileNav}
                                />
                            ))}
                        </div>
                    </nav>
                ) : null}
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
