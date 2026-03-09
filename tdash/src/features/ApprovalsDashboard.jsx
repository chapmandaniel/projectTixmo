import React, { useEffect, useState } from 'react';
import {
    Calendar,
    Filter,
    FolderKanban,
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

const ApprovalsDashboard = ({ user }) => {
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

    const visibleApprovals = approvals.filter((approval) => {
        const haystack = `${approval.title} ${approval.event?.name || ''}`.toLowerCase();
        return haystack.includes(searchQuery.toLowerCase());
    });

    return (
        <div className="min-h-[calc(100vh-64px)] bg-[#081018] text-white -m-6 px-4 py-6 sm:-m-8 sm:px-6 lg:px-8">
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

            <div className="mx-auto max-w-7xl space-y-6">
                <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_35%),linear-gradient(135deg,_#0b1724,_#0f1116)] p-6 shadow-2xl">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div className="space-y-3">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.22em] text-slate-300">
                                <FolderKanban className="h-3.5 w-3.5" />
                                Creative Asset Approval System
                            </div>
                            <div>
                                <h1 className="text-3xl font-semibold tracking-tight">Approvals Dashboard</h1>
                                <p className="mt-2 max-w-2xl text-sm text-slate-400">
                                    Latest revision first, threaded collaboration, secure external review, and deadline-aware triage in one workspace.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowCreateModal(true)}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300"
                        >
                            <Plus className="h-4 w-4" />
                            New submission
                        </button>
                    </div>
                </section>

                <section className="grid gap-3 rounded-[2rem] border border-white/10 bg-[#0d1520] p-5 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
                    <label className="relative">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by asset title or event"
                            className="w-full rounded-2xl border border-white/10 bg-[#081018] py-3 pl-10 pr-4 text-sm outline-none focus:border-sky-400"
                        />
                    </label>

                    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#081018] px-4 py-3 text-sm">
                        <Calendar className="h-4 w-4 text-slate-500" />
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
                    </label>

                    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#081018] px-4 py-3 text-sm">
                        <Filter className="h-4 w-4 text-slate-500" />
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="w-full bg-transparent outline-none"
                        >
                            <option value="deadline">Sort by deadline</option>
                            <option value="submittedAt">Sort by submission</option>
                        </select>
                    </label>

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setAssignedToMe((current) => !current)}
                            className={`flex-1 rounded-2xl border px-4 py-3 text-sm transition ${assignedToMe ? 'border-sky-400 bg-sky-500/15 text-sky-100' : 'border-white/10 bg-[#081018] text-slate-300'}`}
                        >
                            <span className="inline-flex items-center gap-2">
                                <UserCheck className="h-4 w-4" />
                                Assigned to me
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setApproachingDeadline((current) => !current)}
                            className={`flex-1 rounded-2xl border px-4 py-3 text-sm transition ${approachingDeadline ? 'border-amber-300 bg-amber-500/15 text-amber-100' : 'border-white/10 bg-[#081018] text-slate-300'}`}
                        >
                            Near deadline
                        </button>
                    </div>
                </section>

                <section className="flex flex-wrap gap-2">
                    {APPROVAL_STATUS_OPTIONS.map((status) => {
                        const meta = APPROVAL_STATUS_META[status];
                        const Icon = meta.icon;
                        const count = approvals.filter((approval) => approval.status === status).length;
                        const active = statusFilter === status;

                        return (
                            <button
                                key={status}
                                type="button"
                                onClick={() => setStatusFilter(status)}
                                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${active ? meta.chip : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:text-white'}`}
                            >
                                <Icon className="h-4 w-4" />
                                {meta.label}
                                <span className="rounded-full bg-black/20 px-2 py-0.5 text-xs">{count}</span>
                            </button>
                        );
                    })}
                </section>

                {error && (
                    <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="rounded-[2rem] border border-white/10 bg-[#0d1520] px-6 py-16 text-center text-sm text-slate-400">
                        Loading approvals…
                    </div>
                ) : visibleApprovals.length === 0 ? (
                    <div className="rounded-[2rem] border border-dashed border-white/10 bg-[#0d1520] px-6 py-16 text-center">
                        <p className="text-lg font-medium text-slate-200">No approvals match this view.</p>
                        <p className="mt-2 text-sm text-slate-500">Try a different status or create a new submission.</p>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                                    className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0d1520] text-left transition hover:-translate-y-0.5 hover:border-sky-300/40 hover:shadow-2xl"
                                >
                                    <div className="aspect-[4/3] bg-[linear-gradient(135deg,_rgba(14,165,233,0.18),_rgba(15,23,42,0.8))]">
                                        {previewAsset?.mimeType?.startsWith('image/') ? (
                                            <img src={previewAsset.s3Url} alt={approval.title} className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="flex h-full items-center justify-center text-slate-400">
                                                Latest revision preview unavailable
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-4 px-5 py-5">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ${meta.chip}`}>
                                                <Icon className="h-3.5 w-3.5" />
                                                {meta.label}
                                            </span>
                                            <span className="text-xs text-slate-500">v{approval.latestRevisionNumber}</span>
                                        </div>

                                        <div>
                                            <h2 className="text-lg font-semibold text-white">{approval.title}</h2>
                                            <p className="mt-1 text-sm text-slate-400">{approval.event?.name || 'Unassigned event'}</p>
                                        </div>

                                        <div className="grid gap-2 text-sm text-slate-400">
                                            <div className="flex items-center justify-between">
                                                <span>Submitted</span>
                                                <span>{formatApprovalDate(approval.submittedAt)}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span>Deadline</span>
                                                <span>{formatApprovalDate(approval.deadline)}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span>Pending reviewers</span>
                                                <span>{pendingCount}</span>
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ApprovalsDashboard;
