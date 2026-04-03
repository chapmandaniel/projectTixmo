import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { api } from '../lib/api';
import SectionSkeletonOverlay from '../components/SectionSkeletonOverlay';
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
const discussionCardClass = 'rounded-lg border px-4 py-3 text-left transition';
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
const optimisticItemClass = 'border-sky-400/20 bg-sky-500/8 opacity-80';

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
    const [activeDiscussionView, setActiveDiscussionView] = useState('GLOBAL');
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
    const sortedComments = useMemo(
        () =>
            [...comments].sort((left, right) => {
                const leftTime = new Date(left.createdAt || 0).getTime();
                const rightTime = new Date(right.createdAt || 0).getTime();
                return rightTime - leftTime;
            }),
        [comments]
    );
    const globalComments = useMemo(
        () => sortedComments.filter((item) => item.visibility === 'GLOBAL'),
        [sortedComments]
    );
    const internalComments = useMemo(
        () => sortedComments.filter((item) => item.visibility === 'INTERNAL'),
        [sortedComments]
    );
    const visibleComments = activeDiscussionView === 'INTERNAL' ? internalComments : globalComments;

    useEffect(() => {
        setAssetIndex(0);
    }, [selectedRevisionId]);

    useEffect(() => {
        setReplyTo(null);
    }, [activeDiscussionView]);

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
    const discussionCards = [
        {
            key: 'INTERNAL',
            title: 'Internal / Private',
            description: 'Only logged-in team members can view this chat.',
            count: internalComments.length,
        },
        {
            key: 'GLOBAL',
            title: 'Global',
            description: 'Visible to invited reviewers and logged-in team members.',
            count: globalComments.length,
        },
    ];
    const commentPlaceholder = activeDiscussionView === 'INTERNAL'
        ? 'Message the internal chat'
        : 'Message the global chat';
    const emptyStateLabel = activeDiscussionView === 'INTERNAL'
        ? 'No internal messages yet.'
        : 'No global messages yet.';

    const canDeleteComment = (commentItem) => {
        if (commentItem.pending) {
            return false;
        }

        const currentEmail = user?.email?.toLowerCase();
        const authorEmail = commentItem.author?.email?.toLowerCase();

        return Boolean(
            commentItem.author?.id === user?.id ||
            (currentEmail && authorEmail && currentEmail === authorEmail)
        );
    };

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

    const submitComment = async (event) => {
        event.preventDefault();
        if (!comment.trim() || !commentRevisionId) {
            return;
        }

        const content = comment.trim();
        const optimisticComment = {
            id: `optimistic-comment-${Date.now()}`,
            revisionId: commentRevisionId,
            parentCommentId: replyTo?.id,
            visibility: activeDiscussionView,
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
            setComment('');
            setReplyTo(null);
            await api.post(`/approvals/${approval.id}/comments`, {
                content,
                revisionId: commentRevisionId,
                parentCommentId: replyTo?.id,
                visibility: activeDiscussionView,
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
                setReplyTo(null);
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
        return (
            <div className="min-h-[calc(100vh-64px)] bg-[#141625] px-6 py-16 text-center text-sm font-light text-[#8f94aa]">
                Loading review workspace...
            </div>
        );
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
                    <section className={`${panelClass} relative p-4 sm:p-5`}>
                        <div className={`${surfaceClass} relative overflow-hidden`}>
                            {(refreshing || pendingSection === 'workspace') && (
                                <SectionSkeletonOverlay
                                    label={pendingSection === 'workspace' ? 'Updating preview' : 'Refreshing preview'}
                                    variant="workspace"
                                />
                            )}
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

                    <aside className="space-y-4">
                        {reviewerAssignment && (
                            <div className="px-1 pt-1">
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

                        <section className={`${panelClass} relative p-5`}>
                            {(refreshing || pendingSection === 'reviewers') && (
                                <SectionSkeletonOverlay
                                    label={pendingSection === 'reviewers' ? 'Updating reviewers' : 'Refreshing reviewers'}
                                    variant="list"
                                />
                            )}
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
                                    <div key={reviewer.id} className={`${surfaceClass} px-4 py-3 ${reviewer.pending ? optimisticItemClass : ''}`}>
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

                        <section className={`${panelClass} relative p-4`}>
                            {(refreshing || pendingSection === 'discussion' || pendingSection === 'decision') && (
                                <SectionSkeletonOverlay
                                    label={pendingSection === 'decision'
                                        ? 'Updating review state'
                                        : pendingSection === 'discussion'
                                            ? 'Updating discussion'
                                            : 'Refreshing discussion'}
                                    variant="conversation"
                                />
                            )}
                            <div className="flex items-center justify-between gap-4 px-1 pb-3">
                                <h2 className="text-lg font-light text-gray-100">Discussion</h2>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                {discussionCards.map((card) => {
                                    const isActive = activeDiscussionView === card.key;
                                    return (
                                        <button
                                            key={card.key}
                                            type="button"
                                            onClick={() => setActiveDiscussionView(card.key)}
                                            className={`${discussionCardClass} ${isActive
                                                ? 'border-sky-400/50 bg-sky-500/10 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]'
                                                : 'border-white/10 bg-white/5 hover:border-sky-400/30 hover:bg-sky-500/5'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-light text-gray-100">{card.title}</p>
                                                    <p className="mt-1 text-xs font-light leading-5 text-[#8f94aa]">{card.description}</p>
                                                </div>
                                                <span className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] ${isActive
                                                    ? 'border border-sky-400/30 bg-sky-500/10 text-sky-100'
                                                    : 'border border-white/10 bg-white/5 text-[#8f94aa]'
                                                }`}>
                                                    {card.count}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {replyTo && (
                                <div className="mb-3 flex items-center justify-between rounded-full border border-sky-400/25 bg-sky-500/10 px-3 py-2 text-xs uppercase tracking-[0.16em] text-sky-100">
                                    <span>Replying to {authorLabel(replyTo.author)}</span>
                                    <button type="button" onClick={() => setReplyTo(null)} className="text-sky-100 transition hover:text-white">
                                        Cancel
                                    </button>
                                </div>
                            )}

                            <div className="mt-4 space-y-3">
                                {visibleComments.map((item, index) => (
                                    <div
                                        key={item.id}
                                        data-testid="approval-comment-card"
                                        className={`relative rounded-lg px-1 pb-3 ${item.pending ? 'opacity-80' : ''} ${index !== visibleComments.length - 1 ? 'border-b border-[#2b2b40]' : ''}`}
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div className="flex items-start gap-3">
                                                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-sky-400/20 bg-sky-500/10 text-[11px] uppercase tracking-[0.18em] text-sky-100">
                                                    {initialsLabel(item.author)}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="text-sm font-light text-gray-100">{authorLabel(item.author)}</span>
                                                        {activeDiscussionView === 'GLOBAL' && item.author?.type !== 'INTERNAL' && item.author?.association && (
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
                                                    onClick={() => setReplyTo(item)}
                                                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-sky-200 transition hover:border-sky-400/30 hover:bg-sky-500/10 hover:text-white"
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
                                ))}

                                {visibleComments.length === 0 && (
                                    <div className="rounded-lg border border-dashed border-[#2b2b40] px-4 py-8 text-center text-sm font-light text-[#8f94aa]">
                                        {emptyStateLabel}
                                    </div>
                                )}
                            </div>

                            <form onSubmit={submitComment} className="mt-4 flex items-end gap-3 border-t border-[#2b2b40] pt-4">
                                <textarea
                                    rows={3}
                                    value={comment}
                                    onChange={(event) => setComment(event.target.value)}
                                    placeholder={commentPlaceholder}
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
