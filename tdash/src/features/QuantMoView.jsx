import React, { useEffect, useMemo, useState } from 'react';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import {
    AlertCircle,
    ArrowRight,
    BarChart3,
    BrainCircuit,
    CalendarDays,
    Clock3,
    FileText,
    History,
    ListTodo,
    Loader2,
    Search,
    Send,
    Sparkles,
    Target,
    TrendingDown,
    TrendingUp,
} from 'lucide-react';
import api from '../lib/api';

const HISTORY_KEY = 'tixmo_quantmo_history';
const TEMPLATE_KEY = 'tixmo_quantmo_templates';

const SCOPE_OPTIONS = [
    { id: 'all', label: 'All Events' },
    { id: 'active', label: 'Active' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'past', label: 'Past' },
];

const CHART_COLORS = {
    revenue: '#f472b6',
    tickets: '#38bdf8',
    benchmark: '#a78bfa',
    support: '#fb923c',
};

const readStoredValue = (key, fallback) => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
        return fallback;
    }
};

const persistStoredValue = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error(`Failed to persist ${key}`, error);
    }
};

const extractPayload = (response) => response?.data || response || {};

const formatCurrency = (value) => {
    const amount = Number(value) || 0;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: amount >= 1000 ? 0 : 2,
    }).format(amount);
};

const formatCompactCurrency = (value) => {
    const amount = Number(value) || 0;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: amount >= 1000 ? 'compact' : 'standard',
        maximumFractionDigits: 1,
    }).format(amount);
};

const formatCompactNumber = (value) => new Intl.NumberFormat('en-US', {
    notation: Number(value) >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
}).format(Number(value) || 0);

const formatPercent = (value, digits = 0) => `${((Number(value) || 0) * 100).toFixed(digits)}%`;

const formatDateLabel = (value, options = { month: 'short', day: 'numeric' }) => {
    if (!value) return 'Date TBA';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Date TBA';
    return parsed.toLocaleDateString('en-US', options);
};

const safeRatio = (numerator, denominator) => {
    const top = Number(numerator) || 0;
    const bottom = Number(denominator) || 0;
    return bottom > 0 ? top / bottom : 0;
};

