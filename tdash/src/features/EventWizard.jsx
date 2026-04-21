import React, { useEffect, useMemo, useState } from 'react';
import {
    CalendarDays,
    CheckCircle2,
    Image as ImageIcon,
    ListChecks,
    Loader2,
    MapPin,
    Sparkles,
    Ticket,
    ArrowRight,
} from 'lucide-react';
import api from '../lib/api';
import TicketBuilder from '../components/TicketBuilder';
import {
    DashboardButton,
    DashboardChip,
    DashboardEmptyState,
    DashboardPage,
    DashboardStat,
    DashboardSurface,
} from '../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../lib/dashboardTheme';
import { cn } from '../lib/utils';

const CATEGORY_OPTIONS = ['Music', 'Nightlife', 'Festival', 'Conference', 'Theater', 'Community'];

const WIZARD_STEPS = [
    {
        id: 'basics',
        title: 'Basics',
        detail: 'Name the event and set the category.',
        badge: 'Required',
        Icon: Sparkles,
    },
    {
        id: 'schedule',
        title: 'Schedule',
        detail: 'Set the timing and timezone.',
        badge: 'Required',
        Icon: CalendarDays,
    },
    {
        id: 'venue',
        title: 'Venue',
        detail: 'Choose a venue or leave it open.',
        badge: 'Optional',
        Icon: MapPin,
    },
    {
        id: 'details',
        title: 'Details',
        detail: 'Add description, poster, and tags.',
        badge: 'Optional',
        Icon: ImageIcon,
    },
    {
        id: 'tickets',
        title: 'Tickets',
        detail: 'Set ticket types and capacity.',
        badge: 'Optional',
        Icon: Ticket,
    },
    {
        id: 'review',
        title: 'Review',
        detail: 'Confirm the draft and create it.',
        badge: 'Create',
        Icon: ListChecks,
    },
];

const formatLocalDateTime = (value, options = {}) => {
    if (!value) {
        return 'Not set';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'Not set';
    }

    return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        ...options,
    });
};

const toDateTimeLocalValue = (date) => {
    const pad = (value) => String(value).padStart(2, '0');

    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
    ].join('-') + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const addHoursToDateTimeLocal = (value, hours) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    date.setHours(date.getHours() + hours);
    return toDateTimeLocalValue(date);
};

const getDurationLabel = (startValue, endValue) => {
    const start = new Date(startValue);
    const end = new Date(endValue);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        return 'Not set';
    }

    const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;

    if (hours && minutes) {
        return `${hours}h ${minutes}m`;
    }

    if (hours) {
        return `${hours}h`;
    }

    return `${minutes}m`;
};

const getVenueAddress = (venue) => {
    if (!venue?.address) {
        return 'Address unavailable';
    }

    if (typeof venue.address === 'string') {
        return venue.address;
    }

    return [venue.address.street, venue.address.city, venue.address.state]
        .filter(Boolean)
        .join(', ') || 'Address unavailable';
};

const splitTags = (value) => value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const FieldLabel = ({ isDark, children, meta }) => (
    <div className="mb-3 flex items-center justify-between gap-3">
        <label className={cn(
            'text-[11px] uppercase tracking-[0.18em]',
            isDark ? 'text-dashboard-nav' : 'text-slate-500'
        )}>
            {children}
        </label>
        {meta ? (
            <span className={cn(
                'text-[10px] font-light uppercase tracking-[0.16em]',
                isDark ? 'text-dashboard-subtleAlt' : 'text-slate-400'
            )}>
                {meta}
            </span>
        ) : null}
    </div>
);

const inputClassName = (isDark) => cn(
    'w-full rounded-md border px-4 py-3 text-sm font-light outline-none transition-colors',
    isDark
        ? 'border-dashboard-border bg-dashboard-panelMuted text-zinc-100 placeholder:text-dashboard-subtle focus:border-dashboard-borderStrong focus:bg-dashboard-panelAlt'
        : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-slate-300'
);

const textareaClassName = (isDark) => cn(inputClassName(isDark), 'min-h-[180px] resize-y');

const metricCardClassName = (isDark) => cn(
    'rounded-md border p-4',
    isDark ? 'border-dashboard-border bg-dashboard-panelMuted' : 'border-slate-200 bg-slate-50'
);

