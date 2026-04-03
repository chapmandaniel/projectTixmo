import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    Download,
    FileText,
    Search,
    Send,
    Trash2,
    XCircle,
} from 'lucide-react';
import {
    APPROVAL_STATUS_META,
    DECISION_OPTIONS,
    formatApprovalDate,
} from '../features/approvalConstants';
import SectionSkeletonOverlay from '../components/SectionSkeletonOverlay';
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

const DECISION_NOTE_META = {
    APPROVED: {
        icon: CheckCircle2,
        label: 'Approved note',
        badge: 'bg-emerald-500/12 text-emerald-200 border border-emerald-400/20',
        iconWrap: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100',
    },
    CHANGES_REQUESTED: {
        icon: AlertTriangle,
        label: 'Changes requested note',
        badge: 'bg-amber-500/12 text-amber-200 border border-amber-400/20',
        iconWrap: 'border-amber-400/20 bg-amber-500/10 text-amber-100',
    },
    DECLINED: {
        icon: XCircle,
        label: 'Declined note',
        badge: 'bg-rose-500/12 text-rose-200 border border-rose-400/20',
        iconWrap: 'border-rose-400/20 bg-rose-500/10 text-rose-100',
    },
};

const panelClass = 'rounded-md border border-[#2b2b40] bg-[#1e1e2d]';
const surfaceClass = 'rounded-md border border-[#2b2b40] bg-[#151521]';
const inputClass = 'w-full rounded-md border border-[#2b2b40] bg-[#151521] px-4 py-3 text-sm font-light text-gray-100 outline-none transition focus:border-sky-400 placeholder:text-[#5e6278]';
const reviewerAssociationOptions = [
    { value: 'ARTIST', label: 'Artist' },
    { value: 'AGENT', label: 'Agent' },
    { value: 'MANAGEMENT', label: 'Management' },
    { value: 'OTHER', label: 'Other' },
];
const associationBadgeClass = 'inline-flex rounded-full border border-fuchsia-400/35 bg-fuchsia-500/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-fuchsia-100';
const optimisticDiscussionItemClass = 'border-sky-400/20 bg-sky-500/8 opacity-80';

