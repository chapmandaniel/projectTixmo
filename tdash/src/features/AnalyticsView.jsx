import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ResponsiveLine } from '@nivo/line';
import { ResponsivePie } from '@nivo/pie';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsiveHeatMap } from '@nivo/heatmap';
import {
    TrendingUp, DollarSign, Ticket, ShoppingCart,
    BarChart3, ChevronDown, Loader2, Flame, Link2, RefreshCcw, Plus, Save, Users, Eye, MousePointerClick
} from 'lucide-react';
import api from '../lib/api';
import {
    ANALYTICS_TIMEFRAMES,
    GOOGLE_ANALYTICS_DIMENSION_BLUEPRINT,
    GOOGLE_ANALYTICS_METRIC_BLUEPRINT,
    ORGANIZATION_GOOGLE_ANALYTICS_TAGS_KEY,
    ORGANIZATION_SELECTED_GOOGLE_ANALYTICS_TAG_ID_KEY,
    buildAnalyticsQueryString,
    getGoogleAnalyticsIntegrationMeta,
    getOrganizationGoogleAnalyticsIntegrationMeta,
    normalizeOrganizationGoogleAnalyticsTags,
} from '../lib/analyticsSources';
import {
    DashboardButton,
    DashboardChip,
    DashboardEmptyState,
    DashboardPage,
    DashboardSection,
    DashboardSelect,
    DashboardStat,
    DashboardSurface,
    DashboardTextInput,
    DashboardTitleBar,
} from '../components/dashboard/DashboardPrimitives';
import { dashboardColorTokens, getDashboardTheme } from '../lib/dashboardTheme';
import { cn } from '../lib/utils';

const nivoDarkTheme = {
    background: 'transparent',
    text: { fontSize: 11, fill: dashboardColorTokens.muted, fontFamily: 'inherit', fontWeight: 300 },
    axis: {
        domain: { line: { stroke: dashboardColorTokens.border, strokeWidth: 1 } },
        ticks: { line: { stroke: dashboardColorTokens.border, strokeWidth: 1 }, text: { fill: dashboardColorTokens.muted, fontSize: 11 } },
        legend: { text: { fill: dashboardColorTokens.muted, fontSize: 12 } },
    },
    grid: { line: { stroke: dashboardColorTokens.border, strokeWidth: 1, strokeDasharray: '4 4' } },
    legends: { text: { fill: dashboardColorTokens.muted, fontSize: 11 } },
    tooltip: {
        container: {
            background: dashboardColorTokens.shell,
            color: '#e4e4e7',
            fontSize: 12,
            borderRadius: '12px',
            boxShadow: '0 18px 45px rgba(8, 10, 24, 0.28)',
            border: `1px solid ${dashboardColorTokens.border}`,
            padding: '8px 12px',
            fontFamily: 'inherit',
            fontWeight: 300,
        },
    },
    crosshair: { line: { stroke: '#ec4899', strokeWidth: 1, strokeOpacity: 0.5 } },
};

const nivoLightTheme = {
    background: 'transparent',
    text: { fontSize: 11, fill: '#71717a' },
    axis: {
        domain: { line: { stroke: '#e4e4e7', strokeWidth: 1 } },
        ticks: { line: { stroke: '#e4e4e7', strokeWidth: 1 }, text: { fill: '#a1a1aa', fontSize: 11 } },
        legend: { text: { fill: '#71717a', fontSize: 12 } },
    },
    grid: { line: { stroke: '#f1f5f9', strokeWidth: 1 } },
    legends: { text: { fill: '#71717a', fontSize: 11 } },
    tooltip: {
        container: {
            background: '#ffffff',
            color: '#334155',
            fontSize: 12,
            borderRadius: '12px',
            boxShadow: '0 12px 30px rgba(15, 23, 42, 0.12)',
            border: '1px solid #e2e8f0',
            padding: '8px 12px',
        },
    },
    crosshair: { line: { stroke: '#6366f1', strokeWidth: 1, strokeOpacity: 0.5 } },
};

const PIE_COLORS_DARK = ['#ec4899', '#f97316', '#f59e0b', '#8b5cf6', '#d946ef', '#06b6d4'];
const PIE_COLORS_LIGHT = ['#4f46e5', '#7c3aed', '#db2777', '#d97706', '#059669', '#0891b2'];

const formatCurrency = (v) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
    return `$${v.toFixed(2)}`;
};

const formatNumber = (v) => {
    if (v === null || v === undefined) return 'Not synced';
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return v.toString();
};

const formatPercent = (v) => {
    if (v === null || v === undefined) return 'Not synced';
    return `${v.toFixed(1)}%`;
};

const analyticsTooltipClass = (isDark) => cn(
    'rounded-md border px-3 py-2 text-xs',
    isDark ? 'border-dashboard-border bg-dashboard-shell text-zinc-100' : 'border-slate-200 bg-white text-slate-700'
);

const KpiCard = ({ label, value, icon: Icon, iconClassName, accent = 'slate', isDark }) => {
    const uiTheme = getDashboardTheme(isDark);

    return (
        <DashboardSurface isDark={isDark} accent={accent} interactive className="p-5">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className={cn('text-[10px] uppercase tracking-[0.16em]', uiTheme.textTertiary)}>{label}</p>
                    <p className={cn('mt-3 text-3xl font-light tracking-tight', uiTheme.textPrimary)}>{value}</p>
                </div>
                <Icon size={24} className={iconClassName} />
            </div>
        </DashboardSurface>
    );
};

const ChartCard = ({ title, description, children, isDark, className = '', colSpan = '', accent = 'slate' }) => {
    const uiTheme = getDashboardTheme(isDark);

    return (
        <DashboardSurface isDark={isDark} accent={accent} className={cn('overflow-hidden', colSpan, className)}>
            <div className="p-5 pb-0">
                <div className={cn('text-[10px] font-light uppercase tracking-[0.16em]', uiTheme.textTertiary)}>
                    {title}
                </div>
                {description ? (
                    <p className={cn('mt-2 text-sm font-light leading-6', uiTheme.textSecondary)}>{description}</p>
                ) : null}
            </div>
            <div className="p-5 pt-4">{children}</div>
        </DashboardSurface>
    );
};

