import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    Download,
    FileText,
    Hourglass,
    MailPlus,
    RotateCcw,
    Search,
    Send,
    Trash2,
    Upload,
    User,
    XCircle,
} from 'lucide-react';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import { api } from '../lib/api';
import {
    APPROVAL_STATUS_META,
    DECISION_OPTIONS,
    formatApprovalDate,
} from './approvalConstants';

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
const reviewerAssociationOptions = [
    { value: 'ARTIST', label: 'Artist' },
    { value: 'AGENT', label: 'Agent' },
    { value: 'MANAGEMENT', label: 'Management' },
    { value: 'OTHER', label: 'Other' },
];
const associationLabel = (association) => (
    reviewerAssociationOptions.find((option) => option.value === association)?.label || association || ''
);

const associationBadgeClass = 'inline-flex rounded-full border border-fuchsia-400/35 bg-fuchsia-500/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-fuchsia-100';
const optimisticItemClass = 'pending-surface-soft border-sky-400/20 bg-sky-500/8 opacity-80';

const authorLabel = (author) => {
    if (!author) {
        return 'Unknown';
    }

    return author.name || author.email || 'Unknown';
};

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

const normalizeEmail = (value) => value?.trim().toLowerCase() || '';

const replyPrefill = (commentItem) => {
    const label = authorLabel(commentItem?.author);
    if (!label || label === 'Unknown') {
        return '';
    }

    return `@${label} `;
};

const reviewerStatusMeta = (reviewer) => {
    if (reviewer?.latestDecision?.decision === 'APPROVED') {
        return {
            icon: CheckCircle2,
            className: 'text-emerald-400',
            label: 'Approved',
        };
    }

    if (
        reviewer?.latestDecision?.decision === 'DECLINED' ||
        reviewer?.latestDecision?.decision === 'CHANGES_REQUESTED'
    ) {
        return {
            icon: XCircle,
            className: 'text-rose-400',
            label:
                reviewer.latestDecision.decision === 'CHANGES_REQUESTED'
                    ? 'Changes requested'
                    : 'Declined',
        };
    }

    return {
        icon: Hourglass,
        className: 'text-[#707791]',
        label: 'Pending',
    };
};

const DecisionActionCard = ({ option, saving, onClick }) => (
    <button
        type="button"
        disabled={saving}
        onClick={onClick}
        className={`flex-1 rounded-md border px-4 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${DECISION_CARD_STYLES[option.value] || 'border-white/10 bg-white/5 text-slate-200 hover:border-sky-300/40 hover:text-white'}`}
    >
        {option.label}
    </button>
);

