import React, { useState, useEffect } from 'react';
import {
    CheckCircle,
    XCircle,
    AlertTriangle,
    MessageSquare,
    Clock,
    FileText,
    Image,
    Download,
    ExternalLink,
    Send,
    Loader2,
    ChevronLeft,
    ChevronRight,
    Calendar,
    User
} from 'lucide-react';

// External API calls without authentication
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

    async submitDecision(token, decision, note) {
        const response = await fetch(`${this.baseUrl}/review/${token}/decision`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ decision, note }),
        });
        if (!response.ok) throw new Error('Failed to submit decision');
        return response.json();
    },

    async addComment(token, content) {
        const response = await fetch(`${this.baseUrl}/review/${token}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
        });
        if (!response.ok) throw new Error('Failed to add comment');
        return response.json();
    },
};

const STATUS_LABELS = {
    PENDING: 'Awaiting Review',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    CHANGES_REQUESTED: 'Changes Requested',
};

const ExternalReviewPage = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [approval, setApproval] = useState(null);
    const [reviewer, setReviewer] = useState(null);
    const [currentAssetIndex, setCurrentAssetIndex] = useState(0);
    const [comment, setComment] = useState('');
    const [decisionNote, setDecisionNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showDecisionModal, setShowDecisionModal] = useState(false);
    const [pendingDecision, setPendingDecision] = useState(null);

    // Get token from URL
    const token = window.location.pathname.split('/').pop();

    useEffect(() => {
        loadReview();
    }, [token]);

    const loadReview = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await reviewApi.getReview(token);
            setApproval(data.approval);
            setReviewer(data.reviewer);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDecision = async (decision) => {
        try {
            setSubmitting(true);
            await reviewApi.submitDecision(token, decision, decisionNote);
            await loadReview();
            setShowDecisionModal(false);
            setDecisionNote('');
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddComment = async () => {
        if (!comment.trim()) return;
        try {
            setSubmitting(true);
            await reviewApi.addComment(token, comment);
            setComment('');
            await loadReview();
        } catch (err) {
            console.error('Failed to add comment:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const openDecisionModal = (decision) => {
        setPendingDecision(decision);
        setShowDecisionModal(true);
    };

    const currentAsset = approval?.assets?.[currentAssetIndex];
    const isImage = currentAsset?.mimeType?.startsWith('image/');

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-4" />
                    <p className="text-gray-400">Loading review...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
                <div className="max-w-md text-center">
                    <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
                        <AlertTriangle className="w-8 h-8 text-red-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Unable to Load Review</h1>
                    <p className="text-gray-400 mb-6">{error}</p>
                    <p className="text-sm text-gray-500">
                        This link may have expired or been used already. Please contact the requester for a new link.
                    </p>
                </div>
            </div>
        );
    }

    const hasDecided = reviewer?.decision !== null;

    return (
        <div className="min-h-screen bg-[#0A0A0A] text-white">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[#0A0A0A]/90 backdrop-blur-md border-b border-gray-800">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-bold">{approval.title}</h1>
                            <p className="text-sm text-gray-400 mt-1">
                                {approval.event?.name} • Requested by {approval.createdBy?.firstName} {approval.createdBy?.lastName}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {approval.dueDate && (
                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                    <Calendar className="w-4 h-4" />
                                    Due {new Date(approval.dueDate).toLocaleDateString()}
                                </div>
                            )}
                            {hasDecided ? (
                                <div className={`px-4 py-2 rounded-lg font-medium ${reviewer.decision === 'APPROVED' ? 'bg-green-500/20 text-green-400' :
                                        reviewer.decision === 'REJECTED' ? 'bg-red-500/20 text-red-400' :
                                            'bg-orange-500/20 text-orange-400'
                                    }`}>
                                    {reviewer.decision === 'APPROVED' ? 'You Approved' :
                                        reviewer.decision === 'REJECTED' ? 'You Rejected' :
                                            'Changes Requested'}
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => openDecisionModal('APPROVED')}
                                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => openDecisionModal('CHANGES_REQUESTED')}
                                        className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                                    >
                                        <AlertTriangle className="w-4 h-4" />
                                        Request Changes
                                    </button>
                                    <button
                                        onClick={() => openDecisionModal('REJECTED')}
                                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                    >
                                        <XCircle className="w-4 h-4" />
                                        Reject
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Asset Viewer */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Asset Display */}
                        <div className="relative bg-gray-900 rounded-xl overflow-hidden" style={{ minHeight: '500px' }}>
                            {currentAsset ? (
                                isImage ? (
                                    <img
                                        src={currentAsset.s3Url}
                                        alt={currentAsset.originalName}
                                        className="w-full h-full object-contain"
                                        style={{ maxHeight: '600px' }}
                                    />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center py-20">
                                        <FileText className="w-20 h-20 text-gray-600 mb-4" />
                                        <p className="text-gray-400 font-medium">{currentAsset.originalName}</p>
                                        <a
                                            href={currentAsset.s3Url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-4 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                        >
                                            <Download className="w-4 h-4" />
                                            Download to View
                                        </a>
                                    </div>
                                )
                            ) : (
                                <div className="w-full h-full flex items-center justify-center py-20">
                                    <Image className="w-20 h-20 text-gray-700" />
                                </div>
                            )}

                            {/* Navigation */}
                            {approval.assets?.length > 1 && (
                                <>
                                    <button
                                        onClick={() => setCurrentAssetIndex((i) => Math.max(0, i - 1))}
                                        disabled={currentAssetIndex === 0}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 disabled:opacity-30"
                                    >
                                        <ChevronLeft className="w-6 h-6" />
                                    </button>
                                    <button
                                        onClick={() => setCurrentAssetIndex((i) => Math.min(approval.assets.length - 1, i + 1))}
                                        disabled={currentAssetIndex === approval.assets.length - 1}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 disabled:opacity-30"
                                    >
                                        <ChevronRight className="w-6 h-6" />
                                    </button>
                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
                                        {approval.assets.map((_, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setCurrentAssetIndex(i)}
                                                className={`w-2 h-2 rounded-full transition-colors ${i === currentAssetIndex ? 'bg-white' : 'bg-white/30 hover:bg-white/50'
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Asset Thumbnails */}
                        {approval.assets?.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-2">
                                {approval.assets.map((asset, i) => (
                                    <button
                                        key={asset.id}
                                        onClick={() => setCurrentAssetIndex(i)}
                                        className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${i === currentAssetIndex ? 'border-indigo-500' : 'border-transparent hover:border-gray-600'
                                            }`}
                                    >
                                        {asset.mimeType?.startsWith('image/') ? (
                                            <img src={asset.s3Url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                                                <FileText className="w-6 h-6 text-gray-500" />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Instructions */}
                        {approval.instructions && (
                            <div className="bg-[#1A1A1A] rounded-xl p-5 border border-gray-800">
                                <h3 className="font-semibold mb-3 flex items-center gap-2">
                                    <User className="w-4 h-4 text-indigo-400" />
                                    Instructions
                                </h3>
                                <p className="text-gray-300 text-sm whitespace-pre-wrap">{approval.instructions}</p>
                            </div>
                        )}

                        {/* Description */}
                        {approval.description && (
                            <div className="bg-[#1A1A1A] rounded-xl p-5 border border-gray-800">
                                <h3 className="font-semibold mb-3">Description</h3>
                                <p className="text-gray-400 text-sm whitespace-pre-wrap">{approval.description}</p>
                            </div>
                        )}

                        {/* Comments */}
                        <div className="bg-[#1A1A1A] rounded-xl p-5 border border-gray-800">
                            <h3 className="font-semibold mb-4 flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-indigo-400" />
                                Comments ({approval.comments?.length || 0})
                            </h3>

                            <div className="space-y-4 max-h-80 overflow-y-auto mb-4">
                                {approval.comments?.map((c) => (
                                    <div key={c.id} className="text-sm">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium text-gray-300">
                                                {c.user ? `${c.user.firstName} ${c.user.lastName}` : c.reviewerEmail || 'Reviewer'}
                                            </span>
                                            <span className="text-gray-600 text-xs">
                                                {new Date(c.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="text-gray-400">{c.content}</p>
                                    </div>
                                ))}
                                {(!approval.comments || approval.comments.length === 0) && (
                                    <p className="text-gray-500 text-sm text-center py-4">No comments yet</p>
                                )}
                            </div>

                            {/* Add Comment */}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                                    placeholder="Add a comment..."
                                    className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <button
                                    onClick={handleAddComment}
                                    disabled={!comment.trim() || submitting}
                                    className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    <Send className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Decision Modal */}
            {showDecisionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
                    <div className="bg-[#1A1A1A] rounded-xl max-w-md w-full p-6 border border-gray-800">
                        <h2 className="text-xl font-bold mb-2">
                            {pendingDecision === 'APPROVED' ? 'Approve this request?' :
                                pendingDecision === 'REJECTED' ? 'Reject this request?' :
                                    'Request changes?'}
                        </h2>
                        <p className="text-gray-400 text-sm mb-4">
                            Add an optional note to explain your decision.
                        </p>
                        <textarea
                            value={decisionNote}
                            onChange={(e) => setDecisionNote(e.target.value)}
                            placeholder="Optional note..."
                            rows={3}
                            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none mb-4"
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDecisionModal(false)}
                                className="flex-1 py-3 text-gray-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDecision(pendingDecision)}
                                disabled={submitting}
                                className={`flex-1 py-3 rounded-lg font-medium text-white transition-colors disabled:opacity-50 ${pendingDecision === 'APPROVED' ? 'bg-green-600 hover:bg-green-700' :
                                        pendingDecision === 'REJECTED' ? 'bg-red-600 hover:bg-red-700' :
                                            'bg-orange-600 hover:bg-orange-700'
                                    }`}
                            >
                                {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Submit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExternalReviewPage;