const BlueprintTag = ({ isDark, children }) => (
    <span className={cn(
        'rounded-full px-3 py-1.5 text-xs font-light',
        isDark ? 'border border-dashboard-borderStrong bg-dashboard-panelAlt text-zinc-100' : 'border border-slate-200 bg-white text-slate-700'
    )}>
        {children}
    </span>
);

const InlineEmptyState = ({ isDark, title, description, compact = false }) => (
    <div className={cn('h-full', compact ? 'py-4' : 'py-0')}>
        <DashboardEmptyState
            isDark={isDark}
            compact={compact}
            title={title}
            description={description}
            className="flex h-full flex-col items-center justify-center"
        />
    </div>
);

const createAnalyticsTagId = () => `tag-${Date.now().toString(36)}`;

const buildEmptyTrafficAnalytics = () => ({
    sessions: null,
    visitors: null,
    pageViews: null,
    bounceRate: null,
    visitorsByDay: [],
    channelBreakdown: [],
    deviceBreakdown: [],
});

const buildHeatmapData = (salesByDay) => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
    const grid = {};

    dayNames.forEach((day) => {
        grid[day] = {};
        hours.forEach((hour) => { grid[day][hour] = 0; });
    });

    const hourWeights = [
        0.5, 0.3, 0.2, 0.1, 0.1, 0.2, 0.4, 0.8,
        1.2, 2.0, 3.0, 3.5, 4.0, 3.2, 2.8, 3.0,
        3.5, 4.5, 5.0, 4.8, 4.0, 3.0, 2.0, 1.0,
    ];
    const totalWeight = hourWeights.reduce((a, b) => a + b, 0);

    (salesByDay || []).forEach((entry) => {
        const date = new Date(`${entry.date}T12:00:00Z`);
        const dayName = dayNames[date.getUTCDay()];
        if (!grid[dayName]) return;

        hours.forEach((hour, index) => {
            const portion = (entry.orders || entry.tickets || 1) * (hourWeights[index] / totalWeight);
            grid[dayName][hour] += Math.round(portion * 10) / 10;
        });
    });

    return dayNames.map((day) => ({
        id: day,
        data: hours.map((hour) => ({ x: hour, y: Math.round(grid[day][hour]) })),
    }));
};