const ApprovalDetailLoadingSkeleton = () => (
    <SkeletonTheme baseColor="#26293a" highlightColor="#1d2130">
        <div className="min-h-[calc(100vh-64px)] bg-[#141625] text-white -m-6 px-4 py-6 sm:-m-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-[1500px] space-y-5">
                <div className="w-48">
                    <Skeleton height={40} borderRadius={8} />
                </div>

                <section className={`${panelClass} overflow-hidden px-6 py-8 sm:px-8`}>
                    <div className="space-y-4">
                        <Skeleton height={18} width={112} borderRadius={999} />
                        <Skeleton height={42} width="52%" borderRadius={10} />
                        <Skeleton height={18} width="34%" borderRadius={999} />
                    </div>
                </section>

                <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.06fr)_minmax(0,0.94fr)]">
                    <section className={`${panelClass} p-4 sm:p-5`}>
                        <div className={`${surfaceClass} overflow-hidden`}>
                            <div className="flex items-center justify-between gap-3 border-b border-[#2b2b40] px-4 py-4">
                                <div className="flex gap-2">
                                    <Skeleton height={34} width={74} borderRadius={8} />
                                    <Skeleton height={34} width={74} borderRadius={8} />
                                    <Skeleton height={34} width={74} borderRadius={8} />
                                </div>
                                <Skeleton height={36} width={138} borderRadius={8} />
                            </div>
                            <div className="p-6">
                                <Skeleton height={420} borderRadius={12} />
                            </div>
                            <div className="space-y-4 border-t border-[#2b2b40] px-4 py-4">
                                <Skeleton height={20} width="42%" borderRadius={999} />
                                <Skeleton count={2} height={16} borderRadius={999} />
                            </div>
                        </div>
                    </section>

                    <aside className="space-y-4">
                        <section className={`${panelClass} p-5`}>
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <Skeleton height={18} width={96} borderRadius={999} />
                                <Skeleton height={32} width={124} borderRadius={999} />
                            </div>
                            <div className="space-y-3">
                                {Array.from({ length: 3 }, (_, index) => (
                                    <div key={index} className={`${surfaceClass} px-4 py-3`}>
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex-1 space-y-2">
                                                <Skeleton height={18} width="58%" borderRadius={999} />
                                                <Skeleton height={14} width="34%" borderRadius={999} />
                                            </div>
                                            <Skeleton height={32} width={96} borderRadius={999} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className={`${panelClass} p-4`}>
                            <div className="mb-4 flex items-center justify-between gap-4 px-1">
                                <Skeleton height={24} width={108} borderRadius={999} />
                                <Skeleton height={24} width={44} borderRadius={999} />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Skeleton height={84} borderRadius={12} />
                                <Skeleton height={84} borderRadius={12} />
                            </div>
                            <div className="mt-4 space-y-3">
                                {Array.from({ length: 3 }, (_, index) => (
                                    <div key={index} className="rounded-lg border border-[#2b2b40] px-4 py-4">
                                        <div className="flex items-start gap-3">
                                            <Skeleton circle height={36} width={36} />
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-center justify-between gap-3">
                                                    <Skeleton height={16} width={120} borderRadius={999} />
                                                    <Skeleton height={12} width={72} borderRadius={999} />
                                                </div>
                                                <Skeleton count={2} height={14} borderRadius={999} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 border-t border-[#2b2b40] pt-4">
                                <Skeleton height={110} borderRadius={12} />
                            </div>
                        </section>
                    </aside>
                </section>
            </div>
        </div>
    </SkeletonTheme>
);

const ApprovalDetailView = ({ approvalId, initialApproval, user, onBack, onUpdated }) => {
    const fileInputRef = useRef(null);
    const isMountedRef = useRef(true);
    const requestSequenceRef = useRef(0);
    const [approval, setApproval] = useState(initialApproval);
    const [selectedRevisionId, setSelectedRevisionId] = useState(initialApproval?.latestRevision?.id || null);
    const [assetIndex, setAssetIndex] = useState(0);
    const [isImageExpanded, setIsImageExpanded] = useState(false);
    const [comment, setComment] = useState('');
    const [replyTo, setReplyTo] = useState(null);
    const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
    const [revisionSummary, setRevisionSummary] = useState('');
    const [revisionFiles, setRevisionFiles] = useState([]);
    const [isReviewerModalOpen, setIsReviewerModalOpen] = useState(false);
    const [reviewerEmail, setReviewerEmail] = useState('');
    const [reviewerAssociation, setReviewerAssociation] = useState('ARTIST');
    const [loading, setLoading] = useState(!initialApproval);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [pendingSection, setPendingSection] = useState(null);
    const [optimisticComments, setOptimisticComments] = useState([]);
    const [optimisticReviewers, setOptimisticReviewers] = useState([]);
    const [error, setError] = useState('');

    const fetchApproval = async () => {
        const requestId = requestSequenceRef.current + 1;
        requestSequenceRef.current = requestId;
        const shouldShowLoading = !approval;

        try {
            if (shouldShowLoading) {
                setLoading(true);
            } else {
                setRefreshing(true);
            }
            setError('');
            const response = await api.get(`/approvals/${approvalId}`);
            if (!isMountedRef.current || requestSequenceRef.current !== requestId) {
                return null;
            }
            setApproval(response);
            setSelectedRevisionId(response.latestRevision?.id || response.revisions?.[0]?.id || null);
            onUpdated?.(response);
            return response;
        } catch (requestError) {
            if (!isMountedRef.current || requestSequenceRef.current !== requestId) {
                return null;
            }
            setError(requestError.response?.data?.message || requestError.message || 'Failed to load approval.');
        } finally {
            if (!isMountedRef.current || requestSequenceRef.current !== requestId) {
                return;
            }
            if (shouldShowLoading) {
                setLoading(false);
            } else {
                setRefreshing(false);
            }
        }

        return null;
    };

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            requestSequenceRef.current += 1;
        };
    }, []);

    useEffect(() => {
        fetchApproval();
    }, [approvalId]);

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

    const revisions = approval?.revisions || [];
    const comments = useMemo(
        () => [...(approval?.comments || []), ...optimisticComments],
        [approval?.comments, optimisticComments]
    );
    const reviewers = useMemo(
        () => [...(approval?.reviewers || []), ...optimisticReviewers],
        [approval?.reviewers, optimisticReviewers]
    );
    const isTeamMember = useMemo(() => {
        if (user?.role || user?.organizationId) {
            return true;
        }

        const currentEmail = normalizeEmail(user?.email);
        if (!currentEmail) {
            return false;
        }

        return reviewers.some((reviewer) => (
            normalizeEmail(reviewer.email) === currentEmail &&
            reviewer.reviewerType === 'INTERNAL'
        ));
    }, [reviewers, user?.email, user?.organizationId, user?.role]);
    const sortedComments = useMemo(
        () =>
            [...comments].sort((left, right) => {
                const leftTime = new Date(left.createdAt || 0).getTime();
                const rightTime = new Date(right.createdAt || 0).getTime();
                return rightTime - leftTime;
            }),
        [comments]
    );
    const internalComments = useMemo(
        () => sortedComments.filter((item) => item.visibility === 'INTERNAL'),
        [sortedComments]
    );
    const visibleComments = useMemo(
        () => sortedComments.filter((item) => isTeamMember || item.visibility !== 'INTERNAL'),
        [isTeamMember, sortedComments]
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
    const reviewerAssignment = reviewers.find((reviewer) => reviewer.email === user?.email) || null;
    const latestDecision = reviewerAssignment?.latestDecision || approval?.myReview || null;
    const statusMeta = APPROVAL_STATUS_META[approval?.status] || APPROVAL_STATUS_META.PENDING_REVIEW;
    const requesterName = personLabel(approval?.createdBy);
    const commentRevisionId = approval?.latestRevision?.id || selectedRevision?.id || null;
    const currentDecision = latestDecision?.decision
        ? `Current decision: ${latestDecision.decision.replaceAll('_', ' ')}`
        : 'You have not responded yet.';
    const emptyStateLabel = isTeamMember
        ? 'No messages in this approval thread yet.'
        : 'No reviewer-visible messages yet.';

    const canDeleteComment = (commentItem) => {
        if (commentItem.pending) {
            return false;
        }

        const currentEmail = normalizeEmail(user?.email);
        const authorEmail = normalizeEmail(commentItem.author?.email);

        return Boolean(
            commentItem.author?.id === user?.id ||
            (currentEmail && authorEmail && currentEmail === authorEmail)
        );
    };
    const isWorkspacePending = refreshing || pendingSection === 'workspace';
    const isReviewersPending = refreshing || pendingSection === 'reviewers';
    const isDiscussionPending = refreshing || pendingSection === 'discussion' || pendingSection === 'decision';

    const clearSectionState = (section) => {
        setPendingSection((current) => (current === section ? null : current));
    };

    const resetRevisionDraft = () => {
        setRevisionFiles([]);
        setRevisionSummary('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const applyUpdatedApproval = (updated) => {
        if (!isMountedRef.current) {
            return;
        }

        setApproval(updated);
        setSelectedRevisionId((currentRevisionId) =>
            updated.revisions?.some((revision) => revision.id === currentRevisionId)
                ? currentRevisionId
                : updated.latestRevision?.id || updated.revisions?.[0]?.id || null
        );
        onUpdated?.(updated);
    };

    const closeReviewerModal = () => {
        setIsReviewerModalOpen(false);
        setReviewerEmail('');
        setReviewerAssociation('ARTIST');
    };

    const resetCommentDraft = () => {
        setComment('');
        setReplyTo(null);
    };

    const closeCommentModal = () => {
        setIsCommentModalOpen(false);
        resetCommentDraft();
    };

    const openCommentModal = (commentItem = null) => {
        setReplyTo(commentItem);
        setComment(commentItem ? replyPrefill(commentItem) : '');
        setIsCommentModalOpen(true);
    };

    const submitComment = async (event, visibilityOverride = 'GLOBAL') => {
        event?.preventDefault?.();
        if (!comment.trim() || !commentRevisionId) {
            return;
        }

        const content = comment.trim();
        const visibility = visibilityOverride;
        const optimisticComment = {
            id: `optimistic-comment-${Date.now()}`,
            revisionId: commentRevisionId,
            parentCommentId: replyTo?.id,
            visibility,
            content,
            createdAt: new Date().toISOString(),
            pending: true,
            author: {
                id: user?.id,
                type: 'INTERNAL',
                name: personLabel(user),
                email: user?.email,
            },
        };

        try {
            setPendingSection('discussion');
            setSaving(true);
            setError('');
            setOptimisticComments((current) => [optimisticComment, ...current]);
            closeCommentModal();
            await api.post(`/approvals/${approval.id}/comments`, {
                content,
                revisionId: commentRevisionId,
                parentCommentId: replyTo?.id,
                visibility,
            });
            setOptimisticComments([]);
            await fetchApproval();
        } catch (requestError) {
            setOptimisticComments((current) => current.filter((item) => item.id !== optimisticComment.id));
            setError(requestError.response?.data?.message || requestError.message || 'Failed to add comment.');
        } finally {
            setSaving(false);
            clearSectionState('discussion');
        }
    };

    const deleteComment = async (commentItem) => {
        if (!window.confirm('Delete this message?')) {
            return;
        }

        try {
            setPendingSection('discussion');
            setSaving(true);
            setError('');
            const updated = await api.delete(`/approvals/${approval.id}/comments/${commentItem.id}`);
            if (replyTo?.id === commentItem.id) {
                closeCommentModal();
            }
            applyUpdatedApproval(updated);
        } catch (requestError) {
            setError(requestError.response?.data?.message || requestError.message || 'Failed to delete comment.');
        } finally {
            setSaving(false);
            clearSectionState('discussion');
        }
    };

    const submitDecision = async (decision) => {
        try {
            setPendingSection('decision');
            setSaving(true);
            setError('');
            await api.post(`/approvals/${approval.id}/decisions`, {
                decision,
                revisionId: approval.latestRevision?.id,
            });
            await fetchApproval();
        } catch (requestError) {
            setError(requestError.response?.data?.message || requestError.message || 'Failed to submit decision.');
        } finally {
            setSaving(false);
            clearSectionState('decision');
        }
    };

    const uploadRevision = async (event) => {
        event.preventDefault();
        if (!revisionFiles.length) {
            return;
        }

        try {
            setPendingSection('workspace');
            setSaving(true);
            setError('');
            const payload = new FormData();
            revisionFiles.forEach((file) => payload.append('files', file));
            if (revisionSummary) {
                payload.append('summary', revisionSummary);
            }

            const updated = await api.upload(`/approvals/${approval.id}/revisions`, payload);
            resetRevisionDraft();
            applyUpdatedApproval(updated);
        } catch (requestError) {
            setError(requestError.response?.data?.message || requestError.message || 'Failed to upload version.');
        } finally {
            setSaving(false);
            clearSectionState('workspace');
        }
    };

    const addReviewer = async (event) => {
        event.preventDefault();
        if (!reviewerEmail.trim()) {
            return;
        }

        try {
            setPendingSection('reviewers');
            setSaving(true);
            setError('');
            const optimisticReviewer = {
                id: `optimistic-reviewer-${Date.now()}`,
                email: reviewerEmail.trim(),
                association: reviewerAssociation,
                reviewerType: 'EXTERNAL',
                pending: true,
                latestDecision: null,
            };
            setOptimisticReviewers((current) => [...current, optimisticReviewer]);
            const updated = await api.post(`/approvals/${approval.id}/reviewers`, {
                reviewers: [{ email: reviewerEmail.trim(), association: reviewerAssociation }],
            });

            setOptimisticReviewers([]);
            applyUpdatedApproval(updated);
            closeReviewerModal();
        } catch (requestError) {
            setOptimisticReviewers([]);
            setError(requestError.response?.data?.message || requestError.message || 'Failed to add reviewer.');
        } finally {
            setSaving(false);
            clearSectionState('reviewers');
        }
    };

    const resendReviewerInvite = async (reviewerId) => {
        try {
            setPendingSection('reviewers');
            setSaving(true);
            setError('');
            const updated = await api.post(`/approvals/${approval.id}/reviewers/${reviewerId}/resend`);
            applyUpdatedApproval(updated);
        } catch (requestError) {
            setError(requestError.response?.data?.message || requestError.message || 'Failed to resend reviewer email.');
        } finally {
            setSaving(false);
            clearSectionState('reviewers');
        }
    };

    const removeReviewer = async (reviewer) => {
        if (!window.confirm(`Remove reviewer ${reviewer.email}?`)) {
            return;
        }

        try {
            setPendingSection('reviewers');
            setSaving(true);
            setError('');
            const updated = await api.delete(`/approvals/${approval.id}/reviewers/${reviewer.id}`);
            applyUpdatedApproval(updated);
        } catch (requestError) {
            setError(requestError.response?.data?.message || requestError.message || 'Failed to remove reviewer.');
        } finally {
            setSaving(false);
            clearSectionState('reviewers');
        }
    };

    if (loading) {
        return <ApprovalDetailLoadingSkeleton />;
    }

    if (!approval) {
        return (
            <div className="min-h-[calc(100vh-64px)] bg-[#141625] px-6 py-16 text-center text-sm font-light text-[#8f94aa]">
                Approval not found.
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-64px)] bg-[#141625] text-white -m-6 px-4 py-6 sm:-m-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-[1500px] space-y-5">
                <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-light text-[#a1a5b7] transition hover:text-white"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to review portal
                </button>

                <div className="page-section-enter" style={{ '--section-delay': '0ms' }}>
                    <section className={`relative overflow-hidden rounded-md border px-6 py-8 sm:px-8 ${refreshing ? 'page-section-reload' : ''} ${panelClass}`}>
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
                </div>

                {error && (
                    <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-light text-rose-300">
                        {error}
                    </div>
                )}

                <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.06fr)_minmax(0,0.94fr)]">
                    <div className="page-section-enter" style={{ '--section-delay': '80ms' }}>
                        <section className={`${panelClass} ${isWorkspacePending ? 'page-section-reload' : ''} p-4 sm:p-5`}>
                        <div className={`${surfaceClass} relative overflow-hidden ${isWorkspacePending ? 'pending-surface' : ''}`}>
                            <div className="absolute left-4 top-4 z-10 flex max-w-[calc(100%-9.5rem)] gap-2 overflow-x-auto rounded-md border border-white/10 bg-[#0f1020]/90 px-2 py-2 shadow-lg shadow-black/20 backdrop-blur">
                                {revisions.map((revision) => (
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

                            <div className="absolute right-4 top-4 z-10">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-[#0f1020]/90 px-4 py-2 text-sm font-light text-white shadow-lg shadow-black/20 backdrop-blur transition hover:bg-[#17192b]"
                                >
                                    <Upload className="h-4 w-4" />
                                    Upload version
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    onChange={(event) => setRevisionFiles(Array.from(event.target.files || []))}
                                    className="hidden"
                                />
                            </div>

                            {revisionFiles.length > 0 && (
                                <form
                                    onSubmit={uploadRevision}
                                    className="absolute bottom-4 left-4 right-4 z-10 rounded-md border border-white/10 bg-[#0f1020]/92 p-4 shadow-2xl shadow-black/30 backdrop-blur"
                                >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <p className="text-xs uppercase tracking-[0.16em] text-[#8f94aa]">Version upload ready</p>
                                            <p className="mt-1 text-sm font-light text-gray-100">
                                                {revisionFiles.length} file{revisionFiles.length === 1 ? '' : 's'} selected
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={resetRevisionDraft}
                                            className="text-xs uppercase tracking-[0.16em] text-[#8f94aa] transition hover:text-white"
                                        >
                                            Clear
                                        </button>
                                    </div>

                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {revisionFiles.map((file) => (
                                            <span
                                                key={`${file.name}-${file.size}`}
                                                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-light text-[#d7d9e4]"
                                            >
                                                {file.name}
                                            </span>
                                        ))}
                                    </div>

                                    <textarea
                                        rows={2}
                                        value={revisionSummary}
                                        onChange={(event) => setRevisionSummary(event.target.value)}
                                        placeholder="What changed in this version?"
                                        className={`${inputClass} mt-3 bg-[#151521]/90`}
                                    />

                                    <div className="mt-3 flex justify-end">
                                        <button
                                            type="submit"
                                            disabled={saving}
                                            className="inline-flex items-center gap-2 rounded-md bg-sky-500 px-4 py-2 text-sm text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            <Upload className="h-4 w-4" />
                                            Upload version
                                        </button>
                                    </div>
                                </form>
                            )}

                            <div className={`flex min-h-[520px] items-center justify-center p-6 transition-opacity ${isWorkspacePending ? 'opacity-70' : ''}`}>
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
                                        <div className="rounded-md border border-[#2b2b40] bg-[#1e1e2d] px-8 py-12 text-center">
                                            <FileText className="mx-auto h-12 w-12 text-[#5e6278]" />
                                            <p className="mt-4 text-sm font-light text-gray-200">{selectedAsset.originalName}</p>
                                            <a
                                                href={selectedAsset.s3Url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="mt-4 inline-flex items-center gap-2 rounded-md bg-sky-500 px-4 py-2 text-sm text-white transition hover:bg-sky-400"
                                            >
                                                <Download className="h-4 w-4" />
                                                Download asset
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

                            {selectedRevision?.assets?.length > 1 && (
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
                                    <span>Version <span className="text-gray-100">v{approval.latestRevisionNumber}</span></span>
                                    <span className="mx-2 text-[#5e6278]">/</span>
                                    <span>Status <span className="text-gray-100">{statusMeta.label}</span></span>
                                </div>
                            </div>
                        </div>
                        </section>
                    </div>

                    <aside className="space-y-4">
                        {reviewerAssignment && (
                            <div className="page-section-enter px-1 pt-1" style={{ '--section-delay': '120ms' }}>
                                <p className="text-sm font-light text-[#a1a5b7]">{currentDecision}</p>
                                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                    {DECISION_OPTIONS.map((option) => (
                                        <DecisionActionCard
                                            key={option.value}
                                            option={option}
                                            saving={saving}
                                            onClick={() => submitDecision(option.value)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="page-section-enter" style={{ '--section-delay': '160ms' }}>
                        <section className={`${panelClass} ${isReviewersPending ? 'pending-surface-soft page-section-reload' : ''} relative overflow-hidden p-5`}>
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-xs uppercase tracking-[0.24em] text-[#8f94aa]">Reviewers</p>
                                <button
                                    type="button"
                                    onClick={() => setIsReviewerModalOpen(true)}
                                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-[#d7d9e4] transition hover:border-sky-400/30 hover:bg-sky-500/10 hover:text-white"
                                >
                                    <MailPlus className="h-3.5 w-3.5" />
                                    Add reviewer
                                </button>
                            </div>
                            <div className="mt-4 space-y-2">
                                {reviewers.map((reviewer) => (
                                    <div
                                        key={reviewer.id}
                                        data-pending-block-root="panel"
                                        className={`${surfaceClass} px-4 py-3 ${reviewer.pending ? optimisticItemClass : ''}`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="min-w-0 truncate pr-2 text-sm font-light text-gray-100">
                                                {reviewer.email}
                                            </p>
                                            {reviewer.reviewerType !== 'INTERNAL' && reviewer.association && (
                                                <span className={`${associationBadgeClass} shrink-0`}>
                                                    {associationLabel(reviewer.association)}
                                                </span>
                                            )}
                                            <div className="flex items-center gap-2">
                                                {reviewer.pending && (
                                                    <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/25 bg-sky-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-sky-100">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-sky-300 animate-pulse" />
                                                        Inviting
                                                    </span>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => resendReviewerInvite(reviewer.id)}
                                                    disabled={saving || reviewer.pending}
                                                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[#d7d9e4] transition hover:border-sky-400/30 hover:bg-sky-500/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                                                    aria-label={`Resend reviewer invite for ${reviewer.email}`}
                                                    title="Resend invite"
                                                >
                                                    <RotateCcw className="h-3.5 w-3.5" />
                                                    Resend
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => removeReviewer(reviewer)}
                                                    disabled={saving || reviewer.pending}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#8f94aa] transition hover:border-rose-400/30 hover:bg-rose-500/10 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                                                    aria-label={`Remove reviewer ${reviewer.email}`}
                                                    title="Remove reviewer"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                                {(() => {
                                                    const meta = reviewerStatusMeta(reviewer);
                                                    const ReviewerStatusIcon = meta.icon;
                                                    return (
                                                        <ReviewerStatusIcon
                                                            className={`h-5 w-5 shrink-0 ${meta.className}`}
                                                            aria-label={meta.label}
                                                            title={meta.label}
                                                        />
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                        </div>

                        <div className="page-section-enter" style={{ '--section-delay': '220ms' }}>
                        <section className={`${panelClass} ${isDiscussionPending ? 'pending-surface-soft page-section-reload' : ''} relative overflow-hidden p-4`}>
                            <div className="flex items-start justify-between gap-4 px-1 pb-3">
                                <div className="min-w-0">
                                    <h2 className="text-lg font-light text-gray-100">Discussion</h2>
                                    <p className="mt-1 text-sm font-light text-[#8f94aa]">
                                        {isTeamMember
                                            ? 'Team members see the full thread. Internal notes stay hidden from invited reviewers.'
                                            : 'Only reviewer-visible messages appear in this thread.'}
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    {isTeamMember && internalComments.length > 0 && (
                                        <span className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-amber-100">
                                            {internalComments.length} internal
                                        </span>
                                    )}
                                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-[#8f94aa]">
                                        {visibleComments.length} visible
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => openCommentModal()}
                                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-[#d7d9e4] transition hover:border-sky-400/30 hover:bg-sky-500/10 hover:text-white"
                                    >
                                        <Send className="h-3.5 w-3.5" />
                                        Add comment
                                    </button>
                                </div>
                            </div>

                            <div className="mt-4 space-y-3">
                                {visibleComments.map((item, index) => {
                                    const isInternalComment = item.visibility === 'INTERNAL';
                                    const cardTone = isInternalComment
                                        ? 'border-amber-400/20 bg-amber-500/[0.08]'
                                        : 'border-[#2b2b40] bg-[#151521]';
                                    const avatarTone = isInternalComment
                                        ? 'border-amber-400/30 bg-amber-500/12 text-amber-100'
                                        : 'border-sky-400/20 bg-sky-500/10 text-sky-100';

                                    return (
                                        <div
                                            key={item.id}
                                            data-pending-block-root="panel"
                                            data-testid="approval-comment-card"
                                            className={`relative rounded-lg border px-4 py-4 ${cardTone} ${item.pending ? optimisticItemClass : ''} ${index !== visibleComments.length - 1 ? 'border-b border-[#2b2b40]' : ''}`}
                                        >
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div className="flex items-start gap-3">
                                                    <div className={`flex h-9 w-9 items-center justify-center rounded-full border text-[11px] uppercase tracking-[0.18em] ${avatarTone}`}>
                                                        {initialsLabel(item.author)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="text-sm font-light text-gray-100">{authorLabel(item.author)}</span>
                                                            {item.visibility === 'INTERNAL' && isTeamMember && (
                                                                <span className="inline-flex rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-amber-100">
                                                                    Internal
                                                                </span>
                                                            )}
                                                            {item.author?.type !== 'INTERNAL' && item.author?.association && (
                                                                <span className={associationBadgeClass}>
                                                                    {associationLabel(item.author.association)}
                                                                </span>
                                                            )}
                                                            {item.parentCommentId && (
                                                                <span className="inline-flex rounded-full border border-sky-400/25 bg-sky-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-sky-100">
                                                                    Reply
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="mt-2 text-sm leading-6 font-light text-[#d7d9e4]">{item.content}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[11px] font-light uppercase tracking-[0.16em] text-[#5e6278]">{formatApprovalDate(item.createdAt)}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => openCommentModal(item)}
                                                        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-sky-200 transition hover:border-sky-400/30 hover:bg-sky-500/10 hover:text-white"
                                                        aria-label={`Reply to ${authorLabel(item.author)}`}
                                                    >
                                                        <User className="h-3.5 w-3.5" />
                                                        Reply
                                                    </button>
                                                    {canDeleteComment(item) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => deleteComment(item)}
                                                            disabled={saving}
                                                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#8f94aa] transition hover:border-rose-400/30 hover:bg-rose-500/10 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                                                            aria-label={`Delete message from ${authorLabel(item.author)}`}
                                                            title="Delete message"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {visibleComments.length === 0 && (
                                    <div className="rounded-lg border border-dashed border-[#2b2b40] px-4 py-8 text-center text-sm font-light text-[#8f94aa]">
                                        {emptyStateLabel}
                                    </div>
                                )}
                            </div>
                        </section>
                        </div>
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

            {isCommentModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"
                    role="dialog"
                    aria-modal="true"
                    aria-label={replyTo ? `Reply to ${authorLabel(replyTo.author)}` : 'Add comment'}
                    onClick={closeCommentModal}
                >
                    <div
                        className={`${panelClass} w-full max-w-2xl p-6 shadow-2xl shadow-black/30`}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-light text-gray-100">
                                    {replyTo ? `Reply to ${authorLabel(replyTo.author)}` : 'Add comment'}
                                </h2>
                                <p className="mt-1 text-sm font-light text-[#8f94aa]">
                                    {replyTo
                                        ? 'Replies start with a mention and stay in the shared approval thread.'
                                        : 'Choose who can see the note before sending it to the thread.'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeCommentModal}
                                className="rounded-full border border-white/10 bg-white/5 p-2 text-[#8f94aa] transition hover:text-white"
                                aria-label="Close comment modal"
                            >
                                <XCircle className="h-4 w-4" />
                            </button>
                        </div>

                        {replyTo && (
                            <div className="mt-5 rounded-lg border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm font-light text-sky-100">
                                Replying to {authorLabel(replyTo.author)}
                            </div>
                        )}

                        <form onSubmit={(event) => submitComment(event, 'GLOBAL')} className="mt-5 space-y-4">
                            {!isTeamMember && (
                                <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-light text-[#d7d9e4]">
                                    This note will be sent to the global approval thread.
                                </div>
                            )}

                            <div>
                                <label htmlFor="approval-comment" className="mb-2 block text-xs uppercase tracking-[0.16em] text-[#8f94aa]">
                                    Message
                                </label>
                                <textarea
                                    id="approval-comment"
                                    rows={5}
                                    autoFocus
                                    value={comment}
                                    onChange={(event) => setComment(event.target.value)}
                                    placeholder="Write your note"
                                    className={inputClass}
                                />
                            </div>

                            <div className="flex justify-end gap-3">
                                {isTeamMember && (
                                    <div className="mr-auto flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-light text-amber-100">
                                        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                        <span>Only team members can see private messages.</span>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={closeCommentModal}
                                    className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm font-light text-[#a1a5b7] transition hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    aria-label="Send"
                                    disabled={saving || !comment.trim()}
                                    className="inline-flex items-center gap-2 rounded-md bg-sky-500 px-4 py-2 text-sm text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <Send className="h-4 w-4" />
                                    Send
                                </button>
                                {isTeamMember && (
                                    <button
                                        type="button"
                                        onClick={(event) => submitComment(event, 'INTERNAL')}
                                        aria-label="Send private"
                                        disabled={saving || !comment.trim()}
                                        className="inline-flex items-center gap-2 rounded-md border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100 transition hover:border-amber-300/40 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <Send className="h-4 w-4" />
                                        Send private
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isReviewerModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Add reviewer"
                    onClick={closeReviewerModal}
                >
                    <div
                        className={`${panelClass} w-full max-w-md p-6 shadow-2xl shadow-black/30`}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-light text-gray-100">Add reviewer</h2>
                                <p className="mt-1 text-sm font-light text-[#8f94aa]">
                                    Invite one more reviewer to this approval.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeReviewerModal}
                                className="rounded-full border border-white/10 bg-white/5 p-2 text-[#8f94aa] transition hover:text-white"
                                aria-label="Close add reviewer modal"
                            >
                                <XCircle className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={addReviewer} className="mt-5 space-y-4">
                            <div>
                                <label htmlFor="reviewer-email" className="mb-2 block text-xs uppercase tracking-[0.16em] text-[#8f94aa]">
                                    Reviewer email
                                </label>
                                <input
                                    id="reviewer-email"
                                    type="email"
                                    autoFocus
                                    value={reviewerEmail}
                                    onChange={(event) => setReviewerEmail(event.target.value)}
                                    placeholder="reviewer@company.com"
                                    className={inputClass}
                                />
                            </div>

                            <div>
                                <label htmlFor="reviewer-association" className="mb-2 block text-xs uppercase tracking-[0.16em] text-[#8f94aa]">
                                    Association
                                </label>
                                <select
                                    id="reviewer-association"
                                    value={reviewerAssociation}
                                    onChange={(event) => setReviewerAssociation(event.target.value)}
                                    className={inputClass}
                                >
                                    {reviewerAssociationOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={closeReviewerModal}
                                    className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm font-light text-[#a1a5b7] transition hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving || !reviewerEmail.trim()}
                                    className="inline-flex items-center gap-2 rounded-md bg-sky-500 px-4 py-2 text-sm text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <MailPlus className="h-4 w-4" />
                                    Add reviewer
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApprovalDetailView;
