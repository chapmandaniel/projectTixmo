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
        navTitle: 'What is the name of the new event?',
        title: 'Event details',
        detail: 'Set the event title and primary category.',
        accent: 'from-[#b235fb] to-[#b235fb]',
        Icon: Sparkles,
    },
    {
        id: 'schedule',
        eyebrow: 'Step 2',
        navTitle: 'When is the new event happening?',
        title: 'Schedule',
        detail: 'Set the start and end time for the draft.',
        accent: 'from-[#b235fb] to-[#b235fb]',
        Icon: CalendarDays,
    },
    {
        id: 'venue',
        eyebrow: 'Step 3',
        navTitle: 'Where is the new event happening?',
        title: 'Venue',
        detail: 'Choose a saved venue or leave it open for later.',
        accent: 'from-[#b235fb] to-[#b235fb]',
        Icon: MapPin,
    },
    {
        id: 'launch',
        eyebrow: 'Step 4',
        navTitle: 'Save as draft.',
        title: 'Review',
        detail: 'Check the required details, then create the draft event.',
        accent: 'from-[#b235fb] to-[#b235fb]',
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

const STEP_LABELS = {
    identity: 'Step 1: Event Details',
    schedule: 'Step 2: Schedule',
    venue: 'Step 3: Venue',
    launch: 'Step 4: Review',
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
    const currentStepLabel = STEP_LABELS[currentStep.id];
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
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] animate-fade-in">
            <div className="space-y-6">
                <div>
                    <label className={`mb-3 block text-[11px] uppercase tracking-[0.22em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                        Event Name
                    </label>
                    <input
                        autoFocus
                        type="text"
                        value={formData.title}
                        onChange={(event) => updateFormData({ title: event.target.value })}
                        placeholder="Enter the event name"
                        className={`w-full rounded-md border px-4 py-4 text-lg font-light outline-none transition-colors ${isDark
                            ? 'border-[#2b2b40] bg-[#151521] text-white placeholder:text-[#5e6278] focus:border-[#b235fb]/40'
                            : 'border-gray-200 bg-white text-gray-900 placeholder:text-gray-300 focus:border-[#b235fb]'
                        }`}
                    />
                </div>

                <div>
                    <label className={`mb-3 block text-[11px] uppercase tracking-[0.22em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                        Event Category
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {CATEGORY_OPTIONS.map((option) => {
                            const isSelected = formData.category === option;
                            return (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => updateFormData({ category: option })}
                                    className={`rounded-md border px-4 py-4 text-left text-sm font-light transition-all ${isSelected
                                        ? (isDark ? 'border-[#b235fb]/30 bg-[#b235fb]/10 text-[#f3ddff]' : 'border-[#e7c3fd] bg-[#f8e9ff] text-[#8f22d4]')
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

            <div className={`rounded-md border p-5 ${isDark ? 'border-[#2b2b40] bg-[#151521]' : 'border-gray-200 bg-gray-50'}`}>
                <p className={`text-[11px] uppercase tracking-[0.22em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                    Draft Preview
                </p>
                <div className="mt-5 space-y-5">
                    <div>
                        <p className={`text-[10px] uppercase tracking-[0.16em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                            Title
                        </p>
                        <p className={`mt-2 text-xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                            {formData.title.trim() || 'Untitled event'}
                        </p>
                    </div>
                    <div>
                        <p className={`text-[10px] uppercase tracking-[0.16em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                            Category
                        </p>
                        <p className={`mt-2 text-base font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                            {formData.category}
                        </p>
                    </div>
                    <div className={`rounded-md border border-dashed px-4 py-5 text-sm leading-6 ${isDark ? 'border-[#2b2b40] text-[#a1a5b7]' : 'border-gray-200 text-gray-500'}`}>
                        Tickets, media, and public details stay editable after the draft is created.
                    </div>
                </div>
            </div>
        </div>
    );

    const renderScheduleStep = () => (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] animate-fade-in">
            <div className="space-y-6">
                <div>
                    <label className={`mb-3 block text-[11px] uppercase tracking-[0.22em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                        Start Date & Time
                    </label>
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
                            ? 'border-[#2b2b40] bg-[#151521] text-white focus:border-[#b235fb]/40'
                            : 'border-gray-200 bg-white text-gray-900 focus:border-[#b235fb]'
                        }`}
                    />
                </div>

                <div>
                    <label className={`mb-3 block text-[11px] uppercase tracking-[0.22em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                        End Date & Time
                    </label>
                    <input
                        type="datetime-local"
                        value={formData.endDateTime}
                        onChange={(event) => updateFormData({ endDateTime: event.target.value })}
                        className={`w-full rounded-md border px-4 py-4 text-lg font-light outline-none transition-colors ${isDark
                            ? 'border-[#2b2b40] bg-[#151521] text-white focus:border-[#b235fb]/40'
                            : 'border-gray-200 bg-white text-gray-900 focus:border-[#b235fb]'
                        }`}
                    />
                </div>
            </div>

            <div className={`rounded-md border p-5 ${isDark ? 'border-[#2b2b40] bg-[#151521]' : 'border-gray-200 bg-gray-50'}`}>
                <p className={`text-[11px] uppercase tracking-[0.22em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                    Timeline
                </p>
                <div className="mt-5 grid gap-4 md:grid-cols-3 xl:grid-cols-1">
                    <div>
                        <p className={`text-[10px] uppercase tracking-[0.16em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                            Start
                        </p>
                        <p className={`mt-2 text-base font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                            {formatLocalDateTime(formData.startDateTime, { weekday: 'short' })}
                        </p>
                    </div>
                    <div>
                        <p className={`text-[10px] uppercase tracking-[0.16em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                            End
                        </p>
                        <p className={`mt-2 text-base font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                            {formatLocalDateTime(formData.endDateTime, { weekday: 'short' })}
                        </p>
                    </div>
                    <div>
                        <p className={`text-[10px] uppercase tracking-[0.16em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                            Duration
                        </p>
                        <p className={`mt-2 text-base font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                            {getDurationLabel(formData.startDateTime, formData.endDateTime)}
                        </p>
                    </div>
                </div>
                <div className={`mt-5 rounded-md border border-dashed px-4 py-4 text-sm leading-6 ${isDark ? 'border-[#2b2b40] text-[#a1a5b7]' : 'border-gray-200 text-gray-500'}`}>
                    The end time auto-fills three hours after the chosen start time so you can keep moving.
                </div>
            </div>
        </div>
    );

    const renderVenueStep = () => (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] animate-fade-in">
            <div className="space-y-4">
                <label className={`block text-[11px] uppercase tracking-[0.22em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                    Venue
                </label>
                <button
                    type="button"
                    onClick={() => updateFormData({ venueId: '' })}
                    className={`w-full rounded-md border p-5 text-left transition-all ${!formData.venueId
                        ? (isDark ? 'border-[#b235fb]/30 bg-[#b235fb]/10 text-[#f3ddff]' : 'border-[#e7c3fd] bg-[#f8e9ff] text-[#8f22d4] shadow-sm')
                        : (isDark ? 'border-[#2b2b40] bg-[#151521] text-gray-200 hover:border-[#3a3a5a] hover:bg-[#232336]' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 shadow-sm')
                    }`}
                >
                    <p className={`text-[11px] uppercase tracking-[0.2em] ${!formData.venueId ? (isDark ? 'text-[#ebc8ff]' : 'text-[#8f22d4]') : (isDark ? 'text-[#8f94aa]' : 'text-gray-500')}`}>
                        Decide Later
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
                                        ? (isDark ? 'border-[#b235fb]/30 bg-[#b235fb]/10' : 'border-[#e7c3fd] bg-[#f8e9ff] shadow-sm')
                                        : (isDark ? 'border-[#2b2b40] bg-[#151521] hover:border-[#3a3a5a] hover:bg-[#232336]' : 'border-gray-200 bg-white hover:bg-gray-50 shadow-sm')
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className={`text-[11px] uppercase tracking-[0.18em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                                                Saved Venue
                                            </p>
                                            <p className={`mt-2 text-base font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                                                {venue.name}
                                            </p>
                                        </div>
                                        {isSelected ? (
                                            <span className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.16em] ${isDark ? 'border border-[#b235fb]/20 bg-[#b235fb]/10 text-[#f3ddff]' : 'border border-[#e7c3fd] bg-[#f8e9ff] text-[#8f22d4]'}`}>
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

            <div className={`rounded-md border p-5 ${isDark ? 'border-[#2b2b40] bg-[#151521]' : 'border-gray-200 bg-gray-50'}`}>
                <p className={`text-[11px] uppercase tracking-[0.22em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                    Selected Venue
                </p>
                <div className="mt-5 space-y-5">
                    <div>
                        <p className={`text-[10px] uppercase tracking-[0.16em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                            Name
                        </p>
                        <p className={`mt-2 text-xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                            {selectedVenue?.name || 'Set later'}
                        </p>
                    </div>
                    <div>
                        <p className={`text-[10px] uppercase tracking-[0.16em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                            Address
                        </p>
                        <p className={`mt-2 text-base font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                            {selectedVenue ? getVenueAddress(selectedVenue) : 'To be assigned'}
                        </p>
                    </div>
                    <div>
                        <p className={`text-[10px] uppercase tracking-[0.16em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                            Capacity
                        </p>
                        <p className={`mt-2 text-base font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                            {selectedVenue?.capacity ? selectedVenue.capacity : 'Set later'}
                        </p>
                    </div>
                    <div className={`rounded-md border border-dashed px-4 py-4 text-sm leading-6 ${isDark ? 'border-[#2b2b40] text-[#a1a5b7]' : 'border-gray-200 text-gray-500'}`}>
                        Venue assignment can still be changed in the event dashboard after creation.
                    </div>
                </div>
            </div>
        </div>
    );

    const renderLaunchStep = () => (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] animate-fade-in">
            <div className={`rounded-md border p-5 ${isDark ? 'border-[#2b2b40] bg-[#151521]' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h3 className={`text-2xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                            {formData.title.trim() || 'Untitled event'}
                        </h3>
                        <p className={`mt-1 text-sm font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                            Review the required details before saving the draft.
                        </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${isDark ? 'border border-white/10 bg-white/5 text-[#8f94aa]' : 'border border-gray-200 bg-white text-gray-500'}`}>
                        {formData.category}
                    </span>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className={`rounded-md border px-4 py-4 ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white'}`}>
                        <p className={`text-[10px] uppercase tracking-[0.16em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>Category</p>
                        <p className={`mt-2 text-base font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{formData.category}</p>
                    </div>
                    <div className={`rounded-md border px-4 py-4 ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white'}`}>
                        <p className={`text-[10px] uppercase tracking-[0.16em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>Venue</p>
                        <p className={`mt-2 text-base font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{selectedVenue?.name || 'Set later'}</p>
                    </div>
                    <div className={`rounded-md border px-4 py-4 ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white'}`}>
                        <p className={`text-[10px] uppercase tracking-[0.16em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>Start</p>
                        <p className={`mt-2 text-base font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{formatLocalDateTime(formData.startDateTime, { weekday: 'short' })}</p>
                    </div>
                    <div className={`rounded-md border px-4 py-4 ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white'}`}>
                        <p className={`text-[10px] uppercase tracking-[0.16em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>End</p>
                        <p className={`mt-2 text-base font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{formatLocalDateTime(formData.endDateTime, { weekday: 'short' })}</p>
                    </div>
                </div>
            </div>

            <div className={`rounded-md border p-5 ${isDark ? 'border-[#2b2b40] bg-[#151521]' : 'border-gray-200 bg-gray-50'}`}>
                <p className={`text-[11px] uppercase tracking-[0.22em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                    After Creation
                </p>
                <div className={`mt-5 space-y-4 text-sm leading-6 ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                    <p>Add tickets, poster art, and public-facing copy.</p>
                    <p>Finalize venue details, pricing, and on-sale settings.</p>
                    <p>Publish from the event dashboard when the draft is ready.</p>
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
        <div className="space-y-5 animate-fade-in max-w-[1500px] mx-auto pb-12">
            <section className={`relative overflow-hidden rounded-md border px-6 py-7 sm:px-8 ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white shadow-sm'}`}>
                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,_rgba(178,53,251,0.12),_transparent_30%),linear-gradient(120deg,_rgba(107,127,174,0.08),_transparent_38%)]" />
                <div className="relative">
                    <p className={`text-[11px] uppercase tracking-[0.24em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                        Event Creation
                    </p>
                    <h2 className={`mt-3 text-4xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                        New Event Wizard
                    </h2>
                    <p className={`mt-3 max-w-3xl text-base font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                        Create the draft with the required details only. Everything else stays editable in the event dashboard.
                    </p>
                </div>
            </section>

            <section className={`overflow-hidden rounded-md border ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white shadow-sm'}`}>
                <div className={`grid gap-px ${isDark ? 'bg-[#2b2b40]' : 'bg-gray-200'} sm:grid-cols-2 xl:grid-cols-4`}>
                    {QUESTION_STEPS.map((item, index) => {
                        const isActive = index === step;
                        const isComplete = index < step;

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
                                className={`relative px-5 py-5 text-left transition-all ${isDark ? 'bg-[#1e1e2d]' : 'bg-white'} ${index <= step ? 'cursor-pointer' : 'cursor-not-allowed opacity-45'}`}
                            >
                                <div className={`absolute inset-x-0 bottom-0 h-[2px] ${isActive || isComplete ? 'bg-[#b235fb]' : 'bg-transparent'}`} />
                                <p className={`text-[11px] uppercase tracking-[0.2em] ${isActive || isComplete ? (isDark ? 'text-[#ebc8ff]' : 'text-[#8f22d4]') : (isDark ? 'text-[#707791]' : 'text-gray-400')}`}>
                                    {item.eyebrow}
                                </p>
                                <p className={`mt-2 text-lg font-medium leading-6 tracking-tight ${isActive ? (isDark ? 'text-[#f3ddff]' : 'text-[#8f22d4]') : isComplete ? (isDark ? 'text-gray-100' : 'text-gray-900') : (isDark ? 'text-[#8f94aa]' : 'text-gray-500')}`}>
                                    {item.navTitle}
                                </p>
                            </button>
                        );
                    })}
                </div>
            </section>

            {error ? (
                <div className={`rounded-md border px-4 py-3 text-sm font-light ${isDark ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                    {error}
                </div>
            ) : null}

            <section className={`overflow-hidden rounded-md border ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white shadow-sm'}`}>
                <div className={`border-b px-6 py-5 sm:px-8 ${isDark ? 'border-[#2b2b40]' : 'border-gray-200'}`}>
                    <p className={`text-2xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                        {currentStepLabel}
                    </p>
                    <p className={`mt-2 text-sm font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                        {currentStep.detail}
                    </p>
                </div>

                <div className="px-6 py-6 sm:px-8">
                    <div className="min-h-[420px]">
                        {renderStepContent()}
                    </div>
                </div>

                <div className={`flex flex-col gap-4 border-t px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 ${isDark ? 'border-[#2b2b40] bg-[#1a1a29]' : 'border-gray-200 bg-gray-50/70'}`}>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className={`inline-flex items-center justify-center rounded-md px-5 py-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${isDark ? 'border border-[#2b2b40] bg-[#1e1e2d] text-gray-200 hover:bg-[#232336]' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
                    >
                        Cancel
                    </button>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        {step > 0 ? (
                            <button
                                type="button"
                                onClick={handleBack}
                                disabled={loading}
                                className={`inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${isDark ? 'border border-[#2b2b40] bg-[#1e1e2d] text-gray-200 hover:bg-[#232336]' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
                            >
                                <ArrowLeft size={16} />
                                Back
                            </button>
                        ) : null}

                        {step < QUESTION_STEPS.length - 1 ? (
                            <button
                                type="button"
                                onClick={handleNext}
                                disabled={!canAdvance || loading}
                                className="inline-flex items-center justify-center gap-2 rounded-md bg-[#b235fb] px-6 py-3 text-sm text-white transition-colors hover:bg-[#bf52fc] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Next
                                <ArrowRight size={16} />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleCreateEvent}
                                disabled={loading}
                                className="inline-flex items-center justify-center gap-2 rounded-md bg-[#b235fb] px-6 py-3 text-sm text-white transition-colors hover:bg-[#bf52fc] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                Save Draft
                            </button>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default EventWizard;
