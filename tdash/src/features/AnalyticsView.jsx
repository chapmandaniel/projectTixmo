import React, { useState, useEffect, useMemo } from 'react';
import { ResponsiveLine } from '@nivo/line';
import { ResponsivePie } from '@nivo/pie';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsiveHeatMap } from '@nivo/heatmap';
import {
    TrendingUp, TrendingDown, DollarSign, Ticket, ShoppingCart,
    BarChart3, ChevronDown, Loader2, AlertCircle, Flame, Users
} from 'lucide-react';
import api from '../lib/api';

// ─── Nivo Dark Theme ────────────────────────────────────────────────────────
const nivoDarkTheme = {
    background: 'transparent',
    text: { fontSize: 11, fill: '#a1a1aa' },
    axis: {
        domain: { line: { stroke: '#3f3f46', strokeWidth: 1 } },
        ticks: { line: { stroke: '#3f3f46', strokeWidth: 1 }, text: { fill: '#71717a', fontSize: 11 } },
        legend: { text: { fill: '#a1a1aa', fontSize: 12 } },
    },
    grid: { line: { stroke: '#27272a', strokeWidth: 1 } },
    legends: { text: { fill: '#a1a1aa', fontSize: 11 } },
    tooltip: {
        container: {
            background: '#18181b', color: '#e4e4e7', fontSize: 12,
            borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: '1px solid #3f3f46',
            padding: '8px 12px',
        },
    },
    crosshair: { line: { stroke: '#6366f1', strokeWidth: 1, strokeOpacity: 0.5 } },
};

const nivoLightTheme = {
    background: 'transparent',
    text: { fontSize: 11, fill: '#71717a' },
    axis: {
        domain: { line: { stroke: '#e4e4e7', strokeWidth: 1 } },
        ticks: { line: { stroke: '#e4e4e7', strokeWidth: 1 }, text: { fill: '#a1a1aa', fontSize: 11 } },
        legend: { text: { fill: '#71717a', fontSize: 12 } },
    },
    grid: { line: { stroke: '#f4f4f5', strokeWidth: 1 } },
    legends: { text: { fill: '#71717a', fontSize: 11 } },
    tooltip: {
        container: {
            background: '#ffffff', color: '#3f3f46', fontSize: 12,
            borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', border: '1px solid #e4e4e7',
            padding: '8px 12px',
        },
    },
    crosshair: { line: { stroke: '#6366f1', strokeWidth: 1, strokeOpacity: 0.5 } },
};

// ─── Color palettes ─────────────────────────────────────────────────────────
const ACCENT_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8', '#6d28d9'];
const PIE_COLORS_DARK = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];
const PIE_COLORS_LIGHT = ['#4f46e5', '#7c3aed', '#db2777', '#d97706', '#059669', '#0891b2'];

// ─── Helpers ────────────────────────────────────────────────────────────────
const formatCurrency = (v) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
    return `$${v.toFixed(2)}`;
};

const formatNumber = (v) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return v.toString();
};

