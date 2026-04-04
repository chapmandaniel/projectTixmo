import React, { useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    ArrowRight,
    CalendarDays,
    CheckCircle2,
    Loader2,
    MapPin,
    Sparkles,
} from 'lucide-react';
import api from '../lib/api';

const CATEGORY_OPTIONS = ['Music', 'Nightlife', 'Festival', 'Conference', 'Theater', 'Community'];

const QUESTION_STEPS = [
    {
        id: 'identity',
        eyebrow: 'Step 1',
        navTitle: 'Name',
        title: 'Event details',
        detail: 'Set the event title and primary category.',
        accent: 'from-sky-400 to-cyan-500',
        Icon: Sparkles,
    },
    {
        id: 'schedule',
        eyebrow: 'Step 2',
        navTitle: 'Schedule',
        title: 'Schedule',
        detail: 'Set the start and end time for the draft.',
        accent: 'from-emerald-400 to-teal-500',
        Icon: CalendarDays,
    },
    {
        id: 'venue',
        eyebrow: 'Step 3',
        navTitle: 'Venue',
        title: 'Venue',
        detail: 'Choose a saved venue or leave it open for later.',
        accent: 'from-amber-400 to-orange-500',
        Icon: MapPin,
    },
    {
        id: 'launch',
        eyebrow: 'Step 4',
        navTitle: 'Review',
        title: 'Review',
        detail: 'Check the required details, then create the draft event.',
        accent: 'from-fuchsia-500 to-pink-500',
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
        <div className="space-y-6 animate-fade-in">
            <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-center">
                <div>
                    <p className={`text-lg font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                        What is the event&apos;s name?
                    </p>
                </div>
                <input
                    autoFocus
                    type="text"
                    value={formData.title}
                    onChange={(event) => updateFormData({ title: event.target.value })}
                    placeholder="Neon Harbour Sessions"
                    className={`w-full rounded-md border px-4 py-4 text-lg font-light outline-none transition-colors ${isDark
                        ? 'border-[#2b2b40] bg-[#151521] text-white placeholder:text-[#5e6278] focus:border-fuchsia-400/40'
                        : 'border-gray-200 bg-white text-gray-900 placeholder:text-gray-300 focus:border-fuchsia-500'
                    }`}
                />
            </div>

            <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
                <div>
                    <p className={`text-lg font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                        What is the category?
                    </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {CATEGORY_OPTIONS.map((option) => {
                        const isSelected = formData.category === option;
                        return (
                            <button
                                key={option}
                                type="button"
                                onClick={() => updateFormData({ category: option })}
                                className={`rounded-md border px-4 py-4 text-left text-sm font-light transition-all ${isSelected
                                    ? (isDark ? 'border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-100' : 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700')
                                    : (isDark ? 'border-[#2b2b40] bg-[#151521] text-gray-200 hover:border-[#3a3a5a] hover:bg-[#232336]' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50')
                                }`}
                            >
                                {option}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );

    const renderScheduleStep = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-center">
                <div>
                    <p className={`text-lg font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                        When does it start?
                    </p>
                </div>
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
                    className={`w-full rounded-md border px-4 py-4 text-lg font-light outline-none transition-colors ${isDark
                        ? 'border-[#2b2b40] bg-[#151521] text-white focus:border-emerald-400/40'
                        : 'border-gray-200 bg-white text-gray-900 focus:border-emerald-500'
                    }`}
                />
            </div>

            <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-center">
                <div>
                    <p className={`text-lg font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                        When does it end?
                    </p>
                </div>
                <input
                    type="datetime-local"
                    value={formData.endDateTime}
                    onChange={(event) => updateFormData({ endDateTime: event.target.value })}
                    className={`w-full rounded-md border px-4 py-4 text-lg font-light outline-none transition-colors ${isDark
                        ? 'border-[#2b2b40] bg-[#151521] text-white focus:border-emerald-400/40'
                        : 'border-gray-200 bg-white text-gray-900 focus:border-emerald-500'
                    }`}
                />
            </div>

            <div className={`rounded-md border p-5 ${isDark ? 'border-[#2b2b40] bg-[#151521]' : 'border-gray-200 bg-gray-50'}`}>
                <div className="grid gap-4 md:grid-cols-3">
                    <div>
                        <p className={`text-[11px] uppercase tracking-[0.18em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                            Start
                        </p>
                        <p className={`mt-2 text-base font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                            {formatLocalDateTime(formData.startDateTime, { weekday: 'short' })}
                        </p>
                    </div>
                    <div>
                        <p className={`text-[11px] uppercase tracking-[0.18em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                            End
                        </p>
                        <p className={`mt-2 text-base font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                            {formatLocalDateTime(formData.endDateTime, { weekday: 'short' })}
                        </p>
                    </div>
                    <div>
                        <p className={`text-[11px] uppercase tracking-[0.18em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                            Duration
                        </p>
                        <p className={`mt-2 text-base font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                            {getDurationLabel(formData.startDateTime, formData.endDateTime)}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderVenueStep = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
                <div>
                    <p className={`text-lg font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                        Where is the event?
                    </p>
                    <p className={`mt-2 text-sm leading-6 ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                        Choose a saved venue or leave it open for later.
                    </p>
                </div>
                <div className="space-y-4">
                    <button
                        type="button"
                        onClick={() => updateFormData({ venueId: '' })}
                        className={`w-full rounded-md border p-5 text-left transition-all ${!formData.venueId
                            ? (isDark ? 'border-amber-400/30 bg-amber-500/10 text-amber-50' : 'border-amber-200 bg-amber-50 text-amber-700 shadow-sm')
                            : (isDark ? 'border-[#2b2b40] bg-[#151521] text-gray-200 hover:border-[#3a3a5a] hover:bg-[#232336]' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 shadow-sm')
                        }`}
                    >
                        <p className={`text-[11px] uppercase tracking-[0.2em] ${!formData.venueId ? (isDark ? 'text-amber-200' : 'text-amber-700') : (isDark ? 'text-[#8f94aa]' : 'text-gray-500')}`}>
                            Decide later
                        </p>
                        <p className="mt-2 text-base font-light">
                            Create the draft without assigning a venue.
                        </p>
                    </button>

                    {venues.length > 0 ? (
                        <div className="grid gap-3 xl:grid-cols-2">
                            {venues.map((venue) => {
                                const isSelected = formData.venueId === venue.id;

                                return (
                                    <button
                                        key={venue.id}
                                        type="button"
                                        onClick={() => updateFormData({ venueId: venue.id })}
                                        className={`rounded-md border p-5 text-left transition-all ${isSelected
                                            ? (isDark ? 'border-amber-400/30 bg-amber-500/10' : 'border-amber-200 bg-amber-50 shadow-sm')
                                            : (isDark ? 'border-[#2b2b40] bg-[#151521] hover:border-[#3a3a5a] hover:bg-[#232336]' : 'border-gray-200 bg-white hover:bg-gray-50 shadow-sm')
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className={`text-[11px] uppercase tracking-[0.18em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                                                    Saved venue
                                                </p>
                                                <p className={`mt-2 text-base font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                                                    {venue.name}
                                                </p>
                                            </div>
                                            {isSelected ? (
                                                <span className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.16em] ${isDark ? 'border border-amber-400/20 bg-amber-500/10 text-amber-100' : 'border border-amber-200 bg-amber-100 text-amber-700'}`}>
                                                    Selected
                                                </span>
                                            ) : null}
                                        </div>
                                        <p className={`mt-3 text-sm leading-6 ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                                            {getVenueAddress(venue)}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className={`rounded-md border border-dashed px-4 py-10 text-center text-sm font-light ${isDark ? 'border-[#2b2b40] bg-[#151521] text-[#8f94aa]' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                            No saved venues yet.
                        </div>
                    )}
                </div>
            </div>

            <div className={`rounded-md border p-5 ${isDark ? 'border-[#2b2b40] bg-[#151521]' : 'border-gray-200 bg-gray-50'}`}>
                <div className="grid gap-4 md:grid-cols-3">
                    <div>
                        <p className={`text-[11px] uppercase tracking-[0.18em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                            Venue
                        </p>
                        <p className={`mt-2 text-base font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                            {selectedVenue?.name || 'Set later'}
                        </p>
                    </div>
                    <div>
                        <p className={`text-[11px] uppercase tracking-[0.18em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                            Address
                        </p>
                        <p className={`mt-2 text-base font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                            {selectedVenue ? getVenueAddress(selectedVenue) : 'To be assigned'}
                        </p>
                    </div>
                    <div>
                        <p className={`text-[11px] uppercase tracking-[0.18em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                            Capacity
                        </p>
                        <p className={`mt-2 text-base font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                            {selectedVenue?.capacity ? selectedVenue.capacity : 'Set later'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderLaunchStep = () => (
        <div className="space-y-6 animate-fade-in">
            <div className={`rounded-md border p-5 ${isDark ? 'border-[#2b2b40] bg-[#151521]' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h3 className={`text-2xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                            {formData.title.trim() || 'Untitled event'}
                        </h3>
                        <p className={`mt-1 text-sm font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                            Review the required details before creating the draft.
                        </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${isDark ? 'border border-white/10 bg-white/5 text-[#8f94aa]' : 'border border-gray-200 bg-white text-gray-500'}`}>
                        {formData.category}
                    </span>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className={`rounded-md border px-4 py-4 ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white'}`}>
                        <p className={`text-[10px] uppercase tracking-[0.16em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                            Category
                        </p>
                        <p className={`mt-2 text-base font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                            {formData.category}
                        </p>
                    </div>
                    <div className={`rounded-md border px-4 py-4 ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white'}`}>
                        <p className={`text-[10px] uppercase tracking-[0.16em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                            Start
                        </p>
                        <p className={`mt-2 text-base font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                            {formatLocalDateTime(formData.startDateTime, { weekday: 'short' })}
                        </p>
                    </div>
                    <div className={`rounded-md border px-4 py-4 ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white'}`}>
                        <p className={`text-[10px] uppercase tracking-[0.16em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                            End
                        </p>
                        <p className={`mt-2 text-base font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                            {formatLocalDateTime(formData.endDateTime, { weekday: 'short' })}
                        </p>
                    </div>
                    <div className={`rounded-md border px-4 py-4 ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white'}`}>
                        <p className={`text-[10px] uppercase tracking-[0.16em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                            Venue
                        </p>
                        <p className={`mt-2 text-base font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                            {selectedVenue?.name || 'Set later'}
                        </p>
                    </div>
                </div>
            </div>

            <div className={`rounded-md border p-5 ${isDark ? 'border-[#2b2b40] bg-[#151521]' : 'border-gray-200 bg-gray-50'}`}>
                <p className={`text-[11px] uppercase tracking-[0.18em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                    After creation
                </p>
                <p className={`mt-3 text-sm leading-7 ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                    Add tickets, artwork, public-page copy, and publishing settings in the event dashboard.
                </p>
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
        <div className="space-y-6 animate-fade-in max-w-[1500px] mx-auto pb-12">
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {QUESTION_STEPS.map((item, index) => {
                    const isActive = index === step;
                    const isComplete = index < step;
                    const ItemIcon = item.Icon;

                    return (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                                if (index <= step && !loading) {
                                    setError('');
                                    setStep(index);
                                }
                            }}
                            disabled={index > step || loading}
                            className={`relative overflow-hidden rounded-md border p-5 text-left transition-all ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white shadow-sm'} ${index <= step ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}
                        >
                            <div className={`absolute left-0 top-0 h-[3px] w-full bg-gradient-to-r ${item.accent} ${isActive || isComplete ? 'opacity-90' : 'opacity-35'}`} />
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className={`text-xs uppercase tracking-[0.18em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                                        {item.eyebrow}
                                    </p>
                                    <p className={`mt-3 text-3xl font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                                        {index + 1}
                                    </p>
                                </div>
                                <div className={`flex h-11 w-11 items-center justify-center rounded-md ${isDark ? 'bg-[#151521]' : 'bg-gray-50'} ${isActive ? (isDark ? 'text-gray-100' : 'text-gray-900') : (isDark ? 'text-[#8f94aa]' : 'text-gray-500')}`}>
                                    <ItemIcon size={18} />
                                </div>
                            </div>
                            <p className={`mt-4 text-base font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                                {item.navTitle}
                            </p>
                        </button>
                    );
                })}
            </section>

            {error ? (
                <div className={`rounded-md border px-4 py-3 text-sm font-light ${isDark ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                    {error}
                </div>
            ) : null}

            <section className={`rounded-md border p-5 sm:p-6 ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white shadow-sm'}`}>
                <div className="min-h-[340px]">
                    {renderStepContent()}
                </div>

                <div className={`mt-6 flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-center sm:justify-between ${isDark ? 'border-[#2b2b40]' : 'border-gray-200'}`}>
                    <div>
                        {step > 0 ? (
                            <button
                                type="button"
                                onClick={handleBack}
                                disabled={loading}
                                className={`inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${isDark ? 'text-gray-200 hover:bg-[#232336]' : 'text-gray-700 hover:bg-gray-100'}`}
                            >
                                <ArrowLeft size={16} />
                                Previous
                            </button>
                        ) : null}
                    </div>

                    {step < QUESTION_STEPS.length - 1 ? (
                        <button
                            type="button"
                            onClick={handleNext}
                            disabled={!canAdvance || loading}
                            className={`inline-flex items-center justify-center gap-2 rounded-md px-6 py-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${isDark ? 'bg-pink-500 text-white hover:bg-pink-400' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                        >
                            Next
                            <ArrowRight size={16} />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleCreateEvent}
                            disabled={loading}
                            className={`inline-flex items-center justify-center gap-2 rounded-md px-6 py-3 text-sm text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${isDark ? 'bg-pink-500 hover:bg-pink-400' : 'bg-gray-900 hover:bg-gray-800'}`}
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                            Create event
                        </button>
                    )}
                </div>
            </section>
        </div>
    );
};

export default EventWizard;