const associationLabel = (association) => (
    reviewerAssociationOptions.find((option) => option.value === association)?.label || association || ''
);

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

    async deleteComment(token, commentId) {
        const response = await fetch(`${this.baseUrl}/review/${token}/comments/${commentId}`, {
            method: 'DELETE',
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || 'Failed to delete comment');
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

const DecisionActionButton = ({ option, saving, onClick }) => (
    <button
        type="button"
        disabled={saving}
        onClick={onClick}
        className={`flex-1 rounded-md border px-4 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${DECISION_CARD_STYLES[option.value] || 'border-white/10 bg-white/5 text-slate-200 hover:border-sky-300/40 hover:text-white'}`}
    >
        {option.label}
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
    const [pendingDecision, setPendingDecision] = useState(null);
    const [decisionReason, setDecisionReason] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [pendingSection, setPendingSection] = useState(null);
    const [optimisticComments, setOptimisticComments] = useState([]);
    const [error, setError] = useState('');

    const loadReview = async () => {
        const shouldShowLoading = !approval;

        try {
            if (shouldShowLoading) {
                setLoading(true);
            } else {
                setRefreshing(true);
            }
            setError('');
            const response = await reviewApi.getReview(token);
            setApproval(response.approval);
            setReviewer(response.reviewer);
            setSelectedRevisionId(response.approval.latestRevision?.id || response.approval.revisions?.[0]?.id || null);
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            if (shouldShowLoading) {
                setLoading(false);
            } else {
                setRefreshing(false);
            }
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

    const comments = useMemo(
        () => [...(approval?.comments || []), ...optimisticComments],
        [approval?.comments, optimisticComments]
    );
    const latestRevisionDecisions =
        approval?.latestRevision?.decisions ||
        approval?.revisions?.[0]?.decisions ||
        [];

    const discussionItems = useMemo(() => {
        const commentItems = comments.map((item) => ({
            id: `comment-${item.id}`,
            commentId: item.id,
            type: 'comment',
            createdAt: item.createdAt,
            author: item.author,
            content: item.content,
            pending: item.pending,
        }));

        const decisionItems = latestRevisionDecisions
            .filter((decision) => decision.note?.trim())
            .map((decision) => ({
                id: `decision-${decision.id}`,
                type: 'decision',
                createdAt: decision.createdAt,
                author: decision.reviewer
                    ? {
                        name: decision.reviewer.name || decision.reviewer.email,
                        email: decision.reviewer.email,
                        type: decision.reviewer.reviewerType,
                        association: decision.reviewer.association,
                    }
                    : reviewer
                        ? {
                            name: reviewer.name || reviewer.email,
                            email: reviewer.email,
                            type: reviewer.reviewerType,
                            association: reviewer.association,
                        }
                        : null,
                content: decision.note.trim(),
                decision: decision.decision,
            }));

        return [...commentItems, ...decisionItems].sort((left, right) => {
            const leftTime = new Date(left.createdAt || 0).getTime();
            const rightTime = new Date(right.createdAt || 0).getTime();
            return rightTime - leftTime;
        });
    }, [comments, latestRevisionDecisions, reviewer]);

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
    const requesterName = personLabel(approval?.createdBy);
    const statusMeta = APPROVAL_STATUS_META[approval?.status] || APPROVAL_STATUS_META.PENDING_REVIEW;
    const commentRevisionId = approval?.latestRevision?.id || selectedRevision?.id || null;
    const currentDecision = approval?.myReview?.decision
        ? `Current decision: ${approval.myReview.decision.replaceAll('_', ' ')}`
        : 'You have not responded yet.';
    const canDeleteComment = (item) => (
        !item.pending &&
        item.type === 'comment' &&
        Boolean(
            item.author?.id === reviewer?.id ||
            (
                item.author?.email?.toLowerCase() &&
                reviewer?.email?.toLowerCase() &&
                item.author.email.toLowerCase() === reviewer.email.toLowerCase()
            )
        )
    );

    const closeDecisionModal = () => {
        setPendingDecision(null);
        setDecisionReason('');
    };

    const clearSectionState = (section) => {
        setPendingSection((current) => (current === section ? null : current));
    };

    const submitDecision = async (decision, note) => {
        try {
            setPendingSection('aside');
            setSaving(true);
            setError('');
            await reviewApi.submitDecision(token, {
                decision,
                note: note || undefined,
                revisionId: approval.latestRevision?.id,
            });
            await loadReview();
        } catch (requestError) {
            setError(requestError.message);
            throw requestError;
        } finally {
            setSaving(false);
            clearSectionState('aside');
        }
    };

    const handleDecisionAction = async (decision) => {
        if (decision === 'APPROVED') {
            await submitDecision(decision);
            return;
        }

        setPendingDecision(decision);
        setDecisionReason('');
    };

    const submitDecisionReason = async (event) => {
        event.preventDefault();
        if (!pendingDecision || !decisionReason.trim()) {
            return;
        }

        try {
            await submitDecision(pendingDecision, decisionReason.trim());
            closeDecisionModal();
        } catch {
            // submitDecision already surfaces the error banner
        }
    };

    const submitComment = async (event) => {
        event.preventDefault();
        if (!comment.trim() || !commentRevisionId) {
            return;
        }

        const content = comment.trim();
        const optimisticId = `optimistic-comment-${Date.now()}`;
        const optimisticComment = {
            id: optimisticId,
            commentId: optimisticId,
            type: 'comment',
            createdAt: new Date().toISOString(),
            content,
            pending: true,
            author: {
                id: reviewer?.id,
                name: reviewer?.name || reviewer?.email,
                email: reviewer?.email,
                type: reviewer?.reviewerType,
                association: reviewer?.association,
            },
        };

        try {
            setPendingSection('aside');
            setSaving(true);
            setError('');
            setOptimisticComments((current) => [optimisticComment, ...current]);
            setComment('');
            await reviewApi.addComment(token, {
                content,
                revisionId: commentRevisionId,
            });
            setOptimisticComments([]);
            await loadReview();
        } catch (requestError) {
            setOptimisticComments((current) => current.filter((item) => item.id !== optimisticComment.id));
            setError(requestError.message);
        } finally {
            setSaving(false);
            clearSectionState('aside');
        }
    };

    const deleteComment = async (commentId) => {
        if (!window.confirm('Delete this message?')) {
            return;
        }

        try {
            setPendingSection('aside');
            setSaving(true);
            setError('');
            await reviewApi.deleteComment(token, commentId);
            await loadReview();
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setSaving(false);
            clearSectionState('aside');
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
                        <div className="flex items-start justify-between gap-3">
                            <h1 className="flex flex-wrap items-center gap-3 text-3xl font-light tracking-tight text-gray-100 sm:text-4xl">
                                <span>Review Portal</span>
                                <Search className="h-5 w-5 text-sky-300" />
                                <span className="text-lg font-medium text-sky-300 sm:text-xl">{approval.title}</span>
                            </h1>
                            {refreshing && (
                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[#8f94aa]">
                                    Refreshing
                                </span>
                            )}
                        </div>
                    </div>
                </section>

                {error && (
                    <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-light text-rose-300">
                        {error}
                    </div>
                )}

                <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.06fr)_minmax(0,0.94fr)]">
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
                                            <p className="truncate text-base font-medium text-gray-100">{approval.title}</p>
                                            <p className="mt-1 text-sm font-light leading-6 text-[#8f94aa]">
                                                {approval.description || 'Review the latest supplied asset and respond from this secure portal.'}
                                            </p>
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

                            <div className="border-t border-[#2b2b40] p-4">
                                <div className="rounded-md border border-white/10 bg-white/5 px-4 py-3 text-xs font-light leading-6 text-[#a1a5b7]">
                                    <span className="text-gray-100">{approval.event?.name || 'Unassigned event'}</span>
                                    <span className="mx-2 text-[#5e6278]">/</span>
                                    <span className="text-gray-100">{requesterName}</span>
                                    <span className="mx-2 text-[#5e6278]">/</span>
                                    <span>Due <span className="text-gray-100">{formatApprovalDate(approval.deadline)}</span></span>
                                    <span className="mx-2 text-[#5e6278]">/</span>
                                    <span>Link expires <span className="text-gray-100">{formatApprovalDate(reviewer?.tokenExpiresAt)}</span></span>
                                    <span className="mx-2 text-[#5e6278]">/</span>
                                    <span>Status <span className="text-gray-100">{statusMeta.label}</span></span>
                                </div>
                            </div>
                        </div>
                    </section>

                    <aside className="relative space-y-4">
                        {(refreshing || pendingSection === 'aside') && (
                            <SectionSkeletonOverlay
                                label={pendingSection === 'aside' ? 'Updating review panel' : 'Refreshing review panel'}
                                variant="conversation"
                            />
                        )}
                        <div className="px-1 pt-1">
                            <p className="text-sm font-light text-[#a1a5b7]">{currentDecision}</p>
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                {DECISION_OPTIONS.map((option) => (
                                    <DecisionActionButton
                                        key={option.value}
                                        option={option}
                                        saving={saving}
                                        onClick={() => handleDecisionAction(option.value)}
                                    />
                                ))}
                            </div>
                        </div>

                        <section className={`${panelClass} p-4`}>
                            <div className="flex items-center justify-between gap-4 px-1 pb-3">
                                <h2 className="text-lg font-light text-gray-100">Discussion</h2>
                                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-[#8f94aa]">
                                    {discussionItems.length}
                                </span>
                            </div>

                            <div className="space-y-3">
                                {discussionItems.map((item, index) => {
                                    const decisionMeta =
                                        item.type === 'decision'
                                            ? DECISION_NOTE_META[item.decision]
                                            : null;
                                    const DecisionIcon = decisionMeta?.icon || null;

                                    return (
                                        <div
                                            key={item.id}
                                            data-testid="external-discussion-item"
                                            className={`relative rounded-lg px-1 pb-3 ${item.pending ? optimisticDiscussionItemClass : ''} ${index !== discussionItems.length - 1 ? 'border-b border-[#2b2b40]' : ''}`}
                                        >
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div className="flex items-start gap-3">
                                                    {item.type === 'decision' && DecisionIcon ? (
                                                        <div className={`flex h-9 w-9 items-center justify-center rounded-full border ${decisionMeta.iconWrap}`}>
                                                            <DecisionIcon className="h-4 w-4" aria-label={decisionMeta.label} />
                                                        </div>
                                                    ) : (
                                                        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-sky-400/20 bg-sky-500/10 text-[11px] uppercase tracking-[0.18em] text-sky-100">
                                                            {initialsLabel(item.author)}
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="text-sm font-light text-gray-100">{authorLabel(item.author)}</span>
                                                            {item.author?.type !== 'INTERNAL' && item.author?.association && (
                                                                <span className={associationBadgeClass}>
                                                                    {associationLabel(item.author.association)}
                                                                </span>
                                                            )}
                                                            {item.type === 'decision' && decisionMeta && (
                                                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${decisionMeta.badge}`}>
                                                                    {item.decision.replaceAll('_', ' ')}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="mt-2 text-sm leading-6 font-light text-[#d7d9e4]">{item.content}</p>
                                                    </div>
                                                </div>
                                                <span className="text-[11px] font-light uppercase tracking-[0.16em] text-[#5e6278]">
                                                    {formatApprovalDate(item.createdAt)}
                                                </span>
                                                {canDeleteComment(item) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => deleteComment(item.commentId)}
                                                        disabled={saving}
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#8f94aa] transition hover:border-rose-400/30 hover:bg-rose-500/10 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                                                        aria-label="Delete message"
                                                        title="Delete message"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {discussionItems.length === 0 && (
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

            {pendingDecision && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"
                    role="dialog"
                    aria-modal="true"
                    aria-label={`${pendingDecision === 'CHANGES_REQUESTED' ? 'Request changes' : 'Decline'} note`}
                    onClick={closeDecisionModal}
                >
                    <div
                        className={`${panelClass} w-full max-w-lg p-6 shadow-2xl shadow-black/30`}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-light text-gray-100">
                                    {pendingDecision === 'CHANGES_REQUESTED' ? 'Request changes' : 'Decline submission'}
                                </h2>
                                <p className="mt-1 text-sm font-light text-[#8f94aa]">
                                    Add context so the requester sees it in the discussion thread.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeDecisionModal}
                                className="rounded-full border border-white/10 bg-white/5 p-2 text-[#8f94aa] transition hover:text-white"
                                aria-label="Close decision note modal"
                            >
                                <XCircle className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={submitDecisionReason} className="mt-5 space-y-4">
                            <textarea
                                rows={5}
                                value={decisionReason}
                                onChange={(event) => setDecisionReason(event.target.value)}
                                placeholder={pendingDecision === 'CHANGES_REQUESTED' ? 'Explain what needs to change' : 'Explain why you are declining this submission'}
                                className={inputClass}
                            />

                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={closeDecisionModal}
                                    className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm font-light text-[#a1a5b7] transition hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving || !decisionReason.trim()}
                                    className="inline-flex items-center gap-2 rounded-md bg-sky-500 px-4 py-2 text-sm text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    Submit note
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

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