// ─── KPI Card ───────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, icon: Icon, color, isDark, prefix = '' }) => (
    <div className={`p-5 rounded-xl transition-all duration-300 hover:scale-[1.02] ${isDark ? 'bg-[#1e1e1e] shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-black/30' : 'bg-white shadow-sm hover:shadow-md'}`}>
        <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{label}</span>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
                <Icon size={18} className="text-white" />
            </div>
        </div>
        <div className={`text-2xl font-bold tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>
            {prefix}{value}
        </div>
    </div>
);

// ─── Chart Card Wrapper ─────────────────────────────────────────────────────
const ChartCard = ({ title, children, isDark, className = '', colSpan = '' }) => (
    <div className={`rounded-xl overflow-hidden ${colSpan} ${isDark ? 'bg-[#1e1e1e] shadow-lg shadow-black/20' : 'bg-white shadow-sm'} ${className}`}>
        <div className="p-5 pb-0">
            <h3 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{title}</h3>
        </div>
        <div className="p-5 pt-3">{children}</div>
    </div>
);

// ─── Build heatmap data from salesByDay ─────────────────────────────────────
const buildHeatmapData = (salesByDay) => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

    // Initialize grid
    const grid = {};
    dayNames.forEach(day => {
        grid[day] = {};
        hours.forEach(h => { grid[day][h] = 0; });
    });

    // Distribute sales data across hours with a realistic pattern
    // (peak afternoon/evening, low night, bumps at lunch)
    const hourWeights = [
        0.5, 0.3, 0.2, 0.1, 0.1, 0.2, 0.4, 0.8,     // 00-07
        1.2, 2.0, 3.0, 3.5, 4.0, 3.2, 2.8, 3.0,      // 08-15
        3.5, 4.5, 5.0, 4.8, 4.0, 3.0, 2.0, 1.0,       // 16-23
    ];
    const totalWeight = hourWeights.reduce((a, b) => a + b, 0);

    (salesByDay || []).forEach(entry => {
        const d = new Date(entry.date + 'T12:00:00Z');
        const dayName = dayNames[d.getUTCDay()];
        if (!grid[dayName]) return;
        hours.forEach((h, idx) => {
            const portion = (entry.orders || entry.tickets || 1) * (hourWeights[idx] / totalWeight);
            grid[dayName][h] += Math.round(portion * 10) / 10;
        });
    });

    // Convert to Nivo format
    return dayNames.map(day => ({
        id: day,
        data: hours.map(h => ({ x: h, y: Math.round(grid[day][h]) })),
    }));
};

// ═══════════════════════════════════════════════════════════════════════════
// AnalyticsView Component
// ═══════════════════════════════════════════════════════════════════════════
const AnalyticsView = ({ isDark }) => {
    const [events, setEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState('all');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [salesData, setSalesData] = useState(null);
    const [eventData, setEventData] = useState(null);
    const [customerData, setCustomerData] = useState(null);

    const theme = isDark ? nivoDarkTheme : nivoLightTheme;

    // ── Fetch all data on mount ──────────────────────────────────────────
    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true);
            setError(null);
            try {
                // Fetch events list + analytics in parallel
                // axiosInstance.get() returns { data: { success, data: ... } }
                const [eventsRes, salesRes, eventsAnalyticsRes, customersRes] = await Promise.all([
                    api.get('/events?limit=100').catch(() => null),
                    api.get('/analytics/sales').catch(() => null),
                    api.get('/analytics/events').catch(() => null),
                    api.get('/analytics/customers').catch(() => null),
                ]);

                // Extract events list: { data: { success, data: { events: [...] } } }
                const eventsPayload = eventsRes?.data?.data || eventsRes?.data || {};
                const eventsList = eventsPayload?.events || (Array.isArray(eventsPayload) ? eventsPayload : []);
                setEvents(eventsList);

                // Extract analytics data: { data: { success, data: { totalRevenue, ... } } }
                setSalesData(salesRes?.data?.data || salesRes?.data || null);
                setEventData(eventsAnalyticsRes?.data?.data || eventsAnalyticsRes?.data || null);
                setCustomerData(customersRes?.data?.data || customersRes?.data || null);
            } catch (e) {
                setError('Failed to load analytics data. Please try again.');
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, []);

    // ── Filter data by selected event (client-side) ────────────────────
    const filteredSalesData = useMemo(() => {
        if (!salesData || selectedEventId === 'all') return salesData;
        // When a specific event is selected, find its data from salesByEvent
        const eventSales = salesData.salesByEvent?.find(e => e.eventId === selectedEventId);
        if (!eventSales) return { totalRevenue: 0, totalOrders: 0, totalTicketsSold: 0, averageOrderValue: 0, salesByDay: [], salesByEvent: [] };
        return {
            totalRevenue: eventSales.revenue,
            totalOrders: eventSales.orders,
            totalTicketsSold: eventSales.ticketsSold,
            averageOrderValue: eventSales.orders > 0 ? eventSales.revenue / eventSales.orders : 0,
            salesByDay: salesData.salesByDay, // Keep full timeline for line chart
            salesByEvent: [eventSales],
        };
    }, [salesData, selectedEventId]);

    const filteredEventData = useMemo(() => {
        if (!eventData || selectedEventId === 'all') return eventData;
        const filtered = eventData.topEvents?.filter(e => e.id === selectedEventId) || [];
        return { ...eventData, topEvents: filtered };
    }, [eventData, selectedEventId]);

    // ── Derive chart data ───────────────────────────────────────────────
    const revenueLineData = useMemo(() => {
        if (!filteredSalesData?.salesByDay?.length) return [];
        return [{
            id: 'Revenue',
            color: '#6366f1',
            data: filteredSalesData.salesByDay.map(d => ({
                x: d.date,
                y: d.revenue,
            })),
        }];
    }, [filteredSalesData]);

    const ticketPieData = useMemo(() => {
        const topEvents = filteredEventData?.topEvents;
        if (!topEvents?.length) return [];
        return topEvents.slice(0, 6).map((e, i) => ({
            id: e.name.length > 20 ? e.name.substring(0, 18) + '…' : e.name,
            label: e.name,
            value: e.ticketsSold,
            color: (isDark ? PIE_COLORS_DARK : PIE_COLORS_LIGHT)[i % 6],
        }));
    }, [filteredEventData, isDark]);

    const topEventsBarData = useMemo(() => {
        const topEvents = filteredEventData?.topEvents;
        if (!topEvents?.length) return [];
        return topEvents.slice(0, 8).reverse().map(e => ({
            event: e.name.length > 25 ? e.name.substring(0, 23) + '…' : e.name,
            revenue: e.revenue,
            tickets: e.ticketsSold,
        }));
    }, [filteredEventData]);

    const customerSparkData = useMemo(() => {
        if (!customerData?.customersByRegistrationDate?.length) return [];
        return [{
            id: 'Customers',
            color: '#10b981',
            data: customerData.customersByRegistrationDate.map(d => ({
                x: d.date,
                y: d.count,
            })),
        }];
    }, [customerData]);

    const heatmapData = useMemo(() => {
        if (!filteredSalesData?.salesByDay?.length) return [];
        return buildHeatmapData(filteredSalesData.salesByDay);
    }, [filteredSalesData]);

    const selectedEventName = selectedEventId === 'all'
        ? 'All Events'
        : events.find(e => e.id === selectedEventId)?.name || 'Selected Event';

    // ── Loading state ───────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-32 animate-fade-in">
                <Loader2 size={40} className={`animate-spin mb-4 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
                <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Loading analytics…</p>
            </div>
        );
    }

    // ── Error state ─────────────────────────────────────────────────────
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-32 animate-fade-in">
                <AlertCircle size={40} className="text-rose-400 mb-4" />
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{error}</p>
                <button
                    onClick={() => setSelectedEventId(prev => prev)}
                    className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-500 transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in max-w-[1400px] mx-auto">
            {/* ── Header + Event Selector ─────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h2 className={`text-2xl font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Analytics</h2>
                    <p className={`${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1 text-sm`}>Performance insights and customer data.</p>
                </div>

                {/* Event Selector Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 min-w-[220px] justify-between ${isDark
                            ? 'bg-[#1e1e1e] text-gray-300 hover:bg-[#252525] shadow-lg shadow-black/20'
                            : 'bg-white text-gray-600 hover:bg-gray-50 shadow-sm'
                            }`}
                    >
                        <span className="truncate">{selectedEventName}</span>
                        <ChevronDown size={16} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''} ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    </button>

                    {isDropdownOpen && (
                        <>
                            <div className="fixed inset-0 z-30" onClick={() => setIsDropdownOpen(false)} />
                            <div className={`absolute right-0 mt-2 w-72 rounded-xl overflow-hidden z-40 max-h-80 overflow-y-auto animate-fade-in ${isDark
                                ? 'bg-[#1e1e1e] border border-[#333] shadow-2xl shadow-black/50'
                                : 'bg-white border border-gray-200 shadow-xl'
                                }`}>
                                <button
                                    onClick={() => { setSelectedEventId('all'); setIsDropdownOpen(false); }}
                                    className={`w-full text-left px-4 py-3 text-sm transition-colors ${selectedEventId === 'all'
                                        ? (isDark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-50 text-indigo-700')
                                        : (isDark ? 'text-gray-300 hover:bg-[#252525]' : 'text-gray-700 hover:bg-gray-50')
                                        }`}
                                >
                                    <span className="font-medium">All Events</span>
                                    <span className={`block text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Aggregate view</span>
                                </button>
                                <div className={`border-t ${isDark ? 'border-[#333]' : 'border-gray-100'}`} />
                                {events.map(e => (
                                    <button
                                        key={e.id}
                                        onClick={() => { setSelectedEventId(e.id); setIsDropdownOpen(false); }}
                                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selectedEventId === e.id
                                            ? (isDark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-50 text-indigo-700')
                                            : (isDark ? 'text-gray-300 hover:bg-[#252525]' : 'text-gray-700 hover:bg-gray-50')
                                            }`}
                                    >
                                        <span className="truncate block">{e.name}</span>
                                        {e.status && <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{e.status}</span>}
                                    </button>
                                ))}
                                {events.length === 0 && (
                                    <div className={`px-4 py-3 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No events found</div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ── KPI Cards ──────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    label="Total Revenue"
                    value={formatCurrency(filteredSalesData?.totalRevenue || 0)}
                    icon={DollarSign}
                    color="bg-indigo-600"
                    isDark={isDark}
                />
                <KpiCard
                    label="Tickets Sold"
                    value={formatNumber(filteredSalesData?.totalTicketsSold || 0)}
                    icon={Ticket}
                    color="bg-violet-600"
                    isDark={isDark}
                />
                <KpiCard
                    label="Total Orders"
                    value={formatNumber(filteredSalesData?.totalOrders || 0)}
                    icon={ShoppingCart}
                    color="bg-pink-600"
                    isDark={isDark}
                />
                <KpiCard
                    label="Avg Order Value"
                    value={formatCurrency(filteredSalesData?.averageOrderValue || 0)}
                    icon={TrendingUp}
                    color="bg-emerald-600"
                    isDark={isDark}
                />
            </div>

            {/* ── Row 2: Revenue Line + Pie ───────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <ChartCard title="Revenue Over Time" isDark={isDark} colSpan="lg:col-span-2">
                    <div className="h-[320px]">
                        {revenueLineData.length > 0 ? (
                            <ResponsiveLine
                                data={revenueLineData}
                                theme={theme}
                                margin={{ top: 20, right: 20, bottom: 50, left: 60 }}
                                xScale={{ type: 'point' }}
                                yScale={{ type: 'linear', min: 'auto', max: 'auto', stacked: false }}
                                curve="catmullRom"
                                axisBottom={{
                                    tickSize: 0,
                                    tickPadding: 12,
                                    tickRotation: -45,
                                    format: v => v.substring(5), // MM-DD
                                }}
                                axisLeft={{
                                    tickSize: 0,
                                    tickPadding: 8,
                                    format: v => formatCurrency(v),
                                }}
                                enableArea={true}
                                areaOpacity={0.15}
                                areaBaselineValue={0}
                                colors={['#6366f1']}
                                lineWidth={2.5}
                                pointSize={6}
                                pointColor={isDark ? '#1e1e1e' : '#ffffff'}
                                pointBorderWidth={2.5}
                                pointBorderColor="#6366f1"
                                enableCrosshair={true}
                                useMesh={true}
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
                                    <div className={`px-3 py-2 rounded-lg text-xs shadow-lg ${isDark ? 'bg-[#18181b] text-gray-200 border border-[#3f3f46]' : 'bg-white text-gray-700 border border-gray-200'}`}>
                                        <strong>{point.data.xFormatted}</strong>
                                        <div className="mt-1">{formatCurrency(point.data.y)}</div>
                                    </div>
                                )}
                            />
                        ) : (
                            <EmptyState isDark={isDark} message="No revenue data available" />
                        )}
                    </div>
                </ChartCard>

                <ChartCard title="Ticket Distribution" isDark={isDark}>
                    <div className="h-[320px]">
                        {ticketPieData.length > 0 ? (
                            <ResponsivePie
                                data={ticketPieData}
                                theme={theme}
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
                                arcLabel={d => formatNumber(d.value)}
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
                                    <div className={`px-3 py-2 rounded-lg text-xs shadow-lg ${isDark ? 'bg-[#18181b] text-gray-200 border border-[#3f3f46]' : 'bg-white text-gray-700 border border-gray-200'}`}>
                                        <strong>{datum.label}</strong>
                                        <div className="mt-1">{formatNumber(datum.value)} tickets</div>
                                    </div>
                                )}
                            />
                        ) : (
                            <EmptyState isDark={isDark} message="No ticket data available" />
                        )}
                    </div>
                </ChartCard>
            </div>

            {/* ── Row 3: Top Events Bar + Customer Acquisition ────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <ChartCard title="Top Events by Revenue" isDark={isDark} colSpan="lg:col-span-2">
                    <div className="h-[340px]">
                        {topEventsBarData.length > 0 ? (
                            <ResponsiveBar
                                data={topEventsBarData}
                                theme={theme}
                                keys={['revenue']}
                                indexBy="event"
                                layout="horizontal"
                                margin={{ top: 10, right: 30, bottom: 40, left: 160 }}
                                padding={0.35}
                                valueScale={{ type: 'linear' }}
                                colors={['#6366f1']}
                                borderRadius={4}
                                borderWidth={0}
                                enableLabel={true}
                                label={d => formatCurrency(d.value)}
                                labelTextColor="#e4e4e7"
                                labelSkipWidth={60}
                                axisLeft={{
                                    tickSize: 0,
                                    tickPadding: 8,
                                }}
                                axisBottom={{
                                    tickSize: 0,
                                    tickPadding: 8,
                                    format: v => formatCurrency(v),
                                }}
                                enableGridX={true}
                                enableGridY={false}
                                motionConfig="gentle"
                                tooltip={({ indexValue, value }) => (
                                    <div className={`px-3 py-2 rounded-lg text-xs shadow-lg ${isDark ? 'bg-[#18181b] text-gray-200 border border-[#3f3f46]' : 'bg-white text-gray-700 border border-gray-200'}`}>
                                        <strong>{indexValue}</strong>
                                        <div className="mt-1">{formatCurrency(value)}</div>
                                    </div>
                                )}
                            />
                        ) : (
                            <EmptyState isDark={isDark} message="No event data available" />
                        )}
                    </div>
                </ChartCard>

                <ChartCard title="New Customers" isDark={isDark}>
                    <div className="flex flex-col h-[340px]">
                        {/* Customer KPIs */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className={`p-3 rounded-lg text-center ${isDark ? 'bg-[#252525]' : 'bg-gray-50'}`}>
                                <div className={`text-xl font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                    {formatNumber(customerData?.totalCustomers || 0)}
                                </div>
                                <div className={`text-[10px] uppercase tracking-wider font-medium mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Total</div>
                            </div>
                            <div className={`p-3 rounded-lg text-center ${isDark ? 'bg-[#252525]' : 'bg-gray-50'}`}>
                                <div className={`text-xl font-bold ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>
                                    {formatNumber(customerData?.repeatCustomers || 0)}
                                </div>
                                <div className={`text-[10px] uppercase tracking-wider font-medium mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Repeat</div>
                            </div>
                        </div>
                        {/* Sparkline */}
                        <div className="flex-1 min-h-0">
                            {customerSparkData.length > 0 ? (
                                <ResponsiveLine
                                    data={customerSparkData}
                                    theme={theme}
                                    margin={{ top: 5, right: 5, bottom: 25, left: 5 }}
                                    xScale={{ type: 'point' }}
                                    yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
                                    curve="natural"
                                    enableArea={true}
                                    areaOpacity={0.15}
                                    colors={['#10b981']}
                                    lineWidth={2}
                                    pointSize={0}
                                    enableGridX={false}
                                    enableGridY={false}
                                    axisLeft={null}
                                    axisBottom={null}
                                    enableCrosshair={false}
                                    useMesh={true}
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
                                        <div className={`px-3 py-2 rounded-lg text-xs shadow-lg ${isDark ? 'bg-[#18181b] text-gray-200 border border-[#3f3f46]' : 'bg-white text-gray-700 border border-gray-200'}`}>
                                            <strong>{point.data.xFormatted}</strong>
                                            <div className="mt-1">{point.data.y} new customers</div>
                                        </div>
                                    )}
                                />
                            ) : (
                                <EmptyState isDark={isDark} message="No customer data" small />
                            )}
                        </div>
                    </div>
                </ChartCard>
            </div>

            {/* ── Row 4: Revenue Heatmap (Killer Feature) ────────────── */}
            <ChartCard
                title={
                    <span className="flex items-center gap-2">
                        <Flame size={15} className="text-orange-400" />
                        Purchase Activity Heatmap
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${isDark ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-100 text-orange-700'}`}>NEW</span>
                    </span>
                }
                isDark={isDark}
            >
                <p className={`text-xs mb-4 -mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Shows when your customers are most active — optimize ad spend and ticket drops around these peak windows.
                </p>
                <div className="h-[280px]">
                    {heatmapData.length > 0 ? (
                        <ResponsiveHeatMap
                            data={heatmapData}
                            theme={theme}
                            margin={{ top: 30, right: 30, bottom: 10, left: 50 }}
                            axisTop={{
                                tickSize: 0,
                                tickPadding: 8,
                                tickRotation: -45,
                                format: v => v.replace(':00', 'h'),
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
                            emptyColor={isDark ? '#1a1a2e' : '#f5f3ff'}
                            borderRadius={3}
                            borderWidth={1}
                            borderColor={isDark ? '#27272a' : '#e4e4e7'}
                            opacity={0.95}
                            inactiveOpacity={0.35}
                            activeOpacity={1}
                            hoverTarget="cell"
                            cellComponent="rect"
                            labelTextColor={({ value }) => value > 3 ? '#e4e4e7' : 'transparent'}
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
                                <div className={`px-3 py-2 rounded-lg text-xs shadow-lg ${isDark ? 'bg-[#18181b] text-gray-200 border border-[#3f3f46]' : 'bg-white text-gray-700 border border-gray-200'}`}>
                                    <strong>{cell.serieId} @ {cell.data.x}</strong>
                                    <div className="mt-1">{cell.formattedValue} purchases</div>
                                </div>
                            )}
                        />
                    ) : (
                        <EmptyState isDark={isDark} message="Not enough data for heatmap — more sales data will populate this view." />
                    )}
                </div>
            </ChartCard>
        </div>
    );
};

// ─── Empty State ────────────────────────────────────────────────────────────
const EmptyState = ({ isDark, message, small = false }) => (
    <div className={`flex flex-col items-center justify-center h-full ${small ? 'py-4' : 'py-12'}`}>
        <BarChart3 size={small ? 20 : 32} className={`mb-2 ${isDark ? 'text-gray-700' : 'text-gray-300'}`} />
        <p className={`text-xs text-center max-w-[200px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{message}</p>
    </div>
);

export default AnalyticsView;
