import React, { useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    ArrowRight,
    CalendarDays,
    CheckCircle2,
    Loader2,
    MapPin,
    Sparkles,
    X,
} from 'lucide-react';
import api from '../lib/api';

const CATEGORY_OPTIONS = ['Music', 'Nightlife', 'Festival', 'Conference', 'Theater', 'Community'];

const QUESTION_STEPS = [
    {
        id: 'identity',
        eyebrow: 'Question 1',
        title: 'What should people call this event?',
        detail: 'Name it, pick the lane, and the draft shell will carry the rest into the dashboard.',
        accent: 'from-sky-400 to-cyan-500',
        Icon: Sparkles,
    },
    {
        id: 'schedule',
        eyebrow: 'Question 2',
        title: 'When does it happen?',
        detail: 'Set the core timing now. You can refine schedules, doors, and on-sale moments later.',
        accent: 'from-sky-400 to-cyan-500',
        Icon: CalendarDays,
    },
    {
        id: 'venue',
        eyebrow: 'Question 3',
        title: 'Where should people show up?',
        detail: 'Pick a saved venue or leave it open and finish that detail inside the event workspace.',
        accent: 'from-sky-400 to-cyan-500',
        Icon: MapPin,
    },
    {
        id: 'launch',
        eyebrow: 'Handoff',
        title: 'Ready to generate the draft?',
        detail: 'The wizard creates the event shell. Tickets, artwork, copy, and publishing stay in the event dashboard.',
        accent: 'from-sky-400 to-cyan-500',
        Icon: CheckCircle2,
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

const EventWizard = ({ onClose, onSuccess, isDark, user }) => {
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [venues, setVenues] = useState([]);
    const [formData, setFormData] = useState({
        title: '',
        category: 'Music',
        startDateTime: '',
        endDateTime: '',
        venueId: '',
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

    const currentStep = QUESTION_STEPS[step];
    const selectedVenue = useMemo(
        () => venues.find((venue) => venue.id === formData.venueId) || null,
        [formData.venueId, venues]
    );

    const updateFormData = (patch) => {
        setError('');
        setFormData((current) => ({ ...current, ...patch }));
    };

    const validateStep = (stepIndex) => {
        if (stepIndex === 0 && !formData.title.trim()) {
            return 'Give the event a title before moving on.';
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
                return 'End time needs to be after the start time.';
            }
        }

        return '';
    };

    const canAdvance = useMemo(() => {
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

    const handleNext = () => {
        const nextError = validateStep(step);
        if (nextError) {
            setError(nextError);
            return;
        }

        setError('');
        setStep((current) => Math.min(current + 1, QUESTION_STEPS.length - 1));
    };

    const handleBack = () => {
        setError('');
        if (step === 0) {
            onClose?.();
            return;
        }

        setStep((current) => Math.max(current - 1, 0));
    };

    const handleCreateEvent = async () => {
        const title = formData.title.trim();
        if (!user?.organizationId) {
            setError('Your organization is missing. Reload and try again.');
            return;
        }

        const scheduleError = validateStep(0) || validateStep(1);
        if (scheduleError) {
            setError(scheduleError);
            return;
        }

        setLoading(true);
        setError('');

        try {
            const payload = {
                title,
                organizationId: user.organizationId,
                startDateTime: new Date(formData.startDateTime).toISOString(),
                endDateTime: new Date(formData.endDateTime).toISOString(),
                venueId: formData.venueId || undefined,
                capacity: selectedVenue?.capacity || undefined,
                category: formData.category,
                timezone: selectedVenue?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
                status: 'DRAFT',
            };

            const response = await api.post('/events', payload);
            const created = response.data?.data || response.data?.event || response.data || {};
            const createdEvent = {
                ...created,
                id: created.id,
                title: created.title || title,
                name: created.name || title,
                category: created.category || formData.category,
                status: created.status || 'DRAFT',
                startDateTime: created.startDateTime || created.startDatetime || payload.startDateTime,
                endDateTime: created.endDateTime || created.endDatetime || payload.endDateTime,
                venueId: created.venueId || payload.venueId || '',
                venue: created.venue || selectedVenue || null,
                capacity: created.capacity || payload.capacity || null,
            };

            onSuccess?.(createdEvent);
        } catch (requestError) {
            console.error(requestError);
            setError(requestError.response?.data?.message || requestError.message || 'Failed to create event.');
        } finally {
            setLoading(false);
        }
    };

    const renderIdentityStep = () => (
        <div className="space-y-8 animate-fade-in">
            <div className={`rounded-md border p-6 ${isDark ? 'border-[#2b2b40] bg-[#151521]' : 'border-gray-200 bg-white shadow-sm'}`}>
                <label className="block">
                    <span className={`mb-3 block text-[11px] uppercase tracking-[0.24em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                        Event title
                    </span>
                    <input
                        autoFocus
                        type="text"
                        value={formData.title}
                        onChange={(event) => updateFormData({ title: event.target.value })}
                        placeholder="Neon Harbour Sessions"
                        className={`w-full border-b bg-transparent pb-4 text-3xl font-light tracking-tight outline-none transition-colors sm:text-4xl ${isDark
                            ? 'border-[#2b2b40] text-white placeholder:text-[#5e6278] focus:border-sky-400'
                            : 'border-gray-200 text-gray-900 placeholder:text-gray-300 focus:border-sky-500'
                        }`}
                    />
                </label>
            </div>

            <div className="space-y-3">
                <p className={`text-[11px] uppercase tracking-[0.24em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                    Category
                </p>
                <div className="flex flex-wrap gap-3">
                    {CATEGORY_OPTIONS.map((option) => {
                        const isSelected = formData.category === option;
                        return (
                            <button
                                key={option}
                                type="button"
                                onClick={() => updateFormData({ category: option })}
                                className={`rounded-md border px-4 py-2 text-sm font-light transition-all ${isSelected
                                    ? (isDark ? 'border-sky-400/30 bg-sky-500/10 text-sky-100' : 'border-sky-200 bg-sky-50 text-sky-700')
                                    : (isDark ? 'border-[#2b2b40] bg-[#151521] text-gray-200 hover:border-[#3a3a5a] hover:bg-[#232336]' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50')
                                }`}
                            >
                                {option}
                            </button>
                        );
                    })}
                </div>
            </div>

            <p className={`max-w-2xl text-sm leading-7 ${isDark ? 'text-[#b8bed4]' : 'text-gray-500'}`}>
                The wizard keeps this intentionally lean. Description, artwork, ticketing, promo codes, and public-page polish move to the event dashboard after creation.
            </p>
        </div>
    );

    const renderScheduleStep = () => (
        <div className="space-y-8 animate-fade-in">
            <div className="grid gap-6 xl:grid-cols-2">
                <label className={`rounded-md border p-6 transition-colors ${isDark ? 'border-[#2b2b40] bg-[#151521]' : 'border-gray-200 bg-white shadow-sm'}`}>
                    <span className={`mb-3 block text-[11px] uppercase tracking-[0.24em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                        Start
                    </span>
                    <input
                        type="datetime-local"
                        value={formData.startDateTime}
                        onChange={(event) => {
                            const nextStart = event.target.value;
                            const nextPatch = { startDateTime: nextStart };

                            if (nextStart && (!formData.endDateTime || new Date(formData.endDateTime) <= new Date(nextStart))) {
                                nextPatch.endDateTime = addHoursToDateTimeLocal(nextStart, 3);
                            }

                            updateFormData(nextPatch);
                        }}
                        className={`w-full bg-transparent text-lg font-light outline-none ${isDark ? 'text-white' : 'text-gray-900'}`}
                    />
                </label>

                <label className={`rounded-md border p-6 transition-colors ${isDark ? 'border-[#2b2b40] bg-[#151521]' : 'border-gray-200 bg-white shadow-sm'}`}>
                    <span className={`mb-3 block text-[11px] uppercase tracking-[0.24em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                        End
                    </span>
                    <input
                        type="datetime-local"
                        value={formData.endDateTime}
                        onChange={(event) => updateFormData({ endDateTime: event.target.value })}
                        className={`w-full bg-transparent text-lg font-light outline-none ${isDark ? 'text-white' : 'text-gray-900'}`}
                    />
                </label>
            </div>

            <div className={`grid gap-4 rounded-md border p-6 lg:grid-cols-[1.2fr_0.8fr] ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white shadow-sm'}`}>
                <div>
                    <p className={`text-[11px] uppercase tracking-[0.24em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                        Timeline preview
                    </p>
                    <div className="mt-4 space-y-3">
                        <div>
                            <p className={`text-xs ${isDark ? 'text-[#8f96b0]' : 'text-gray-500'}`}>Start</p>
                            <p className={`text-xl font-light tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {formatLocalDateTime(formData.startDateTime, { weekday: 'short' })}
                            </p>
                        </div>
                        <div>
                            <p className={`text-xs ${isDark ? 'text-[#8f96b0]' : 'text-gray-500'}`}>End</p>
                            <p className={`text-xl font-light tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {formatLocalDateTime(formData.endDateTime, { weekday: 'short' })}
                            </p>
                        </div>
                    </div>
                </div>
                <div className={`rounded-md p-5 ${isDark ? 'bg-[#151521]' : 'bg-gray-50'}`}>
                    <p className={`text-[11px] uppercase tracking-[0.24em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                        Wizard note
                    </p>
                    <p className={`mt-3 text-sm leading-7 ${isDark ? 'text-[#c7cee2]' : 'text-gray-600'}`}>
                        If you only choose the start time first, the wizard auto-sets the end time three hours later so you can keep moving.
                    </p>
                </div>
            </div>
        </div>
    );

    const renderVenueStep = () => (
        <div className="space-y-8 animate-fade-in">
            <div className="grid gap-4 xl:grid-cols-2">
                <button
                    type="button"
                    onClick={() => updateFormData({ venueId: '' })}
                    className={`rounded-md border p-6 text-left transition-all ${!formData.venueId
                        ? (isDark ? 'border-sky-400/30 bg-sky-500/10' : 'border-sky-200 bg-sky-50 shadow-sm')
                        : (isDark ? 'border-[#2b2b40] bg-[#151521] hover:border-[#3a3a5a] hover:bg-[#232336]' : 'border-gray-200 bg-white hover:bg-gray-50 shadow-sm')
                    }`}
                >
                    <p className={`text-[11px] uppercase tracking-[0.24em] ${isDark ? 'text-sky-200' : 'text-sky-700'}`}>
                        Decide later
                    </p>
                    <h3 className={`mt-3 text-2xl font-light tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Start with a venue-free draft
                    </h3>
                    <p className={`mt-3 text-sm leading-7 ${isDark ? 'text-[#c7cee2]' : 'text-gray-600'}`}>
                        The event dashboard can assign the venue later, along with capacity, layout, and any venue-specific edits.
                    </p>
                </button>

                <div className={`rounded-md border p-6 ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white shadow-sm'}`}>
                    <p className={`text-[11px] uppercase tracking-[0.24em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                        Selected venue
                    </p>
                    <h3 className={`mt-3 text-2xl font-light tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {selectedVenue?.name || 'Venue to be assigned'}
                    </h3>
                    <p className={`mt-2 text-sm leading-7 ${isDark ? 'text-[#b8bed4]' : 'text-gray-600'}`}>
                        {selectedVenue ? getVenueAddress(selectedVenue) : 'No venue is locked yet. This will stay editable after the draft is created.'}
                    </p>
                    {selectedVenue?.capacity ? (
                        <p className={`mt-4 text-sm ${isDark ? 'text-emerald-200' : 'text-emerald-700'}`}>
                            Capacity will start at {selectedVenue.capacity}.
                        </p>
                    ) : null}
                </div>
            </div>

            {venues.length > 0 ? (
                <div className="grid gap-4 xl:grid-cols-2">
                    {venues.map((venue) => {
                        const isSelected = formData.venueId === venue.id;

                        return (
                            <button
                                key={venue.id}
                                type="button"
                                onClick={() => updateFormData({ venueId: venue.id })}
                                className={`rounded-md border p-6 text-left transition-all ${isSelected
                                    ? (isDark ? 'border-sky-400/30 bg-sky-500/10' : 'border-sky-200 bg-sky-50 shadow-sm')
                                    : (isDark ? 'border-[#2b2b40] bg-[#151521] hover:border-[#3a3a5a] hover:bg-[#232336]' : 'border-gray-200 bg-white hover:bg-gray-50 shadow-sm')
                                }`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className={`text-[11px] uppercase tracking-[0.24em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                                            Saved venue
                                        </p>
                                        <h3 className={`mt-2 text-2xl font-light tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            {venue.name}
                                        </h3>
                                    </div>
                                    {isSelected ? (
                                        <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${isDark ? 'border border-sky-400/20 bg-sky-500/15 text-sky-100' : 'border border-sky-100 bg-sky-100 text-sky-700'}`}>
                                            Selected
                                        </span>
                                    ) : null}
                                </div>
                                <p className={`mt-3 text-sm leading-7 ${isDark ? 'text-[#c7cee2]' : 'text-gray-600'}`}>
                                    {getVenueAddress(venue)}
                                </p>
                                <div className={`mt-5 flex items-center justify-between text-sm ${isDark ? 'text-[#9ca3c7]' : 'text-gray-500'}`}>
                                    <span>{venue.address?.city || 'City unavailable'}</span>
                                    <span>{venue.capacity ? `${venue.capacity} cap` : 'Capacity later'}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div className={`rounded-md border border-dashed p-8 ${isDark ? 'border-[#2b2b40] bg-[#151521]' : 'border-gray-200 bg-gray-50'}`}>
                    <p className={`text-lg font-light tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        No saved venues yet.
                    </p>
                    <p className={`mt-2 text-sm leading-7 ${isDark ? 'text-[#b8bed4]' : 'text-gray-600'}`}>
                        Create the draft now and add the venue from the dashboard when your location is ready.
                    </p>
                </div>
            )}
        </div>
    );

    const renderLaunchStep = () => (
        <div className="space-y-8 animate-fade-in">
            <div className={`overflow-hidden rounded-md border ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white shadow-sm'}`}>
                <div className="relative overflow-hidden px-7 py-8 sm:px-8">
                    <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${currentStep.accent}`} />
                    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
                        <div>
                            <p className={`text-[11px] uppercase tracking-[0.24em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                                Draft summary
                            </p>
                            <h3 className={`mt-3 text-3xl font-light tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {formData.title.trim() || 'Untitled event'}
                            </h3>
                            <div className={`mt-6 grid gap-4 sm:grid-cols-2 ${isDark ? 'text-[#d7dcef]' : 'text-gray-900'}`}>
                                <div>
                                    <p className={`text-[11px] uppercase tracking-[0.2em] ${isDark ? 'text-[#8f96b0]' : 'text-gray-500'}`}>
                                        Category
                                    </p>
                                    <p className="mt-2 text-lg font-light">{formData.category}</p>
                                </div>
                                <div>
                                    <p className={`text-[11px] uppercase tracking-[0.2em] ${isDark ? 'text-[#8f96b0]' : 'text-gray-500'}`}>
                                        Venue
                                    </p>
                                    <p className="mt-2 text-lg font-light">{selectedVenue?.name || 'Set later in dashboard'}</p>
                                </div>
                                <div>
                                    <p className={`text-[11px] uppercase tracking-[0.2em] ${isDark ? 'text-[#8f96b0]' : 'text-gray-500'}`}>
                                        Starts
                                    </p>
                                    <p className="mt-2 text-lg font-light">{formatLocalDateTime(formData.startDateTime, { weekday: 'short' })}</p>
                                </div>
                                <div>
                                    <p className={`text-[11px] uppercase tracking-[0.2em] ${isDark ? 'text-[#8f96b0]' : 'text-gray-500'}`}>
                                        Ends
                                    </p>
                                    <p className="mt-2 text-lg font-light">{formatLocalDateTime(formData.endDateTime, { weekday: 'short' })}</p>
                                </div>
                            </div>
                        </div>

                        <div className={`rounded-md p-6 ${isDark ? 'bg-[#151521]' : 'bg-gray-50'}`}>
                            <p className={`text-[11px] uppercase tracking-[0.24em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                                Next in the dashboard
                            </p>
                            <div className={`mt-4 space-y-4 text-sm leading-7 ${isDark ? 'text-[#c7cee2]' : 'text-gray-600'}`}>
                                <p>Add event description, poster art, and search tags.</p>
                                <p>Build ticket types, tiers, inventory, and pricing.</p>
                                <p>Review public-page details, marketing settings, and publishing state.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderStepContent = () => {
        if (step === 0) {
            return renderIdentityStep();
        }

        if (step === 1) {
            return renderScheduleStep();
        }

        if (step === 2) {
            return renderVenueStep();
        }

        return renderLaunchStep();
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <section className={`rounded-md border overflow-hidden ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40]/60 shadow-lg shadow-black/20' : 'bg-white border-gray-200/60 shadow-sm'}`}>
                <div className={`p-6 sm:p-8 border-b ${isDark ? 'border-[#2b2b40]/60' : 'border-gray-200/60'}`}>
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <p className={`text-[11px] uppercase tracking-[0.28em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                                    Event Creation Wizard
                                </p>
                                <p className={`mt-2 text-[11px] uppercase tracking-[0.28em] ${isDark ? 'text-[#707791]' : 'text-gray-400'}`}>
                                    Step {step + 1} of {QUESTION_STEPS.length}
                                </p>
                                <h3 className={`mt-4 text-3xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                                    {currentStep.title}
                                </h3>
                                <p className={`mt-3 max-w-2xl text-sm leading-7 ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                                    {currentStep.detail}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={onClose}
                                className={`inline-flex h-10 w-10 items-center justify-center rounded-md border transition-colors ${isDark ? 'border-[#2b2b40]/60 text-[#a1a5b7] hover:text-gray-200 hover:bg-[#232336]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                aria-label="Close wizard"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="overflow-x-auto pb-1">
                            <div className="min-w-[720px]">
                                <div className="relative grid grid-cols-4 gap-4">
                                    <div className={`absolute left-[6%] right-[6%] top-5 h-0.5 ${isDark ? 'bg-[#2b2b40]' : 'bg-gray-200'}`} />
                                    <div
                                        className={`absolute left-[6%] top-5 h-0.5 transition-all duration-300 ${isDark ? 'bg-sky-400/80' : 'bg-sky-500'}`}
                                        style={{ width: `${Math.max(0, (step / (QUESTION_STEPS.length - 1)) * 88)}%` }}
                                    />

                                    {QUESTION_STEPS.map((item, index) => {
                                        const isActive = index === step;
                                        const isComplete = index < step;
                                        const ItemIcon = item.Icon;

                                        return (
                                            <div key={item.id} className="relative z-10 flex flex-col items-center text-center">
                                                <div className={`flex h-10 w-10 items-center justify-center rounded-full border transition-all ${isComplete
                                                    ? (isDark ? 'border-sky-400/30 bg-sky-500 text-white' : 'border-sky-500 bg-sky-500 text-white')
                                                    : isActive
                                                        ? (isDark ? 'border-sky-400/30 bg-[#232336] text-sky-100' : 'border-sky-500 bg-white text-sky-600')
                                                        : (isDark ? 'border-[#2b2b40] bg-[#151521] text-[#8f94aa]' : 'border-gray-200 bg-white text-gray-400')
                                                }`}>
                                                    <ItemIcon size={16} />
                                                </div>
                                                <p className={`mt-3 text-[10px] uppercase tracking-[0.2em] ${isActive ? (isDark ? 'text-sky-200' : 'text-sky-700') : (isDark ? 'text-[#8f94aa]' : 'text-gray-500')}`}>
                                                    {item.eyebrow}
                                                </p>
                                                <p className={`mt-1 text-sm font-light leading-5 ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>
                                                    {item.title}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 sm:p-8">
                    {error ? (
                        <div className={`mb-8 rounded-md border px-5 py-4 text-sm font-light ${isDark ? 'border-rose-400/30 bg-rose-500/10 text-rose-100' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                            {error}
                        </div>
                    ) : null}

                    <div className="min-h-[420px]">
                        {renderStepContent()}
                    </div>
                </div>

                <div className={`px-6 py-5 sm:px-8 border-t flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${isDark ? 'border-[#2b2b40]/60 bg-[#151521]' : 'border-gray-200/60 bg-gray-50/60'}`}>
                    <button
                        type="button"
                        onClick={handleBack}
                        disabled={loading}
                        className={`inline-flex items-center gap-2 rounded-md px-5 py-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${isDark ? 'text-gray-200 hover:bg-[#232336]' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                        <ArrowLeft size={16} />
                        {step === 0 ? 'Back to tools' : 'Previous question'}
                    </button>

                    <div className={`rounded-md border px-4 py-3 text-sm font-light ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d] text-[#d7dcef]' : 'border-gray-200 bg-white text-gray-700'}`}>
                        {formData.title.trim() || 'Untitled event'}
                    </div>

                    {step < QUESTION_STEPS.length - 1 ? (
                        <button
                            type="button"
                            onClick={handleNext}
                            disabled={!canAdvance || loading}
                            className={`inline-flex items-center justify-center gap-2 rounded-md px-6 py-3 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-40 ${isDark ? 'bg-sky-500 text-white hover:bg-sky-400 shadow-lg shadow-sky-500/20' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                        >
                            Continue
                            <ArrowRight size={16} />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleCreateEvent}
                            disabled={loading}
                            className={`inline-flex items-center justify-center gap-2 rounded-md px-6 py-3 text-sm text-white transition-all disabled:cursor-not-allowed disabled:opacity-50 ${isDark ? 'bg-sky-500 hover:bg-sky-400 shadow-lg shadow-sky-500/20' : 'bg-gray-900 hover:bg-gray-800'}`}
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                            Create draft and open dashboard
                        </button>
                    )}
                </div>
            </section>
        </div>
    );
};

export default EventWizard;
