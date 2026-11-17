import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CalendarDays, CheckSquare, Radio, Ticket, TrendingUp } from 'lucide-react';
import api from '../../lib/api';
import { DashboardSection, DashboardSurface } from '../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../lib/dashboardTheme';
import { cn } from '../../lib/utils';

const DAY = 86400000;
const money = (v) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(v || 0);
const count = (v) => new Intl.NumberFormat('en-CA').format(v || 0);
const body = (res) => res?.data?.data ?? res?.data ?? null;

export const ago = (iso, now = Date.now()) => {
    const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} hr ago`;
    const d = Math.round(h / 24);
    return `${d} day${d === 1 ? '' : 's'} ago`;
};

// Pure summary so the numbers are testable without the network.
const asList = (value) => (Array.isArray(value) ? value : []);

const localDateKey = (ms) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const summarizePulse = ({ today, month, trend, events: rawEvents, tasks: rawTasks, now = Date.now() }) => {
    const events = asList(rawEvents);
    const tasks = asList(rawTasks);
    const live = events.filter((e) => new Date(e.startDatetime).getTime() <= now && new Date(e.endDatetime).getTime() >= now && e.status !== 'CANCELLED');
    const onSale = events.filter((e) => ['ON_SALE', 'SOLD_OUT'].includes(e.status) && new Date(e.endDatetime).getTime() >= now);
    const next = onSale.filter((e) => new Date(e.startDatetime).getTime() > now).sort((a, b) => new Date(a.startDatetime) - new Date(b.startDatetime))[0];
    const open = tasks.filter((t) => t.status !== 'DONE');
    const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);
    const dueSoon = open.filter((t) => t.dueDate && new Date(t.dueDate).getTime() <= endOfToday.getTime()).length;
    const days = [];
    const byDate = new Map(asList(trend?.salesByDay).map((d) => [d.date, d]));
    // Bars are the viewer's local days. The API buckets by UTC date, which overlaps
    // each local day for most of its hours; the last bar uses the local-midnight
    // totals so "Today" always matches the "Tickets sold today" tile.
    for (let i = 13; i >= 1; i -= 1) {
        const key = localDateKey(now - i * DAY);
        days.push({ date: key, tickets: byDate.get(key)?.tickets || 0, revenue: byDate.get(key)?.revenue || 0 });
    }
    days.push({ date: localDateKey(now), tickets: today?.totalTicketsSold || 0, revenue: today?.totalRevenue || 0 });
    return {
        ticketsToday: today?.totalTicketsSold || 0,
        ordersToday: today?.totalOrders || 0,
        revenueToday: today?.totalRevenue || 0,
        revenue30: month?.sales?.totalRevenue || 0,
        tickets30: month?.sales?.totalTicketsSold || 0,
        live,
        onSale: onSale.length,
        next,
        openTasks: open.length,
        dueSoon,
        days,
    };
};

const Tile = ({ isDark, to, icon: Icon, label, value, detail, accent = 'brand', iconClassName }) => {
    const theme = getDashboardTheme(isDark);
    return (
        <Link to={to} className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500">
            <DashboardSurface isDark={isDark} accent={accent} className="h-full p-4 transition-transform hover:-translate-y-0.5 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                    <p className={cn('text-xs font-light sm:text-sm', theme.textSecondary)}>{label}</p>
                    <Icon size={16} className={iconClassName} />
                </div>
                <p className={cn('mt-2 text-3xl font-light tracking-tight', theme.textPrimary)}>{value}</p>
                <p className={cn('mt-1 truncate text-xs font-light', theme.textMuted)}>{detail}</p>
            </DashboardSurface>
        </Link>
    );
};

const HomePulse = ({ isDark, pendingApprovals = 0, now: fixedNow }) => {
    const theme = getDashboardTheme(isDark);
    const [state, setState] = useState(null);
    const [feed, setFeed] = useState([]);

    useEffect(() => {
        let cancelled = false;
        const now = fixedNow ?? Date.now();
        const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);
        const iso = (ms) => new Date(ms).toISOString();
        const safe = (p) => p.catch(() => null);
        Promise.all([
            safe(api.get('/analytics/sales', { params: { startDate: iso(midnight.getTime()), endDate: iso(now) } })),
            safe(api.get('/analytics/dashboard')),
            safe(api.get('/analytics/sales', { params: { startDate: iso(now - 14 * DAY), endDate: iso(now) } })),
            safe(api.get('/events', { params: { page: 1, limit: 100 } })),
            safe(api.get('/tasks')),
            safe(api.get('/notifications', { params: { page: 1, limit: 6 } })),
        ]).then(([todayRes, monthRes, trendRes, eventsRes, tasksRes, notesRes]) => {
            if (cancelled) return;
            const eventsBody = body(eventsRes);
            const tasksBody = tasksRes?.data;
            const notesBody = body(notesRes);
            setState(summarizePulse({
                today: body(todayRes),
                month: body(monthRes),
                trend: body(trendRes),
                events: eventsBody?.events,
                tasks: Array.isArray(tasksBody) ? tasksBody : tasksBody?.data,
                now,
            }));
            setFeed(asList(notesBody?.notifications));
        }).catch(() => {});
        return () => { cancelled = true; };
    }, [fixedNow]);

    if (!state) return null;
    const now = fixedNow ?? Date.now();
    const maxTickets = Math.max(1, ...state.days.map((d) => d.tickets));
    const liveName = state.live[0]?.name;

    return (
        <div className="space-y-5" data-testid="home-pulse">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                <Tile isDark={isDark} to="/orders" icon={Ticket} iconClassName="text-pink-400" label="Tickets sold today" value={count(state.ticketsToday)}
                    detail={`${count(state.ordersToday)} orders · ${money(state.revenueToday)}`} />
                <Tile isDark={isDark} to="/analytics" icon={TrendingUp} accent="green" iconClassName="text-emerald-400" label="Revenue, last 30 days" value={money(state.revenue30)}
                    detail={`${count(state.tickets30)} tickets`} />
                <Tile isDark={isDark} to="/events" icon={liveName ? Radio : CalendarDays} accent="violet" iconClassName={liveName ? 'text-rose-400 animate-pulse' : 'text-violet-300'} label="On sale now" value={count(state.onSale)}
                    detail={liveName ? `Live now: ${liveName}` : (state.next ? `Next: ${state.next.name}` : 'No upcoming events')} />
                <Tile isDark={isDark} to="/todo" icon={CheckSquare} accent="blue" iconClassName="text-indigo-300" label="Open tasks" value={count(state.openTasks)}
                    detail={state.dueSoon ? `${state.dueSoon} due today or overdue` : 'Nothing due today'} />
                <Tile isDark={isDark} to="/approvals" icon={Bell} accent="amber" iconClassName="text-amber-300" label="Waiting on review" value={count(pendingApprovals)}
                    detail={pendingApprovals ? 'Creative out with reviewers' : 'All reviews answered'} />
            </div>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <DashboardSection isDark={isDark} title="Ticket sales, last 14 days" description="Paid tickets per day across every event.">
                    <div className="flex h-36 items-end gap-1.5" data-testid="home-sales-chart">
                        {state.days.map((d, i) => (
                            <div key={d.date} className="flex h-full flex-1 flex-col justify-end" title={`${d.date}: ${d.tickets} tickets`}>
                                <span
                                    className={cn('w-full rounded-sm', i === state.days.length - 1 ? 'bg-pink-400' : (isDark ? 'bg-pink-400/35' : 'bg-pink-500/35'))}
                                    style={{ height: `${Math.max(4, Math.round((d.tickets / maxTickets) * 100))}%` }}
                                />
                            </div>
                        ))}
                    </div>
                    <div className={cn('mt-2 flex justify-between text-[11px] font-light', theme.textMuted)}>
                        <span>2 weeks ago</span><span>Today</span>
                    </div>
                </DashboardSection>
                <DashboardSection isDark={isDark} title="Latest activity" description="What the team and your buyers did most recently.">
                    {feed.length ? (
                        <ul className={cn('divide-y', isDark ? 'divide-white/5' : 'divide-slate-100')} data-testid="home-activity">
                            {feed.slice(0, 5).map((n) => (
                                <li key={n.id} className="flex items-start justify-between gap-3 py-2.5">
                                    <div className="min-w-0">
                                        <p className={cn('truncate text-sm font-light', theme.textPrimary)}>{n.subject}</p>
                                        <p className={cn('truncate text-xs font-light', theme.textMuted)}>{n.message}</p>
                                    </div>
                                    <span className={cn('shrink-0 text-[11px] font-light', theme.textTertiary)}>{ago(n.createdAt || n.sentAt, now)}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className={cn('text-sm font-light', theme.textMuted)}>No recent activity yet.</p>
                    )}
                </DashboardSection>
            </div>
        </div>
    );
};

export default HomePulse;
