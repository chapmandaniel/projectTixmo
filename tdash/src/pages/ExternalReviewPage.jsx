import React, { useEffect, useMemo, useState } from 'react';
import {
    CalendarDays,
    CheckCircle2,
    Download,
    FileText,
    MessageSquare,
    Send,
    ShieldCheck,
    User,
    XCircle,
} from 'lucide-react';
import {
    APPROVAL_STATUS_META,
    DECISION_OPTIONS,
    formatApprovalDate,
} from '../features/approvalConstants';
import { getApiBaseUrl } from '../lib/runtimeConfig';

const STATUS_CARD_ACCENTS = {
    PENDING_REVIEW: 'from-amber-400 to-orange-500',
    UPDATED: 'from-sky-400 to-cyan-500',
    CHANGES_REQUESTED: 'from-orange-400 to-rose-500',
    APPROVED: 'from-emerald-400 to-teal-500',
    DECLINED: 'from-rose-400 to-red-500',
};

const DECISION_CARD_STYLES = {
    APPROVED: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100 hover:border-emerald-300/50 hover:bg-emerald-500/15',
    CHANGES_REQUESTED: 'border-amber-400/30 bg-amber-500/10 text-amber-100 hover:border-amber-300/50 hover:bg-amber-500/15',
    DECLINED: 'border-rose-400/30 bg-rose-500/10 text-rose-100 hover:border-rose-300/50 hover:bg-rose-500/15',
};

const panelClass = 'rounded-md border border-[#2b2b40] bg-[#1e1e2d]';
const surfaceClass = 'rounded-md border border-[#2b2b40] bg-[#151521]';
const inputClass = 'w-full rounded-md border border-[#2b2b40] bg-[#151521] px-4 py-3 text-sm font-light text-gray-100 outline-none transition focus:border-sky-400 placeholder:text-[#5e6278]';