const EventWizard = ({ onClose, onSuccess, isDark, user }) => {
    const uiTheme = getDashboardTheme(isDark);
    const [step, setStep] = useState(0);
    const [visitedSteps, setVisitedSteps] = useState([0]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [venues, setVenues] = useState([]);
    const [tickets, setTickets] = useState([]);
    const [formData, setFormData] = useState({
        title: '',
        category: 'Music',
        description: '',
        startDateTime: '',
        endDateTime: '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        venueId: '',
        imageUrl: '',
        tags: '',
    });

    useEffect(() => {
        const fetchVenues = async () => {
            try {
                const response = await api.get('/venues?limit=100');
                const payload = response.data?.data || response.data;
                const nextVenues = Array.isArray(payload) ? payload : (payload?.venues || []);
                setVenues(nextVenues);
            } catch (fetchError) {
                console.error('Failed to fetch venues', fetchError);
                setVenues([]);
            }
        };

        fetchVenues();
    }, []);

    const currentStep = WIZARD_STEPS[step];
    const selectedVenue = useMemo(
        () => venues.find((venue) => venue.id === formData.venueId) || null,
        [formData.venueId, venues]
    );
    const highestVisitedStep = Math.max(...visitedSteps);
    const totalTicketCapacity = useMemo(
        () => tickets.reduce((sum, ticket) => sum + Number.parseInt(ticket.quantity || 0, 10), 0),
        [tickets]
    );
    const derivedCapacity = totalTicketCapacity || selectedVenue?.capacity || 0;
    const tagList = useMemo(() => splitTags(formData.tags), [formData.tags]);

    const updateFormData = (patch) => {
        setError('');
        setFormData((current) => ({ ...current, ...patch }));
    };

    const validateStep = (stepIndex) => {
        if (stepIndex === 0 && !formData.title.trim()) {
            return 'Add an event title before continuing.';
        }

        if (stepIndex === 1) {
            if (!formData.startDateTime || !formData.endDateTime) {
                return 'Set both a start and end time.';
            }

            const start = new Date(formData.startDateTime);
            const end = new Date(formData.endDateTime);

            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
                return 'Enter valid date and time values.';
            }

            if (end <= start) {
                return 'End time must be after the start time.';
            }
        }

        return '';
    };

    const canContinue = useMemo(() => {
        if (step === 0) {
            return Boolean(formData.title.trim());
        }

        if (step === 1) {
            if (!formData.startDateTime || !formData.endDateTime) {
                return false;
            }

            const start = new Date(formData.startDateTime);
            const end = new Date(formData.endDateTime);

            return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start;
        }

        return true;
    }, [formData.endDateTime, formData.startDateTime, formData.title, step]);

    const canSaveDraft = useMemo(
        () => !validateStep(0) && !validateStep(1),
        [formData.endDateTime, formData.startDateTime, formData.title]
    );

    const markStepVisited = (nextStep) => {
        setVisitedSteps((current) => (current.includes(nextStep) ? current : [...current, nextStep]));
    };

    const handleAdvance = () => {
        const nextError = validateStep(step);
        if (nextError) {
            setError(nextError);
            return;
        }

        if (step === WIZARD_STEPS.length - 1) {
            void handleCreateEvent();
            return;
        }

        const nextStep = Math.min(step + 1, WIZARD_STEPS.length - 1);
        markStepVisited(nextStep);
        setError('');
        setStep(nextStep);
    };

    const handleStepChange = (nextStep) => {
        if (nextStep > highestVisitedStep || loading) {
            return;
        }

        setError('');
        setStep(nextStep);
    };

    const handleCreateEvent = async () => {
        const title = formData.title.trim();

        if (!user?.organizationId) {
            setError('Your organization is missing. Reload and try again.');
            return;
        }

        const nextError = validateStep(0) || validateStep(1);
        if (nextError) {
            setError(nextError);
            return;
        }

        setLoading(true);
        setError('');

        try {
            const payload = {
                title,
                name: title,
                description: formData.description.trim() || undefined,
                organizationId: user.organizationId,
                startDateTime: new Date(formData.startDateTime).toISOString(),
                endDateTime: new Date(formData.endDateTime).toISOString(),
                venueId: formData.venueId || undefined,
                capacity: derivedCapacity || undefined,
                category: formData.category,
                timezone: formData.timezone || selectedVenue?.timezone || 'UTC',
                status: 'DRAFT',
                imageUrl: formData.imageUrl.trim() || undefined,
                tags: tagList.length ? tagList : undefined,
            };

            const response = await api.post('/events', payload);
            const created = response.data?.data || response.data?.event || response.data || {};
            const eventId = created.id;

            if (eventId && tickets.length > 0) {
                await Promise.all(tickets.map(async (ticket) => {
                    const ticketPayload = {
                        eventId,
                        name: ticket.name,
                        price: Number.parseFloat(ticket.price),
                        quantity: Number.parseInt(ticket.quantity, 10),
                        status: ticket.status || 'ACTIVE',
                    };

                    const ticketResponse = await api.post('/ticket-types', ticketPayload);
                    const createdTicket = ticketResponse.data?.data || ticketResponse.data || {};
                    const ticketTypeId = createdTicket.id;

                    if (ticketTypeId && Array.isArray(ticket.tiers) && ticket.tiers.length > 0) {
                        await Promise.all(ticket.tiers.map((tier, index) => api.post('/ticket-tiers', {
                            ticketTypeId,
                            name: tier.name,
                            price: Number.parseFloat(tier.price),
                            quantityLimit: tier.quantityLimit ? Number.parseInt(tier.quantityLimit, 10) : null,
                            startsAt: tier.startsAt ? new Date(tier.startsAt).toISOString() : null,
                            endsAt: tier.endsAt ? new Date(tier.endsAt).toISOString() : null,
                            sortOrder: index,
                        })));
                    }
                }));
            }

            const createdEvent = {
                ...created,
                id: created.id,
                title: created.title || title,
                name: created.name || title,
                description: created.description || formData.description || '',
                category: created.category || formData.category,
                status: created.status || 'DRAFT',
                startDateTime: created.startDateTime || created.startDatetime || payload.startDateTime,
                endDateTime: created.endDateTime || created.endDatetime || payload.endDateTime,
                venueId: created.venueId || payload.venueId || '',
                venue: created.venue || selectedVenue || null,
                capacity: created.capacity || payload.capacity || null,
                imageUrl: created.imageUrl || payload.imageUrl || '',
                tags: created.tags || tagList,
            };

            onSuccess?.(createdEvent);
        } catch (requestError) {
            console.error(requestError);
            setError(requestError.response?.data?.message || requestError.message || 'Failed to create event.');
        } finally {
            setLoading(false);
        }
    };

    const renderBasicsStep = () => (
        <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-2">
                <div>
                    <FieldLabel isDark={isDark} meta="Required">Event title</FieldLabel>
                    <input
                        autoFocus
                        type="text"
                        value={formData.title}
                        onChange={(event) => updateFormData({ title: event.target.value })}
                        placeholder="Summer harbour launch"
                        className={inputClassName(isDark)}
                    />
                </div>
                <div>
                    <FieldLabel isDark={isDark}>Category</FieldLabel>
                    <select
                        value={formData.category}
                        onChange={(event) => updateFormData({ category: event.target.value })}
                        className={inputClassName(isDark)}
                    >
                        {CATEGORY_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className={cn('border-t pt-6', isDark ? 'border-dashboard-border' : 'border-slate-200')}>
                <FieldLabel isDark={isDark} meta="Comma separated">Discovery tags</FieldLabel>
                <input
                    type="text"
                    value={formData.tags}
                    onChange={(event) => updateFormData({ tags: event.target.value })}
                    placeholder="afterparty, waterfront, 19plus"
                    className={inputClassName(isDark)}
                />

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <DashboardStat
                        isDark={isDark}
                        label="Category"
                        value={formData.category}
                        detail="Primary listing bucket"
                    />
                    <DashboardStat
                        isDark={isDark}
                        label="Tags"
                        value={tagList.length || 0}
                        detail={tagList.length ? tagList.join(' • ') : 'Add search and merch tags'}
                    />
                    <DashboardStat
                        isDark={isDark}
                        label="Title"
                        value={formData.title.trim() ? 'Set' : 'Missing'}
                        detail={formData.title.trim() || 'Add the public event title'}
                    />
                </div>
            </div>
        </div>
    );

    const renderScheduleStep = () => (
        <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-2">
                <div>
                    <FieldLabel isDark={isDark} meta="Required">Start date and time</FieldLabel>
                    <input
                        type="datetime-local"
                        value={formData.startDateTime}
                        onChange={(event) => {
                            const nextStart = event.target.value;
                            const patch = { startDateTime: nextStart };

                            if (nextStart && (!formData.endDateTime || new Date(formData.endDateTime) <= new Date(nextStart))) {
                                patch.endDateTime = addHoursToDateTimeLocal(nextStart, 3);
                            }

                            updateFormData(patch);
                        }}
                        className={inputClassName(isDark)}
                    />
                </div>
                <div>
                    <FieldLabel isDark={isDark} meta="Required">End date and time</FieldLabel>
                    <input
                        type="datetime-local"
                        value={formData.endDateTime}
                        onChange={(event) => updateFormData({ endDateTime: event.target.value })}
                        className={inputClassName(isDark)}
                    />
                </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
                <div>
                    <FieldLabel isDark={isDark}>Timezone</FieldLabel>
                    <input
                        type="text"
                        value={formData.timezone}
                        onChange={(event) => updateFormData({ timezone: event.target.value })}
                        placeholder="America/St_Johns"
                        className={inputClassName(isDark)}
                    />
                </div>
                <div className={metricCardClassName(isDark)}>
                    <p className={cn('text-[10px] uppercase tracking-[0.16em]', uiTheme.textTertiary)}>Duration</p>
                    <p className={cn('mt-3 text-3xl font-light tracking-tight', uiTheme.textPrimary)}>
                        {getDurationLabel(formData.startDateTime, formData.endDateTime)}
                    </p>
                    <p className={cn('mt-2 text-sm font-light leading-6', uiTheme.textSecondary)}>
                        End time auto-fills three hours after the selected start to keep the draft moving.
                    </p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <DashboardStat
                    isDark={isDark}
                    label="Start"
                    value={formatLocalDateTime(formData.startDateTime, { weekday: 'short' })}
                    detail="First live date on the draft"
                />
                <DashboardStat
                    isDark={isDark}
                    label="End"
                    value={formatLocalDateTime(formData.endDateTime, { weekday: 'short' })}
                    detail="Close time for the event shell"
                />
                <DashboardStat
                    isDark={isDark}
                    label="Timezone"
                    value={formData.timezone || 'Not set'}
                    detail="Stored with the event metadata"
                />
            </div>
        </div>
    );

    const renderVenueStep = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h3 className={cn('text-xl font-light tracking-tight', uiTheme.textPrimary)}>Venue assignment</h3>
                    <p className={cn('mt-2 text-sm font-light leading-6', uiTheme.textSecondary)}>
                        Choose an existing venue or keep the event shell open for later routing.
                    </p>
                </div>
                <DashboardChip isDark={isDark}>
                    {selectedVenue ? 'Assigned' : 'Open'}
                </DashboardChip>
            </div>

            <button
                type="button"
                onClick={() => updateFormData({ venueId: '' })}
                className={cn(
                    'w-full rounded-md border p-4 text-left transition-colors',
                    !formData.venueId
                        ? (isDark ? 'border-dashboard-borderStrong bg-dashboard-panelAlt text-zinc-100' : 'border-slate-900 bg-slate-900 text-white')
                        : (isDark ? 'border-dashboard-border bg-dashboard-panelMuted text-dashboard-muted hover:bg-dashboard-panelAlt' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100')
                )}
            >
                <p className="text-sm font-light">Create without venue</p>
                <p className={cn('mt-2 text-sm font-light leading-6', !formData.venueId ? 'opacity-80' : uiTheme.textSecondary)}>
                    Keep the location flexible and assign it after the draft opens in the event workspace.
                </p>
            </button>

            <div>
                {venues.length ? (
                    <div className="grid gap-3 xl:grid-cols-2">
                        {venues.map((venue) => {
                            const isSelected = formData.venueId === venue.id;

                            return (
                                <button
                                    key={venue.id}
                                    type="button"
                                    onClick={() => updateFormData({ venueId: venue.id, timezone: venue.timezone || formData.timezone })}
                                    className={cn(
                                        'rounded-md border p-4 text-left transition-colors',
                                        isSelected
                                            ? (isDark ? 'border-dashboard-borderStrong bg-dashboard-panelAlt text-zinc-100' : 'border-slate-900 bg-slate-900 text-white')
                                            : (isDark ? 'border-dashboard-border bg-dashboard-panelMuted text-dashboard-muted hover:bg-dashboard-panelAlt' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-medium">{venue.name}</p>
                                            <p className={cn('mt-2 text-sm font-light leading-6', isSelected ? 'opacity-80' : uiTheme.textSecondary)}>
                                                {getVenueAddress(venue)}
                                            </p>
                                        </div>
                                        <span className={cn(
                                            'rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]',
                                            isSelected
                                                ? (isDark ? 'bg-dashboard-panel text-zinc-100' : 'bg-white text-slate-900')
                                                : (isDark ? 'bg-dashboard-panel text-dashboard-muted' : 'bg-slate-100 text-slate-500')
                                        )}>
                                            {isSelected ? 'Selected' : 'Saved'}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <DashboardEmptyState
                        isDark={isDark}
                        compact
                        title="No saved venues"
                        description="Create venues in the venue workspace and they will appear here for assignment."
                    />
                )}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <DashboardStat
                    isDark={isDark}
                    label="Venue"
                    value={selectedVenue?.name || 'Set later'}
                    detail={selectedVenue ? 'Attached to the draft' : 'Open assignment'}
                />
                <DashboardStat
                    isDark={isDark}
                    label="Capacity"
                    value={selectedVenue?.capacity || derivedCapacity || 'Open'}
                    detail={selectedVenue?.capacity ? 'Venue maximum capacity' : 'Will follow ticketing or workspace updates'}
                />
                <DashboardStat
                    isDark={isDark}
                    label="Timezone"
                    value={selectedVenue?.timezone || formData.timezone || 'Not set'}
                    detail="Updated from the selected venue when available"
                />
            </div>
        </div>
    );

    const renderDetailsStep = () => (
        <div className="space-y-6">
            <div>
                <FieldLabel isDark={isDark}>Public description</FieldLabel>
                <textarea
                    value={formData.description}
                    onChange={(event) => updateFormData({ description: event.target.value })}
                    placeholder="Outline the lineup, timing, access, and what attendees should expect."
                    className={textareaClassName(isDark)}
                />

                <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div>
                        <FieldLabel isDark={isDark}>Poster or hero image URL</FieldLabel>
                        <input
                            type="url"
                            value={formData.imageUrl}
                            onChange={(event) => updateFormData({ imageUrl: event.target.value })}
                            placeholder="https://assets.tixmo.com/events/harbour-launch-poster.jpg"
                            className={inputClassName(isDark)}
                        />
                    </div>
                    <div className={cn(
                        'overflow-hidden rounded-md border',
                        isDark ? 'border-dashboard-border bg-dashboard-panelMuted' : 'border-slate-200 bg-slate-50'
                    )}>
                        <div className={cn(
                            'flex h-40 items-center justify-center border-b',
                            isDark ? 'border-dashboard-border bg-dashboard-panelAlt' : 'border-slate-200 bg-white'
                        )}>
                            {formData.imageUrl.trim() ? (
                                <img
                                    src={formData.imageUrl}
                                    alt="Event poster preview"
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className={cn('flex flex-col items-center gap-2 text-sm font-light', uiTheme.textSecondary)}>
                                    <ImageIcon size={24} />
                                    <span>Poster preview</span>
                                </div>
                            )}
                        </div>
                        <div className="p-4">
                            <p className={cn('text-sm font-light', uiTheme.textPrimary)}>
                                {formData.title.trim() || 'Untitled event'}
                            </p>
                            <p className={cn('mt-2 text-sm font-light leading-6', uiTheme.textSecondary)}>
                                {formData.category}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <DashboardStat
                    isDark={isDark}
                    label="Description"
                    value={formData.description.trim() ? 'Added' : 'Pending'}
                    detail={formData.description.trim() ? `${formData.description.trim().length} characters` : 'Add event context for the listing'}
                />
                <DashboardStat
                    isDark={isDark}
                    label="Poster"
                    value={formData.imageUrl.trim() ? 'Linked' : 'Pending'}
                    detail={formData.imageUrl.trim() || 'Add a hosted image URL for previews'}
                />
                <DashboardStat
                    isDark={isDark}
                    label="Tags"
                    value={tagList.length || 0}
                    detail={tagList.length ? tagList.join(' • ') : 'No discovery tags yet'}
                />
            </div>
        </div>
    );

    const renderTicketsStep = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h3 className={cn('text-xl font-light tracking-tight', uiTheme.textPrimary)}>Ticket structure</h3>
                    <p className={cn('mt-2 text-sm font-light leading-6', uiTheme.textSecondary)}>
                        Ticketing is optional for the draft, but adding it now makes the event shell immediately actionable after creation.
                    </p>
                </div>
                <DashboardChip isDark={isDark}>
                    {tickets.length ? `${tickets.length} configured` : 'Optional'}
                </DashboardChip>
            </div>
            <TicketBuilder tickets={tickets} onChange={setTickets} isDark={isDark} />

            <div className="grid gap-4 md:grid-cols-3">
                <DashboardStat
                    isDark={isDark}
                    label="Ticket types"
                    value={tickets.length}
                    detail={tickets.length ? tickets.map((ticket) => ticket.name).join(' • ') : 'No tickets configured'}
                />
                <DashboardStat
                    isDark={isDark}
                    label="Capacity"
                    value={derivedCapacity || 'Open'}
                    detail={totalTicketCapacity ? 'Derived from ticket quantity totals' : 'Falls back to venue or later setup'}
                />
                <DashboardStat
                    isDark={isDark}
                    label="Pricing tiers"
                    value={tickets.reduce((sum, ticket) => sum + (ticket.tiers?.length || 0), 0)}
                    detail="Additional pricing windows attached to ticket types"
                />
            </div>
        </div>
    );

    const renderReviewStep = () => (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className={metricCardClassName(isDark)}>
                    <p className={cn('text-[10px] uppercase tracking-[0.16em]', uiTheme.textTertiary)}>Event</p>
                    <p className={cn('mt-2 text-lg font-light tracking-tight', uiTheme.textPrimary)}>
                        {formData.title.trim() || 'Untitled event'}
                    </p>
                    <p className={cn('mt-2 text-sm font-light leading-6', uiTheme.textSecondary)}>
                        {formData.category}
                    </p>
                </div>
                <div className={metricCardClassName(isDark)}>
                    <p className={cn('text-[10px] uppercase tracking-[0.16em]', uiTheme.textTertiary)}>Schedule</p>
                    <p className={cn('mt-2 text-lg font-light tracking-tight', uiTheme.textPrimary)}>
                        {formatLocalDateTime(formData.startDateTime, { weekday: 'short' })}
                    </p>
                    <p className={cn('mt-2 text-sm font-light leading-6', uiTheme.textSecondary)}>
                        Ends {formatLocalDateTime(formData.endDateTime, { weekday: 'short' })}
                    </p>
                </div>
                <div className={metricCardClassName(isDark)}>
                    <p className={cn('text-[10px] uppercase tracking-[0.16em]', uiTheme.textTertiary)}>Venue</p>
                    <p className={cn('mt-2 text-lg font-light tracking-tight', uiTheme.textPrimary)}>
                        {selectedVenue?.name || 'Set later'}
                    </p>
                    <p className={cn('mt-2 text-sm font-light leading-6', uiTheme.textSecondary)}>
                        {selectedVenue ? getVenueAddress(selectedVenue) : 'Venue can be added in the event workspace'}
                    </p>
                </div>
                <div className={metricCardClassName(isDark)}>
                    <p className={cn('text-[10px] uppercase tracking-[0.16em]', uiTheme.textTertiary)}>Description</p>
                    <p className={cn('mt-2 text-sm font-light leading-6', uiTheme.textPrimary)}>
                        {formData.description.trim() || 'No public description yet'}
                    </p>
                </div>
                <div className={metricCardClassName(isDark)}>
                    <p className={cn('text-[10px] uppercase tracking-[0.16em]', uiTheme.textTertiary)}>Tags</p>
                    <p className={cn('mt-2 text-sm font-light leading-6', uiTheme.textPrimary)}>
                        {tagList.length ? tagList.join(', ') : 'No tags yet'}
                    </p>
                </div>
                <div className={metricCardClassName(isDark)}>
                    <p className={cn('text-[10px] uppercase tracking-[0.16em]', uiTheme.textTertiary)}>Tickets</p>
                    <p className={cn('mt-2 text-lg font-light tracking-tight', uiTheme.textPrimary)}>
                        {tickets.length ? `${tickets.length} configured` : 'Not configured'}
                    </p>
                    <p className={cn('mt-2 text-sm font-light leading-6', uiTheme.textSecondary)}>
                        {derivedCapacity ? `Capacity ${derivedCapacity}` : 'Capacity will stay open until ticketing is added'}
                    </p>
                </div>
            </div>

            <div className={cn('border-t pt-6', isDark ? 'border-dashboard-border' : 'border-slate-200')}>
                <div className="mb-4">
                    <h3 className={cn('text-xl font-light tracking-tight', uiTheme.textPrimary)}>After draft creation</h3>
                    <p className={cn('mt-2 text-sm font-light leading-6', uiTheme.textSecondary)}>
                        The draft opens into the event workspace where you can refine poster art, venue operations, on-sale timing, and publishing controls.
                    </p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                    <div className={metricCardClassName(isDark)}>
                        <p className={cn('text-sm font-light', uiTheme.textPrimary)}>Media and content</p>
                        <p className={cn('mt-2 text-sm font-light leading-6', uiTheme.textSecondary)}>
                            Refine public copy, linked media, and listing placement.
                        </p>
                    </div>
                    <div className={metricCardClassName(isDark)}>
                        <p className={cn('text-sm font-light', uiTheme.textPrimary)}>Inventory and pricing</p>
                        <p className={cn('mt-2 text-sm font-light leading-6', uiTheme.textSecondary)}>
                            Expand ticket tiers, inventory limits, and sales windows.
                        </p>
                    </div>
                    <div className={metricCardClassName(isDark)}>
                        <p className={cn('text-sm font-light', uiTheme.textPrimary)}>Operations</p>
                        <p className={cn('mt-2 text-sm font-light leading-6', uiTheme.textSecondary)}>
                            Connect scanners, staffing, and venue-side logistics when the shell is ready.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderStepContent = () => {
        if (step === 0) {
            return renderBasicsStep();
        }

        if (step === 1) {
            return renderScheduleStep();
        }

        if (step === 2) {
            return renderVenueStep();
        }

        if (step === 3) {
            return renderDetailsStep();
        }

        if (step === 4) {
            return renderTicketsStep();
        }

        return renderReviewStep();
    };

    return (
        <DashboardPage className="mx-auto max-w-[1680px]">
            <DashboardSurface isDark={isDark} accent="brand" className="p-5 sm:p-6">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                        <p className={cn('text-[11px] uppercase tracking-[0.18em]', uiTheme.textTertiary)}>
                            Step {step + 1} of {WIZARD_STEPS.length}
                        </p>
                        <h2 className={cn('mt-4 text-3xl font-light tracking-tight sm:text-4xl', uiTheme.textPrimary)}>
                            Event Builder
                        </h2>
                        <p className={cn('mt-2 max-w-xl text-sm font-light leading-6', uiTheme.textSecondary)}>
                            Set the essentials and create the draft.
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                        {onClose ? (
                            <DashboardButton isDark={isDark} variant="secondary" onClick={onClose} disabled={loading}>
                                Cancel
                            </DashboardButton>
                        ) : null}
                        <DashboardButton
                            isDark={isDark}
                            variant="secondary"
                            onClick={() => void handleCreateEvent()}
                            disabled={!canSaveDraft || loading}
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                            Save Draft
                        </DashboardButton>
                        <DashboardButton
                            isDark={isDark}
                            onClick={handleAdvance}
                            disabled={!canContinue || loading}
                        >
                            {step === WIZARD_STEPS.length - 1 ? 'Create Draft' : 'Continue'}
                            {!loading ? <ArrowRight size={16} /> : null}
                        </DashboardButton>
                    </div>
                </div>
            </DashboardSurface>

            {error ? (
                <DashboardSurface
                    isDark={isDark}
                    accent={null}
                    className={cn(
                        'p-4 text-sm font-light',
                        isDark ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-rose-300/50 bg-rose-50 text-rose-700'
                    )}
                >
                    {error}
                </DashboardSurface>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)_300px]">
                <DashboardSurface isDark={isDark} accent={null} className="h-fit p-3 sm:p-4 xl:sticky xl:top-6">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                            <p className={cn('text-[10px] uppercase tracking-[0.16em]', uiTheme.textTertiary)}>
                                Progress
                            </p>
                            <p className={cn('mt-1 text-sm font-light', uiTheme.textPrimary)}>
                                {step + 1} of {WIZARD_STEPS.length}
                            </p>
                        </div>
                        <p className={cn('text-sm font-light', uiTheme.textSecondary)}>
                            {highestVisitedStep + 1}/{WIZARD_STEPS.length}
                        </p>
                    </div>

                    <div className="space-y-2">
                        {WIZARD_STEPS.map((item, index) => {
                            const isActive = index === step;
                            const isVisited = index < step;
                            const isUnlocked = index <= highestVisitedStep;

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => handleStepChange(index)}
                                    disabled={!isUnlocked || loading}
                                    className={cn(
                                        'w-full rounded-md border px-3 py-2 text-left transition-colors',
                                        isActive
                                            ? (isDark ? 'border-dashboard-accent bg-dashboard-panelAlt text-zinc-100 shadow-[inset_2px_0_0_0_rgba(255,51,102,1)]' : 'border-rose-500 bg-rose-50 text-slate-900 shadow-[inset_2px_0_0_0_rgba(244,63,94,1)]')
                                            : isVisited
                                                ? (isDark ? 'border-dashboard-border bg-dashboard-panel text-zinc-100 hover:bg-dashboard-panelAlt' : 'border-slate-200 bg-slate-50 text-slate-900 hover:bg-white')
                                                : (isDark ? 'border-dashboard-border bg-dashboard-panelMuted text-dashboard-muted disabled:opacity-100' : 'border-slate-200 bg-white text-slate-500 disabled:opacity-100')
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-xs font-light',
                                            isActive
                                                ? (isDark ? 'border-dashboard-accent bg-dashboard-accent text-white' : 'border-rose-500 bg-rose-500 text-white')
                                                : isVisited
                                                    ? (isDark ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-emerald-500 bg-emerald-50 text-emerald-700')
                                                    : (isDark ? 'border-dashboard-borderStrong bg-dashboard-panel text-dashboard-muted' : 'border-slate-200 bg-slate-50 text-slate-500')
                                        )}>
                                            {isVisited ? <CheckCircle2 size={15} /> : <item.Icon size={15} />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium">{`${index + 1}. ${item.title}`}</p>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </DashboardSurface>

                <div className="min-w-0 space-y-6">
                    <DashboardSurface isDark={isDark} accent={null} className="overflow-hidden">
                        <div className={cn('border-b px-5 py-5 sm:px-6', isDark ? 'border-dashboard-border' : 'border-slate-200')}>
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <p className={cn('text-[11px] uppercase tracking-[0.18em]', uiTheme.textTertiary)}>
                                        Step
                                    </p>
                                    <h3 className={cn('mt-2 text-xl font-light tracking-tight sm:text-2xl', uiTheme.textPrimary)}>
                                        {currentStep.title}
                                    </h3>
                                </div>
                            </div>
                            <p className={cn('mt-3 max-w-2xl text-sm font-light leading-6', uiTheme.textSecondary)}>
                                {currentStep.detail}
                            </p>
                        </div>
                        <div className="p-5 sm:p-6">
                            {renderStepContent()}
                        </div>
                    </DashboardSurface>
                </div>

                <div className="space-y-6 xl:sticky xl:top-6 xl:h-fit">
                    <DashboardSurface isDark={isDark} accent={null} className="overflow-hidden">
                        <div className={cn(
                            'flex h-44 items-center justify-center border-b',
                            isDark ? 'border-dashboard-border bg-dashboard-panelAlt' : 'border-slate-200 bg-slate-50'
                        )}>
                            {formData.imageUrl.trim() ? (
                                <img
                                    src={formData.imageUrl}
                                    alt="Event preview"
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className={cn('flex flex-col items-center gap-2 text-sm font-light', uiTheme.textSecondary)}>
                                    <ImageIcon size={24} />
                                    <span>Live preview</span>
                                </div>
                            )}
                        </div>
                        <div className="p-5">
                            <p className={cn('text-xl font-light tracking-tight', uiTheme.textPrimary)}>
                                {formData.title.trim() || 'Untitled event'}
                            </p>
                            <p className={cn('mt-2 text-sm font-light leading-6', uiTheme.textSecondary)}>
                                {formData.category}
                            </p>

                            <div className="mt-5 space-y-4">
                                <div>
                                    <p className={cn('text-[10px] uppercase tracking-[0.16em]', uiTheme.textTertiary)}>Schedule</p>
                                    <p className={cn('mt-2 text-sm font-light', uiTheme.textPrimary)}>
                                        {formatLocalDateTime(formData.startDateTime, { weekday: 'short' })}
                                    </p>
                                </div>
                                <div>
                                    <p className={cn('text-[10px] uppercase tracking-[0.16em]', uiTheme.textTertiary)}>Venue</p>
                                    <p className={cn('mt-2 text-sm font-light', uiTheme.textPrimary)}>
                                        {selectedVenue?.name || 'Set later'}
                                    </p>
                                </div>
                                <div>
                                    <p className={cn('text-[10px] uppercase tracking-[0.16em]', uiTheme.textTertiary)}>Capacity</p>
                                    <p className={cn('mt-2 text-sm font-light', uiTheme.textPrimary)}>
                                        {derivedCapacity || 'Open'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </DashboardSurface>
                </div>
            </div>
        </DashboardPage>
    );
};

export default EventWizard;
