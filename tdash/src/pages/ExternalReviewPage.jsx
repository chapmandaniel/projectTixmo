import React, { useEffect, useMemo, useState } from 'react';
import {
    CalendarDays,
    CheckCircle2,
    Download,
    FileText,
    MessageSquare,
    Send,
    ShieldCheck,
    XCircle,
} from 'lucide-react';
import {
    APPROVAL_STATUS_META,
    DECISION_OPTIONS,
    formatApprovalDate,
} from '../features/approvalConstants';

const reviewApi = {
    baseUrl: import.meta.env.VITE_API_URL || '/api/v1',

    async getReview(token) {
        const response = await fetch(`${this.baseUrl}/review/${token}`);
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || 'Invalid or expired review link');
        }
        return response.json();
    },

    async submitDecision(token, body) {
        const response = await fetch(`${this.baseUrl}/review/${token}/decisions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || 'Failed to submit decision');
        }
        return response.json();
    },

    async addComment(token, body) {
        const response = await fetch(`${this.baseUrl}/review/${token}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || 'Failed to add comment');
        }
        return response.json();
    },
};

const authorLabel = (author) => author?.name || author?.email || 'Unknown';

const ExternalReviewPage = () => {
    const token = window.location.pathname.split('/').pop();
    const [approval, setApproval] = useState(null);
    const [reviewer, setReviewer] = useState(null);
    const [selectedRevisionId, setSelectedRevisionId] = useState(null);
    const [assetIndex, setAssetIndex] = useState(0);
    const [comment, setComment] = useState('');
    const [decisionNote, setDecisionNote] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const loadReview = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await reviewApi.getReview(token);
            setApproval(response.approval);
            setReviewer(response.reviewer);
            setSelectedRevisionId(response.approval.latestRevision?.id || response.approval.revisions?.[0]?.id || null);
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReview();
    }, [token]);

    const selectedRevision = useMemo(() => {
        if (!approval?.revisions?.length) {
            return null;
        }

        return approval.revisions.find((revision) => revision.id === selectedRevisionId) || approval.latestRevision;
    }, [approval, selectedRevisionId]);

    useEffect(() => {
        setAssetIndex(0);
    }, [selectedRevisionId]);

    const selectedAsset = selectedRevision?.assets?.[assetIndex] || null;
    const statusMeta = APPROVAL_STATUS_META[approval?.status] || APPROVAL_STATUS_META.PENDING_REVIEW;
    const StatusIcon = statusMeta.icon;

    const submitDecision = async (decision) => {
        try {
            setSaving(true);
            setError('');
            await reviewApi.submitDecision(token, {
                decision,
                note: decisionNote || undefined,
                revisionId: approval.latestRevision?.id,
            });
            setDecisionNote('');
            await loadReview();
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setSaving(false);
        }
    };

    const submitComment = async (event) => {
        event.preventDefault();
        if (!comment.trim() || !selectedRevision) {
            return;
        }

        try {
            setSaving(true);
            setError('');
            await reviewApi.addComment(token, {
                content: comment,
                revisionId: selectedRevision.id,
            });
            setComment('');
            await loadReview();
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#07111a] text-slate-300 flex items-center justify-center">
                Loading review link…
            </div>
        );
    }

    if (error && !approval) {
        return (
            <div className="min-h-screen bg-[#07111a] px-6 py-16 text-center text-slate-300">
                <XCircle className="mx-auto h-12 w-12 text-rose-400" />
                <h1 className="mt-4 text-2xl font-semibold text-white">Review link unavailable</h1>
                <p className="mt-2 text-sm text-slate-400">{error}</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#07111a] text-white">
            <header className="border-b border-white/10 bg-[#0d1520]/90 backdrop-blur">
                <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-400">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Secure External Review
                        </div>
                        <h1 className="mt-3 text-2xl font-semibold">{approval.title}</h1>
                        <p className="mt-2 text-sm text-slate-400">
                            {approval.event?.name} • Requested by {approval.createdBy?.firstName} {approval.createdBy?.lastName}
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 lg:items-end">
                        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ${statusMeta.chip}`}>
                            <StatusIcon className="h-3.5 w-3.5" />
                            {statusMeta.label}
                        </span>
                        <div className="inline-flex items-center gap-2 text-sm text-slate-400">
                            <CalendarDays className="h-4 w-4" />
                            Deadline {formatApprovalDate(approval.deadline)}
                        </div>
                    </div>
                </div>
            </header>

            <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
                <section className="space-y-6">
                    <div className="rounded-[2rem] border border-white/10 bg-[#0d1520] p-5">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Asset viewer</p>
                                <h2 className="mt-2 text-lg font-semibold">Revision {selectedRevision?.revisionNumber}</h2>
                            </div>
                            <span className="text-sm text-slate-400">{formatApprovalDate(selectedRevision?.createdAt)}</span>
                        </div>

                        <div className="min-h-[420px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#07111a] p-6">
                            <div className="flex h-full items-center justify-center">
                                {selectedAsset ? (
                                    selectedAsset.mimeType?.startsWith('image/') ? (
                                        <img src={selectedAsset.s3Url} alt={selectedAsset.originalName} className="max-h-[520px] w-full rounded-2xl object-contain" />
                                    ) : (
                                        <div className="rounded-[1.5rem] border border-white/10 bg-[#0d1520] px-8 py-12 text-center">
                                            <FileText className="mx-auto h-12 w-12 text-slate-500" />
                                            <p className="mt-4 text-sm text-slate-300">{selectedAsset.originalName}</p>
                                            <a
                                                href={selectedAsset.s3Url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="mt-4 inline-flex items-center gap-2 rounded-full bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950"
                                            >
                                                <Download className="h-4 w-4" />
                                                Download
                                            </a>
                                        </div>
                                    )
                                ) : (
                                    <p className="text-sm text-slate-500">No preview available.</p>
                                )}
                            </div>
                        </div>

                        {selectedRevision?.assets?.length > 1 && (
                            <div className="mt-4 flex gap-2 overflow-x-auto">
                                {selectedRevision.assets.map((asset, index) => (
                                    <button
                                        key={asset.id}
                                        type="button"
                                        onClick={() => setAssetIndex(index)}
                                        className={`h-20 min-w-20 overflow-hidden rounded-2xl border ${index === assetIndex ? 'border-sky-400' : 'border-white/10'}`}
                                    >
                                        {asset.mimeType?.startsWith('image/') ? (
                                            <img src={asset.s3Url} alt={asset.originalName} className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="flex h-full items-center justify-center bg-[#07111a] text-xs text-slate-400">File</div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="rounded-[2rem] border border-white/10 bg-[#0d1520] p-5">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Comments</p>
                                <h2 className="mt-2 text-lg font-semibold">Discussion thread</h2>
                            </div>
                            <span className="inline-flex items-center gap-2 text-sm text-slate-400">
                                <MessageSquare className="h-4 w-4" />
                                {approval.comments.length} comments
                            </span>
                        </div>

                        <div className="space-y-3">
                            {approval.comments.map((item) => (
                                <div key={item.id} className="rounded-2xl border border-white/10 bg-[#07111a] p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="text-sm text-slate-300">{authorLabel(item.author)}</div>
                                        <div className="text-xs text-slate-500">{formatApprovalDate(item.createdAt)}</div>
                                    </div>
                                    <p className="mt-3 text-sm leading-6 text-slate-200">{item.content}</p>
                                </div>
                            ))}
                        </div>

                        <form onSubmit={submitComment} className="mt-5 rounded-[1.5rem] border border-white/10 bg-[#07111a] p-4">
                            <textarea
                                rows={4}
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Add a comment or ask for clarification."
                                className="w-full rounded-2xl border border-white/10 bg-[#0d1520] px-4 py-3 text-sm outline-none focus:border-sky-400"
                            />
                            <div className="mt-3 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={saving || !comment.trim()}
                                    className="inline-flex items-center gap-2 rounded-full bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <Send className="h-4 w-4" />
                                    Add comment
                                </button>
                            </div>
                        </form>
                    </div>
                </section>

                <aside className="space-y-6">
                    <section className="rounded-[2rem] border border-white/10 bg-[#0d1520] p-5">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Your access</p>
                        <div className="mt-4 rounded-2xl border border-white/10 bg-[#07111a] px-4 py-4 text-sm text-slate-300">
                            <p>{reviewer?.name || reviewer?.email}</p>
                            <p className="mt-1 text-xs text-slate-500">{reviewer?.email}</p>
                            <p className="mt-3 text-xs text-slate-400">
                                You can comment, browse revision history, approve, request changes, or decline this submission.
                            </p>
                        </div>

                        <textarea
                            rows={3}
                            value={decisionNote}
                            onChange={(e) => setDecisionNote(e.target.value)}
                            placeholder="Optional decision note"
                            className="mt-4 w-full rounded-2xl border border-white/10 bg-[#07111a] px-4 py-3 text-sm outline-none focus:border-sky-400"
                        />

                        <div className="mt-4 grid gap-2">
                            {DECISION_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    disabled={saving}
                                    onClick={() => submitDecision(option.value)}
                                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-slate-200 transition hover:border-sky-300/40 hover:text-white disabled:opacity-60"
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-[2rem] border border-white/10 bg-[#0d1520] p-5">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Version history</p>
                        <div className="mt-4 space-y-3">
                            {approval.revisions.map((revision) => (
                                <button
                                    key={revision.id}
                                    type="button"
                                    onClick={() => setSelectedRevisionId(revision.id)}
                                    className={`w-full rounded-2xl border px-4 py-4 text-left transition ${revision.id === selectedRevision?.id ? 'border-sky-400/50 bg-sky-500/10' : 'border-white/10 bg-[#07111a]'}`}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-sm font-medium">Revision {revision.revisionNumber}</span>
                                        <span className="text-xs text-slate-500">{formatApprovalDate(revision.createdAt)}</span>
                                    </div>
                                    <p className="mt-2 text-sm text-slate-400">{revision.summary || 'No revision note provided.'}</p>
                                </button>
                            ))}
                        </div>
                    </section>

                    {error && (
                        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                            {error}
                        </div>
                    )}
                </aside>
            </main>
        </div>
    );
};

export default ExternalReviewPage;
