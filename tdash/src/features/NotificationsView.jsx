import React, { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import {
    DashboardButton,
    DashboardEmptyState,
    DashboardPage,
    DashboardPageHeader,
    DashboardSurface,
} from '../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../lib/dashboardTheme';
import { cn } from '../lib/utils';
import api from '../lib/api';

const extractNotifications = (payload) => {
    const root = payload?.data ?? payload ?? {};
    const nested = root.data && typeof root.data === 'object' ? root.data : root;
    const list = Array.isArray(nested.notifications)
        ? nested.notifications
        : Array.isArray(root.notifications)
            ? root.notifications
            : [];
    const pagination = nested.pagination || root.pagination || {};
    return { list, pagination };
};

const formatWhen = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('en-CA', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

export default function NotificationsView({ isDark }) {
    const theme = getDashboardTheme(isDark);
    const [notifications, setNotifications] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [markingAll, setMarkingAll] = useState(false);

    const load = useCallback(async (page = 1, append = false) => {
        setError(null);
        if (!append) setLoading(true);
        try {
            const response = await api.get('/notifications', { params: { page, limit: 50 } });
            const { list, pagination: nextPagination } = extractNotifications(response);
            setNotifications((prev) => (append ? [...prev, ...list] : list));
            setPagination({
                page: nextPagination.page || page,
                pages: nextPagination.pages || 1,
                total: nextPagination.total || list.length,
            });
        } catch (err) {
            setError('Could not load notifications.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load(1);
    }, [load]);

    const handleMarkRead = async (item) => {
        if (!item?.id || item.readAt) return;
        try {
            await api.put(`/notifications/${item.id}/read`);
            setNotifications((prev) => prev.map((row) => (
                row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row
            )));
        } catch (err) {
            setError('Could not mark that notification as read.');
        }
    };

    const handleMarkAllRead = async () => {
        setMarkingAll(true);
        setError(null);
        try {
            await api.put('/notifications/read-all');
            setNotifications((prev) => prev.map((row) => (
                row.readAt ? row : { ...row, readAt: new Date().toISOString() }
            )));
        } catch (err) {
            setError('Could not mark all notifications as read.');
        } finally {
            setMarkingAll(false);
        }
    };

    const unread = notifications.filter((item) => item && !item.readAt).length;
    const hasMore = pagination.page < pagination.pages;

    return (
        <DashboardPage className="space-y-4">
            <DashboardPageHeader
                isDark={isDark}
                title="Notifications"
                description={pagination.total
                    ? `${pagination.total} in your inbox${unread ? ` · ${unread} unread on this page` : ''}`
                    : 'Activity from your organization.'}
                icon={Bell}
                iconClassName={isDark ? 'text-fuchsia-300' : 'text-fuchsia-700'}
                actions={notifications.some((item) => item && !item.readAt) ? (
                    <DashboardButton
                        isDark={isDark}
                        type="button"
                        onClick={handleMarkAllRead}
                        disabled={markingAll}
                    >
                        <CheckCheck size={16} />
                        <span>{markingAll ? 'Marking…' : 'Mark all as read'}</span>
                    </DashboardButton>
                ) : null}
            />

            {error ? (
                <p className={cn('text-sm font-light', isDark ? 'text-rose-300' : 'text-rose-600')}>{error}</p>
            ) : null}

            {loading && notifications.length === 0 ? (
                <DashboardSurface isDark={isDark} className="p-8 text-sm font-light">
                    <p className={theme.textSecondary}>Loading notifications…</p>
                </DashboardSurface>
            ) : notifications.length === 0 ? (
                <DashboardEmptyState
                    isDark={isDark}
                    title="No notifications yet"
                    description="When there is activity on your events, it will show up here."
                />
            ) : (
                <DashboardSurface isDark={isDark} className="overflow-hidden p-0">
                    <ul>
                        {notifications.map((item) => {
                            const unreadItem = item && !item.readAt;
                            return (
                                <li key={item.id}>
                                    <button
                                        type="button"
                                        onClick={() => handleMarkRead(item)}
                                        className={cn(
                                            'flex w-full flex-col gap-1 border-b px-5 py-4 text-left transition-colors last:border-0',
                                            isDark ? 'border-dashboard-border/60 hover:bg-dashboard-panelAlt' : 'border-slate-100 hover:bg-slate-50',
                                            unreadItem ? (isDark ? 'bg-dashboard-panelAlt' : 'bg-indigo-50/70') : 'bg-transparent'
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <span className={cn(
                                                'text-sm font-light',
                                                isDark ? 'text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-orange-400' : 'text-indigo-600'
                                            )}>
                                                {item.subject}
                                            </span>
                                            {unreadItem ? (
                                                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-fuchsia-500" aria-label="Unread" />
                                            ) : null}
                                        </div>
                                        <p className={cn('text-sm font-light leading-relaxed', theme.textSecondary)}>{item.message}</p>
                                        <span className={cn('text-[11px] uppercase tracking-wider font-light', theme.textMuted)}>
                                            {formatWhen(item.createdAt)}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </DashboardSurface>
            )}

            {hasMore ? (
                <div className="flex justify-center">
                    <DashboardButton
                        isDark={isDark}
                        type="button"
                        variant="secondary"
                        onClick={() => load(pagination.page + 1, true)}
                    >
                        Load more
                    </DashboardButton>
                </div>
            ) : null}
        </DashboardPage>
    );
}
