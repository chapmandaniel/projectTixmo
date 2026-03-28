import React, { useEffect, useMemo, useState } from 'react';
import {
    Calendar,
    CheckCircle2,
    Filter,
    Plus,
    Search,
    UserCheck,
    X,
} from 'lucide-react';
import { api } from '../lib/api';
import ApprovalDetailView from './ApprovalDetailView';
import {
    APPROVAL_STATUS_META,
    APPROVAL_STATUS_OPTIONS,
    formatApprovalDate,
} from './approvalConstants';

const emptyForm = {
    title: '',
    eventId: '',
    deadline: '',
    description: '',
    reviewers: [],
};

const STATUS_CARD_ACCENTS = {
    PENDING_REVIEW: 'from-amber-400 to-orange-500',
    UPDATED: 'from-sky-400 to-cyan-500',
    CHANGES_REQUESTED: 'from-orange-400 to-rose-500',
    APPROVED: 'from-emerald-400 to-teal-500',
    DECLINED: 'from-rose-400 to-red-500',
};

const CreateApprovalModal = ({ events, onClose, onCreated }) => {
    const [form, setForm] = useState(emptyForm);
    const [reviewerInput, setReviewerInput] = useState('');
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
            reviewers: [...current.reviewers, { email }],
        }));
        setReviewerInput('');
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
                            <div className="flex gap-2">
                                <input
                                    type="email"
                                    value={reviewerInput}
                                    onChange={(e) => setReviewerInput(e.target.value)}
                                    placeholder="reviewer@example.com"
                                    className="flex-1 rounded-2xl border border-white/10 bg-[#0b1118] px-4 py-3 text-sm outline-none focus:border-sky-400"
                                />
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
                                        {reviewer.email}
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

const StatusFilterCard = ({ status, meta, count, active, onClick, isDark }) => {
    const Icon = meta.icon;

    return (
        <button
            type="button"
            onClick={onClick}
            className={`relative w-full overflow-hidden rounded-md border px-4 py-3 text-left transition-all duration-300 ${
                isDark
                    ? active
                        ? 'border-sky-400/50 bg-[#1e1e2d] shadow-xl shadow-sky-950/20'
                        : 'border-[#2b2b40] bg-[#1e1e2d] hover:border-[#3a3a5a] hover:bg-[#232336]'
                    : active
                        ? 'border-sky-300 bg-white shadow-lg'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
            }`}
        >
            <div className={`absolute left-0 top-0 h-[3px] w-full bg-gradient-to-r ${STATUS_CARD_ACCENTS[status] || 'from-slate-400 to-slate-500'} ${active ? 'opacity-100' : 'opacity-45'}`} />
            <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                    isDark
                        ? active ? 'bg-[#151521] text-sky-200' : 'bg-[#151521] text-slate-400'
                        : active ? 'bg-sky-50 text-sky-700' : 'bg-gray-50 text-gray-500'
                    }`}>
                        <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                        <h3 className={`text-sm font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{meta.label}</h3>
                        <p className={`mt-0.5 text-xs font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>{active ? 'Current queue' : 'Open lane'}</p>
                    </div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] ${meta.chip}`}>{count}</span>
            </div>
        </button>
    );
};

