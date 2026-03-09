import React, { useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    CalendarDays,
    CheckCircle2,
    Download,
    FileText,
    MessageSquare,
    RefreshCcw,
    Send,
    Upload,
    User,
    XCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import {
    APPROVAL_STATUS_META,
    DECISION_OPTIONS,
    formatApprovalDate,
} from './approvalConstants';

const authorLabel = (author) => {
    if (!author) {
        return 'Unknown';
    }

    return author.name || author.email || 'Unknown';
};

const ApprovalDetailView = ({ approvalId, initialApproval, user, onBack, onUpdated }) => {
    const [approval, setApproval] = useState(initialApproval);
    const [selectedRevisionId, setSelectedRevisionId] = useState(initialApproval?.latestRevision?.id || null);
    const [assetIndex, setAssetIndex] = useState(0);
    const [comment, setComment] = useState('');
    const [replyTo, setReplyTo] = useState(null);
    const [decisionNote, setDecisionNote] = useState('');
    const [revisionSummary, setRevisionSummary] = useState('');
    const [revisionFiles, setRevisionFiles] = useState([]);
    const [loading, setLoading] = useState(!initialApproval);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const fetchApproval = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await api.get(`/approvals/${approvalId}`);
            setApproval(response);
            setSelectedRevisionId(response.latestRevision?.id || response.revisions?.[0]?.id || null);
            onUpdated?.(response);
        } catch (requestError) {
            setError(requestError.response?.data?.message || requestError.message || 'Failed to load approval.');
        } finally {
            setLoading(false);
        }
    };

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

    useEffect(() => {
        setAssetIndex(0);
    }, [selectedRevisionId]);

    const selectedAsset = selectedRevision?.assets?.[assetIndex] || null;
    const reviewerAssignment = approval?.reviewers?.find((reviewer) => reviewer.email === user?.email) || null;
    const latestDecision = reviewerAssignment?.latestDecision || approval?.myReview || null;
    const statusMeta = APPROVAL_STATUS_META[approval?.status] || APPROVAL_STATUS_META.PENDING_REVIEW;
    const StatusIcon = statusMeta.icon;

    const submitComment = async (event) => {
        event.preventDefault();
        if (!comment.trim() || !selectedRevision) {
            return;
        }

        try {
            setSaving(true);
            setError('');
            await api.post(`/approvals/${approval.id}/comments`, {
                content: comment,
                revisionId: selectedRevision.id,
                parentCommentId: replyTo?.id,
            });
            setComment('');
            setReplyTo(null);
            await fetchApproval();
        } catch (requestError) {
            setError(requestError.response?.data?.message || requestError.message || 'Failed to add comment.');
        } finally {
            setSaving(false);
        }
    };

    const submitDecision = async (decision) => {
        try {
            setSaving(true);
            setError('');
            await api.post(`/approvals/${approval.id}/decisions`, {
                decision,
                note: decisionNote || undefined,
                revisionId: approval.latestRevision?.id,
            });
            setDecisionNote('');
            await fetchApproval();
        } catch (requestError) {
            setError(requestError.response?.data?.message || requestError.message || 'Failed to submit decision.');
        } finally {
            setSaving(false);
        }
    };

    const uploadRevision = async (event) => {
        event.preventDefault();
        if (!revisionFiles.length) {
            return;
        }

        try {
            setSaving(true);
            setError('');
            const payload = new FormData();
            revisionFiles.forEach((file) => payload.append('files', file));
            if (revisionSummary) {
                payload.append('summary', revisionSummary);
            }

            const updated = await api.upload(`/approvals/${approval.id}/revisions`, payload);
            setRevisionFiles([]);
            setRevisionSummary('');
            setApproval(updated);
            setSelectedRevisionId(updated.latestRevision?.id || updated.revisions?.[0]?.id || null);
            onUpdated?.(updated);
        } catch (requestError) {
            setError(requestError.response?.data?.message || requestError.message || 'Failed to upload revision.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[calc(100vh-64px)] bg-[#081018] px-6 py-16 text-center text-sm text-slate-400">
                Loading approval workspace…
            </div>
        );
    }

    if (!approval) {
        return (
            <div className="min-h-[calc(100vh-64px)] bg-[#081018] px-6 py-16 text-center text-sm text-slate-400">
                Approval not found.
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-64px)] bg-[#081018] text-white -m-6 px-4 py-6 sm:-m-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl space-y-6">
                <div className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-[#0d1520] p-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                        <button
                            type="button"
                            onClick={onBack}
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300 transition hover:text-white"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back to dashboard
                        </button>

                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-3xl font-semibold tracking-tight">{approval.title}</h1>
                            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ${statusMeta.chip}`}>
                                <StatusIcon className="h-3.5 w-3.5" />
                                {statusMeta.label}
                            </span>
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                            <span>{approval.event?.name}</span>
                            <span className="inline-flex items-center gap-2">
                                <CalendarDays className="h-4 w-4" />
                                Deadline {formatApprovalDate(approval.deadline)}
                            </span>
                            <span>Submitted {formatApprovalDate(approval.submittedAt)}</span>
                        </div>
                    </div>

                    <div className="grid gap-3 md:min-w-[320px]">
                        {reviewerAssignment && (
                            <div className="rounded-2xl border border-white/10 bg-[#081018] p-4">
                                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Your review</p>
                                <p className="mt-2 text-sm text-slate-300">
                                    {latestDecision ? `Current decision: ${latestDecision.decision.replaceAll('_', ' ')}` : 'You are assigned and have not submitted a decision yet.'}
                                </p>
                                <textarea
                                    rows={3}
                                    value={decisionNote}
                                    onChange={(e) => setDecisionNote(e.target.value)}
                                    placeholder="Optional decision note"
                                    className="mt-3 w-full rounded-2xl border border-white/10 bg-[#0d1520] px-4 py-3 text-sm outline-none focus:border-sky-400"
                                />
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {DECISION_OPTIONS.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            disabled={saving}
                                            onClick={() => submitDecision(option.value)}
                                            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:border-sky-300/40 hover:text-white disabled:opacity-60"
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <form onSubmit={uploadRevision} className="rounded-2xl border border-white/10 bg-[#081018] p-4">
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Upload revision</p>
                            <textarea
                                rows={3}
                                value={revisionSummary}
                                onChange={(e) => setRevisionSummary(e.target.value)}
                                placeholder="What changed in this revision?"
                                className="mt-3 w-full rounded-2xl border border-white/10 bg-[#0d1520] px-4 py-3 text-sm outline-none focus:border-sky-400"
                            />
                            <input
                                type="file"
                                multiple
                                onChange={(e) => setRevisionFiles(Array.from(e.target.files || []))}
                                className="mt-3 block w-full rounded-2xl border border-dashed border-white/10 bg-[#0d1520] px-4 py-4 text-sm text-slate-300"
                            />
                            <button
                                type="submit"
                                disabled={saving || !revisionFiles.length}
                                className="mt-3 inline-flex items-center gap-2 rounded-full bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <Upload className="h-4 w-4" />
                                Upload revision
                            </button>
                        </form>
                    </div>
                </div>

                {error && (
                    <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                        {error}
                    </div>
                )}

                <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                    <section className="space-y-6">
                        <div className="rounded-[2rem] border border-white/10 bg-[#0d1520] p-5">
                            <div className="mb-4 flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Asset viewer</p>
                                    <h2 className="mt-2 text-lg font-semibold">
                                        Revision {selectedRevision?.revisionNumber || approval.latestRevisionNumber}
                                    </h2>
                                </div>
                                <div className="text-sm text-slate-400">
                                    {selectedRevision ? formatApprovalDate(selectedRevision.createdAt) : ''}
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#081018]">
                                <div className="flex min-h-[420px] items-center justify-center p-6">
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
                                        <div className="text-sm text-slate-500">No assets uploaded for this revision.</div>
                                    )}
                                </div>

                                {selectedRevision?.assets?.length > 1 && (
                                    <div className="flex gap-2 overflow-x-auto border-t border-white/10 p-4">
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
                                                    <div className="flex h-full items-center justify-center bg-[#0d1520] text-xs text-slate-400">File</div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="rounded-[2rem] border border-white/10 bg-[#0d1520] p-5">
                            <div className="mb-4 flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Discussion</p>
                                    <h2 className="mt-2 text-lg font-semibold">Threaded feedback</h2>
                                </div>
                                <span className="inline-flex items-center gap-2 text-sm text-slate-400">
                                    <MessageSquare className="h-4 w-4" />
                                    {approval.comments.length} comments
                                </span>
                            </div>

                            <div className="space-y-3">
                                {approval.comments.map((item) => (
                                    <div key={item.id} className="rounded-2xl border border-white/10 bg-[#081018] p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 text-sm text-slate-300">
                                                <User className="h-4 w-4 text-slate-500" />
                                                <span>{authorLabel(item.author)}</span>
                                                <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-slate-400">
                                                    Revision {approval.revisions.find((revision) => revision.id === item.revisionId)?.revisionNumber || approval.latestRevisionNumber}
                                                </span>
                                                {item.parentCommentId && (
                                                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-slate-400">Reply</span>
                                                )}
                                            </div>
                                            <span className="text-xs text-slate-500">{formatApprovalDate(item.createdAt)}</span>
                                        </div>
                                        <p className="mt-3 text-sm leading-6 text-slate-200">{item.content}</p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setReplyTo(item);
                                                setSelectedRevisionId(item.revisionId);
                                            }}
                                            className="mt-3 text-xs text-sky-300 transition hover:text-sky-200"
                                        >
                                            Reply
                                        </button>
                                    </div>
                                ))}

                                {approval.comments.length === 0 && (
                                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
                                        No comments yet.
                                    </div>
                                )}
                            </div>

                            <form onSubmit={submitComment} className="mt-5 rounded-[1.5rem] border border-white/10 bg-[#081018] p-4">
                                {replyTo && (
                                    <div className="mb-3 flex items-center justify-between rounded-2xl border border-sky-400/25 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
                                        <span>Replying to {authorLabel(replyTo.author)}</span>
                                        <button type="button" onClick={() => setReplyTo(null)}>
                                            Cancel
                                        </button>
                                    </div>
                                )}
                                <textarea
                                    rows={4}
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    placeholder="Add feedback, answer questions, or clarify requested changes."
                                    className="w-full rounded-2xl border border-white/10 bg-[#0d1520] px-4 py-3 text-sm outline-none focus:border-sky-400"
                                />
                                <div className="mt-3 flex items-center justify-between">
                                    <span className="text-xs text-slate-500">
                                        Comment will be attached to revision {selectedRevision?.revisionNumber || approval.latestRevisionNumber}.
                                    </span>
                                    <button
                                        type="submit"
                                        disabled={saving || !comment.trim()}
                                        className="inline-flex items-center gap-2 rounded-full bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <Send className="h-4 w-4" />
                                        Post comment
                                    </button>
                                </div>
                            </form>
                        </div>
                    </section>

                    <aside className="space-y-6">
                        <section className="rounded-[2rem] border border-white/10 bg-[#0d1520] p-5">
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Version history</p>
                            <div className="mt-4 space-y-3">
                                {approval.revisions.map((revision) => (
                                    <button
                                        key={revision.id}
                                        type="button"
                                        onClick={() => setSelectedRevisionId(revision.id)}
                                        className={`w-full rounded-2xl border px-4 py-4 text-left transition ${revision.id === selectedRevision?.id ? 'border-sky-400/50 bg-sky-500/10' : 'border-white/10 bg-[#081018]'}`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-sm font-medium">Revision {revision.revisionNumber}</span>
                                            <span className="text-xs text-slate-500">{formatApprovalDate(revision.createdAt)}</span>
                                        </div>
                                        <p className="mt-2 text-sm text-slate-400">{revision.summary || 'No revision note provided.'}</p>
                                        <p className="mt-2 text-xs text-slate-500">
                                            Uploaded by {revision.uploadedBy?.firstName} {revision.uploadedBy?.lastName}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className="rounded-[2rem] border border-white/10 bg-[#0d1520] p-5">
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Reviewers</p>
                            <div className="mt-4 space-y-3">
                                {approval.reviewers.map((reviewer) => (
                                    <div key={reviewer.id} className="rounded-2xl border border-white/10 bg-[#081018] px-4 py-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-medium text-slate-200">{reviewer.name || reviewer.email}</p>
                                                <p className="text-xs text-slate-500">{reviewer.email}</p>
                                            </div>
                                            <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] text-slate-400">
                                                {reviewer.reviewerType}
                                            </span>
                                        </div>
                                        <p className="mt-3 text-xs text-slate-400">
                                            {reviewer.latestDecision ? `Decision: ${reviewer.latestDecision.decision.replaceAll('_', ' ')}` : 'Awaiting decision'}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="rounded-[2rem] border border-white/10 bg-[#0d1520] p-5">
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Submission metadata</p>
                            <dl className="mt-4 grid gap-3 text-sm">
                                <div className="rounded-2xl border border-white/10 bg-[#081018] px-4 py-3">
                                    <dt className="text-slate-500">Requested by</dt>
                                    <dd className="mt-1 text-slate-200">{approval.createdBy?.firstName} {approval.createdBy?.lastName}</dd>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-[#081018] px-4 py-3">
                                    <dt className="text-slate-500">Latest revision</dt>
                                    <dd className="mt-1 text-slate-200">v{approval.latestRevisionNumber}</dd>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-[#081018] px-4 py-3">
                                    <dt className="text-slate-500">Last comment</dt>
                                    <dd className="mt-1 text-slate-200">{formatApprovalDate(approval.lastCommentAt)}</dd>
                                </div>
                            </dl>
                        </section>
                    </aside>
                </div>
            </div>
        </div>
    );
};

export default ApprovalDetailView;
