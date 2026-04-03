import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertTriangle,
    Calendar,
    CheckCircle2,
    Clock3,
    Plus,
    RefreshCcw,
    X,
    XCircle,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import SectionSkeletonOverlay from '../components/SectionSkeletonOverlay';
import ApprovalDetailView from './ApprovalDetailView';
import { formatApprovalDate } from './approvalConstants';

const emptyForm = {
    title: '',
    eventId: '',
    deadline: '',
    description: '',
    reviewers: [],
};
const reviewerAssociationOptions = [
    { value: 'ARTIST', label: 'Artist' },
    { value: 'AGENT', label: 'Agent' },
    { value: 'MANAGEMENT', label: 'Management' },
    { value: 'OTHER', label: 'Other' },
];

const APPROVALS_DASHBOARD_CACHE_KEY = 'tixmo:approvals-dashboard-cache';

const readApprovalsDashboardCache = () => {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const raw = window.sessionStorage.getItem(APPROVALS_DASHBOARD_CACHE_KEY);
        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed?.approvals) || !Array.isArray(parsed?.events)) {
            return null;
        }

        return {
            approvals: parsed.approvals,
            events: parsed.events,
        };
    } catch {
        return null;
    }
};

const writeApprovalsDashboardCache = ({ approvals, events }) => {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.sessionStorage.setItem(
            APPROVALS_DASHBOARD_CACHE_KEY,
            JSON.stringify({
                approvals,
                events,
            })
        );
    } catch {
        // Cache writes are best-effort only.
    }
};

const REVIEW_STATUS_META = {
    IN_PROGRESS: {
        label: 'In Progress',
        chip: 'bg-sky-500/15 text-sky-200 border border-sky-400/30',
        accent: 'from-sky-400 to-cyan-500',
        icon: Clock3,
    },
    APPROVED: {
        label: 'Approved',
        chip: 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/30',
        accent: 'from-emerald-400 to-teal-500',
        icon: CheckCircle2,
    },
    CANCELLED: {
        label: 'Cancelled',
        chip: 'bg-rose-500/15 text-rose-200 border border-rose-400/30',
        accent: 'from-rose-400 to-red-500',
        icon: XCircle,
    },
};

const DASHBOARD_STATUS_OPTIONS = [
    { value: '', label: 'All statuses' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'CANCELLED', label: 'Cancelled' },
];

const mapApprovalStatus = (status) => {
    if (status === 'APPROVED') {
        return 'APPROVED';
    }

    if (status === 'DECLINED' || status === 'CANCELLED') {
        return 'CANCELLED';
    }

    return 'IN_PROGRESS';
};

const isOverdueApproval = (approval) => {
    if (!approval?.deadline) {
        return false;
    }

    return new Date(approval.deadline).getTime() < Date.now();
};

const ApprovalCardSkeleton = ({ isDark = true }) => (
    <div
        data-testid="approval-card-skeleton"
        className={`overflow-hidden rounded-md border animate-pulse ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white shadow-sm'}`}
    >
        <div className={`aspect-[1.2/1] ${isDark ? 'bg-[#25253a]' : 'bg-gray-100'}`} />
        <div className="space-y-3 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
                <div className={`h-6 w-24 rounded-full ${isDark ? 'bg-[#2b2b40]' : 'bg-gray-100'}`} />
                <div className={`h-4 w-10 rounded-full ${isDark ? 'bg-[#2b2b40]' : 'bg-gray-100'}`} />
            </div>
            <div className="space-y-2">
                <div className={`h-5 w-3/4 rounded-full ${isDark ? 'bg-[#2b2b40]' : 'bg-gray-100'}`} />
                <div className={`h-4 w-1/2 rounded-full ${isDark ? 'bg-[#25253a]' : 'bg-gray-50'}`} />
            </div>
            <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between gap-3">
                    <div className={`h-4 w-8 rounded-full ${isDark ? 'bg-[#25253a]' : 'bg-gray-50'}`} />
                    <div className={`h-4 w-24 rounded-full ${isDark ? 'bg-[#2b2b40]' : 'bg-gray-100'}`} />
                </div>
                <div className="flex items-center justify-between gap-3">
                    <div className={`h-4 w-10 rounded-full ${isDark ? 'bg-[#25253a]' : 'bg-gray-50'}`} />
                    <div className={`h-4 w-20 rounded-full ${isDark ? 'bg-[#2b2b40]' : 'bg-gray-100'}`} />
                </div>
            </div>
        </div>
    </div>
);