const ApprovalsDashboard = ({ user, isDark = true }) => {
    const [approvals, setApprovals] = useState([]);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [statusFilter, setStatusFilter] = useState('PENDING_REVIEW');
    const [eventFilter, setEventFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [assignedToMe, setAssignedToMe] = useState(false);
    const [approachingDeadline, setApproachingDeadline] = useState(false);
    const [sortBy, setSortBy] = useState('deadline');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedApproval, setSelectedApproval] = useState(null);

    const loadApprovals = async () => {
        try {
            setLoading(true);
            setError('');
            const params = new URLSearchParams();
            if (statusFilter) {
                params.set('status', statusFilter);
            }
            if (eventFilter) {
                params.set('eventId', eventFilter);
            }
            if (assignedToMe) {
                params.set('assignedToMe', 'true');
            }
            if (approachingDeadline) {
                params.set('approachingDeadline', 'true');
            }
            params.set('sortBy', sortBy);

            const response = await api.get(`/approvals?${params.toString()}`);
            setApprovals(response.approvals || []);
        } catch (requestError) {
            setError(requestError.response?.data?.message || requestError.message || 'Failed to load approvals.');
        } finally {
            setLoading(false);
        }
    };

    const loadEvents = async () => {
        try {
            const response = await api.get('/events?limit=100');
            setEvents(response.events || response.data?.events || []);
        } catch {
            setEvents([]);
        }
    };

    useEffect(() => {
        loadEvents();
    }, []);

    useEffect(() => {
        loadApprovals();
    }, [statusFilter, eventFilter, assignedToMe, approachingDeadline, sortBy]);

    const visibleApprovals = approvals.filter((approval) => {
        const haystack = `${approval.title} ${approval.event?.name || ''}`.toLowerCase();
        return haystack.includes(searchQuery.toLowerCase());
    });
    const statusCounts = useMemo(
        () => APPROVAL_STATUS_OPTIONS.reduce((acc, status) => {
            acc[status] = approvals.filter((approval) => approval.status === status).length;
            return acc;
        }, {}),
        [approvals]
    );

    if (selectedApproval) {
        return (
            <ApprovalDetailView
                approvalId={selectedApproval.id}
                initialApproval={selectedApproval}
                user={user}
                onBack={() => {
                    setSelectedApproval(null);
                    loadApprovals();
                }}
                onUpdated={(approval) => {
                    setSelectedApproval(approval);
                    setApprovals((current) => current.map((item) => (item.id === approval.id ? approval : item)));
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
                        setSelectedApproval(approval);
                        setApprovals((current) => [approval, ...current]);
                    }}
                />
            )}

            <div className="space-y-6">
                <section className={`relative overflow-hidden rounded-md border p-6 sm:p-8 ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40] shadow-2xl shadow-black/20' : 'bg-white border-gray-200 shadow-sm'}`}>
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl" />
                        <div className="absolute left-10 bottom-0 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
                    </div>
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div className="relative">
                            <h1 className={`flex flex-wrap items-baseline gap-3 text-3xl sm:text-4xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                                <span className="inline-flex items-center gap-2">
                                    <span>Review Portal</span>
                                    <CheckCircle2 className={`h-6 w-6 sm:h-7 sm:w-7 ${isDark ? 'text-sky-300' : 'text-sky-700'}`} />
                                </span>
                            </h1>
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
                </section>

                <section className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)] gap-6">
                    <aside className="space-y-4">
                        <div className={`rounded-md border p-4 ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40]' : 'bg-white border-gray-200 shadow-sm'}`}>
                            <label className="block">
                                <span className={`mb-2 block text-xs uppercase tracking-[0.2em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>Event filter</span>
                                <div className={`flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm font-light ${isDark ? 'border-[#2b2b40] bg-[#151521] text-gray-100' : 'border-gray-200 bg-gray-50 text-gray-800'}`}>
                                    <Calendar className={`h-4 w-4 ${isDark ? 'text-[#5e6278]' : 'text-gray-400'}`} />
                                    <select
                                        value={eventFilter}
                                        onChange={(e) => setEventFilter(e.target.value)}
                                        className="w-full bg-transparent outline-none"
                                    >
                                        <option value="">All events</option>
                                        {events.map((event) => (
                                            <option key={event.id} value={event.id}>
                                                {event.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </label>
                        </div>

                        <div className="space-y-2">
                            {APPROVAL_STATUS_OPTIONS.map((status) => {
                                const meta = APPROVAL_STATUS_META[status];

                                return (
                                    <StatusFilterCard
                                        key={status}
                                        status={status}
                                        meta={meta}
                                        count={statusCounts[status] || 0}
                                        active={statusFilter === status}
                                        onClick={() => setStatusFilter(status)}
                                        isDark={isDark}
                                    />
                                );
                            })}
                        </div>
                    </aside>

                    <div className="space-y-4">
                        <div className={`rounded-md border p-4 ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40]' : 'bg-white border-gray-200 shadow-sm'}`}>
                            <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr_auto_auto]">
                                <label className="relative">
                                    <Search className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${isDark ? 'text-[#5e6278]' : 'text-gray-400'}`} />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search by asset title or event"
                                        className={`w-full rounded-md border py-3 pl-10 pr-4 text-sm font-light outline-none ${isDark ? 'border-[#2b2b40] bg-[#151521] text-gray-100 placeholder:text-[#5e6278] focus:border-sky-400' : 'border-gray-200 bg-gray-50 text-gray-800 placeholder:text-gray-400 focus:border-sky-500'}`}
                                    />
                                </label>

                                <label className={`flex items-center gap-3 rounded-md border px-4 py-3 text-sm font-light ${isDark ? 'border-[#2b2b40] bg-[#151521] text-gray-100' : 'border-gray-200 bg-gray-50 text-gray-800'}`}>
                                    <Filter className={`h-4 w-4 ${isDark ? 'text-[#5e6278]' : 'text-gray-400'}`} />
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value)}
                                        className="w-full bg-transparent outline-none"
                                    >
                                        <option value="deadline">Sort by deadline</option>
                                        <option value="submittedAt">Sort by submission</option>
                                    </select>
                                </label>

                                <button
                                    type="button"
                                    onClick={() => setAssignedToMe((current) => !current)}
                                    className={`rounded-md border px-4 py-3 text-sm transition ${assignedToMe ? 'border-sky-400 bg-sky-500/15 text-sky-100' : isDark ? 'border-[#2b2b40] bg-[#151521] text-gray-300 hover:bg-[#232336]' : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
                                >
                                    <span className="inline-flex items-center gap-2">
                                        <UserCheck className="h-4 w-4" />
                                        Mine
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setApproachingDeadline((current) => !current)}
                                    className={`rounded-md border px-4 py-3 text-sm transition ${approachingDeadline ? 'border-amber-300 bg-amber-500/15 text-amber-100' : isDark ? 'border-[#2b2b40] bg-[#151521] text-gray-300 hover:bg-[#232336]' : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
                                >
                                    Near deadline
                                </button>

                                <div className={`flex items-center rounded-md border px-4 py-3 text-sm font-light ${isDark ? 'border-[#2b2b40] bg-[#151521] text-[#a1a5b7]' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                                    {visibleApprovals.length} items
                                </div>
                            </div>
                        </div>

                {error && (
                    <div className={`rounded-md border px-4 py-3 text-sm font-light ${isDark ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className={`rounded-md border px-6 py-16 text-center text-sm font-light ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d] text-[#8f94aa]' : 'border-gray-200 bg-white text-gray-500 shadow-sm'}`}>
                        Loading approvals…
                    </div>
                ) : visibleApprovals.length === 0 ? (
                    <div className={`rounded-md border border-dashed px-6 py-16 text-center ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white shadow-sm'}`}>
                        <p className={`text-lg font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>No approvals match this view.</p>
                        <p className={`mt-2 text-sm font-light ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>Try a different status or create a new submission.</p>
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {visibleApprovals.map((approval) => {
                            const meta = APPROVAL_STATUS_META[approval.status];
                            const Icon = meta.icon;
                            const previewAsset = approval.latestRevision?.assets?.[0];
                            const pendingCount = approval.reviewers.filter((reviewer) => !reviewer.latestDecision).length;

                            return (
                                <button
                                    key={approval.id}
                                    type="button"
                                    onClick={() => setSelectedApproval(approval)}
                                    className={`relative overflow-hidden rounded-md border text-left transition-all duration-300 ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d] hover:border-[#3a3a5a] hover:bg-[#232336] hover:shadow-xl hover:shadow-black/20' : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'}`}
                                >
                                    <div className={`absolute left-0 top-0 h-[3px] w-full bg-gradient-to-r ${STATUS_CARD_ACCENTS[approval.status] || 'from-slate-400 to-slate-500'}`} />
                                    <div className={`aspect-[1.2/1] ${isDark ? 'bg-[linear-gradient(135deg,_rgba(56,189,248,0.14),_rgba(30,30,45,0.8))]' : 'bg-[linear-gradient(135deg,_rgba(14,165,233,0.08),_rgba(255,255,255,0.9))]'}`}>
                                        {previewAsset?.mimeType?.startsWith('image/') ? (
                                            <img src={previewAsset.s3Url} alt={approval.title} className="h-full w-full object-cover" />
                                        ) : (
                                            <div className={`flex h-full items-center justify-center text-sm font-light ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                                                Latest revision preview unavailable
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-3 px-4 py-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] ${meta.chip}`}>
                                                <Icon className="h-3 w-3" />
                                                {meta.label}
                                            </span>
                                            <span className={`text-xs uppercase tracking-[0.18em] ${isDark ? 'text-[#5e6278]' : 'text-gray-400'}`}>v{approval.latestRevisionNumber}</span>
                                        </div>

                                        <div>
                                            <h2 className={`text-base font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{approval.title}</h2>
                                            <p className={`mt-1 text-xs font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>{approval.event?.name || 'Unassigned event'}</p>
                                        </div>

                                        <div className={`grid gap-1.5 text-xs font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                                            <div className="flex items-center justify-between">
                                                <span>Submitted</span>
                                                <span className={isDark ? 'text-gray-200' : 'text-gray-800'}>{formatApprovalDate(approval.submittedAt)}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span>Deadline</span>
                                                <span className={isDark ? 'text-gray-200' : 'text-gray-800'}>{formatApprovalDate(approval.deadline)}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span>Pending reviewers</span>
                                                <span className={isDark ? 'text-gray-200' : 'text-gray-800'}>{pendingCount}</span>
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default ApprovalsDashboard;