const AnalyticsView = ({ isDark, user }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [events, setEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState(() => searchParams.get('eventId') || 'all');
    const [selectedTimeframe, setSelectedTimeframe] = useState('30d');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [salesData, setSalesData] = useState(null);
    const [eventData, setEventData] = useState(null);
    const [customerData, setCustomerData] = useState(null);
    const [organization, setOrganization] = useState(null);
    const [selectedAnalyticsTagId, setSelectedAnalyticsTagId] = useState('');
    const [analyticsTagTitle, setAnalyticsTagTitle] = useState('');
    const [analyticsTagMeasurementId, setAnalyticsTagMeasurementId] = useState('');
    const [isSavingAnalyticsTag, setIsSavingAnalyticsTag] = useState(false);
    const [analyticsTagMessage, setAnalyticsTagMessage] = useState('');

    const chartTheme = isDark ? nivoDarkTheme : nivoLightTheme;
    const uiTheme = getDashboardTheme(isDark);
    const analyticsQuery = useMemo(() => buildAnalyticsQueryString(selectedTimeframe, selectedEventId), [selectedEventId, selectedTimeframe]);

    useEffect(() => {
        const eventIdParam = searchParams.get('eventId') || 'all';
        setSelectedEventId((current) => (current === eventIdParam ? current : eventIdParam));
    }, [searchParams]);

    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true);
            setError(null);
            try {
                const [eventsRes, salesRes, eventsAnalyticsRes, customersRes, organizationRes] = await Promise.all([
                    api.get('/events?limit=100').catch(() => null),
                    api.get(`/analytics/sales${analyticsQuery}`).catch(() => null),
                    api.get(`/analytics/events${analyticsQuery}`).catch(() => null),
                    api.get(`/analytics/customers${analyticsQuery}`).catch(() => null),
                    user?.organizationId ? api.get(`/organizations/${user.organizationId}`).catch(() => null) : Promise.resolve(null),
                ]);

                const eventsPayload = eventsRes?.data?.data || eventsRes?.data || {};
                const eventsList = eventsPayload?.events || (Array.isArray(eventsPayload) ? eventsPayload : []);
                const organizationPayload = organizationRes?.data?.data || organizationRes?.data || null;
                setEvents(eventsList);
                setSalesData(salesRes?.data?.data || salesRes?.data || null);
                setEventData(eventsAnalyticsRes?.data?.data || eventsAnalyticsRes?.data || null);
                setCustomerData(customersRes?.data?.data || customersRes?.data || null);
                setOrganization(organizationPayload);
            } catch (requestError) {
                setError('Failed to load analytics data. Please try again.');
                console.error(requestError);
            } finally {
                setLoading(false);
            }
        };

        fetchAll();
    }, [analyticsQuery, refreshKey, user?.organizationId]);

    const filteredSalesData = useMemo(() => {
        if (!salesData || selectedEventId === 'all') return salesData;
        const eventSales = salesData.salesByEvent?.find((event) => event.eventId === selectedEventId);

        if (!eventSales) {
            return { totalRevenue: 0, totalOrders: 0, totalTicketsSold: 0, averageOrderValue: 0, salesByDay: [], salesByEvent: [] };
        }

        return {
            totalRevenue: eventSales.revenue,
            totalOrders: eventSales.orders,
            totalTicketsSold: eventSales.ticketsSold,
            averageOrderValue: eventSales.orders > 0 ? eventSales.revenue / eventSales.orders : 0,
            salesByDay: salesData.salesByDay,
            salesByEvent: [eventSales],
        };
    }, [salesData, selectedEventId]);

    const filteredEventData = useMemo(() => {
        if (!eventData || selectedEventId === 'all') return eventData;
        const filtered = eventData.topEvents?.filter((event) => event.id === selectedEventId) || [];
        return { ...eventData, topEvents: filtered };
    }, [eventData, selectedEventId]);

    const revenueLineData = useMemo(() => {
        if (!filteredSalesData?.salesByDay?.length) return [];
        return [{
            id: 'Revenue',
            color: '#6366f1',
            data: filteredSalesData.salesByDay.map((day) => ({
                x: day.date,
                y: day.revenue,
            })),
        }];
    }, [filteredSalesData]);

    const ticketPieData = useMemo(() => {
        const topEvents = filteredEventData?.topEvents;
        if (!topEvents?.length) return [];
        return topEvents.slice(0, 6).map((event, index) => ({
            id: event.name.length > 20 ? `${event.name.substring(0, 18)}…` : event.name,
            label: event.name,
            value: event.ticketsSold,
            color: (isDark ? PIE_COLORS_DARK : PIE_COLORS_LIGHT)[index % 6],
        }));
    }, [filteredEventData, isDark]);

    const topEventsBarData = useMemo(() => {
        const topEvents = filteredEventData?.topEvents;
        if (!topEvents?.length) return [];
        return topEvents.slice(0, 8).reverse().map((event) => ({
            event: event.name.length > 25 ? `${event.name.substring(0, 23)}…` : event.name,
            revenue: event.revenue,
            tickets: event.ticketsSold,
        }));
    }, [filteredEventData]);

    const customerSparkData = useMemo(() => {
        if (!customerData?.customersByRegistrationDate?.length) return [];
        return [{
            id: 'Customers',
            color: '#10b981',
            data: customerData.customersByRegistrationDate.map((day) => ({
                x: day.date,
                y: day.count,
            })),
        }];
    }, [customerData]);

    const heatmapData = useMemo(() => {
        if (!filteredSalesData?.salesByDay?.length) return [];
        return buildHeatmapData(filteredSalesData.salesByDay);
    }, [filteredSalesData]);

    const trafficData = useMemo(() => buildEmptyTrafficAnalytics(), [selectedAnalyticsTagId]);

    const visitorsLineData = useMemo(() => {
        if (!trafficData.visitorsByDay?.length) return [];
        return [{
            id: 'Visitors',
            color: '#06b6d4',
            data: trafficData.visitorsByDay.map((day) => ({
                x: day.date,
                y: day.visitors,
            })),
        }];
    }, [trafficData]);

    const trafficChannelData = useMemo(() => trafficData.channelBreakdown || [], [trafficData]);
    const trafficDeviceData = useMemo(() => trafficData.deviceBreakdown || [], [trafficData]);

    const selectedEventName = selectedEventId === 'all'
        ? 'All Events'
        : events.find((event) => event.id === selectedEventId)?.name || 'Selected Event';
    const selectedEventLabel = selectedEventName.length > 32
        ? `${selectedEventName.slice(0, 29)}...`
        : selectedEventName;
    const selectedEvent = selectedEventId === 'all'
        ? null
        : events.find((event) => event.id === selectedEventId) || null;
    const analyticsTags = useMemo(() => normalizeOrganizationGoogleAnalyticsTags(organization), [organization]);
    const selectedAnalyticsTag = useMemo(
        () => analyticsTags.find((tag) => tag.id === selectedAnalyticsTagId) || analyticsTags[0] || null,
        [analyticsTags, selectedAnalyticsTagId]
    );
    const googleAnalyticsMeta = useMemo(
        () => {
            const meta = organization
                ? getOrganizationGoogleAnalyticsIntegrationMeta(organization, selectedAnalyticsTag)
                : getGoogleAnalyticsIntegrationMeta();

            const measurementId = analyticsTagMeasurementId.trim() || meta.measurementId;
            return {
                ...meta,
                measurementId,
                eventMeasurementId: measurementId,
                tagTitle: analyticsTagTitle.trim() || meta.tagTitle,
                connected: Boolean(measurementId || meta.propertyId),
                statusLabel: measurementId || meta.propertyId ? 'Organization GA tag selected' : 'Organization GA tag needed',
            };
        },
        [analyticsTagMeasurementId, analyticsTagTitle, organization, selectedAnalyticsTag]
    );

    useEffect(() => {
        if (!organization) {
            setSelectedAnalyticsTagId('');
            setAnalyticsTagTitle('');
            setAnalyticsTagMeasurementId('');
            setAnalyticsTagMessage('');
            return;
        }

        const requestedTagId = searchParams.get('tagId');
        const requestedUnsavedTag = requestedTagId && requestedTagId === selectedAnalyticsTagId
            && !analyticsTags.some((tag) => tag.id === requestedTagId);

        if (requestedUnsavedTag) {
            return;
        }

        const nextTag = analyticsTags.find((tag) => tag.id === requestedTagId)
            || analyticsTags.find((tag) => tag.id === selectedAnalyticsTagId)
            || analyticsTags[0]
            || { id: '', title: '', measurementId: '' };

        setSelectedAnalyticsTagId(nextTag.id);
        setAnalyticsTagTitle(nextTag.title);
        setAnalyticsTagMeasurementId(nextTag.measurementId);
        setAnalyticsTagMessage('');
    }, [analyticsTags, organization, searchParams, selectedAnalyticsTagId]);

    const handleEventSelection = (eventId) => {
        setSelectedEventId(eventId);
        setIsDropdownOpen(false);
        const nextParams = new URLSearchParams(searchParams);

        if (eventId === 'all') {
            nextParams.delete('eventId');
            nextParams.delete('tagId');
        } else {
            nextParams.set('eventId', eventId);
        }

        setSearchParams(nextParams, { replace: true });
    };

    const handleAnalyticsTagSelection = (tagId) => {
        const nextTag = analyticsTags.find((tag) => tag.id === tagId);
        setSelectedAnalyticsTagId(tagId);
        setAnalyticsTagTitle(nextTag?.title || '');
        setAnalyticsTagMeasurementId(nextTag?.measurementId || '');
        setAnalyticsTagMessage('');

        const nextParams = new URLSearchParams(searchParams);
        if (tagId) {
            nextParams.set('tagId', tagId);
        } else {
            nextParams.delete('tagId');
        }
        setSearchParams(nextParams, { replace: true });
    };

    const handleAddAnalyticsTag = () => {
        if (!organization) {
            setAnalyticsTagMessage('Your organization profile is required before adding a GA tag.');
            return;
        }

        const tagId = createAnalyticsTagId();
        setSelectedAnalyticsTagId(tagId);
        setAnalyticsTagTitle('');
        setAnalyticsTagMeasurementId('');
        setAnalyticsTagMessage('');

        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('tagId', tagId);
        setSearchParams(nextParams, { replace: true });
    };

    const handleSaveAnalyticsTag = async () => {
        if (!organization) {
            setAnalyticsTagMessage('Your organization profile is required before adding a GA tag.');
            return;
        }

        const title = analyticsTagTitle.trim();
        const measurementId = analyticsTagMeasurementId.trim();

        if (!title || !measurementId) {
            setAnalyticsTagMessage('Add a tag title and GA measurement ID.');
            return;
        }

        setIsSavingAnalyticsTag(true);
        setAnalyticsTagMessage('');

        const tagId = selectedAnalyticsTagId || createAnalyticsTagId();
        const nextTag = { id: tagId, title, measurementId };
        const nextTags = [
            ...analyticsTags.filter((tag) => tag.id !== tagId),
            nextTag,
        ];
        const settings = {
            ...(organization.settings || {}),
            [ORGANIZATION_GOOGLE_ANALYTICS_TAGS_KEY]: nextTags,
            [ORGANIZATION_SELECTED_GOOGLE_ANALYTICS_TAG_ID_KEY]: tagId,
        };

        try {
            const response = await api.put(`/organizations/${organization.id}`, { settings });
            const updatedOrganization = response.data?.data || response.data?.organization || response.data;

            if (updatedOrganization?.id) {
                setOrganization(updatedOrganization);
            }

            setSelectedAnalyticsTagId(tagId);
            setAnalyticsTagMessage('GA tag saved.');
        } catch (requestError) {
            console.error('Failed to save GA tag', requestError);
            setAnalyticsTagMessage(requestError.response?.data?.message || 'Could not save this GA tag.');
        } finally {
            setIsSavingAnalyticsTag(false);
        }
    };

    if (loading) {
        return (
            <DashboardPage className="mx-auto max-w-[1400px]">
                <DashboardEmptyState
                    isDark={isDark}
                    title="Loading analytics"
                    description="Pulling revenue, event, and customer data into the shared analytics workspace."
                    action={<Loader2 size={18} className="animate-spin" />}
                />
            </DashboardPage>
        );
    }

    if (error) {
        return (
            <DashboardPage className="mx-auto max-w-[1400px]">
                <DashboardEmptyState
                    isDark={isDark}
                    title="Analytics unavailable"
                    description={error}
                    action={(
                        <DashboardButton isDark={isDark} onClick={() => setRefreshKey((current) => current + 1)}>
                            <RefreshCcw size={16} />
                            Retry
                        </DashboardButton>
                    )}
                />
            </DashboardPage>
        );
    }

    return (
        <DashboardPage className="mx-auto max-w-[1400px]">
            <DashboardTitleBar
                isDark={isDark}
                title="Analytics"
                description="Review Tixmo commerce reporting separately from GA4 web-traffic readiness."
                icon={BarChart3}
                iconClassName={isDark ? 'text-cyan-300' : 'text-sky-700'}
                glowTopClassName="bg-cyan-400/10"
                glowBottomClassName="bg-sky-500/10"
                badges={(
                    <DashboardChip
                        isDark={isDark}
                        className={cn(
                            'gap-2 border',
                            googleAnalyticsMeta.connected
                                ? (isDark ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700')
                                : (isDark ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-amber-200 bg-amber-50 text-amber-700')
                        )}
                    >
                        <Link2 size={14} />
                        {googleAnalyticsMeta.statusLabel}
                    </DashboardChip>
                )}
            />

            <DashboardSection
                isDark={isDark}
                accent="violet"
                title="GA4 readiness"
                description="Manage organization-level GA tags for traffic reporting. Event selection still filters the commerce charts below."
                actions={(
                    <DashboardButton isDark={isDark} variant="secondary" onClick={() => setRefreshKey((current) => current + 1)}>
                        <RefreshCcw size={16} />
                        Refresh data
                    </DashboardButton>
                )}
            >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <DashboardStat isDark={isDark} label="Traffic source" value={googleAnalyticsMeta.label} detail="GA4 web metrics only" />
                    <DashboardStat isDark={isDark} label="Sales scope" value={selectedEventLabel} detail={selectedEvent ? 'Selected Tixmo event' : 'All Tixmo events'} />
                    <DashboardStat isDark={isDark} label="Property ID" value={googleAnalyticsMeta.propertyId || 'Not configured'} detail="GA property target" />
                    <DashboardStat
                        isDark={isDark}
                        label="Measurement ID"
                        value={googleAnalyticsMeta.measurementId || 'Not configured'}
                        detail={selectedAnalyticsTag ? 'Organization tag' : 'Global web stream'}
                    />
                </div>

                <DashboardSurface isDark={isDark} accent="blue" className="mt-4 p-4 sm:p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <p className={cn('text-[10px] uppercase tracking-[0.16em]', uiTheme.textTertiary)}>GA tags</p>
                            <h3 className={cn('mt-2 text-lg font-light tracking-tight', uiTheme.textPrimary)}>
                                {organization?.name || 'Organization tags'}
                            </h3>
                        </div>
                        <DashboardButton
                            isDark={isDark}
                            variant="secondary"
                            onClick={handleAddAnalyticsTag}
                        >
                            <Plus size={16} />
                            Add Tag
                        </DashboardButton>
                    </div>

                    <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(180px,0.75fr)_minmax(180px,1fr)_minmax(220px,1fr)_auto] xl:items-end">
                        <label className="block">
                            <span className={cn('text-xs uppercase tracking-[0.16em]', uiTheme.textTertiary)}>Switch tag</span>
                            <DashboardSelect
                                isDark={isDark}
                                className="mt-2"
                                value={selectedAnalyticsTagId}
                                onChange={(event) => handleAnalyticsTagSelection(event.target.value)}
                                disabled={!organization || analyticsTags.length === 0}
                            >
                                {analyticsTags.length === 0 ? (
                                    <option value="">No tags yet</option>
                                ) : analyticsTags.map((tag) => (
                                    <option key={tag.id} value={tag.id}>{tag.title}</option>
                                ))}
                            </DashboardSelect>
                        </label>
                        <label className="block">
                            <span className={cn('text-xs uppercase tracking-[0.16em]', uiTheme.textTertiary)}>Title</span>
                            <DashboardTextInput
                                isDark={isDark}
                                className="mt-2"
                                placeholder="Festival web tag"
                                value={analyticsTagTitle}
                                onChange={(event) => {
                                    setAnalyticsTagTitle(event.target.value);
                                    setAnalyticsTagMessage('');
                                }}
                                disabled={!organization}
                            />
                        </label>
                        <label className="block">
                            <span className={cn('text-xs uppercase tracking-[0.16em]', uiTheme.textTertiary)}>GA measurement ID</span>
                            <DashboardTextInput
                                isDark={isDark}
                                className="mt-2"
                                placeholder="G-XXXXXXXXXX"
                                value={analyticsTagMeasurementId}
                                onChange={(event) => {
                                    setAnalyticsTagMeasurementId(event.target.value);
                                    setAnalyticsTagMessage('');
                                }}
                                disabled={!organization}
                            />
                        </label>
                        <DashboardButton
                            isDark={isDark}
                            onClick={handleSaveAnalyticsTag}
                            disabled={!organization || isSavingAnalyticsTag}
                        >
                            {isSavingAnalyticsTag ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Save Tag
                        </DashboardButton>
                    </div>

                    {analyticsTagMessage ? (
                        <p className={cn(
                            'mt-3 text-sm font-light',
                            analyticsTagMessage.includes('saved') ? (isDark ? 'text-emerald-300' : 'text-emerald-700') : (isDark ? 'text-rose-300' : 'text-rose-700')
                        )}>
                            {analyticsTagMessage}
                        </p>
                    ) : null}
                </DashboardSurface>

                <DashboardSurface isDark={isDark} accent="slate" className="mt-4 p-4 sm:p-5">
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                        <div>
                            <p className={cn('text-[10px] uppercase tracking-[0.16em]', uiTheme.textTertiary)}>GA4 metric blueprint</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {GOOGLE_ANALYTICS_METRIC_BLUEPRINT.map((item) => (
                                    <BlueprintTag key={item} isDark={isDark}>{item}</BlueprintTag>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className={cn('text-[10px] uppercase tracking-[0.16em]', uiTheme.textTertiary)}>Dimension blueprint</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {GOOGLE_ANALYTICS_DIMENSION_BLUEPRINT.map((item) => (
                                    <BlueprintTag key={item} isDark={isDark}>{item}</BlueprintTag>
                                ))}
                            </div>
                        </div>
                    </div>
                </DashboardSurface>
            </DashboardSection>

            <section className="space-y-5" aria-labelledby="web-traffic-title">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h2 id="web-traffic-title" className={cn('text-[1.35rem] font-light tracking-tight', uiTheme.textPrimary)}>
                            Web traffic (GA4)
                        </h2>
                        <p className={cn('mt-2 max-w-2xl text-sm font-light leading-6', uiTheme.textSecondary)}>
                            Visitor, session, page-view, channel, and device metrics come from the selected Google Analytics tag.
                        </p>
                    </div>
                    <DashboardChip isDark={isDark}>Traffic source</DashboardChip>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <KpiCard label="Visitors" value={formatNumber(trafficData.visitors)} icon={Users} accent="blue" iconClassName="text-cyan-300" isDark={isDark} />
                    <KpiCard label="Sessions" value={formatNumber(trafficData.sessions)} icon={MousePointerClick} accent="violet" iconClassName="text-violet-300" isDark={isDark} />
                    <KpiCard label="Page Views" value={formatNumber(trafficData.pageViews)} icon={Eye} accent="brand" iconClassName="text-pink-400" isDark={isDark} />
                    <KpiCard label="Bounce Rate" value={formatPercent(trafficData.bounceRate)} icon={TrendingUp} accent="amber" iconClassName="text-orange-300" isDark={isDark} />
                </div>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                    <ChartCard
                        title="Visitors over time"
                        description="Standard GA4 traffic data for the selected organization tag."
                        isDark={isDark}
                        colSpan="lg:col-span-2"
                        accent="blue"
                    >
                        <div className="h-[300px]">
                            {visitorsLineData.length > 0 ? (
                                <ResponsiveLine
                                    data={visitorsLineData}
                                    theme={chartTheme}
                                    margin={{ top: 20, right: 20, bottom: 50, left: 56 }}
                                    xScale={{ type: 'point' }}
                                    yScale={{ type: 'linear', min: 0, max: 'auto', stacked: false }}
                                    curve="catmullRom"
                                    axisBottom={{
                                        tickSize: 0,
                                        tickPadding: 12,
                                        tickRotation: -45,
                                        format: (value) => value.substring(5),
                                    }}
                                    axisLeft={{
                                        tickSize: 0,
                                        tickPadding: 8,
                                        format: (value) => formatNumber(value),
                                    }}
                                    enableArea
                                    areaOpacity={0.12}
                                    colors={['#06b6d4']}
                                    lineWidth={2.5}
                                    pointSize={5}
                                    pointColor={isDark ? dashboardColorTokens.panel : '#ffffff'}
                                    pointBorderWidth={2}
                                    pointBorderColor="#06b6d4"
                                    useMesh
                                    tooltip={({ point }) => (
                                        <div className={analyticsTooltipClass(isDark)}>
                                            <strong>{point.data.xFormatted}</strong>
                                            <div className="mt-1">{formatNumber(point.data.y)} visitors</div>
                                        </div>
                                    )}
                                />
                            ) : (
                                <InlineEmptyState
                                    isDark={isDark}
                                    title={selectedAnalyticsTag ? 'Traffic data not synced' : 'Select a GA tag'}
                                    description={selectedAnalyticsTag ? 'This dashboard is ready for visitors, sessions, page views, and channel data once GA4 reporting is connected.' : 'Add or select an organization GA tag to prepare traffic reporting.'}
                                />
                            )}
                        </div>
                    </ChartCard>

                    <ChartCard title="Traffic channels" isDark={isDark} accent="green">
                        <div className="h-[300px]">
                            {trafficChannelData.length > 0 ? (
                                <ResponsivePie
                                    data={trafficChannelData}
                                    theme={chartTheme}
                                    margin={{ top: 20, right: 20, bottom: 40, left: 20 }}
                                    innerRadius={0.6}
                                    padAngle={2}
                                    cornerRadius={4}
                                    colors={{ datum: 'data.color' }}
                                    enableArcLinkLabels={false}
                                    tooltip={({ datum }) => (
                                        <div className={analyticsTooltipClass(isDark)}>
                                            <strong>{datum.label}</strong>
                                            <div className="mt-1">{formatNumber(datum.value)} sessions</div>
                                        </div>
                                    )}
                                />
                            ) : (
                                <InlineEmptyState isDark={isDark} title="No channel data" description="Organic, direct, referral, social, and paid channels will appear here after GA4 data is available." compact />
                            )}
                        </div>
                    </ChartCard>
                </div>

                <ChartCard
                    title="Device traffic"
                    description="Visitors split by device category for the selected organization GA tag."
                    isDark={isDark}
                    accent="slate"
                >
                    <div className="h-[260px]">
                        {trafficDeviceData.length > 0 ? (
                            <ResponsiveBar
                                data={trafficDeviceData}
                                theme={chartTheme}
                                keys={['sessions']}
                                indexBy="device"
                                margin={{ top: 10, right: 30, bottom: 45, left: 56 }}
                                padding={0.35}
                                colors={['#8b5cf6']}
                                borderRadius={0}
                                axisBottom={{ tickSize: 0, tickPadding: 10 }}
                                axisLeft={{ tickSize: 0, tickPadding: 8, format: (value) => formatNumber(value) }}
                                enableGridY
                                tooltip={({ indexValue, value }) => (
                                    <div className={analyticsTooltipClass(isDark)}>
                                        <strong>{indexValue}</strong>
                                        <div className="mt-1">{formatNumber(value)} sessions</div>
                                    </div>
                                )}
                            />
                        ) : (
                            <InlineEmptyState isDark={isDark} title="No device data" description="Desktop, mobile, and tablet traffic will populate once GA4 reporting is connected." />
                        )}
                    </div>
                </ChartCard>
            </section>

            <section className="space-y-5" aria-labelledby="ticket-sales-title">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h2 id="ticket-sales-title" className={cn('text-[1.35rem] font-light tracking-tight', uiTheme.textPrimary)}>
                            Ticket sales (Tixmo data)
                        </h2>
                        <p className={cn('mt-2 max-w-2xl text-sm font-light leading-6', uiTheme.textSecondary)}>
                            Revenue, orders, tickets, customers, and purchase timing come from Tixmo orders and event records.
                        </p>
                    </div>
                    <DashboardChip isDark={isDark}>{selectedEventLabel}</DashboardChip>
                </div>

                <DashboardSurface isDark={isDark} accent="blue" className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className={cn('inline-flex flex-wrap gap-2 rounded-md border p-1', isDark ? 'border-dashboard-borderStrong bg-dashboard-panelMuted' : 'border-slate-200 bg-slate-50')}>
                        {ANALYTICS_TIMEFRAMES.map((timeframe) => (
                            <button
                                key={timeframe.id}
                                type="button"
                                onClick={() => setSelectedTimeframe(timeframe.id)}
                                className={cn(
                                    'rounded-md px-4 py-2 text-sm font-light transition-colors',
                                    selectedTimeframe === timeframe.id
                                        ? (isDark ? 'bg-dashboard-panelAlt text-zinc-100' : 'bg-white text-slate-900 shadow-sm')
                                        : uiTheme.textTertiary
                                )}
                            >
                                {timeframe.label}
                            </button>
                        ))}
                    </div>

                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setIsDropdownOpen((current) => !current)}
                            className={cn(
                                'flex min-w-[220px] items-center justify-between gap-3 rounded-md border px-4 py-2.5 text-sm font-light transition-colors',
                                uiTheme.panel,
                                isDark ? 'hover:bg-dashboard-panelAlt' : 'hover:bg-slate-50'
                            )}
                        >
                            <span className="truncate">{selectedEventName}</span>
                            <ChevronDown size={16} className={cn('transition-transform duration-200', isDropdownOpen ? 'rotate-180' : '', uiTheme.textTertiary)} />
                        </button>

                        {isDropdownOpen ? (
                            <>
                                <div className="fixed inset-0 z-30" onClick={() => setIsDropdownOpen(false)} />
                                <DashboardSurface
                                    isDark={isDark}
                                    accent="blue"
                                    className={cn('absolute right-0 z-40 mt-2 max-h-80 w-72 overflow-y-auto', isDark ? 'bg-dashboard-shell' : 'bg-white')}
                                >
                                    <button
                                        type="button"
                                        onClick={() => handleEventSelection('all')}
                                        className={cn(
                                            'w-full px-4 py-3 text-left text-sm font-light transition-colors',
                                            selectedEventId === 'all'
                                                ? (isDark ? 'bg-white/10 text-zinc-100' : 'bg-slate-100 text-slate-900')
                                                : (isDark ? 'text-zinc-300 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-50')
                                        )}
                                    >
                                        <span className="font-medium">All Events</span>
                                        <span className={cn('mt-0.5 block text-xs', uiTheme.textTertiary)}>Aggregate view</span>
                                    </button>
                                    <div className={cn('border-t', uiTheme.divider)} />
                                    {events.map((event) => (
                                        <button
                                            key={event.id}
                                            type="button"
                                            onClick={() => handleEventSelection(event.id)}
                                            className={cn(
                                                'w-full px-4 py-2.5 text-left text-sm transition-colors',
                                                selectedEventId === event.id
                                                    ? (isDark ? 'bg-sky-500/15 text-sky-200' : 'bg-sky-50 text-sky-700')
                                                    : (isDark ? 'text-zinc-300 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-50')
                                            )}
                                        >
                                            <span className="block truncate">{event.name}</span>
                                            {event.status ? <span className={cn('text-xs', uiTheme.textTertiary)}>{event.status}</span> : null}
                                        </button>
                                    ))}
                                    {events.length === 0 ? (
                                        <div className={cn('px-4 py-3 text-xs', uiTheme.textTertiary)}>No events found</div>
                                    ) : null}
                                </DashboardSurface>
                            </>
                        ) : null}
                    </div>
                </div>
                </DashboardSurface>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard label="Total Revenue" value={formatCurrency(filteredSalesData?.totalRevenue || 0)} icon={DollarSign} accent="violet" iconClassName="text-indigo-400" isDark={isDark} />
                <KpiCard label="Tickets Sold" value={formatNumber(filteredSalesData?.totalTicketsSold || 0)} icon={Ticket} accent="brand" iconClassName="text-pink-400" isDark={isDark} />
                <KpiCard label="Total Orders" value={formatNumber(filteredSalesData?.totalOrders || 0)} icon={ShoppingCart} accent="violet" iconClassName="text-fuchsia-400" isDark={isDark} />
                <KpiCard label="Avg Order Value" value={formatCurrency(filteredSalesData?.averageOrderValue || 0)} icon={TrendingUp} accent="green" iconClassName="text-emerald-400" isDark={isDark} />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <ChartCard title="Revenue over time" isDark={isDark} colSpan="lg:col-span-2" accent="violet">
                    <div className="h-[320px]">
                        {revenueLineData.length > 0 ? (
                            <ResponsiveLine
                                data={revenueLineData}
                                theme={chartTheme}
                                margin={{ top: 20, right: 20, bottom: 50, left: 60 }}
                                xScale={{ type: 'point' }}
                                yScale={{ type: 'linear', min: 'auto', max: 'auto', stacked: false }}
                                curve="catmullRom"
                                axisBottom={{
                                    tickSize: 0,
                                    tickPadding: 12,
                                    tickRotation: -45,
                                    format: (value) => value.substring(5),
                                }}
                                axisLeft={{
                                    tickSize: 0,
                                    tickPadding: 8,
                                    format: (value) => formatCurrency(value),
                                }}
                                enableArea
                                areaOpacity={0.15}
                                areaBaselineValue={0}
                                colors={['#ec4899']}
                                lineWidth={2.5}
                                pointSize={6}
                                pointColor={isDark ? dashboardColorTokens.panel : '#ffffff'}
                                pointBorderWidth={2.5}
                                pointBorderColor="#ec4899"
                                enableCrosshair
                                useMesh
                                defs={[
                                    {
                                        id: 'areaGradient',
                                        type: 'linearGradient',
                                        colors: [
                                            { offset: 0, color: '#6366f1', opacity: 0.4 },
                                            { offset: 100, color: '#6366f1', opacity: 0 },
                                        ],
                                    },
                                ]}
                                fill={[{ match: '*', id: 'areaGradient' }]}
                                tooltip={({ point }) => (
                                    <div className={analyticsTooltipClass(isDark)}>
                                        <strong>{point.data.xFormatted}</strong>
                                        <div className="mt-1">{formatCurrency(point.data.y)}</div>
                                    </div>
                                )}
                            />
                        ) : (
                            <InlineEmptyState isDark={isDark} title="No revenue data" description="Sales activity will appear here once analytics data is available." />
                        )}
                    </div>
                </ChartCard>

                <ChartCard title="Ticket distribution" isDark={isDark} accent="brand">
                    <div className="h-[320px]">
                        {ticketPieData.length > 0 ? (
                            <ResponsivePie
                                data={ticketPieData}
                                theme={chartTheme}
                                margin={{ top: 20, right: 20, bottom: 40, left: 20 }}
                                innerRadius={0.6}
                                padAngle={2}
                                cornerRadius={4}
                                activeOuterRadiusOffset={6}
                                colors={{ datum: 'data.color' }}
                                borderWidth={0}
                                enableArcLinkLabels={false}
                                arcLabelsSkipAngle={20}
                                arcLabelsTextColor={isDark ? '#e4e4e7' : '#ffffff'}
                                arcLabel={(datum) => formatNumber(datum.value)}
                                motionConfig="gentle"
                                transitionMode="startAngle"
                                legends={[
                                    {
                                        anchor: 'bottom',
                                        direction: 'row',
                                        translateY: 36,
                                        itemWidth: 70,
                                        itemHeight: 14,
                                        itemTextColor: isDark ? '#a1a1aa' : '#71717a',
                                        symbolSize: 8,
                                        symbolShape: 'circle',
                                    },
                                ]}
                                tooltip={({ datum }) => (
                                    <div className={analyticsTooltipClass(isDark)}>
                                        <strong>{datum.label}</strong>
                                        <div className="mt-1">{formatNumber(datum.value)} tickets</div>
                                    </div>
                                )}
                            />
                        ) : (
                            <InlineEmptyState isDark={isDark} title="No ticket data" description="Ticket distribution appears once event totals are available." />
                        )}
                    </div>
                </ChartCard>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <ChartCard title="Top events by revenue" isDark={isDark} colSpan="lg:col-span-2" accent="brand">
                    <div className="h-[340px]">
                        {topEventsBarData.length > 0 ? (
                            <ResponsiveBar
                                data={topEventsBarData}
                                theme={chartTheme}
                                keys={['revenue']}
                                indexBy="event"
                                layout="horizontal"
                                margin={{ top: 10, right: 30, bottom: 40, left: 160 }}
                                padding={0.35}
                                valueScale={{ type: 'linear' }}
                                colors={['#ec4899']}
                                borderRadius={0}
                                borderWidth={0}
                                enableLabel
                                label={(datum) => formatCurrency(datum.value)}
                                labelTextColor="#e4e4e7"
                                labelSkipWidth={60}
                                axisLeft={{ tickSize: 0, tickPadding: 8 }}
                                axisBottom={{ tickSize: 0, tickPadding: 8, format: (value) => formatCurrency(value) }}
                                enableGridX
                                enableGridY={false}
                                motionConfig="gentle"
                                tooltip={({ indexValue, value }) => (
                                    <div className={analyticsTooltipClass(isDark)}>
                                        <strong>{indexValue}</strong>
                                        <div className="mt-1">{formatCurrency(value)}</div>
                                    </div>
                                )}
                            />
                        ) : (
                            <InlineEmptyState isDark={isDark} title="No event revenue data" description="Revenue rankings will populate after event analytics are synced." />
                        )}
                    </div>
                </ChartCard>

                <ChartCard title="New customers" isDark={isDark} accent="green">
                    <div className="flex h-[340px] flex-col">
                        <div className="mb-4 grid grid-cols-2 gap-3">
                            <DashboardStat isDark={isDark} label="Total" value={formatNumber(customerData?.totalCustomers || 0)} />
                            <DashboardStat isDark={isDark} label="Repeat" value={formatNumber(customerData?.repeatCustomers || 0)} />
                        </div>
                        <div className="min-h-0 flex-1">
                            {customerSparkData.length > 0 ? (
                                <ResponsiveLine
                                    data={customerSparkData}
                                    theme={chartTheme}
                                    margin={{ top: 5, right: 5, bottom: 25, left: 5 }}
                                    xScale={{ type: 'point' }}
                                    yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
                                    curve="natural"
                                    enableArea
                                    areaOpacity={0.15}
                                    colors={['#10b981']}
                                    lineWidth={2}
                                    pointSize={0}
                                    enableGridX={false}
                                    enableGridY={false}
                                    axisLeft={null}
                                    axisBottom={null}
                                    enableCrosshair={false}
                                    useMesh
                                    defs={[
                                        {
                                            id: 'customerGradient',
                                            type: 'linearGradient',
                                            colors: [
                                                { offset: 0, color: '#10b981', opacity: 0.3 },
                                                { offset: 100, color: '#10b981', opacity: 0 },
                                            ],
                                        },
                                    ]}
                                    fill={[{ match: '*', id: 'customerGradient' }]}
                                    tooltip={({ point }) => (
                                        <div className={analyticsTooltipClass(isDark)}>
                                            <strong>{point.data.xFormatted}</strong>
                                            <div className="mt-1">{point.data.y} new customers</div>
                                        </div>
                                    )}
                                />
                            ) : (
                                <InlineEmptyState isDark={isDark} title="No customer data" description="Customer acquisition will populate once registrations are available." compact />
                            )}
                        </div>
                    </div>
                </ChartCard>
            </div>

            <ChartCard
                title={(
                    <span className="flex items-center gap-2">
                        <Flame size={15} className="text-orange-400" />
                        Purchase activity heatmap
                        <span className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            isDark ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-100 text-orange-700'
                        )}>
                            NEW
                        </span>
                    </span>
                )}
                description="Shows when customers are most active so campaign pacing and ticket drops can align with peak windows."
                isDark={isDark}
                accent="amber"
            >
                <div className="h-[280px]">
                    {heatmapData.length > 0 ? (
                        <ResponsiveHeatMap
                            data={heatmapData}
                            theme={chartTheme}
                            margin={{ top: 30, right: 30, bottom: 10, left: 50 }}
                            axisTop={{
                                tickSize: 0,
                                tickPadding: 8,
                                tickRotation: -45,
                                format: (value) => value.replace(':00', 'h'),
                            }}
                            axisLeft={{
                                tickSize: 0,
                                tickPadding: 8,
                            }}
                            colors={{
                                type: 'sequential',
                                scheme: 'purples',
                                minValue: 0,
                            }}
                            emptyColor={isDark ? dashboardColorTokens.shell : '#f8fafc'}
                            borderRadius={0}
                            borderWidth={1}
                            borderColor={isDark ? dashboardColorTokens.border : '#e2e8f0'}
                            opacity={0.95}
                            inactiveOpacity={0.35}
                            activeOpacity={1}
                            hoverTarget="cell"
                            cellComponent="rect"
                            labelTextColor={({ value }) => (value > 3 ? '#e4e4e7' : 'transparent')}
                            legends={[
                                {
                                    anchor: 'right',
                                    translateX: 30,
                                    length: 200,
                                    thickness: 10,
                                    direction: 'column',
                                    tickPosition: 'after',
                                    tickSize: 3,
                                    tickSpacing: 4,
                                    title: 'Activity →',
                                    titleAlign: 'start',
                                    titleOffset: 4,
                                },
                            ]}
                            tooltip={({ cell }) => (
                                <div className={analyticsTooltipClass(isDark)}>
                                    <strong>{cell.serieId} @ {cell.data.x}</strong>
                                    <div className="mt-1">{cell.formattedValue} purchases</div>
                                </div>
                            )}
                        />
                    ) : (
                        <InlineEmptyState isDark={isDark} title="Heatmap not ready" description="More sales activity is needed before the activity map becomes useful." />
                    )}
                </div>
            </ChartCard>
            </section>
        </DashboardPage>
    );
};

export default AnalyticsView;
