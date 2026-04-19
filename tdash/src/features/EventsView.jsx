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
import EventWizard from './EventWizard';
import OrdersView from './OrdersView';
import ScannersView from './ScannersView';
import VenuesView from './VenuesView';
import StatusBadge from '../components/StatusBadge';
import api from '../lib/api';
import { generateEventSlug } from '../lib/utils';
import {
    DashboardButton,
    DashboardChip,
    DashboardEmptyState,
    DashboardPage,
    DashboardPageHeader,
    DashboardStat,
    DashboardSurface,
    DashboardTitleBar,
    DashboardWorkspaceTile,
} from '../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../lib/dashboardTheme';
import { cn } from '../lib/utils';

const TOOL_DEFINITIONS = [
    {
        id: 'create',
        label: 'Create New Event',
        description: 'Answer the core launch questions, create the draft, and jump straight into the event dashboard.',
        icon: Sparkles,
        accent: 'violet',
        iconClassName: 'text-fuchsia-400',
    },
    {
        id: 'library',
        label: 'Event Library',
        description: 'Review drafts, published events, and direct links into each event workspace.',
        icon: LayoutGrid,
        accent: 'brand',
        iconClassName: 'text-pink-400',
    },
    {
        id: 'sales',
        label: 'Sales',
        description: 'List transactions with event-aware filters and sorting for finance and box office review.',
        icon: CreditCard,
        accent: 'blue',
        iconClassName: 'text-cyan-400',
    },
    {
        id: 'scanners',
        label: 'Scanners',
        description: 'Manage scanner devices, access, and entry logs from one operations panel.',
        icon: ScanLine,
        accent: 'amber',
        iconClassName: 'text-amber-400',
    },
    {
        id: 'venues',
        label: 'Venues',
        description: 'Maintain venue details, capacity, and location records that power event creation.',
        icon: MapPin,
        accent: 'green',
        iconClassName: 'text-emerald-400',
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

const formatEventDate = (value) => {
    if (!value) {
        return 'Date TBA';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'Date TBA';
    }

    return date.toLocaleDateString();
};

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

const ToolCard = ({ tool, isDark, onClick }) => {
    return (
        <DashboardWorkspaceTile
            as="button"
            type="button"
            isDark={isDark}
            accent={tool.accent}
            onClick={onClick}
            icon={tool.icon}
            iconClassName={tool.iconClassName}
            title={tool.label}
            description={tool.description}
        />
    );
};

const ActiveEventCard = ({ event, isDark, onOpen }) => {
    const uiTheme = getDashboardTheme(isDark);

    return (
        <DashboardSurface
            as="button"
            type="button"
            isDark={isDark}
            accent={null}
            interactive
            onClick={() => onOpen(event)}
            data-testid={`active-event-card-${event.id}`}
            className="group p-5 text-left"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className={cn('text-[10px] uppercase tracking-[0.16em]', isDark ? 'text-pink-300' : 'text-pink-600')}>
                        {event.category || 'Active event'}
                    </p>
                    <h3 className={cn('mt-1 truncate text-base font-light tracking-tight', uiTheme.textPrimary)}>
                        {getEventName(event)}
                    </h3>
                </div>
                <StatusBadge status={event.status} isDark={isDark} />
            </div>

            <div className={cn('mt-3 grid gap-1.5 text-xs font-light', uiTheme.textSecondary)}>
                <div className="flex items-center gap-2">
                    <CalendarDays size={14} className={uiTheme.textTertiary} />
                    <span>{formatEventDate(getEventStart(event))}</span>
                </div>
                <div className="flex items-center gap-2">
                    <MapPin size={14} className={uiTheme.textTertiary} />
                    <span>{event.venue?.name || 'Venue TBA'}</span>
                </div>
            </div>
        </DashboardSurface>
    );
};

const ActiveEventsRail = ({ isDark, events, loading, onOpen }) => {
    const uiTheme = getDashboardTheme(isDark);

    return (
        <DashboardSurface as="aside" isDark={isDark} accent="brand" className="flex flex-col p-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h3 className={cn('text-xl font-light tracking-tight', uiTheme.textPrimary)}>Current Events</h3>
                </div>
                <DashboardChip isDark={isDark}>{events.length}</DashboardChip>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 size={28} className={cn('animate-spin', isDark ? 'text-fuchsia-400' : 'text-fuchsia-600')} />
                </div>
            ) : events.length === 0 ? (
                <DashboardEmptyState
                    isDark={isDark}
                    compact
                    className="mt-5"
                    title="No active events"
                    description="Create or publish an upcoming event to see it here."
                />
            ) : (
                <div className="mt-5 grid content-start gap-2.5">
                    {events.map((event) => (
                        <ActiveEventCard
                            key={event.id}
                            event={event}
                            isDark={isDark}
                            onOpen={onOpen}
                        />
                    ))}
                </div>
            )}
        </DashboardSurface>
    );
};

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
}) => {
    const uiTheme = getDashboardTheme(isDark);

    return (
        <DashboardPage className="space-y-6">
            <DashboardPageHeader
                isDark={isDark}
                eyebrow="Event workspace"
                title="Event Library"
                description="Browse drafts, live events, and hand off into event management."
                icon={LayoutGrid}
                iconClassName={isDark ? 'text-pink-300' : 'text-pink-700'}
                glowTopClassName="bg-pink-500/10"
                glowBottomClassName="bg-cyan-400/10"
                actions={(
                    <div className="flex flex-wrap gap-3">
                        {showAutoGenerate ? (
                            <DashboardButton
                                isDark={isDark}
                                variant="secondary"
                                onClick={onAutoGenerate}
                                disabled={autoGenerating}
                                className={cn(
                                    isDark ? 'border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-100 hover:bg-fuchsia-500/20' : 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100'
                                )}
                            >
                                <Zap size={16} className={autoGenerating ? 'animate-pulse' : ''} />
                                Auto-generate mock event
                            </DashboardButton>
                        ) : null}
                        <DashboardButton isDark={isDark} onClick={onCreateEvent}>
                            <Sparkles size={16} />
                            Create New Event
                        </DashboardButton>
                    </div>
                )}
            />

            <DashboardSurface isDark={isDark} accent="brand" className="p-5 sm:p-6">
            <div className={cn('inline-flex flex-wrap gap-2 rounded-md border p-1', isDark ? 'border-dashboard-borderStrong bg-dashboard-panelMuted' : 'border-slate-200 bg-slate-50')}>
                {LIBRARY_FILTERS.map((filter) => (
                    <button
                        key={filter.id}
                        type="button"
                        onClick={() => onFilterChange(filter.id)}
                        className={cn(
                            'rounded-md px-4 py-2 text-sm font-light transition-colors',
                            filterId === filter.id
                                ? (isDark ? 'bg-dashboard-panelAlt text-zinc-100' : 'bg-white text-slate-900 shadow-sm')
                                : uiTheme.textTertiary
                        )}
                    >
                        {filter.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 size={32} className={cn('animate-spin', isDark ? 'text-fuchsia-400' : 'text-fuchsia-600')} />
                </div>
            ) : events.length === 0 ? (
                <DashboardEmptyState
                    isDark={isDark}
                    title="No events in this view"
                    description="Create a new event or switch filters to review the rest of your schedule."
                    className="mt-6"
                />
            ) : (
                <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
                    {events.map((event) => {
                        const capacity = Number(event.capacity) || 0;
                        const sold = Number(event.sold) || 0;
                        const progress = capacity > 0 ? Math.min(100, Math.round((sold / capacity) * 100)) : 0;

                        return (
                            <DashboardSurface
                                key={event.id}
                                as="button"
                                type="button"
                                isDark={isDark}
                                accent="brand"
                                interactive
                                onClick={() => onNavigate(`/events/${generateEventSlug(getEventName(event), event.id)}`, { state: { event } })}
                                className="p-5 text-left"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className={cn('text-[10px] uppercase tracking-[0.16em]', isDark ? 'text-pink-300' : 'text-pink-600')}>{event.category || 'Event'}</p>
                                        <h3 className={cn('mt-2 text-2xl font-light tracking-tight', uiTheme.textPrimary)}>{getEventName(event)}</h3>
                                    </div>
                                    <StatusBadge status={event.status} isDark={isDark} />
                                </div>

                                <div className={cn('mt-4 grid gap-3 text-sm font-light', uiTheme.textSecondary)}>
                                    <div className="flex items-center gap-2">
                                        <MapPin size={16} className={uiTheme.textTertiary} />
                                        <span>{event.venue?.name || 'Venue TBA'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <CalendarDays size={16} className={uiTheme.textTertiary} />
                                        <span>{getEventStart(event) ? new Date(getEventStart(event)).toLocaleDateString() : 'Date TBA'}</span>
                                    </div>
                                </div>

                                <div className="mt-5 space-y-3">
                                    <div>
                                        <div className={cn('mb-2 flex items-center justify-between text-sm font-light', uiTheme.textSecondary)}>
                                            <span>Sell-through</span>
                                            <span className={uiTheme.textPrimary}>{progress}%</span>
                                        </div>
                                        <div className={cn('h-1.5 rounded-full', isDark ? 'bg-dashboard-shell' : 'bg-slate-100')}>
                                            <div className="h-1.5 rounded-full bg-gradient-to-r from-pink-500 to-orange-400" style={{ width: `${progress}%` }} />
                                        </div>
                                    </div>

                                    <div className="flex items-end justify-between">
                                        <div>
                                            <p className={cn('text-[10px] uppercase tracking-[0.16em]', uiTheme.textMuted)}>Revenue</p>
                                            <p className={cn('mt-1 text-xl font-light', uiTheme.textPrimary)}>{formatCurrency(event.revenue)}</p>
                                        </div>
                                        <span className={cn('inline-flex items-center gap-2 text-sm', uiTheme.textPrimary)}>
                                            Open event
                                            <ChevronRight size={16} />
                                        </span>
                                    </div>
                                </div>
                            </DashboardSurface>
                        );
                    })}
                </div>
            )}
            </DashboardSurface>
        </DashboardPage>
    );
};

const EventsView = ({ isDark, user }) => {
    const navigate = useNavigate();
    const uiTheme = getDashboardTheme(isDark);
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

    const activeEvents = useMemo(() => {
        return events
            .filter((event) => {
                const status = (event.status || '').toUpperCase();
                if (status === 'CANCELLED') return false;
                if (!['PUBLISHED', 'ON_SALE', 'SOLD_OUT'].includes(status)) return false;

                const startValue = getEventStart(event);
                if (!startValue) return true;

                const startTime = new Date(startValue).getTime();
                return Number.isNaN(startTime) || startTime >= Date.now();
            })
            .sort((left, right) => {
                const leftDate = getEventStart(left) ? new Date(getEventStart(left)).getTime() : Number.MAX_SAFE_INTEGER;
                const rightDate = getEventStart(right) ? new Date(getEventStart(right)).getTime() : Number.MAX_SAFE_INTEGER;
                return leftDate - rightDate;
            })
            .slice(0, 5);
    }, [events]);

    const openEventWorkspace = (event) => {
        navigate(`/events/${generateEventSlug(getEventName(event), event.id)}`, { state: { event } });
    };

    const renderActiveTool = () => {
        if (activeTool === 'create') {
            return (
                <EventWizard
                    isDark={isDark}
                    user={user}
                    onClose={() => setActiveTool(null)}
                    onSuccess={(createdEvent) => {
                        if (!createdEvent?.id) {
                            fetchDashboardData();
                            setLibraryFilter('all');
                            setActiveTool('library');
                            return;
                        }

                        openEventWorkspace(createdEvent);
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

    if (activeTool) {
        return (
            <DashboardPage className="mx-auto max-w-[1500px]">
                {renderActiveTool()}
            </DashboardPage>
        );
    }

    return (
        <DashboardPage className="mx-auto max-w-[1680px] space-y-8">
            <DashboardTitleBar
                isDark={isDark}
                title="Event Manager"
                icon={Calendar}
                iconClassName={isDark ? 'text-pink-300' : 'text-pink-700'}
                glowTopClassName="bg-pink-500/10"
                glowBottomClassName="bg-cyan-400/10"
            />

            <section className="grid grid-cols-1 items-start gap-7 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                <div className="grid grid-cols-1 gap-7 sm:grid-cols-2">
                    {TOOL_DEFINITIONS.map((tool) => (
                        <ToolCard
                            key={tool.id}
                            tool={tool}
                            isDark={isDark}
                            onClick={() => setActiveTool(tool.id)}
                        />
                    ))}
                </div>

                <ActiveEventsRail
                    isDark={isDark}
                    events={activeEvents}
                    loading={isLoading}
                    onOpen={openEventWorkspace}
                />
            </section>
        </DashboardPage>
    );
};

export default EventsView;
