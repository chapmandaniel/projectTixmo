import React, { useEffect, useMemo, useState } from 'react';
import {
    Download,
    FileText,
    Send,
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

const initialsLabel = (author) => {
    const label = authorLabel(author).trim();
    if (!label) {
        return '??';
    }

    const parts = label.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
};

const assetLabel = (asset, index) => {
    const filename = asset?.originalName?.trim();
    if (!filename) {
        return `Option ${index + 1}`;
    }

    return filename.replace(/\.[^/.]+$/, '') || filename;
};

const assetTypeLabel = (asset) => (
    asset?.mimeType?.startsWith('image/')
        ? 'Image option'
        : 'File option'
);

const personLabel = (person) => {
    if (!person) {
        return 'Unknown';
    }

    const name = [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
    return name || person.name || person.email || 'Unknown';
};

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
                ? 'Confirm the latest version is ready to ship.'
                : option.value === 'CHANGES_REQUESTED'
                    ? 'Send the work back for another iteration.'
                    : 'Reject the submission in its current state.'}
        </span>
    </button>
);

const ExternalReviewPage = () => {
    const token = window.location.pathname.split('/').filter(Boolean).pop();
    const [approval, setApproval] = useState(null);
    const [reviewer, setReviewer] = useState(null);
    const [selectedRevisionId, setSelectedRevisionId] = useState(null);
    const [assetIndex, setAssetIndex] = useState(0);
    const [isImageExpanded, setIsImageExpanded] = useState(false);
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

        return (
            approval.revisions.find((revision) => revision.id === selectedRevisionId) ||
            approval.latestRevision ||
            approval.revisions[0]
        );
    }, [approval, selectedRevisionId]);

    const comments = approval?.comments || [];
    const sortedComments = useMemo(
        () =>
            [...comments].sort((left, right) => {
                const leftTime = new Date(left.createdAt || 0).getTime();
                const rightTime = new Date(right.createdAt || 0).getTime();
                return rightTime - leftTime;
            }),
        [comments]
    );

    useEffect(() => {
        setAssetIndex(0);
    }, [selectedRevisionId]);

    useEffect(() => {
        if (!isImageExpanded) {
            return undefined;
        }

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setIsImageExpanded(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isImageExpanded]);

    const selectedAsset = selectedRevision?.assets?.[assetIndex] || null;
    const statusMeta = APPROVAL_STATUS_META[approval?.status] || APPROVAL_STATUS_META.PENDING_REVIEW;
    const StatusIcon = statusMeta.icon;
    const requesterName = personLabel(approval?.createdBy);
    const currentDecision = approval?.myReview?.decision
        ? `Current decision: ${approval.myReview.decision.replaceAll('_', ' ')}`
        : 'You have not responded yet.';
    const commentRevisionId = approval?.latestRevision?.id || selectedRevision?.id || null;

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
        if (!comment.trim() || !commentRevisionId) {
            return;
        }

        try {
            setSaving(true);
            setError('');
            await reviewApi.addComment(token, {
                content: comment,
                revisionId: commentRevisionId,
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
            <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
                <section className={`relative overflow-hidden rounded-md border px-6 py-8 sm:px-8 ${panelClass}`}>
                    <div className={`absolute left-0 top-0 h-[3px] w-full bg-gradient-to-r ${STATUS_CARD_ACCENTS[approval.status] || 'from-slate-400 to-slate-500'}`} />
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl" />
                        <div className="absolute left-10 bottom-0 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
                    </div>
                    <div className="relative">
                        <h1 className="text-3xl font-light tracking-tight text-gray-100 sm:text-4xl">
                            Review Portal
                        </h1>
                    </div>
                </section>

                {error && (
                    <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-light text-rose-300">
                        {error}
                    </div>
                )}

                <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)]">
                    <section className={`${panelClass} p-4 sm:p-5`}>
                        <div className={`${surfaceClass} relative overflow-hidden`}>
                            <div className="absolute left-4 top-4 z-10 flex max-w-[calc(100%-2rem)] gap-2 overflow-x-auto rounded-md border border-white/10 bg-[#0f1020]/90 px-2 py-2 shadow-lg shadow-black/20 backdrop-blur">
                                {(approval.revisions || []).map((revision) => (
                                    <button
                                        key={revision.id}
                                        type="button"
                                        onClick={() => setSelectedRevisionId(revision.id)}
                                        className={`rounded-md px-3 py-2 text-xs uppercase tracking-[0.16em] transition ${revision.id === selectedRevision?.id ? 'bg-sky-500 text-white' : 'bg-white/5 text-[#a1a5b7] hover:bg-white/10 hover:text-white'}`}
                                    >
                                        v{revision.revisionNumber}
                                    </button>
                                ))}
                            </div>

                            <div className="flex min-h-[520px] items-center justify-center p-6">
                                {selectedAsset ? (
                                    selectedAsset.mimeType?.startsWith('image/') ? (
                                        <button
                                            type="button"
                                            onClick={() => setIsImageExpanded(true)}
                                            className="group relative w-full cursor-zoom-in overflow-hidden rounded-md"
                                            aria-label={`Expand ${selectedAsset.originalName}`}
                                        >
                                            <img
                                                src={selectedAsset.s3Url}
                                                alt={selectedAsset.originalName}
                                                className="max-h-[560px] w-full rounded-md object-contain"
                                            />
                                            <span className="pointer-events-none absolute inset-x-4 bottom-4 rounded-full bg-black/60 px-3 py-2 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
                                                Click to expand
                                            </span>
                                        </button>
                                    ) : (
                                        <div className={`${panelClass} px-8 py-12 text-center`}>
                                            <FileText className="mx-auto h-12 w-12 text-[#5e6278]" />
                                            <p className="mt-4 text-sm font-light text-gray-200">{selectedAsset.originalName}</p>
                                            <a
                                                href={selectedAsset.s3Url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="mt-4 inline-flex items-center gap-2 rounded-md bg-sky-500 px-4 py-2 text-sm text-white transition hover:bg-sky-400"
                                            >
                                                <Download className="h-4 w-4" />
                                                Download file
                                            </a>
                                        </div>
                                    )
                                ) : (
                                    <div className="text-sm font-light text-[#8f94aa]">No assets uploaded for this version.</div>
                                )}
                            </div>

                            {selectedAsset && (
                                <div className="border-t border-[#2b2b40] px-4 py-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-light text-gray-100">{selectedAsset.originalName}</p>
                                            <p className="mt-1 text-xs font-light text-[#8f94aa]">{selectedAsset.mimeType || 'Unknown file type'}</p>
                                        </div>
                                        <a
                                            href={selectedAsset.s3Url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex shrink-0 items-center gap-2 rounded-md border border-[#2b2b40] bg-[#1e1e2d] px-4 py-2 text-sm font-light text-gray-100 transition hover:border-[#3a3a5a] hover:bg-[#232336]"
                                        >
                                            <Download className="h-4 w-4" />
                                            Download
                                        </a>
                                    </div>
                                </div>
                            )}

                            {(selectedRevision?.assets?.length || 0) > 1 && (
                                <div className="border-t border-[#2b2b40] p-4">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <p className="text-xs uppercase tracking-[0.16em] text-[#8f94aa]">Version options</p>
                                        <span className="text-[11px] uppercase tracking-[0.16em] text-[#5e6278]">
                                            {selectedRevision.assets.length} files
                                        </span>
                                    </div>

                                    <div className="flex gap-3 overflow-x-auto pb-1">
                                        {selectedRevision.assets.map((asset, index) => (
                                            <button
                                                key={asset.id}
                                                type="button"
                                                onClick={() => setAssetIndex(index)}
                                                className={`min-w-[148px] overflow-hidden rounded-lg border text-left transition ${index === assetIndex ? 'border-sky-400 bg-sky-500/10 shadow-lg shadow-sky-500/10' : 'border-[#2b2b40] bg-[#1e1e2d] hover:border-[#3a3a5a] hover:bg-[#232336]'}`}
                                            >
                                                <div className="flex h-24 items-center justify-center overflow-hidden border-b border-inherit bg-[#151521]">
                                                    {asset.mimeType?.startsWith('image/') ? (
                                                        <img src={asset.s3Url} alt={asset.originalName} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <div className="flex h-full w-full items-center justify-center text-xs font-light text-[#8f94aa]">File</div>
                                                    )}
                                                </div>
                                                <div className="space-y-1 px-3 py-3">
                                                    <p className="truncate text-sm font-light text-gray-100">{assetLabel(asset, index)}</p>
                                                    <p className="text-[11px] uppercase tracking-[0.16em] text-[#8f94aa]">
                                                        {assetTypeLabel(asset)}
                                                    </p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    <aside className="space-y-4">
                        <section className={`${panelClass} p-4`}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h2 className="truncate text-lg font-light text-gray-100">{approval.title}</h2>
                                    {approval.description && (
                                        <p className="mt-1 text-sm font-light leading-5 text-[#8f94aa]">
                                            {approval.description}
                                        </p>
                                    )}
                                </div>
                                <span className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1 text-xs ${statusMeta.chip}`}>
                                    <StatusIcon className="h-3.5 w-3.5" />
                                    {statusMeta.label}
                                </span>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-light text-[#a1a5b7]">
                                <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                                    <span className="block uppercase tracking-[0.16em] text-[#5e6278]">Event</span>
                                    <span className="mt-1 block text-sm text-gray-100">{approval.event?.name || 'Unassigned'}</span>
                                </div>
                                <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                                    <span className="block uppercase tracking-[0.16em] text-[#5e6278]">Requested by</span>
                                    <span className="mt-1 block text-sm text-gray-100">{requesterName}</span>
                                </div>
                                <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                                    <span className="block uppercase tracking-[0.16em] text-[#5e6278]">Due</span>
                                    <span className="mt-1 block text-sm text-gray-100">{formatApprovalDate(approval.deadline)}</span>
                                </div>
                                <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                                    <span className="block uppercase tracking-[0.16em] text-[#5e6278]">Link expires</span>
                                    <span className="mt-1 block text-sm text-gray-100">{formatApprovalDate(reviewer?.tokenExpiresAt)}</span>
                                </div>
                            </div>
                        </section>

                        <section className={`${panelClass} p-5`}>
                            <p className="text-xs uppercase tracking-[0.24em] text-[#8f94aa]">Decision controls</p>
                            <p className="mt-2 text-sm font-light text-[#a1a5b7]">{currentDecision}</p>
                            <textarea
                                rows={3}
                                value={decisionNote}
                                onChange={(e) => setDecisionNote(e.target.value)}
                                placeholder="Optional decision note"
                                className={`${inputClass} mt-4`}
                            />
                            <div className="mt-4 grid gap-2">
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
                            <div className="flex items-center justify-between gap-4 px-1 pb-3">
                                <h2 className="text-lg font-light text-gray-100">Discussion</h2>
                                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-[#8f94aa]">
                                    {sortedComments.length}
                                </span>
                            </div>

                            <div className="space-y-3">
                                {sortedComments.map((item, index) => (
                                    <div
                                        key={item.id}
                                        data-testid="external-comment-card"
                                        className={`relative rounded-lg px-1 pb-3 ${index !== sortedComments.length - 1 ? 'border-b border-[#2b2b40]' : ''}`}
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div className="flex items-start gap-3">
                                                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-sky-400/20 bg-sky-500/10 text-[11px] uppercase tracking-[0.18em] text-sky-100">
                                                    {initialsLabel(item.author)}
                                                </div>
                                                <div className="min-w-0">
                                                    <span className="text-sm font-light text-gray-100">{authorLabel(item.author)}</span>
                                                    <p className="mt-2 text-sm leading-6 font-light text-[#d7d9e4]">{item.content}</p>
                                                </div>
                                            </div>
                                            <span className="text-[11px] font-light uppercase tracking-[0.16em] text-[#5e6278]">
                                                {formatApprovalDate(item.createdAt)}
                                            </span>
                                        </div>
                                    </div>
                                ))}

                                {sortedComments.length === 0 && (
                                    <div className="rounded-lg border border-dashed border-[#2b2b40] px-4 py-8 text-center text-sm font-light text-[#8f94aa]">
                                        No comments yet.
                                    </div>
                                )}
                            </div>

                            <form onSubmit={submitComment} className="mt-4 flex items-end gap-3 border-t border-[#2b2b40] pt-4">
                                <textarea
                                    rows={3}
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    placeholder="Add a comment"
                                    className={`flex-1 ${inputClass}`}
                                />
                                <button
                                    type="submit"
                                    aria-label="Send comment"
                                    disabled={saving || !comment.trim()}
                                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <Send className="h-4 w-4" />
                                </button>
                            </form>
                        </section>
                    </aside>
                </section>
            </div>

            {isImageExpanded && selectedAsset?.mimeType?.startsWith('image/') && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 py-6"
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Expanded preview for ${selectedAsset.originalName}`}
                    onClick={() => setIsImageExpanded(false)}
                >
                    <button
                        type="button"
                        onClick={() => setIsImageExpanded(false)}
                        className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20"
                    >
                        <XCircle className="h-4 w-4" />
                        Close preview
                    </button>
                    <img
                        src={selectedAsset.s3Url}
                        alt={selectedAsset.originalName}
                        className="max-h-full max-w-full rounded-md object-contain shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
};

export default ExternalReviewPage;