const average = (values) => {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const truncateLabel = (value, max = 22) => {
    if (!value) return 'Untitled Event';
    return value.length > max ? `${value.slice(0, max - 1)}...` : value;
};

const getEventName = (event) => event?.title || event?.name || 'Untitled Event';

const getEventStart = (event) => event?.startDateTime || event?.startDatetime || null;

const matchesScope = (event, scope, now) => {
    if (scope === 'all') return true;

    const startValue = getEventStart(event);
    const startDate = startValue ? new Date(startValue) : null;
    const hasDate = startDate && !Number.isNaN(startDate.getTime());
    const status = event?.status || 'DRAFT';

    if (scope === 'active') {
        return status !== 'DRAFT' && status !== 'CANCELLED' && (!hasDate || startDate >= now);
    }

    if (scope === 'upcoming') {
        return hasDate ? startDate >= now : status === 'PUBLISHED' || status === 'SOLD_OUT';
    }

    if (scope === 'past') {
        return hasDate ? startDate < now : false;
    }

    return true;
};

const buildEventMetrics = (events, salesData, eventData) => {
    const salesMap = new Map((salesData?.salesByEvent || []).map((item) => [item.eventId, item]));
    const eventMap = new Map((eventData?.topEvents || []).map((item) => [item.id, item]));

    return (events || []).map((event) => {
        const salesMetric = salesMap.get(event.id);
        const eventMetric = eventMap.get(event.id);
        const capacity = Number(event.capacity) || 0;
        const ticketsSold = Number(
            salesMetric?.ticketsSold ?? eventMetric?.ticketsSold ?? event.sold ?? 0
        ) || 0;
        const revenue = Number(
            salesMetric?.revenue ?? eventMetric?.revenue ?? event.revenue ?? 0
        ) || 0;

        return {
            ...event,
            label: getEventName(event),
            startAt: getEventStart(event),
            capacity,
            ticketsSold,
            revenue,
            sellThrough: safeRatio(ticketsSold, capacity),
        };
    });
};

const deriveQuantContext = ({ events, salesData, eventData, customerData, scope, selectedEventId }) => {
    const now = new Date();
    const allEvents = buildEventMetrics(events, salesData, eventData);
    const scopedEvents = allEvents.filter((event) => matchesScope(event, scope, now));
    const scopeEvents = scope === 'all' ? allEvents : scopedEvents;
    const selectedEvent = selectedEventId === 'all'
        ? null
        : scopeEvents.find((event) => event.id === selectedEventId) || null;

    const sortedByRevenue = [...scopeEvents].sort((a, b) => b.revenue - a.revenue);
    const sortedBySellThrough = [...scopeEvents].sort((a, b) => b.sellThrough - a.sellThrough);
    const revenueValues = scopeEvents.map((event) => event.revenue).filter((value) => value > 0);
    const avgRevenue = average(revenueValues);
    const avgSellThrough = average(scopeEvents.map((event) => event.sellThrough));
    const totalRevenue = scopeEvents.reduce((sum, event) => sum + event.revenue, 0);
    const totalTickets = scopeEvents.reduce((sum, event) => sum + event.ticketsSold, 0);
    const totalCapacity = scopeEvents.reduce((sum, event) => sum + event.capacity, 0);
    const allRevenue = (salesData?.salesByEvent || []).reduce((sum, item) => sum + (Number(item.revenue) || 0), 0);
    const scopeRevenueShare = allRevenue > 0 ? totalRevenue / allRevenue : 1;

    const timeline = (salesData?.salesByDay || []).map((item) => ({
        label: formatDateLabel(item.date),
        rawDate: item.date,
        revenue: Math.round((Number(item.revenue) || 0) * scopeRevenueShare),
        orders: Math.round((Number(item.orders) || 0) * scopeRevenueShare),
        tickets: Math.round((Number(item.tickets) || 0) * scopeRevenueShare),
    }));

    const recentTimeline = timeline.slice(-14);
    const avgDailyRevenue = average(recentTimeline.map((item) => item.revenue));
    const avgDailyTickets = average(recentTimeline.map((item) => item.tickets));
    const projected30DayRevenue = totalRevenue + (avgDailyRevenue * 30);
    const repeatCustomerShare = safeRatio(customerData?.repeatCustomers || 0, customerData?.totalCustomers || 0);
    const topPerformer = sortedByRevenue[0] || null;
    const laggingEvents = [...scopeEvents]
        .filter((event) => event.capacity > 0 || event.revenue > 0 || event.ticketsSold > 0)
        .sort((a, b) => {
            const aIndex = avgRevenue > 0 ? a.revenue / avgRevenue : a.sellThrough;
            const bIndex = avgRevenue > 0 ? b.revenue / avgRevenue : b.sellThrough;
            return aIndex - bIndex;
        });

    const scopeLabel = SCOPE_OPTIONS.find((option) => option.id === scope)?.label || 'All Events';
    const selectedLabel = selectedEvent ? selectedEvent.label : scopeLabel;
    const customerTrend = (customerData?.customersByRegistrationDate || []).slice(-14).map((item) => ({
        label: formatDateLabel(item.date),
        rawDate: item.date,
        count: Number(item.count) || 0,
    }));

    const projectedSellOutDays = selectedEvent && selectedEvent.capacity > selectedEvent.ticketsSold
        ? Math.ceil((selectedEvent.capacity - selectedEvent.ticketsSold) / Math.max(1, avgDailyTickets * Math.max(safeRatio(selectedEvent.ticketsSold, Math.max(totalTickets, 1)), 0.2)))
        : null;

    return {
        scope,
        scopeLabel,
        selectedEventId,
        selectedLabel,
        allEvents,
        scopeEvents,
        selectedEvent,
        topPerformer,
        laggingEvents,
        sortedByRevenue,
        sortedBySellThrough,
        totalRevenue,
        totalTickets,
        totalCapacity,
        avgRevenue,
        avgSellThrough,
        repeatCustomerShare,
        avgDailyRevenue,
        avgDailyTickets,
        projected30DayRevenue,
        projectedSellOutDays,
        timeline,
        recentTimeline,
        customerTrend,
        totalCustomers: Number(customerData?.totalCustomers) || 0,
        repeatCustomers: Number(customerData?.repeatCustomers) || 0,
        newCustomersInPeriod: Number(customerData?.newCustomersInPeriod) || 0,
    };
};

const buildHighlight = (label, value, tone = 'neutral') => ({ label, value, tone });

const buildBriefFromResult = (result, context) => {
    const lines = [
        `QuantMo Brief`,
        `Generated: ${new Date().toLocaleString()}`,
        `Scope: ${context.scopeLabel}`,
        `Focus: ${context.selectedLabel}`,
        '',
        'Executive Summary',
        result.summary,
        '',
        'Signals',
        ...result.highlights.map((item) => `- ${item.label}: ${item.value}`),
        '',
        'Recommendations',
        ...result.recommendations.map((item) => `- ${item}`),
    ];

    if (result.disclaimer) {
        lines.push('', 'Notes', `- ${result.disclaimer}`);
    }

    return lines.join('\n');
};

const buildStateOfWorldResult = (context) => {
    const topPerformer = context.topPerformer;
    const laggingEvent = context.laggingEvents[0] || null;
    const laggingGap = laggingEvent && context.avgRevenue > 0
        ? Math.max(0, 1 - safeRatio(laggingEvent.revenue, context.avgRevenue))
        : 0;

    return {
        title: 'State of the World',
        summary: `${context.scopeLabel} is pacing at ${formatCurrency(context.totalRevenue)} across ${context.scopeEvents.length} events. ${topPerformer ? `${topPerformer.label} is leading the book with ${formatCurrency(topPerformer.revenue)} in revenue.` : 'No event has meaningful revenue yet.'}`,
        highlights: [
            buildHighlight('Revenue in scope', formatCompactCurrency(context.totalRevenue), 'positive'),
            buildHighlight('Average sell-through', formatPercent(context.avgSellThrough), context.avgSellThrough >= 0.5 ? 'positive' : 'warning'),
            buildHighlight('Repeat customer share', formatPercent(context.repeatCustomerShare), context.repeatCustomerShare >= 0.25 ? 'positive' : 'neutral'),
            buildHighlight('30-day projection', formatCompactCurrency(context.projected30DayRevenue), 'neutral'),
        ],
        recommendations: [
            topPerformer ? `Protect momentum on ${topPerformer.label} with an immediate remarketing burst while demand is already proven.` : 'Use the next campaign to create the first clear demand signal for this slate.',
            laggingEvent ? `Rework messaging and offer structure on ${laggingEvent.label}; it is trailing portfolio pace by ${formatPercent(laggingGap)}.` : 'There is not enough lagging-event data yet to isolate a weak asset.',
            context.repeatCustomerShare < 0.2 ? 'Increase repeat-buyer conversion with loyalty or VIP upsell messaging.' : 'Lean into retention: your repeat-buyer base is strong enough to support segmented campaigns.',
        ],
        chart: {
            type: 'bar',
            title: 'Revenue by Event',
            data: context.sortedByRevenue.slice(0, 6).map((event) => ({
                label: truncateLabel(event.label),
                revenue: event.revenue,
                tickets: event.ticketsSold,
            })),
            xKey: 'label',
            bars: [
                { key: 'revenue', label: 'Revenue', color: CHART_COLORS.revenue },
                { key: 'tickets', label: 'Tickets', color: CHART_COLORS.tickets },
            ],
        },
        taskTitle: `QuantMo Brief: ${context.scopeLabel}`,
        taskPriority: laggingGap > 0.35 ? 'HIGH' : 'MEDIUM',
        taskTag: laggingGap > 0.35 ? 'MARKETING' : 'OPS',
        prompt: 'Create a state of the world report',
    };
};

const buildQueryResult = (prompt, context) => {
    const normalizedPrompt = prompt.trim().toLowerCase();
    const stateOfWorld = buildStateOfWorldResult(context);

    if (!normalizedPrompt) {
        return stateOfWorld;
    }

    if (
        normalizedPrompt.includes('state of the world')
        || normalizedPrompt.includes('brief')
        || normalizedPrompt.includes('report')
    ) {
        return {
            ...stateOfWorld,
            prompt,
        };
    }

    if (
        normalizedPrompt.includes('underperform')
        || normalizedPrompt.includes('lagging')
        || normalizedPrompt.includes('weak')
    ) {
        const weakest = context.laggingEvents.slice(0, 5);
        return {
            title: 'Underperforming Events',
            summary: weakest.length
                ? `${weakest[0].label} is the clearest drag in ${context.scopeLabel}, and the bottom tier is concentrated enough to fix with focused intervention.`
                : 'There is not enough event performance data yet to isolate an underperformer.',
            highlights: [
                buildHighlight('Weakest event', weakest[0] ? weakest[0].label : 'Not enough data', 'warning'),
                buildHighlight('Revenue vs avg', weakest[0] && context.avgRevenue > 0 ? formatPercent(safeRatio(weakest[0].revenue, context.avgRevenue), 0) : 'N/A', 'warning'),
                buildHighlight('Portfolio average', formatCompactCurrency(context.avgRevenue), 'neutral'),
                buildHighlight('Events below 50% sell-through', `${context.scopeEvents.filter((event) => event.sellThrough < 0.5).length}`, 'warning'),
            ],
            recommendations: [
                weakest[0] ? `Reposition ${weakest[0].label} with refreshed creative and a tighter CTA within the next campaign cycle.` : 'Wait for more transaction data before changing pricing or marketing.',
                'Shift spend away from broad awareness and into the event segments already producing ticket velocity.',
                'Use QuantMo briefs as a daily handoff into Task Manager until the lagging set stabilizes.',
            ],
            chart: {
                type: 'table',
                title: 'Lagging Events',
                columns: ['Event', 'Revenue', 'Sell-through', 'Date'],
                rows: weakest.map((event) => ({
                    Event: event.label,
                    Revenue: formatCurrency(event.revenue),
                    'Sell-through': formatPercent(event.sellThrough),
                    Date: formatDateLabel(event.startAt),
                })),
            },
            taskTitle: `QuantMo Recovery Plan: ${context.scopeLabel}`,
            taskPriority: 'HIGH',
            taskTag: 'MARKETING',
            prompt,
        };
    }

    if (
        normalizedPrompt.includes('sales pace')
        || normalizedPrompt.includes('revenue by day')
        || normalizedPrompt.includes('pace')
        || normalizedPrompt.includes('trend')
    ) {
        const lastPoint = context.recentTimeline[context.recentTimeline.length - 1];
        return {
            title: 'Sales Pace',
            summary: `${context.scopeLabel} is currently averaging ${formatCompactCurrency(context.avgDailyRevenue)} per day based on the last ${context.recentTimeline.length || 0} modeled days. ${lastPoint ? `The latest visible day landed at ${formatCurrency(lastPoint.revenue)}.` : ''}`.trim(),
            highlights: [
                buildHighlight('Average daily revenue', formatCompactCurrency(context.avgDailyRevenue), 'positive'),
                buildHighlight('Average daily tickets', formatCompactNumber(context.avgDailyTickets), 'neutral'),
                buildHighlight('Projected 30-day revenue', formatCompactCurrency(context.projected30DayRevenue), 'positive'),
                buildHighlight('Top performer', context.topPerformer ? context.topPerformer.label : 'No leader yet', 'neutral'),
            ],
            recommendations: [
                'Use the sales-pace line as the daily heartbeat for promoter standups.',
                context.selectedEvent ? `Pair this with a focused comparison against ${context.selectedEvent.label} to understand whether the event is beating or lagging the portfolio.` : 'Select a single event next to compare pace against the portfolio average.',
                'Trigger a Promo workflow when the daily pace flattens for more than 3 consecutive days.',
            ],
            chart: {
                type: 'area',
                title: 'Modeled Revenue Pace',
                data: context.recentTimeline,
                xKey: 'label',
                areas: [
                    { key: 'revenue', label: 'Revenue', color: CHART_COLORS.revenue },
                    { key: 'tickets', label: 'Tickets', color: CHART_COLORS.tickets },
                ],
            },
            disclaimer: context.scope !== 'all' || context.selectedEvent
                ? 'Daily pace is modeled from scoped revenue share because the current analytics API does not yet expose per-scope daily splits.'
                : null,
            taskTitle: `QuantMo Pace Review: ${context.selectedLabel}`,
            taskPriority: 'MEDIUM',
            taskTag: 'OPS',
            prompt,
        };
    }

    if (
        normalizedPrompt.includes('compare')
        || normalizedPrompt.includes('average')
        || normalizedPrompt.includes('performing')
    ) {
        const comparisonTarget = context.selectedEvent || context.topPerformer;
        const portfolioAverageRevenue = context.avgRevenue;
        const portfolioAverageSellThrough = context.avgSellThrough;
        return {
            title: 'Performance vs Average',
            summary: comparisonTarget
                ? `${comparisonTarget.label} is running at ${formatCurrency(comparisonTarget.revenue)} in revenue and ${formatPercent(comparisonTarget.sellThrough)} sell-through versus a portfolio average of ${formatCurrency(portfolioAverageRevenue)} and ${formatPercent(portfolioAverageSellThrough)}.`
                : 'Select an event to compare it against the portfolio average.',
            highlights: [
                buildHighlight('Focus event', comparisonTarget ? comparisonTarget.label : 'No event selected', 'neutral'),
                buildHighlight('Revenue index', comparisonTarget ? formatPercent(safeRatio(comparisonTarget.revenue, Math.max(portfolioAverageRevenue, 1)), 0) : 'N/A', comparisonTarget && comparisonTarget.revenue >= portfolioAverageRevenue ? 'positive' : 'warning'),
                buildHighlight('Sell-through index', comparisonTarget ? formatPercent(safeRatio(comparisonTarget.sellThrough, Math.max(portfolioAverageSellThrough, 0.01)), 0) : 'N/A', comparisonTarget && comparisonTarget.sellThrough >= portfolioAverageSellThrough ? 'positive' : 'warning'),
                buildHighlight('Events in scope', `${context.scopeEvents.length}`, 'neutral'),
            ],
            recommendations: [
                comparisonTarget && comparisonTarget.revenue < portfolioAverageRevenue
                    ? `Raise urgency around ${comparisonTarget.label}; it is under the portfolio revenue benchmark.`
                    : 'Keep feeding the highest-performing playbook into your active slate.',
                'Use this comparison as a promoter-facing check before moving more budget.',
                'Create a QuantMo brief when a key event drops below average for two consecutive reviews.',
            ],
            chart: {
                type: 'bar',
                title: 'Event vs Portfolio Benchmark',
                data: comparisonTarget ? [
                    {
                        label: truncateLabel(comparisonTarget.label),
                        revenue: comparisonTarget.revenue,
                        benchmark: portfolioAverageRevenue,
                        tickets: comparisonTarget.ticketsSold,
                    },
                    {
                        label: 'Portfolio Avg',
                        revenue: portfolioAverageRevenue,
                        benchmark: portfolioAverageRevenue,
                        tickets: average(context.scopeEvents.map((event) => event.ticketsSold)),
                    },
                ] : [],
                xKey: 'label',
                bars: [
                    { key: 'revenue', label: 'Revenue', color: CHART_COLORS.revenue },
                    { key: 'benchmark', label: 'Benchmark', color: CHART_COLORS.benchmark },
                ],
            },
            taskTitle: `QuantMo Comparison: ${comparisonTarget ? comparisonTarget.label : context.scopeLabel}`,
            taskPriority: 'MEDIUM',
            taskTag: 'OPS',
            prompt,
        };
    }

    if (
        normalizedPrompt.includes('demographic')
        || normalizedPrompt.includes('audience')
        || normalizedPrompt.includes('customer')
    ) {
        return {
            title: 'Audience Momentum',
            summary: `QuantMo can already see customer acquisition and repeat-buyer behavior. ${formatCompactNumber(context.newCustomersInPeriod)} new customers landed in the active period, and repeat buyers represent ${formatPercent(context.repeatCustomerShare)} of the known base.`,
            highlights: [
                buildHighlight('Total customers', formatCompactNumber(context.totalCustomers), 'neutral'),
                buildHighlight('New in period', formatCompactNumber(context.newCustomersInPeriod), 'positive'),
                buildHighlight('Repeat buyers', formatCompactNumber(context.repeatCustomers), 'positive'),
                buildHighlight('Repeat buyer share', formatPercent(context.repeatCustomerShare), context.repeatCustomerShare >= 0.25 ? 'positive' : 'neutral'),
            ],
            recommendations: [
                'Pair new-customer growth with retention messaging before the next on-sale wave.',
                'Add demographic and channel dimensions to the analytics API next so QuantMo can surface true audience pockets.',
                'Use repeat-buyer segments as the first target set for high-margin offers.',
            ],
            chart: {
                type: 'area',
                title: 'Customer Acquisition Trend',
                data: context.customerTrend,
                xKey: 'label',
                areas: [
                    { key: 'count', label: 'New Customers', color: CHART_COLORS.support },
                ],
            },
            disclaimer: 'Demographic and channel breakdowns are not yet exposed by the current analytics payload, so this view is using customer-acquisition data as the closest live proxy.',
            taskTitle: `QuantMo Audience Brief: ${context.scopeLabel}`,
            taskPriority: 'MEDIUM',
            taskTag: 'MARKETING',
            prompt,
        };
    }

    return {
        title: 'Portfolio Snapshot',
        summary: `${context.scopeLabel} has ${context.scopeEvents.length} events in play, ${formatCurrency(context.totalRevenue)} in revenue, and ${formatPercent(context.avgSellThrough)} average sell-through. QuantMo recommends running a comparison or lagging-event prompt next.`,
        highlights: [
            buildHighlight('Events in scope', `${context.scopeEvents.length}`, 'neutral'),
            buildHighlight('Revenue', formatCompactCurrency(context.totalRevenue), 'positive'),
            buildHighlight('Tickets sold', formatCompactNumber(context.totalTickets), 'positive'),
            buildHighlight('Projected 30-day revenue', formatCompactCurrency(context.projected30DayRevenue), 'neutral'),
        ],
        recommendations: [
            'Run a state-of-the-world report for a promoter-ready summary.',
            'Compare one key event against the average before shifting spend.',
            'Create a brief task if you want this analysis pushed into the team workflow.',
        ],
        chart: {
            type: 'bar',
            title: 'Sell-through Leaders',
            data: context.sortedBySellThrough.slice(0, 6).map((event) => ({
                label: truncateLabel(event.label),
                sellThrough: Number((event.sellThrough * 100).toFixed(1)),
            })),
            xKey: 'label',
            bars: [
                { key: 'sellThrough', label: 'Sell-through %', color: CHART_COLORS.support },
            ],
        },
        taskTitle: `QuantMo Snapshot: ${context.scopeLabel}`,
        taskPriority: 'MEDIUM',
        taskTag: 'OPS',
        prompt,
    };
};

const ResultTone = ({ tone }) => {
    if (tone === 'positive') {
        return <TrendingUp size={14} className="text-emerald-400" />;
    }
    if (tone === 'warning') {
        return <TrendingDown size={14} className="text-amber-400" />;
    }
    return <Target size={14} className="text-cyan-400" />;
};

const MetricCard = ({ label, value, detail, icon: Icon, isDark }) => (
    <div className={`rounded-md border p-5 ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40] shadow-lg shadow-black/20' : 'bg-white border-gray-200 shadow-sm'}`}>
        <div className="flex items-center justify-between mb-3">
            <span className={`text-xs tracking-[0.24em] uppercase font-light ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>{label}</span>
            <div className={`h-10 w-10 rounded-md flex items-center justify-center ${isDark ? 'bg-[#151521] text-fuchsia-300' : 'bg-fuchsia-50 text-fuchsia-600'}`}>
                <Icon size={18} />
            </div>
        </div>
        <div className={`text-3xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{value}</div>
        <div className={`mt-2 text-sm font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>{detail}</div>
    </div>
);

const ChartRenderer = ({ chart, isDark }) => {
    if (!chart) return null;

    if (chart.type === 'table') {
        return (
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className={isDark ? 'text-[#8f94aa]' : 'text-gray-500'}>
                            {chart.columns.map((column) => (
                                <th key={column} className="text-left font-light tracking-wide pb-3 pr-4">{column}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {chart.rows.length === 0 ? (
                            <tr>
                                <td colSpan={chart.columns.length} className={`py-6 text-center ${isDark ? 'text-[#8f94aa]' : 'text-gray-400'}`}>
                                    No data available for this prompt.
                                </td>
                            </tr>
                        ) : chart.rows.map((row, index) => (
                            <tr key={`${row[chart.columns[0]]}-${index}`} className={`border-t ${isDark ? 'border-[#2b2b40]' : 'border-gray-100'}`}>
                                {chart.columns.map((column) => (
                                    <td key={column} className={`py-3 pr-4 font-light ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                        {row[column]}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    if (chart.type === 'area') {
        return (
            <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chart.data}>
                        <defs>
                            {chart.areas.map((area) => (
                                <linearGradient key={area.key} id={`quantmo-${area.key}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={area.color} stopOpacity={0.35} />
                                    <stop offset="95%" stopColor={area.color} stopOpacity={0.02} />
                                </linearGradient>
                            ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#2b2b40' : '#e5e7eb'} />
                        <XAxis dataKey={chart.xKey} tickLine={false} axisLine={false} tick={{ fill: isDark ? '#a1a5b7' : '#6b7280', fontSize: 12 }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fill: isDark ? '#a1a5b7' : '#6b7280', fontSize: 12 }} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: isDark ? '#151521' : '#ffffff',
                                border: `1px solid ${isDark ? '#2b2b40' : '#e5e7eb'}`,
                                borderRadius: '8px',
                                color: isDark ? '#f3f4f6' : '#111827',
                            }}
                        />
                        {chart.areas.map((area) => (
                            <Area
                                key={area.key}
                                type="monotone"
                                dataKey={area.key}
                                stroke={area.color}
                                fill={`url(#quantmo-${area.key})`}
                                strokeWidth={2.5}
                            />
                        ))}
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        );
    }

    return (
        <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart.data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#2b2b40' : '#e5e7eb'} />
                    <XAxis dataKey={chart.xKey} tickLine={false} axisLine={false} tick={{ fill: isDark ? '#a1a5b7' : '#6b7280', fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: isDark ? '#a1a5b7' : '#6b7280', fontSize: 12 }} />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: isDark ? '#151521' : '#ffffff',
                            border: `1px solid ${isDark ? '#2b2b40' : '#e5e7eb'}`,
                            borderRadius: '8px',
                            color: isDark ? '#f3f4f6' : '#111827',
                        }}
                    />
                    {chart.bars.map((bar) => (
                        <Bar key={bar.key} dataKey={bar.key} fill={bar.color} radius={[6, 6, 0, 0]} />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

const QuantMoView = ({ isDark }) => {
    const [events, setEvents] = useState([]);
    const [salesData, setSalesData] = useState(null);
    const [eventData, setEventData] = useState(null);
    const [customerData, setCustomerData] = useState(null);
    const [scope, setScope] = useState('all');
    const [selectedEventId, setSelectedEventId] = useState('all');
    const [prompt, setPrompt] = useState('');
    const [currentResult, setCurrentResult] = useState(null);
    const [history, setHistory] = useState(() => readStoredValue(HISTORY_KEY, []));
    const [templates, setTemplates] = useState(() => readStoredValue(TEMPLATE_KEY, [
        'Create a state of the world report',
        'How is my focus event performing vs my average?',
        'What is my current sales pace?',
    ]));
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isCreatingTask, setIsCreatingTask] = useState(false);
    const [taskFeedback, setTaskFeedback] = useState(null);

    useEffect(() => {
        const fetchQuantData = async () => {
            setLoading(true);
            setError(null);

            try {
                const [eventsResponse, salesResponse, eventResponse, customerResponse] = await Promise.all([
                    api.get('/events?limit=100').catch(() => null),
                    api.get('/analytics/sales').catch(() => null),
                    api.get('/analytics/events').catch(() => null),
                    api.get('/analytics/customers').catch(() => null),
                ]);

                const eventsPayload = extractPayload(eventsResponse);
                const salesPayload = extractPayload(salesResponse);
                const eventPayload = extractPayload(eventResponse);
                const customerPayload = extractPayload(customerResponse);

                setEvents(eventsPayload.events || eventsPayload.data?.events || []);
                setSalesData(salesPayload);
                setEventData(eventPayload);
                setCustomerData(customerPayload);
            } catch (requestError) {
                console.error('Failed to load QuantMo data', requestError);
                setError('QuantMo could not load analytics data. Try again when the API is available.');
            } finally {
                setLoading(false);
            }
        };

        fetchQuantData();
    }, []);

    const quantContext = useMemo(() => deriveQuantContext({
        events,
        salesData,
        eventData,
        customerData,
        scope,
        selectedEventId,
    }), [events, salesData, eventData, customerData, scope, selectedEventId]);

    const suggestedQueries = useMemo(() => {
        const focusLabel = quantContext.selectedEvent ? quantContext.selectedEvent.label : 'my portfolio';
        return [
            `Create a state of the world report`,
            `How is ${focusLabel} performing vs my average?`,
            'What is my current sales pace?',
            'Which events are underperforming?',
            'Show audience momentum',
        ];
    }, [quantContext.selectedEvent]);

    const snapshotResult = useMemo(() => buildStateOfWorldResult(quantContext), [quantContext]);

    useEffect(() => {
        if (selectedEventId !== 'all' && !quantContext.scopeEvents.find((event) => event.id === selectedEventId)) {
            setSelectedEventId('all');
        }
    }, [quantContext.scopeEvents, selectedEventId]);

    const executePrompt = (nextPrompt, overrides = {}) => {
        const targetScope = overrides.scope || scope;
        const targetEventId = overrides.selectedEventId || selectedEventId;
        const derivedContext = deriveQuantContext({
            events,
            salesData,
            eventData,
            customerData,
            scope: targetScope,
            selectedEventId: targetEventId,
        });

        const result = buildQueryResult(nextPrompt, derivedContext);
        const entry = {
            prompt: nextPrompt,
            scope: targetScope,
            selectedEventId: targetEventId,
            title: result.title,
            chartType: result.chart?.type || 'bar',
            timestamp: new Date().toISOString(),
        };

        if (!overrides.skipHistory) {
            const nextHistory = [entry, ...history.filter((item) => item.prompt !== nextPrompt)].slice(0, 8);
            setHistory(nextHistory);
            persistStoredValue(HISTORY_KEY, nextHistory);
        }

        setPrompt(nextPrompt);
        setCurrentResult(result);
        setTaskFeedback(null);
    };

    const handlePromptSubmit = () => {
        executePrompt(prompt || 'Create a state of the world report');
    };

    const handleSaveTemplate = () => {
        const normalized = (prompt || currentResult?.prompt || '').trim();
        if (!normalized) return;

        const nextTemplates = [normalized, ...templates.filter((item) => item !== normalized)].slice(0, 8);
        setTemplates(nextTemplates);
        persistStoredValue(TEMPLATE_KEY, nextTemplates);
    };

    const handleCreateTask = async (result = currentResult || snapshotResult) => {
        if (!result) return;

        setIsCreatingTask(true);
        setTaskFeedback(null);

        try {
            const briefContext = deriveQuantContext({
                events,
                salesData,
                eventData,
                customerData,
                scope,
                selectedEventId,
            });
            const description = buildBriefFromResult(result, briefContext);

            await api.post('/tasks', {
                title: result.taskTitle || `QuantMo Brief: ${briefContext.selectedLabel}`,
                description,
                priority: result.taskPriority || 'MEDIUM',
                tag: result.taskTag || 'OPS',
                status: 'TO_DO',
            });

            setTaskFeedback({
                tone: 'success',
                message: 'QuantMo brief sent to Team Tasks.',
            });
        } catch (taskError) {
            console.error('Failed to create QuantMo task', taskError);
            setTaskFeedback({
                tone: 'error',
                message: taskError?.response?.data?.message || taskError?.message || 'Task creation failed.',
            });
        } finally {
            setIsCreatingTask(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-32 animate-fade-in">
                <Loader2 size={42} className={`animate-spin ${isDark ? 'text-fuchsia-400' : 'text-fuchsia-600'}`} />
                <p className={`mt-4 text-sm font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>QuantMo is loading portfolio intelligence...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`rounded-md border p-8 max-w-3xl mx-auto ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40]' : 'bg-white border-gray-200 shadow-sm'}`}>
                <div className="flex items-start gap-4">
                    <div className={`h-12 w-12 rounded-md flex items-center justify-center ${isDark ? 'bg-rose-500/10 text-rose-400' : 'bg-rose-50 text-rose-600'}`}>
                        <AlertCircle size={22} />
                    </div>
                    <div>
                        <h2 className={`text-2xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>QuantMo is unavailable</h2>
                        <p className={`mt-2 text-sm font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in max-w-[1500px] mx-auto pb-12">
            <section className={`relative overflow-hidden rounded-md border p-6 sm:p-8 ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40] shadow-2xl shadow-black/20' : 'bg-white border-gray-200 shadow-sm'}`}>
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-fuchsia-500/10 blur-3xl" />
                    <div className="absolute left-10 bottom-0 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
                </div>
                <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                    <div className="max-w-3xl">
                        <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs tracking-[0.24em] uppercase font-light ${isDark ? 'bg-[#151521] text-fuchsia-300 border border-[#2b2b40]' : 'bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-100'}`}>
                            <BrainCircuit size={14} />
                            QuantMo Command Center
                        </div>
                        <h2 className={`mt-4 text-3xl sm:text-4xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>AI-driven quant intelligence for promoters</h2>
                        <p className={`mt-3 text-base sm:text-lg font-light max-w-2xl ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                            QuantMo turns event telemetry into promoter-ready answers, comparisons, forecasts, and task briefs without leaving the control center.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => executePrompt('Create a state of the world report')}
                            className={`inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm transition-colors ${isDark ? 'bg-fuchsia-500 text-white hover:bg-fuchsia-400' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                        >
                            <Sparkles size={16} />
                            State of the World
                        </button>
                        <button
                            onClick={() => handleCreateTask(snapshotResult)}
                            disabled={isCreatingTask}
                            className={`inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm border transition-colors ${isDark ? 'border-[#2b2b40] text-gray-200 hover:bg-[#232336]' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                        >
                            <FileText size={16} />
                            Create Brief Task
                        </button>
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <MetricCard
                    label="Revenue"
                    value={formatCompactCurrency(quantContext.totalRevenue)}
                    detail={`${quantContext.scopeEvents.length} events in ${quantContext.scopeLabel.toLowerCase()}`}
                    icon={BarChart3}
                    isDark={isDark}
                />
                <MetricCard
                    label="Tickets Sold"
                    value={formatCompactNumber(quantContext.totalTickets)}
                    detail={`${formatPercent(safeRatio(quantContext.totalTickets, Math.max(quantContext.totalCapacity, 1)))} of known capacity`}
                    icon={Target}
                    isDark={isDark}
                />
                <MetricCard
                    label="Daily Pace"
                    value={formatCompactCurrency(quantContext.avgDailyRevenue)}
                    detail="Modeled from recent portfolio revenue"
                    icon={Clock3}
                    isDark={isDark}
                />
                <MetricCard
                    label="Repeat Buyers"
                    value={formatPercent(quantContext.repeatCustomerShare)}
                    detail={`${formatCompactNumber(quantContext.repeatCustomers)} repeat customers identified`}
                    icon={ListTodo}
                    isDark={isDark}
                />
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_380px] gap-6">
                <div className="space-y-6">
                    <div className={`rounded-md border p-5 ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40]' : 'bg-white border-gray-200 shadow-sm'}`}>
                        <div className="flex flex-col lg:flex-row gap-4 lg:items-end lg:justify-between">
                            <div>
                                <h3 className={`text-xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Query engine</h3>
                                <p className={`mt-1 text-sm font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                                    Ask QuantMo for pace, comparisons, risk, or a full portfolio brief.
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className={`inline-flex rounded-md border p-1 ${isDark ? 'bg-[#151521] border-[#2b2b40]' : 'bg-gray-50 border-gray-200'}`}>
                                    {SCOPE_OPTIONS.map((option) => (
                                        <button
                                            key={option.id}
                                            onClick={() => setScope(option.id)}
                                            className={`px-3 py-1.5 rounded-sm text-sm font-light transition-colors ${scope === option.id
                                                ? (isDark ? 'bg-[#2b2b40] text-gray-100' : 'bg-white text-gray-900 shadow-sm')
                                                : (isDark ? 'text-[#8f94aa] hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                                <select
                                    value={selectedEventId}
                                    onChange={(event) => setSelectedEventId(event.target.value)}
                                    className={`min-w-[220px] rounded-md border px-3 py-2 text-sm font-light outline-none ${isDark ? 'bg-[#151521] border-[#2b2b40] text-gray-100' : 'bg-white border-gray-200 text-gray-700'}`}
                                >
                                    <option value="all">{scope === 'all' ? 'All events' : `${quantContext.scopeLabel} events`}</option>
                                    {quantContext.scopeEvents.map((event) => (
                                        <option key={event.id} value={event.id}>
                                            {event.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className={`mt-5 rounded-md border p-4 ${isDark ? 'bg-[#151521] border-[#2b2b40]' : 'bg-gray-50 border-gray-200'}`}>
                            <div className="flex items-start gap-3">
                                <div className={`mt-1 h-10 w-10 rounded-md flex items-center justify-center ${isDark ? 'bg-[#232336] text-fuchsia-300' : 'bg-white text-fuchsia-600 border border-gray-200'}`}>
                                    <Search size={18} />
                                </div>
                                <div className="flex-1">
                                    <textarea
                                        value={prompt}
                                        onChange={(event) => setPrompt(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' && !event.shiftKey) {
                                                event.preventDefault();
                                                handlePromptSubmit();
                                            }
                                        }}
                                        rows={3}
                                        placeholder="Compare ticket sales 30 days in vs previous events"
                                        className={`w-full resize-none bg-transparent outline-none text-sm sm:text-base font-light ${isDark ? 'text-gray-100 placeholder:text-[#5e6278]' : 'text-gray-800 placeholder:text-gray-400'}`}
                                    />
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {suggestedQueries.map((query) => (
                                            <button
                                                key={query}
                                                onClick={() => executePrompt(query)}
                                                className={`rounded-full px-3 py-1.5 text-xs sm:text-sm font-light transition-colors ${isDark ? 'bg-[#232336] text-[#c6c9d8] hover:bg-[#2b2b40]' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                                            >
                                                {query}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-3">
                                        <button
                                            onClick={handlePromptSubmit}
                                            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm transition-colors ${isDark ? 'bg-fuchsia-500 text-white hover:bg-fuchsia-400' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                                        >
                                            <Send size={15} />
                                            Run query
                                        </button>
                                        <button
                                            onClick={handleSaveTemplate}
                                            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm border transition-colors ${isDark ? 'border-[#2b2b40] text-gray-200 hover:bg-[#232336]' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                                        >
                                            <Sparkles size={15} />
                                            Save as template
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={`rounded-md border p-5 ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40]' : 'bg-white border-gray-200 shadow-sm'}`}>
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                            <div>
                                <h3 className={`text-xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                                    {currentResult?.title || 'Ready for a QuantMo prompt'}
                                </h3>
                                <p className={`mt-2 max-w-3xl text-sm sm:text-base font-light leading-relaxed ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                                    {currentResult?.summary || 'Start with a state-of-the-world report, a sales-pace question, or an underperformance scan.'}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <button
                                    onClick={() => handleCreateTask(currentResult || snapshotResult)}
                                    disabled={isCreatingTask}
                                    className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm border transition-colors ${isDark ? 'border-[#2b2b40] text-gray-200 hover:bg-[#232336]' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                                >
                                    {isCreatingTask ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
                                    Create task brief
                                </button>
                                {currentResult && (
                                    <button
                                        onClick={() => setCurrentResult(null)}
                                        className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm transition-colors ${isDark ? 'bg-[#151521] text-[#a1a5b7] hover:text-gray-100' : 'bg-gray-50 text-gray-600 hover:text-gray-800'}`}
                                    >
                                        Reset
                                    </button>
                                )}
                            </div>
                        </div>

                        {taskFeedback && (
                            <div className={`mt-4 rounded-md border px-4 py-3 text-sm font-light ${taskFeedback.tone === 'success'
                                ? (isDark ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700')
                                : (isDark ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700')
                            }`}>
                                {taskFeedback.message}
                            </div>
                        )}

                        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                            {(currentResult?.highlights || snapshotResult.highlights).map((item) => (
                                <div key={`${item.label}-${item.value}`} className={`rounded-md border p-4 ${isDark ? 'bg-[#151521] border-[#2b2b40]' : 'bg-gray-50 border-gray-200'}`}>
                                    <div className="flex items-center justify-between">
                                        <span className={`text-xs uppercase tracking-[0.2em] font-light ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>{item.label}</span>
                                        <ResultTone tone={item.tone} />
                                    </div>
                                    <div className={`mt-3 text-lg font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{item.value}</div>
                                </div>
                            ))}
                        </div>

                        <div className={`mt-6 rounded-md border p-5 ${isDark ? 'bg-[#151521] border-[#2b2b40]' : 'bg-gray-50 border-gray-200'}`}>
                            <div className="flex items-center justify-between gap-4 mb-4">
                                <div>
                                    <div className={`text-xs uppercase tracking-[0.2em] font-light ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>{(currentResult?.chart || snapshotResult.chart).title}</div>
                                    <div className={`mt-1 text-sm font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                                        {currentResult?.prompt || 'QuantMo overview'}
                                    </div>
                                </div>
                                <ArrowRight size={18} className={isDark ? 'text-[#5e6278]' : 'text-gray-400'} />
                            </div>
                            <ChartRenderer chart={currentResult?.chart || snapshotResult.chart} isDark={isDark} />
                            {(currentResult?.disclaimer || snapshotResult.disclaimer) && (
                                <p className={`mt-4 text-xs font-light ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                                    {currentResult?.disclaimer || snapshotResult.disclaimer}
                                </p>
                            )}
                        </div>

                        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className={`rounded-md border p-5 ${isDark ? 'bg-[#151521] border-[#2b2b40]' : 'bg-gray-50 border-gray-200'}`}>
                                <div className="flex items-center gap-2">
                                    <Sparkles size={16} className={isDark ? 'text-fuchsia-300' : 'text-fuchsia-600'} />
                                    <h4 className={`text-sm uppercase tracking-[0.2em] font-light ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>Observations</h4>
                                </div>
                                <div className={`mt-4 text-sm font-light leading-relaxed ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                    {currentResult?.summary || snapshotResult.summary}
                                </div>
                            </div>
                            <div className={`rounded-md border p-5 ${isDark ? 'bg-[#151521] border-[#2b2b40]' : 'bg-gray-50 border-gray-200'}`}>
                                <div className="flex items-center gap-2">
                                    <ListTodo size={16} className={isDark ? 'text-cyan-300' : 'text-cyan-600'} />
                                    <h4 className={`text-sm uppercase tracking-[0.2em] font-light ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>Recommended actions</h4>
                                </div>
                                <div className="mt-4 space-y-3">
                                    {(currentResult?.recommendations || snapshotResult.recommendations).map((item) => (
                                        <div key={item} className="flex gap-3">
                                            <div className={`mt-1 h-2 w-2 rounded-full ${isDark ? 'bg-fuchsia-400' : 'bg-fuchsia-500'}`} />
                                            <div className={`text-sm font-light leading-relaxed ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{item}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <aside className="space-y-6">
                    <div className={`rounded-md border p-5 ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40]' : 'bg-white border-gray-200 shadow-sm'}`}>
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className={`text-xs uppercase tracking-[0.2em] font-light ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>State of the World</div>
                                <h3 className={`mt-2 text-xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{quantContext.scopeLabel}</h3>
                            </div>
                            <div className={`h-11 w-11 rounded-md flex items-center justify-center ${isDark ? 'bg-[#151521] text-fuchsia-300' : 'bg-fuchsia-50 text-fuchsia-600'}`}>
                                <BrainCircuit size={18} />
                            </div>
                        </div>
                        <p className={`mt-4 text-sm font-light leading-relaxed ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>{snapshotResult.summary}</p>
                        <div className="mt-5 space-y-3">
                            <div className={`flex items-center justify-between rounded-md border px-4 py-3 ${isDark ? 'border-[#2b2b40] bg-[#151521]' : 'border-gray-200 bg-gray-50'}`}>
                                <span className={isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}>Top performer</span>
                                <span className={isDark ? 'text-gray-100' : 'text-gray-900'}>{quantContext.topPerformer ? quantContext.topPerformer.label : 'No leader yet'}</span>
                            </div>
                            <div className={`flex items-center justify-between rounded-md border px-4 py-3 ${isDark ? 'border-[#2b2b40] bg-[#151521]' : 'border-gray-200 bg-gray-50'}`}>
                                <span className={isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}>30-day projection</span>
                                <span className={isDark ? 'text-gray-100' : 'text-gray-900'}>{formatCompactCurrency(quantContext.projected30DayRevenue)}</span>
                            </div>
                            <div className={`flex items-center justify-between rounded-md border px-4 py-3 ${isDark ? 'border-[#2b2b40] bg-[#151521]' : 'border-gray-200 bg-gray-50'}`}>
                                <span className={isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}>Projected sellout</span>
                                <span className={isDark ? 'text-gray-100' : 'text-gray-900'}>
                                    {quantContext.projectedSellOutDays ? `${quantContext.projectedSellOutDays} days` : 'Need event focus'}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={() => executePrompt('Create a state of the world report')}
                            className={`mt-5 w-full inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm transition-colors ${isDark ? 'bg-fuchsia-500 text-white hover:bg-fuchsia-400' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                        >
                            <Sparkles size={15} />
                            Open report
                        </button>
                    </div>

                    <div className={`rounded-md border p-5 ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40]' : 'bg-white border-gray-200 shadow-sm'}`}>
                        <div className="flex items-center gap-2">
                            <History size={16} className={isDark ? 'text-cyan-300' : 'text-cyan-600'} />
                            <h3 className={`text-lg font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Recent queries</h3>
                        </div>
                        <div className="mt-4 space-y-3">
                            {history.length === 0 ? (
                                <div className={`rounded-md border border-dashed p-4 text-sm font-light ${isDark ? 'border-[#2b2b40] text-[#8f94aa]' : 'border-gray-200 text-gray-500'}`}>
                                    No history yet. Run a QuantMo prompt to build your trail.
                                </div>
                            ) : history.map((entry) => (
                                <button
                                    key={`${entry.prompt}-${entry.timestamp}`}
                                    onClick={() => {
                                        setScope(entry.scope || 'all');
                                        setSelectedEventId(entry.selectedEventId || 'all');
                                        executePrompt(entry.prompt, {
                                            scope: entry.scope || 'all',
                                            selectedEventId: entry.selectedEventId || 'all',
                                            skipHistory: true,
                                        });
                                    }}
                                    className={`w-full text-left rounded-md border p-4 transition-colors ${isDark ? 'border-[#2b2b40] bg-[#151521] hover:bg-[#232336]' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <span className={`text-sm font-light ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>{entry.title}</span>
                                        <span className={`text-[10px] uppercase tracking-[0.18em] ${isDark ? 'text-[#5e6278]' : 'text-gray-400'}`}>{entry.chartType}</span>
                                    </div>
                                    <div className={`mt-2 text-xs font-light leading-relaxed ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>{entry.prompt}</div>
                                    <div className={`mt-3 flex items-center justify-between text-[11px] font-light ${isDark ? 'text-[#5e6278]' : 'text-gray-400'}`}>
                                        <span>{SCOPE_OPTIONS.find((item) => item.id === entry.scope)?.label || 'All Events'}</span>
                                        <span>{new Date(entry.timestamp).toLocaleString()}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className={`rounded-md border p-5 ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40]' : 'bg-white border-gray-200 shadow-sm'}`}>
                        <div className="flex items-center gap-2">
                            <CalendarDays size={16} className={isDark ? 'text-amber-300' : 'text-amber-600'} />
                            <h3 className={`text-lg font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Saved templates</h3>
                        </div>
                        <div className="mt-4 space-y-2">
                            {templates.map((template) => (
                                <button
                                    key={template}
                                    onClick={() => setPrompt(template)}
                                    className={`w-full text-left rounded-md border px-4 py-3 text-sm font-light transition-colors ${isDark ? 'border-[#2b2b40] bg-[#151521] text-gray-200 hover:bg-[#232336]' : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
                                >
                                    {template}
                                </button>
                            ))}
                        </div>
                    </div>
                </aside>
            </section>
        </div>
    );
};

export default QuantMoView;
