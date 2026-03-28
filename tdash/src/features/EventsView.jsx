import React, { useEffect, useMemo, useState } from 'react';
import {
    CalendarDays,
    ChevronRight,
    CreditCard,
    Calendar,
    Loader2,
    MapPin,
    ScanLine,
    Sparkles,
    LayoutGrid,
    Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EventStudio from './EventStudio';
import OrdersView from './OrdersView';
import ScannersView from './ScannersView';
import VenuesView from './VenuesView';
import StatusBadge from '../components/StatusBadge';
import api from '../lib/api';
import { generateEventSlug } from '../lib/utils';

const TOOL_DEFINITIONS = [
    {
        id: 'create',
        label: 'Create Event',
        description: 'Open the full event wizard with live preview, ticket setup, and publishing controls.',
        helper: 'Best for launches',
        icon: Sparkles,
        grad: 'from-fuchsia-500 to-cyan-400',
        color: 'text-fuchsia-400',
        metricLabel: 'Wizard',
    },
    {
        id: 'library',
        label: 'Event Library',
        description: 'Review drafts, published events, and direct links into each event workspace.',
        helper: 'Best for day-to-day management',
        icon: LayoutGrid,
        grad: 'from-pink-500 to-orange-400',
        color: 'text-pink-400',
        metricLabel: 'Events',
    },
    {
        id: 'sales',
        label: 'Sales',
        description: 'List transactions with event-aware filters and sorting for finance and box office review.',
        helper: 'Best for revenue checks',
        icon: CreditCard,
        grad: 'from-cyan-400 to-blue-500',
        color: 'text-cyan-400',
        metricLabel: 'Transactions',
    },
    {
        id: 'scanners',
        label: 'Scanners',
        description: 'Manage scanner devices, access, and entry logs from one operations panel.',
        helper: 'Best for door ops',
        icon: ScanLine,
        grad: 'from-amber-400 to-orange-500',
        color: 'text-amber-400',
        metricLabel: 'Devices',
    },
    {
        id: 'venues',
        label: 'Venues',
        description: 'Maintain venue details, capacity, and location records that power event creation.',
        helper: 'Best for setup and logistics',
        icon: MapPin,
        grad: 'from-emerald-400 to-teal-500',
        color: 'text-emerald-400',
        metricLabel: 'Locations',
    },
];

const LIBRARY_FILTERS = [
    { id: 'all', label: 'All events' },
    { id: 'on-sale', label: 'On sale' },
    { id: 'draft', label: 'Draft' },
    { id: 'past', label: 'Past' },
    { id: 'cancelled', label: 'Cancelled' },
];

const readDevSettings = () => {
    try {
        const saved = localStorage.getItem('tixmo_dev_settings');
        return saved ? JSON.parse(saved) : { enableAutoEventGeneration: false };
    } catch (error) {
        return { enableAutoEventGeneration: false };
    }
};

const extractEvents = (response) => response?.data?.data?.events || response?.data?.events || [];
const extractOrders = (response) => response?.data?.data?.orders || [];
const extractVenues = (response) => response?.data?.data?.venues || response?.data?.data || [];
const extractScanners = (response) => {
    const payload = response?.data?.data;
    if (Array.isArray(payload)) return payload;
    return payload?.scanners || [];
};

const getEventName = (event) => event.title || event.name || 'Untitled Event';
const getEventStart = (event) => event.startDateTime || event.startDatetime || null;

const matchesLibraryFilter = (event, filterId) => {
    const status = event.status || 'DRAFT';
    const startValue = getEventStart(event);
    const startDate = startValue ? new Date(startValue) : null;
    const now = new Date();

    if (filterId === 'on-sale') {
        return status === 'PUBLISHED' || status === 'SOLD_OUT';
    }

    if (filterId === 'draft') {
        return status === 'DRAFT';
    }

    if (filterId === 'past') {
        return startDate && !Number.isNaN(startDate.getTime()) && startDate < now;
    }

    if (filterId === 'cancelled') {
        return status === 'CANCELLED';
    }

    return true;
};

const formatCurrency = (value) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
}).format(Number(value) || 0);