const reviewApi = {
    baseUrl: getApiBaseUrl(),

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

const DecisionActionCard = ({ option, saving, onClick }) => (
    <button
        type="button"
        disabled={saving}
        onClick={onClick}
        className={`rounded-md border px-4 py-3 text-left text-sm font-light transition disabled:cursor-not-allowed disabled:opacity-60 ${DECISION_CARD_STYLES[option.value] || 'border-white/10 bg-white/5 text-slate-200 hover:border-sky-300/40 hover:text-white'}`}
    >
        <span className="block font-medium text-inherit">{option.label}</span>
        <span className="mt-1 block text-xs text-inherit/80">
            {option.value === 'APPROVED'
                ? 'Confirm the latest revision is ready to go.'
                : option.value === 'CHANGES_REQUESTED'
                    ? 'Flag the revision for another iteration.'
                    : 'Reject the submission in its current form.'}
        </span>
    </button>
);

const ExternalReviewPage = () => {
    const token = window.location.pathname.split('/').filter(Boolean).pop();
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
    const requesterName = [approval?.createdBy?.firstName, approval?.createdBy?.lastName].filter(Boolean).join(' ')
        || approval?.createdBy?.email
        || 'Unknown requester';
    const currentDecision = approval?.myReview?.decision
        ? approval.myReview.decision.replaceAll('_', ' ')
        : 'No decision submitted';

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
            <div className="min-h-screen bg-[#141625] px-6 py-16 text-center text-sm font-light text-[#8f94aa]">
                Loading review workspace...
            </div>
        );
    }

    if (error && !approval) {
        return (
            <div className="min-h-screen bg-[#141625] px-6 py-16">
                <div className="mx-auto max-w-3xl">
                    <div className="rounded-md border border-rose-500/30 bg-[#1e1e2d] px-6 py-16 text-center shadow-2xl shadow-black/20">
                        <XCircle className="mx-auto h-12 w-12 text-rose-400" />
                        <h1 className="mt-4 text-3xl font-light tracking-tight text-gray-100">Review link unavailable</h1>
                        <p className="mt-3 text-sm font-light text-[#8f94aa]">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#141625] text-white">
            <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
                <section className={`relative overflow-hidden rounded-md border p-6 sm:p-8 ${panelClass}`}>
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl" />
                        <div className="absolute left-10 bottom-0 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
                    </div>

                    <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div className="space-y-4">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.22em] text-[#a1a5b7]">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                Secure External Review
                            </div>
                            <div>
                                <h1 className="flex flex-wrap items-baseline gap-3 text-3xl font-light tracking-tight text-gray-100 sm:text-4xl">
                                    <span className="inline-flex items-center gap-2">
                                        <span>Review Portal</span>
                                        <CheckCircle2 className="h-6 w-6 text-sky-300 sm:h-7 sm:w-7" />
                                    </span>
                                </h1>
                                <p className="mt-3 text-lg font-light text-gray-200">{approval.title}</p>
                                <p className="mt-2 max-w-3xl text-sm font-light text-[#8f94aa]">
                                    {approval.description || 'Browse the latest revision, leave comments, and submit your decision from a secure review workspace.'}
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-3 md:min-w-[320px]">
                            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ${statusMeta.chip}`}>
                                <StatusIcon className="h-3.5 w-3.5" />
                                {statusMeta.label}
                            </span>
                            <div className={`${surfaceClass} px-4 py-4 text-sm font-light text-[#a1a5b7]`}>
                                <div className="flex items-center justify-between gap-3">
                                    <span>Requested by</span>
                                    <span className="text-right text-gray-100">{requesterName}</span>
                                </div>
                                <div className="mt-2 flex items-center justify-between gap-3">
                                    <span>Event</span>
                                    <span className="text-right text-gray-100">{approval.event?.name || 'Unassigned event'}</span>
                                </div>
                                <div className="mt-2 flex items-center justify-between gap-3">
                                    <span>Deadline</span>
                                    <span className="text-right text-gray-100">{formatApprovalDate(approval.deadline)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
                    <aside className="space-y-4">
                        <section className={`${panelClass} p-4`}>
                            <p className="text-xs uppercase tracking-[0.2em] text-[#8f94aa]">Your access</p>
                            <div className={`${surfaceClass} mt-3 px-4 py-4 text-sm font-light text-[#a1a5b7]`}>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#1e1e2d] text-sky-200">
                                        <User className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm text-gray-100">{reviewer?.name || reviewer?.email}</p>
                                        <p className="truncate text-xs text-[#8f94aa]">{reviewer?.email}</p>
                                    </div>
                                </div>
                                <div className="mt-4 grid gap-2 text-xs">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-[#8f94aa]">Current decision</span>
                                        <span className="text-right uppercase tracking-[0.14em] text-gray-100">{currentDecision}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-[#8f94aa]">Link expires</span>
                                        <span className="text-right text-gray-100">{formatApprovalDate(reviewer?.tokenExpiresAt)}</span>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className={`${panelClass} p-4`}>
                            <p className="text-xs uppercase tracking-[0.2em] text-[#8f94aa]">Decision controls</p>
                            <textarea
                                rows={4}
                                value={decisionNote}
                                onChange={(e) => setDecisionNote(e.target.value)}
                                placeholder="Optional note for your decision"
                                className={`${inputClass} mt-3`}
                            />
                            <div className="mt-3 grid gap-2">
                                {DECISION_OPTIONS.map((option) => (
                                    <DecisionActionCard
                                        key={option.value}
                                        option={option}
                                        saving={saving}
                                        onClick={() => submitDecision(option.value)}
                                    />
                                ))}
                            </div>
                        </section>

                        <section className={`${panelClass} p-4`}>
                            <p className="text-xs uppercase tracking-[0.2em] text-[#8f94aa]">Version history</p>
                            <div className="mt-3 space-y-2">
                                {(approval.revisions || []).map((revision) => (
                                    <button
                                        key={revision.id}
                                        type="button"
                                        onClick={() => setSelectedRevisionId(revision.id)}
                                        className={`relative w-full overflow-hidden rounded-md border px-4 py-4 text-left transition-all duration-300 ${
                                            revision.id === selectedRevision?.id
                                                ? 'border-sky-400/50 bg-[#232336] shadow-xl shadow-sky-950/20'
                                                : 'border-[#2b2b40] bg-[#151521] hover:border-[#3a3a5a] hover:bg-[#202033]'
                                        }`}
                                    >
                                        <div className={`absolute left-0 top-0 h-[3px] w-full bg-gradient-to-r ${STATUS_CARD_ACCENTS[approval.status] || 'from-slate-400 to-slate-500'} ${revision.id === selectedRevision?.id ? 'opacity-100' : 'opacity-45'}`} />
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-sm font-light text-gray-100">Revision {revision.revisionNumber}</span>
                                            <span className="text-[11px] uppercase tracking-[0.16em] text-[#8f94aa]">{revision.assets?.length || 0} files</span>
                                        </div>
                                        <p className="mt-2 text-xs font-light text-[#8f94aa]">{revision.summary || 'No revision note provided.'}</p>
                                        <p className="mt-3 text-[11px] font-light text-[#5e6278]">{formatApprovalDate(revision.createdAt)}</p>
                                    </button>
                                ))}
                            </div>
                        </section>
                    </aside>

                    <div className="space-y-4">
                        {error && (
                            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-light text-rose-300">
                                {error}
                            </div>
                        )}

                        <section className={`${panelClass} p-4`}>
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.2em] text-[#8f94aa]">Active revision</p>
                                    <h2 className="mt-2 text-2xl font-light tracking-tight text-gray-100">
                                        Revision {selectedRevision?.revisionNumber || 'Latest'}
                                    </h2>
                                    <p className="mt-2 max-w-2xl text-sm font-light text-[#a1a5b7]">
                                        {selectedRevision?.summary || approval.description || 'Review the latest supplied files and confirm whether this version is ready to move forward.'}
                                    </p>
                                </div>

                                <div className={`${surfaceClass} min-w-[260px] px-4 py-4 text-sm font-light text-[#a1a5b7]`}>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="inline-flex items-center gap-2">
                                            <CalendarDays className="h-4 w-4 text-[#5e6278]" />
                                            Uploaded
                                        </span>
                                        <span className="text-right text-gray-100">{formatApprovalDate(selectedRevision?.createdAt)}</span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between gap-3">
                                        <span>Files in revision</span>
                                        <span className="text-right text-gray-100">{selectedRevision?.assets?.length || 0}</span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between gap-3">
                                        <span>Comments</span>
                                        <span className="text-right text-gray-100">{approval.comments?.length || 0}</span>
                                    </div>
                                </div>
                            </div>

                            <div className={`${surfaceClass} mt-4 overflow-hidden p-4`}>
                                <div className="flex min-h-[480px] items-center justify-center rounded-md bg-[linear-gradient(135deg,_rgba(56,189,248,0.14),_rgba(21,21,33,0.9))] p-4">
                                    {selectedAsset ? (
                                        selectedAsset.mimeType?.startsWith('image/') ? (
                                            <img
                                                src={selectedAsset.s3Url}
                                                alt={selectedAsset.originalName}
                                                className="max-h-[560px] w-full rounded-md object-contain"
                                            />
                                        ) : (
                                            <div className={`${panelClass} max-w-md px-8 py-12 text-center`}>
                                                <FileText className="mx-auto h-12 w-12 text-[#8f94aa]" />
                                                <p className="mt-4 text-sm font-light text-gray-100">{selectedAsset.originalName}</p>
                                                <p className="mt-2 text-xs font-light text-[#8f94aa]">Preview unavailable for this file type.</p>
                                                <a
                                                    href={selectedAsset.s3Url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="mt-4 inline-flex items-center gap-2 rounded-md bg-sky-500 px-4 py-2.5 text-sm text-white transition-colors hover:bg-sky-400"
                                                >
                                                    <Download className="h-4 w-4" />
                                                    Download file
                                                </a>
                                            </div>
                                        )
                                    ) : (
                                        <p className="text-sm font-light text-[#8f94aa]">No preview available.</p>
                                    )}
                                </div>

                                {selectedAsset && (
                                    <div className="mt-4 flex items-center justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-light text-gray-100">{selectedAsset.originalName}</p>
                                            <p className="mt-1 text-xs font-light text-[#8f94aa]">{selectedAsset.mimeType || 'Unknown file type'}</p>
                                        </div>
                                        <a
                                            href={selectedAsset.s3Url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex shrink-0 items-center gap-2 rounded-md border border-[#2b2b40] bg-[#1e1e2d] px-4 py-2.5 text-sm font-light text-gray-100 transition hover:border-[#3a3a5a] hover:bg-[#232336]"
                                        >
                                            <Download className="h-4 w-4" />
                                            Download
                                        </a>
                                    </div>
                                )}

                                {(selectedRevision?.assets?.length || 0) > 1 && (
                                    <div className="mt-4 grid gap-2 sm:grid-cols-4 lg:grid-cols-6">
                                        {selectedRevision.assets.map((asset, index) => (
                                            <button
                                                key={asset.id}
                                                type="button"
                                                onClick={() => setAssetIndex(index)}
                                                className={`relative overflow-hidden rounded-md border transition-all duration-300 ${
                                                    index === assetIndex
                                                        ? 'border-sky-400/50 bg-[#232336] shadow-lg shadow-sky-950/20'
                                                        : 'border-[#2b2b40] bg-[#151521] hover:border-[#3a3a5a] hover:bg-[#202033]'
                                                }`}
                                            >
                                                <div className={`absolute left-0 top-0 h-[3px] w-full bg-gradient-to-r ${STATUS_CARD_ACCENTS[approval.status] || 'from-slate-400 to-slate-500'} ${index === assetIndex ? 'opacity-100' : 'opacity-45'}`} />
                                                <div className="aspect-square">
                                                    {asset.mimeType?.startsWith('image/') ? (
                                                        <img src={asset.s3Url} alt={asset.originalName} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <div className="flex h-full items-center justify-center text-xs font-light text-[#8f94aa]">File</div>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </section>

                        <section className={`${panelClass} p-4`}>
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.2em] text-[#8f94aa]">Discussion thread</p>
                                    <h2 className="mt-2 text-2xl font-light tracking-tight text-gray-100">Comments</h2>
                                </div>
                                <span className="inline-flex items-center gap-2 text-sm font-light text-[#a1a5b7]">
                                    <MessageSquare className="h-4 w-4" />
                                    {approval.comments?.length || 0} comments
                                </span>
                            </div>

                            <div className="mt-4 space-y-3">
                                {(approval.comments || []).map((item) => (
                                    <div key={item.id} className={`${surfaceClass} px-4 py-4`}>
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="text-sm font-light text-gray-100">{authorLabel(item.author)}</div>
                                            <div className="text-xs font-light text-[#8f94aa]">{formatApprovalDate(item.createdAt)}</div>
                                        </div>
                                        <p className="mt-3 text-sm font-light leading-6 text-[#d2d5e2]">{item.content}</p>
                                    </div>
                                ))}
                            </div>

                            <form onSubmit={submitComment} className={`${surfaceClass} mt-4 px-4 py-4`}>
                                <textarea
                                    rows={4}
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    placeholder="Add a comment or ask for clarification."
                                    className={inputClass}
                                />
                                <div className="mt-3 flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={saving || !comment.trim()}
                                        className="inline-flex items-center gap-2 rounded-md bg-sky-500 px-4 py-2.5 text-sm text-white transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <Send className="h-4 w-4" />
                                        Add comment
                                    </button>
                                </div>
                            </form>
                        </section>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default ExternalReviewPage;