const CreateApprovalModal = ({ events, onClose, onCreated }) => {
    const [form, setForm] = useState(emptyForm);
    const [reviewerInput, setReviewerInput] = useState('');
    const [reviewerAssociation, setReviewerAssociation] = useState('ARTIST');
    const [files, setFiles] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const addReviewer = () => {
        const email = reviewerInput.trim().toLowerCase();
        if (!email || form.reviewers.some((reviewer) => reviewer.email === email)) {
            return;
        }

        setForm((current) => ({
            ...current,
            reviewers: [...current.reviewers, { email, association: reviewerAssociation }],
        }));
        setReviewerInput('');
        setReviewerAssociation('ARTIST');
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!form.title || !form.eventId || !form.deadline || !files.length || !form.reviewers.length) {
            setError('Event, title, deadline, at least one file, and at least one reviewer are required.');
            return;
        }

        try {
            setSubmitting(true);
            setError('');

            const payload = new FormData();
            payload.append('title', form.title);
            payload.append('eventId', form.eventId);
            payload.append('deadline', new Date(form.deadline).toISOString());
            if (form.description) {
                payload.append('description', form.description);
            }
            payload.append('reviewers', JSON.stringify(form.reviewers));
            files.forEach((file) => payload.append('files', file));

            const approval = await api.upload('/approvals', payload);
            onCreated(approval);
        } catch (requestError) {
            setError(requestError.response?.data?.message || requestError.message || 'Failed to create approval request.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-[#10161e] text-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
                    <div>
                        <h2 className="text-xl font-semibold">Submit Creative Approval</h2>
                        <p className="text-sm text-slate-400">Create the initial submission with files, deadline, and reviewers.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full border border-white/10 p-2 text-slate-400 transition hover:text-white"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form className="space-y-6 px-6 py-6" onSubmit={handleSubmit}>
                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-2">
                            <span className="text-sm text-slate-300">Event</span>
                            <select
                                value={form.eventId}
                                onChange={(e) => setForm((current) => ({ ...current, eventId: e.target.value }))}
                                className="w-full rounded-2xl border border-white/10 bg-[#0b1118] px-4 py-3 text-sm outline-none focus:border-sky-400"
                            >
                                <option value="">Select an event</option>
                                {events.map((event) => (
                                    <option key={event.id} value={event.id}>
                                        {event.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="space-y-2">
                            <span className="text-sm text-slate-300">Deadline</span>
                            <input
                                type="datetime-local"
                                value={form.deadline}
                                onChange={(e) => setForm((current) => ({ ...current, deadline: e.target.value }))}
                                className="w-full rounded-2xl border border-white/10 bg-[#0b1118] px-4 py-3 text-sm outline-none focus:border-sky-400"
                            />
                        </label>
                    </div>

                    <label className="space-y-2">
                        <span className="text-sm text-slate-300">Asset title</span>
                        <input
                            type="text"
                            value={form.title}
                            onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
                            placeholder="Festival poster, VIP reel, stage motion graphic..."
                            className="w-full rounded-2xl border border-white/10 bg-[#0b1118] px-4 py-3 text-sm outline-none focus:border-sky-400"
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm text-slate-300">Description</span>
                        <textarea
                            rows={4}
                            value={form.description}
                            onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                            placeholder="Context for reviewers, distribution notes, or what changed."
                            className="w-full rounded-2xl border border-white/10 bg-[#0b1118] px-4 py-3 text-sm outline-none focus:border-sky-400"
                        />
                    </label>

                    <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                        <div className="space-y-3">
                            <span className="text-sm text-slate-300">Reviewers</span>
                            <div className="grid gap-2 md:grid-cols-[1fr_180px_auto]">
                                <input
                                    type="email"
                                    value={reviewerInput}
                                    onChange={(e) => setReviewerInput(e.target.value)}
                                    placeholder="reviewer@example.com"
                                    className="flex-1 rounded-2xl border border-white/10 bg-[#0b1118] px-4 py-3 text-sm outline-none focus:border-sky-400"
                                />
                                <select
                                    value={reviewerAssociation}
                                    onChange={(e) => setReviewerAssociation(e.target.value)}
                                    className="rounded-2xl border border-white/10 bg-[#0b1118] px-4 py-3 text-sm outline-none focus:border-sky-400"
                                >
                                    {reviewerAssociationOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={addReviewer}
                                    className="rounded-2xl border border-sky-400/40 bg-sky-500/10 px-4 py-3 text-sm font-medium text-sky-200 transition hover:bg-sky-500/20"
                                >
                                    Add
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {form.reviewers.map((reviewer) => (
                                    <button
                                        key={reviewer.email}
                                        type="button"
                                        onClick={() =>
                                            setForm((current) => ({
                                                ...current,
                                                reviewers: current.reviewers.filter((item) => item.email !== reviewer.email),
                                            }))
                                        }
                                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200"
                                    >
                                        {reviewer.email} · {reviewerAssociationOptions.find((option) => option.value === reviewer.association)?.label || 'Other'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <label className="space-y-2">
                            <span className="text-sm text-slate-300">Asset files</span>
                            <input
                                type="file"
                                multiple
                                onChange={(e) => setFiles(Array.from(e.target.files || []))}
                                className="block w-full rounded-2xl border border-dashed border-white/15 bg-[#0b1118] px-4 py-6 text-sm text-slate-300"
                            />
                            <p className="text-xs text-slate-500">{files.length ? `${files.length} file(s) selected` : 'Images, PDFs, and videos are supported.'}</p>
                        </label>
                    </div>

                    {error && (
                        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-2xl border border-white/10 px-5 py-3 text-sm text-slate-300 transition hover:text-white"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {submitting ? 'Submitting…' : 'Create approval'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ApprovalsDashboard = ({ user, isDark = true }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const initialCacheRef = useRef(readApprovalsDashboardCache());
    const [approvals, setApprovals] = useState(initialCacheRef.current?.approvals || []);
    const [events, setEvents] = useState(initialCacheRef.current?.events || []);
    const [loading, setLoading] = useState(!initialCacheRef.current);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [eventFilter, setEventFilter] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedApproval, setSelectedApproval] = useState(null);
    const deepLinkedApprovalId = searchParams.get('approvalId');
    const approvalsRef = useRef(approvals);
    const eventsRef = useRef(events);

    const syncApprovalIdParam = (approvalId) => {
        const nextParams = new URLSearchParams(searchParams);

        if (approvalId) {
            nextParams.set('approvalId', approvalId);
        } else {
            nextParams.delete('approvalId');
        }

        setSearchParams(nextParams, { replace: true });
    };

    const mergeApprovalIntoList = (nextApproval) => {
        setApprovals((current) => {
            const existingIndex = current.findIndex((item) => item.id === nextApproval.id);

            if (existingIndex === -1) {
                return [nextApproval, ...current];
            }

            return current.map((item) => (item.id === nextApproval.id ? nextApproval : item));
        });
    };

    const openApproval = (approval) => {
        setSelectedApproval(approval);
        mergeApprovalIntoList(approval);
        syncApprovalIdParam(approval.id);
    };

    const closeApproval = () => {
        setSelectedApproval(null);
        syncApprovalIdParam(null);
    };

    const loadDashboardData = async ({ background = false } = {}) => {
        const hasVisibleContent =
            Boolean(initialCacheRef.current) ||
            approvalsRef.current.length > 0 ||
            eventsRef.current.length > 0;

        try {
            if (background || hasVisibleContent) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            setError('');

            const [approvalsResponse, eventsResponse] = await Promise.allSettled([
                api.get('/approvals?sortBy=deadline'),
                api.get('/events?limit=100'),
            ]);

            let nextApprovals = approvalsRef.current;
            let nextEvents = eventsRef.current;
            let nextError = '';

            if (approvalsResponse.status === 'fulfilled') {
                nextApprovals = approvalsResponse.value.approvals || [];
                setApprovals(nextApprovals);
            } else {
                nextError =
                    approvalsResponse.reason?.response?.data?.message ||
                    approvalsResponse.reason?.message ||
                    'Failed to load approvals.';
            }

            if (eventsResponse.status === 'fulfilled') {
                nextEvents = eventsResponse.value.events || eventsResponse.value.data?.events || [];
                setEvents(nextEvents);
            }

            if (approvalsResponse.status === 'fulfilled' || eventsResponse.status === 'fulfilled') {
                writeApprovalsDashboardCache({
                    approvals: nextApprovals,
                    events: nextEvents,
                });
            }

            if (nextError) {
                setError(nextError);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        approvalsRef.current = approvals;
    }, [approvals]);

    useEffect(() => {
        eventsRef.current = events;
    }, [events]);

    useEffect(() => {
        loadDashboardData({ background: Boolean(initialCacheRef.current) });
    }, []);

    useEffect(() => {
        if (loading) {
            return;
        }

        writeApprovalsDashboardCache({ approvals, events });
    }, [approvals, events, loading]);

    useEffect(() => {
        if (!deepLinkedApprovalId) {
            setSelectedApproval(null);
        }
    }, [deepLinkedApprovalId]);

    useEffect(() => {
        if (!deepLinkedApprovalId || selectedApproval?.id === deepLinkedApprovalId) {
            return;
        }

        const matchingApproval = approvals.find((approval) => approval.id === deepLinkedApprovalId);
        if (matchingApproval) {
            setSelectedApproval(matchingApproval);
            return;
        }

        let isCancelled = false;

        const loadSelectedApproval = async () => {
            try {
                setError('');
                const response = await api.get(`/approvals/${deepLinkedApprovalId}`);
                if (!isCancelled) {
                    setSelectedApproval(response);
                }
            } catch (requestError) {
                if (!isCancelled) {
                    setError(requestError.response?.data?.message || requestError.message || 'Failed to load approval.');
                }
            }
        };

        loadSelectedApproval();

        return () => {
            isCancelled = true;
        };
    }, [approvals, deepLinkedApprovalId, selectedApproval?.id]);

    const visibleApprovals = useMemo(
        () => approvals.filter((approval) => {
            if (eventFilter && approval.event?.id !== eventFilter && approval.eventId !== eventFilter) {
                return false;
            }

            if (statusFilter && mapApprovalStatus(approval.status) !== statusFilter) {
                return false;
            }

            return true;
        }),
        [approvals, eventFilter, statusFilter]
    );

    if (selectedApproval) {
        return (
            <ApprovalDetailView
                approvalId={selectedApproval.id}
                initialApproval={selectedApproval}
                user={user}
                onBack={() => {
                    closeApproval();
                    loadDashboardData({ background: true });
                }}
                onUpdated={(approval) => {
                    setSelectedApproval(approval);
                    mergeApprovalIntoList(approval);
                }}
            />
        );
    }

    return (
        <div className="space-y-8 animate-fade-in max-w-[1500px] mx-auto pb-12">
            {showCreateModal && (
                <CreateApprovalModal
                    events={events}
                    onClose={() => setShowCreateModal(false)}
                    onCreated={(approval) => {
                        setShowCreateModal(false);
                        openApproval(approval);
                    }}
                />
            )}

            <div className="space-y-6">
                <section className={`relative overflow-hidden rounded-md border p-6 sm:p-8 ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40] shadow-2xl shadow-black/20' : 'bg-white border-gray-200 shadow-sm'}`}>
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl" />
                        <div className="absolute left-10 bottom-0 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
                    </div>
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                        <div className="relative">
                            <h1 className={`flex flex-wrap items-baseline gap-3 text-3xl sm:text-4xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                                <span className="inline-flex items-center gap-2">
                                    <span>Approvals</span>
                                    <CheckCircle2 className={`h-6 w-6 sm:h-7 sm:w-7 ${isDark ? 'text-sky-300' : 'text-sky-700'}`} />
                                </span>
                            </h1>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.22em] ${isDark ? 'border-[#2b2b40] bg-[#151521] text-[#8f94aa]' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                                    {visibleApprovals.length} showing
                                </span>
                                {refreshing && (
                                    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.22em] ${isDark ? 'border-sky-400/20 bg-sky-500/10 text-sky-200' : 'border-sky-200 bg-sky-50 text-sky-700'}`}>
                                        <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
                                        Syncing latest
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="relative flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-end">
                            <div className={`flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm font-light ${isDark ? 'border-[#2b2b40] bg-[#151521] text-gray-100' : 'border-gray-200 bg-gray-50 text-gray-800'}`}>
                                <Calendar className={`h-4 w-4 ${isDark ? 'text-[#5e6278]' : 'text-gray-400'}`} />
                                <select
                                    aria-label="Event filter"
                                    value={eventFilter}
                                    onChange={(e) => setEventFilter(e.target.value)}
                                    className="min-w-[11rem] bg-transparent outline-none"
                                >
                                    <option value="">Filter by event</option>
                                    {events.map((event) => (
                                        <option key={event.id} value={event.id}>
                                            {event.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className={`flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm font-light ${isDark ? 'border-[#2b2b40] bg-[#151521] text-gray-100' : 'border-gray-200 bg-gray-50 text-gray-800'}`}>
                                <Clock3 className={`h-4 w-4 ${isDark ? 'text-[#5e6278]' : 'text-gray-400'}`} />
                                <select
                                    aria-label="Status filter"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="min-w-[10rem] bg-transparent outline-none"
                                >
                                    {DASHBOARD_STATUS_OPTIONS.map((option) => (
                                        <option key={option.value || 'all'} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowCreateModal(true)}
                                className={`relative inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm transition-colors ${isDark ? 'bg-sky-500 text-white hover:bg-sky-400' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                            >
                                <Plus className="h-4 w-4" />
                                New submission
                            </button>
                        </div>
                    </div>
                </section>

                <section className="relative space-y-4">
                    {error && (
                        <div className={`rounded-md border px-4 py-3 text-sm font-light ${isDark ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                            {Array.from({ length: 6 }, (_, index) => (
                                <ApprovalCardSkeleton key={index} isDark={isDark} />
                            ))}
                        </div>
                    ) : visibleApprovals.length === 0 ? (
                        <div className={`rounded-md border border-dashed px-6 py-16 text-center ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white shadow-sm'}`}>
                            <p className={`text-lg font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>No approvals match this view.</p>
                            <p className={`mt-2 text-sm font-light ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>Try a different event or status filter.</p>
                        </div>
                    ) : (
                        <div className="relative grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                            {refreshing && (
                                <SectionSkeletonOverlay
                                    label="Refreshing approvals"
                                    variant="cards"
                                />
                            )}
                            {visibleApprovals.map((approval) => {
                                const reviewStatus = mapApprovalStatus(approval.status);
                                const meta = REVIEW_STATUS_META[reviewStatus];
                                const Icon = meta.icon;
                                const previewAsset = approval.latestRevision?.assets?.[0];
                                const isOverdue = isOverdueApproval(approval);

                                return (
                                    <button
                                        key={approval.id}
                                        type="button"
                                        onClick={() => openApproval(approval)}
                                        className={`relative overflow-hidden rounded-md border text-left transition-all duration-300 ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d] hover:border-[#3a3a5a] hover:bg-[#232336] hover:shadow-xl hover:shadow-black/20' : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'}`}
                                    >
                                        <div className={`absolute left-0 top-0 h-[3px] w-full bg-gradient-to-r ${meta.accent}`} />
                                        <div className={`aspect-[1.2/1] ${isDark ? 'bg-[linear-gradient(135deg,_rgba(56,189,248,0.14),_rgba(30,30,45,0.8))]' : 'bg-[linear-gradient(135deg,_rgba(14,165,233,0.08),_rgba(255,255,255,0.9))]'}`}>
                                            {previewAsset?.mimeType?.startsWith('image/') ? (
                                                <img src={previewAsset.s3Url} alt={approval.title} loading="lazy" className="h-full w-full object-cover" />
                                            ) : (
                                                <div className={`flex h-full items-center justify-center text-sm font-light ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                                                    Latest version preview unavailable
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-3 px-4 py-4">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] ${meta.chip}`}>
                                                    <Icon className="h-3 w-3" />
                                                    {meta.label}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    {isOverdue && (
                                                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-100">
                                                            <AlertTriangle className="h-3 w-3" />
                                                            Overdue
                                                        </span>
                                                    )}
                                                    <span className={`text-xs uppercase tracking-[0.18em] ${isDark ? 'text-[#5e6278]' : 'text-gray-400'}`}>v{approval.latestRevisionNumber}</span>
                                                </div>
                                            </div>

                                            <div>
                                                <h2 className={`text-base font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{approval.title}</h2>
                                                <p className={`mt-1 text-xs font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>{approval.event?.name || 'Unassigned event'}</p>
                                            </div>

                                            <div className={`grid gap-1.5 text-xs font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                                                <div className="flex items-center justify-between">
                                                    <span>Due</span>
                                                    <span className={isDark ? 'text-gray-200' : 'text-gray-800'}>{formatApprovalDate(approval.deadline)}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span>Status</span>
                                                    <span className={isDark ? 'text-gray-200' : 'text-gray-800'}>{meta.label}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default ApprovalsDashboard;