const ToolCard = ({ tool, isDark, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={`group relative overflow-hidden rounded-md border p-5 text-left transition-all ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d] hover:bg-[#232336] hover:border-[#3a3a5a] hover:shadow-2xl hover:shadow-black/30' : 'border-gray-200 bg-white hover:bg-gray-50 hover:shadow-lg'}`}
    >
        <div className={`absolute top-0 left-0 h-[3px] w-full bg-gradient-to-r ${tool.grad} opacity-80`} />
        <div className={`absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${tool.grad} opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-10`} />
        <div className="relative">
            <div className="flex items-start justify-between gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-md ${isDark ? 'bg-[#151521]' : 'bg-gray-50'}`}>
                    <tool.icon size={20} className={tool.color} />
                </div>
                <span className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${isDark ? 'bg-[#151521] text-[#8f94aa]' : 'bg-gray-100 text-gray-500'}`}>
                    {tool.helper}
                </span>
            </div>
            <div className="mt-5">
                <h3 className={`text-xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{tool.label}</h3>
                <p className={`mt-2 text-sm font-light leading-relaxed ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>{tool.description}</p>
            </div>
            <div className="mt-5 flex items-center justify-between">
                <div>
                    <p className={`text-[10px] uppercase tracking-[0.18em] ${isDark ? 'text-[#5e6278]' : 'text-gray-400'}`}>{tool.metricLabel}</p>
                    <p className={`mt-1 text-2xl font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{tool.metric}</p>
                </div>
                <div className={`inline-flex items-center gap-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                    Open
                    <ChevronRight size={16} />
                </div>
            </div>
        </div>
    </button>
);

const EventLibrary = ({
    isDark,
    events,
    loading,
    filterId,
    onFilterChange,
    onNavigate,
    onCreateEvent,
    onAutoGenerate,
    showAutoGenerate,
    autoGenerating,
}) => (
    <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div>
                <h2 className={`text-3xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Event Library</h2>
                <p className={`mt-1 text-lg font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                    Browse drafts, live events, and hand off into event management.
                </p>
            </div>
            <div className="flex flex-wrap gap-3">
                {showAutoGenerate && (
                    <button
                        type="button"
                        onClick={onAutoGenerate}
                        disabled={autoGenerating}
                        className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm transition-colors ${isDark ? 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300 hover:bg-fuchsia-500/20' : 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100'}`}
                    >
                        <Zap size={16} className={autoGenerating ? 'animate-pulse' : ''} />
                        Auto-generate mock event
                    </button>
                )}
                <button
                    type="button"
                    onClick={onCreateEvent}
                    className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm transition-colors ${isDark ? 'bg-fuchsia-500 text-white hover:bg-fuchsia-400' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                >
                    <Sparkles size={16} />
                    Create event
                </button>
            </div>
        </div>

        <div className={`inline-flex flex-wrap gap-2 rounded-md border p-1 ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-gray-50'}`}>
            {LIBRARY_FILTERS.map((filter) => (
                <button
                    key={filter.id}
                    type="button"
                    onClick={() => onFilterChange(filter.id)}
                    className={`rounded-sm px-4 py-2 text-sm font-light transition-colors ${filterId === filter.id
                        ? (isDark ? 'bg-[#2b2b40] text-gray-100' : 'bg-white text-gray-900 shadow-sm')
                        : (isDark ? 'text-[#8f94aa] hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')
                    }`}
                >
                    {filter.label}
                </button>
            ))}
        </div>

        {loading ? (
            <div className="flex items-center justify-center py-24">
                <Loader2 size={32} className={`animate-spin ${isDark ? 'text-fuchsia-400' : 'text-fuchsia-600'}`} />
            </div>
        ) : events.length === 0 ? (
            <div className={`rounded-md border border-dashed p-12 text-center ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d] text-[#8f94aa]' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                <CalendarDays size={40} className="mx-auto mb-4 opacity-60" />
                <h3 className={`text-xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>No events in this view</h3>
                <p className="mt-2 text-sm font-light">Create a new event or switch filters to review the rest of your schedule.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {events.map((event) => {
                    const capacity = Number(event.capacity) || 0;
                    const sold = Number(event.sold) || 0;
                    const progress = capacity > 0 ? Math.min(100, Math.round((sold / capacity) * 100)) : 0;

                    return (
                        <button
                            key={event.id}
                            type="button"
                            onClick={() => onNavigate(`/events/${generateEventSlug(getEventName(event), event.id)}`, { state: { event } })}
                            className={`group relative overflow-hidden rounded-md border p-5 text-left transition-all ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d] hover:bg-[#232336] hover:border-[#3a3a5a]' : 'border-gray-200 bg-white hover:bg-gray-50 hover:shadow-lg'}`}
                        >
                            <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-pink-500 to-orange-400 opacity-80" />
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className={`text-xs uppercase tracking-[0.18em] ${isDark ? 'text-pink-300' : 'text-pink-600'}`}>{event.category || 'Event'}</p>
                                    <h3 className={`mt-2 text-2xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{getEventName(event)}</h3>
                                </div>
                                <StatusBadge status={event.status} isDark={isDark} />
                            </div>

                            <div className={`mt-4 grid gap-3 text-sm font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                                <div className="flex items-center gap-2">
                                    <MapPin size={16} className={isDark ? 'text-gray-500' : 'text-gray-400'} />
                                    <span>{event.venue?.name || 'Venue TBA'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <CalendarDays size={16} className={isDark ? 'text-gray-500' : 'text-gray-400'} />
                                    <span>{getEventStart(event) ? new Date(getEventStart(event)).toLocaleDateString() : 'Date TBA'}</span>
                                </div>
                            </div>

                            <div className="mt-5 space-y-3">
                                <div>
                                    <div className={`mb-2 flex items-center justify-between text-sm font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                                        <span>Sell-through</span>
                                        <span className={isDark ? 'text-gray-200' : 'text-gray-800'}>{progress}%</span>
                                    </div>
                                    <div className={`h-1.5 rounded-full ${isDark ? 'bg-[#151521]' : 'bg-gray-100'}`}>
                                        <div className="h-1.5 rounded-full bg-gradient-to-r from-pink-500 to-orange-400" style={{ width: `${progress}%` }} />
                                    </div>
                                </div>

                                <div className="flex items-end justify-between">
                                    <div>
                                        <p className={`text-[10px] uppercase tracking-[0.18em] ${isDark ? 'text-[#5e6278]' : 'text-gray-400'}`}>Revenue</p>
                                        <p className={`mt-1 text-xl font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{formatCurrency(event.revenue)}</p>
                                    </div>
                                    <span className={`inline-flex items-center gap-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                        Open event
                                        <ChevronRight size={16} />
                                    </span>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        )}
    </div>
);

const EventsView = ({ isDark, user }) => {
    const navigate = useNavigate();
    const [activeTool, setActiveTool] = useState(null);
    const [events, setEvents] = useState([]);
    const [ordersCount, setOrdersCount] = useState(0);
    const [venuesCount, setVenuesCount] = useState(0);
    const [scannersCount, setScannersCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isAutoGenerating, setIsAutoGenerating] = useState(false);
    const [libraryFilter, setLibraryFilter] = useState('all');
    const [devSettings] = useState(readDevSettings);

    const fetchDashboardData = async () => {
        try {
            setIsLoading(true);
            const [eventsResponse, ordersResponse, venuesResponse, scannersResponse] = await Promise.all([
                api.get('/events?limit=100'),
                api.get('/orders?page=1&limit=100').catch(() => null),
                api.get('/venues?limit=100').catch(() => null),
                api.get('/scanners?page=1&limit=100').catch(() => null),
            ]);

            const nextEvents = extractEvents(eventsResponse);
            setEvents(nextEvents);
            setOrdersCount(extractOrders(ordersResponse).length);
            setVenuesCount(extractVenues(venuesResponse).length);
            setScannersCount(extractScanners(scannersResponse).length);
        } catch (error) {
            console.error('Failed to load Event Manager data', error);
            setEvents([]);
            setOrdersCount(0);
            setVenuesCount(0);
            setScannersCount(0);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const handleAutoGenerate = async () => {
        try {
            setIsAutoGenerating(true);
            const mockTitle = `Test Event ${Math.floor(Math.random() * 10000)}`;
            await api.post('/events', {
                title: mockTitle,
                description: 'This is an auto-generated test event from the dev dashboard.',
                organizationId: user?.organizationId,
                capacity: 500,
            });
            await fetchDashboardData();
        } catch (error) {
            console.error('Failed to auto-generate event', error);
        } finally {
            setIsAutoGenerating(false);
        }
    };

    const filteredEvents = useMemo(() => {
        return events
            .filter((event) => matchesLibraryFilter(event, libraryFilter))
            .sort((left, right) => {
                const leftDate = getEventStart(left) ? new Date(getEventStart(left)).getTime() : 0;
                const rightDate = getEventStart(right) ? new Date(getEventStart(right)).getTime() : 0;
                return rightDate - leftDate;
            });
    }, [events, libraryFilter]);

    const toolCards = useMemo(() => {
        return TOOL_DEFINITIONS.map((tool) => {
            if (tool.id === 'library') {
                return { ...tool, metric: events.length };
            }

            if (tool.id === 'sales') {
                return { ...tool, metric: ordersCount };
            }

            if (tool.id === 'scanners') {
                return { ...tool, metric: scannersCount };
            }

            if (tool.id === 'venues') {
                return { ...tool, metric: venuesCount };
            }

            return { ...tool, metric: 'Live' };
        });
    }, [events.length, ordersCount, scannersCount, venuesCount]);

    const renderActiveTool = () => {
        if (activeTool === 'create') {
            return (
                <EventStudio
                    embedded
                    isDark={isDark}
                    user={user}
                    onClose={() => setActiveTool(null)}
                    onSuccess={async () => {
                        await fetchDashboardData();
                        setLibraryFilter('all');
                        setActiveTool('library');
                    }}
                />
            );
        }

        if (activeTool === 'library') {
            return (
                <EventLibrary
                    isDark={isDark}
                    events={filteredEvents}
                    loading={isLoading}
                    filterId={libraryFilter}
                    onFilterChange={setLibraryFilter}
                    onNavigate={navigate}
                    onCreateEvent={() => setActiveTool('create')}
                    onAutoGenerate={handleAutoGenerate}
                    showAutoGenerate={devSettings.enableAutoEventGeneration && (user?.role === 'OWNER' || user?.role === 'ADMIN')}
                    autoGenerating={isAutoGenerating}
                />
            );
        }

        if (activeTool === 'sales') {
            return (
                <OrdersView
                    isDark={isDark}
                    embedded
                    title="Sales"
                    description="Review transactions, sort by event, and audit the order stream."
                    eventOptions={events}
                />
            );
        }

        if (activeTool === 'scanners') {
            return (
                <ScannersView
                    isDark={isDark}
                    user={user}
                    embedded
                    title="Scanners"
                    description="Manage scanner devices, access, and entry logs from one panel."
                />
            );
        }

        if (activeTool === 'venues') {
            return (
                <VenuesView
                    isDark={isDark}
                    user={user}
                    embedded
                    title="Venues"
                    description="Maintain venue records and capacity details used during event setup."
                />
            );
        }

        return null;
    };

    return (
        <div className="space-y-8 animate-fade-in max-w-[1500px] mx-auto pb-12">
            <section className={`relative overflow-hidden rounded-md border p-6 sm:p-8 ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40] shadow-2xl shadow-black/20' : 'bg-white border-gray-200 shadow-sm'}`}>
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-fuchsia-500/10 blur-3xl" />
                    <div className="absolute left-10 bottom-0 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
                </div>
                <div className="relative">
                    <h2 className={`flex flex-wrap items-baseline gap-3 text-3xl sm:text-4xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                        <span className="inline-flex items-center gap-2">
                            <span>Event Manager</span>
                            <Calendar className={`h-6 w-6 sm:h-7 sm:w-7 ${isDark ? 'text-fuchsia-300' : 'text-fuchsia-700'}`} />
                        </span>
                    </h2>
                </div>
            </section>

            {!activeTool ? (
                <section className="space-y-4">
                    <div>
                        <h3 className={`text-2xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Tools</h3>
                        <p className={`mt-1 text-sm font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                            Choose the Event Manager workspace you want to use.
                        </p>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-24">
                            <Loader2 size={32} className={`animate-spin ${isDark ? 'text-fuchsia-400' : 'text-fuchsia-600'}`} />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                            {toolCards.map((tool) => (
                                <ToolCard
                                    key={tool.id}
                                    tool={tool}
                                    isDark={isDark}
                                    onClick={() => setActiveTool(tool.id)}
                                />
                            ))}
                        </div>
                    )}
                </section>
            ) : (
                <section className="space-y-4">
                    <button
                        type="button"
                        onClick={() => setActiveTool(null)}
                        className={`rounded-md border px-4 py-2 text-sm transition-colors ${isDark ? 'border-[#2b2b40] text-gray-200 hover:bg-[#232336]' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                    >
                        Back to tools
                    </button>

                    {renderActiveTool()}
                </section>
            )}
        </div>
    );
};

export default EventsView;
