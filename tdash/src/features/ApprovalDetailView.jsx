import React, { useState, useCallback } from 'react';
import {
    ArrowLeft,
    Upload,
    Users,
    Send,
    Trash2,
    Edit3,
    CheckCircle,
    XCircle,
    Clock,
    MessageSquare,
    FileText,
    Image,
    X,
    Plus,
    RefreshCw,
    Download,
    ExternalLink,
    AlertTriangle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '../lib/api';

const STATUS_CONFIG = {
    DRAFT: { label: 'Draft', color: 'bg-gray-500', textColor: 'text-gray-400' },
    PENDING: { label: 'Pending Review', color: 'bg-yellow-500', textColor: 'text-yellow-400' },
    APPROVED: { label: 'Approved', color: 'bg-green-500', textColor: 'text-green-400' },
    CHANGES_REQUESTED: { label: 'Changes Requested', color: 'bg-orange-500', textColor: 'text-orange-400' },
    REJECTED: { label: 'Rejected', color: 'bg-red-500', textColor: 'text-red-400' },
};

const ApprovalDetailView = ({ approval, isDark, user, onBack, onUpdate, onDelete }) => {
    const [uploading, setUploading] = useState(false);
    const [showAddReviewer, setShowAddReviewer] = useState(false);
    const [reviewerEmail, setReviewerEmail] = useState('');
    const [reviewerName, setReviewerName] = useState('');
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('assets');

    const statusConfig = STATUS_CONFIG[approval.status] || STATUS_CONFIG.DRAFT;

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        try {
            setUploading(true);
            setError(null);

            const formData = new FormData();
            files.forEach(file => formData.append('files', file));

            const response = await api.upload(`/approvals/${approval.id}/assets`, formData);
            onUpdate({ ...approval, assets: [...(approval.assets || []), ...response.assets] });
        } catch (err) {
            console.error('Upload failed:', err);
            setError('Failed to upload files');
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteAsset = async (assetId) => {
        if (!confirm('Delete this asset?')) return;

        try {
            await api.delete(`/approvals/${approval.id}/assets/${assetId}`);
            onUpdate({ ...approval, assets: approval.assets.filter(a => a.id !== assetId) });
        } catch (err) {
            console.error('Delete failed:', err);
        }
    };

    const handleAddReviewer = async () => {
        if (!reviewerEmail) return;

        try {
            setSubmitting(true);
            const response = await api.post(`/approvals/${approval.id}/reviewers`, {
                reviewers: [{
                    email: reviewerEmail,
                    name: reviewerName || undefined,
                }]
            });

            // Backend returns an array of created reviewers
            const newReviewers = Array.isArray(response) ? response : [response];

            onUpdate({ ...approval, reviewers: [...(approval.reviewers || []), ...newReviewers] });
            setReviewerEmail('');
            setReviewerName('');
            setShowAddReviewer(false);

            if (approval.status !== 'DRAFT') {
                toast.success('Reviewer added and notified via email');
            }
        } catch (err) {
            console.error('Add reviewer failed:', err);
            setError('Failed to add reviewer');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemoveReviewer = async (reviewerId) => {
        if (approval.status !== 'DRAFT' && !confirm('Are you sure? Removing a reviewer from an active approval cannot be undone.')) {
            return;
        }

        try {
            await api.delete(`/approvals/${approval.id}/reviewers/${reviewerId}`);
            onUpdate({ ...approval, reviewers: approval.reviewers.filter(r => r.id !== reviewerId) });
        } catch (err) {
            console.error('Remove reviewer failed:', err);
        }
    };

    const handleSubmitForReview = async () => {
        if (!approval.reviewers?.length) {
            setError('Please add at least one reviewer');
            return;
        }
        if (!approval.assets?.length) {
            setError('Please upload at least one asset');
            return;
        }

        try {
            setSubmitting(true);
            const response = await api.post(`/approvals/${approval.id}/submit`);
            onUpdate(response);
        } catch (err) {
            console.error('Submit failed:', err);
            setError('Failed to submit for review');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddComment = async () => {
        if (!comment.trim()) return;

        try {
            setSubmitting(true);
            const response = await api.post(`/approvals/${approval.id}/comments`, {
                content: comment,
            });
            onUpdate({ ...approval, comments: [...(approval.comments || []), response.comment] });
            setComment('');
        } catch (err) {
            console.error('Add comment failed:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateRevision = async () => {
        if (!confirm('Create a new revision? This will reset reviewer decisions.')) return;

        try {
            setSubmitting(true);
            const response = await api.post(`/approvals/${approval.id}/revise`);
            onUpdate(response);
        } catch (err) {
            console.error('Revision failed:', err);
            setError('Failed to create revision');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={`min-h-screen ${isDark ? 'bg-[#0A0A0A]' : 'bg-gray-50'}`}>
            {/* Header */}
            <div className={`sticky top-0 z-10 border-b ${isDark ? 'bg-[#0A0A0A] border-gray-800' : 'bg-white border-gray-200'}`}>
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={onBack}
                                className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
                            >
                                <ArrowLeft className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                            </button>
                            <div>
                                <div className="flex items-center gap-3">
                                    <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        {approval.title}
                                    </h1>
                                    {approval.version > 1 && (
                                        <span className={`text-sm px-2 py-0.5 rounded ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                                            v{approval.version}
                                        </span>
                                    )}
                                    <span className={`inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full ${statusConfig.color}/20 ${statusConfig.textColor}`}>
                                        {statusConfig.label}
                                    </span>
                                </div>
                                <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {approval.event?.name}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {approval.status === 'DRAFT' && (
                                <>
                                    <button
                                        onClick={handleSubmitForReview}
                                        disabled={submitting}
                                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                    >
                                        <Send className="w-4 h-4" />
                                        Submit for Review
                                    </button>
                                </>
                            )}
                            {(approval.status === 'CHANGES_REQUESTED' || approval.status === 'REJECTED') && (
                                <button
                                    onClick={handleCreateRevision}
                                    disabled={submitting}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Create Revision
                                </button>
                            )}
                            <button
                                onClick={onDelete}
                                className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-red-900/30 text-red-400' : 'hover:bg-red-50 text-red-600'}`}
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="max-w-7xl mx-auto px-6 pt-4">
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-400 text-sm">
                        <AlertTriangle className="w-4 h-4" />
                        {error}
                        <button onClick={() => setError(null)} className="ml-auto hover:text-red-300">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="max-w-7xl mx-auto px-6 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Assets & Comments */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Tabs */}
                        <div className={`flex border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
                            <button
                                onClick={() => setActiveTab('assets')}
                                className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'assets'
                                        ? 'text-indigo-500 border-indigo-500'
                                        : `${isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-900'} border-transparent`
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Image className="w-4 h-4" />
                                    Assets ({approval.assets?.length || 0})
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveTab('comments')}
                                className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'comments'
                                        ? 'text-indigo-500 border-indigo-500'
                                        : `${isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-900'} border-transparent`
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4" />
                                    Comments ({approval.comments?.length || 0})
                                </div>
                            </button>
                        </div>

                        {/* Assets Tab */}
                        {activeTab === 'assets' && (
                            <div className="space-y-4">
                                {/* Upload zone */}
                                {approval.status === 'DRAFT' && (
                                    <label className={`block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${isDark
                                            ? 'border-gray-700 hover:border-gray-600 bg-gray-800/30'
                                            : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                                        }`}>
                                        <input
                                            type="file"
                                            multiple
                                            className="hidden"
                                            onChange={handleFileUpload}
                                            accept="image/*,.pdf,.psd,.ai,.svg"
                                        />
                                        <Upload className={`w-8 h-8 mx-auto mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                                        <p className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            {uploading ? 'Uploading...' : 'Drop files here or click to upload'}
                                        </p>
                                        <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                            Images, PDFs, PSD, AI, SVG (max 50MB each)
                                        </p>
                                    </label>
                                )}

                                {/* Assets Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {approval.assets?.map((asset) => (
                                        <div
                                            key={asset.id}
                                            className={`group relative rounded-xl overflow-hidden border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                                                }`}
                                        >
                                            <div className="aspect-square">
                                                {asset.mimeType?.startsWith('image/') ? (
                                                    <img
                                                        src={asset.s3Url}
                                                        alt={asset.originalName}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className={`w-full h-full flex items-center justify-center ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                                                        <FileText className={`w-12 h-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className={`p-3 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                                                <p className={`text-sm truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                    {asset.originalName}
                                                </p>
                                            </div>
                                            {/* Overlay actions */}
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                <a
                                                    href={asset.s3Url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-2 bg-white/20 rounded-lg hover:bg-white/30 text-white"
                                                >
                                                    <ExternalLink className="w-5 h-5" />
                                                </a>
                                                {approval.status === 'DRAFT' && (
                                                    <button
                                                        onClick={() => handleDeleteAsset(asset.id)}
                                                        className="p-2 bg-red-500/70 rounded-lg hover:bg-red-500 text-white"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {(!approval.assets || approval.assets.length === 0) && (
                                    <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        <Image className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                        <p>No assets uploaded yet</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Comments Tab */}
                        {activeTab === 'comments' && (
                            <div className="space-y-4">
                                {/* Comment input */}
                                <div className={`rounded-xl border p-4 ${isDark ? 'bg-[#1A1A1A] border-gray-800' : 'bg-white border-gray-200'}`}>
                                    <textarea
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                        placeholder="Add a comment..."
                                        rows={3}
                                        className={`w-full resize-none focus:outline-none ${isDark ? 'bg-transparent text-white placeholder-gray-600' : 'bg-transparent text-gray-900 placeholder-gray-400'
                                            }`}
                                    />
                                    <div className="flex justify-end mt-3">
                                        <button
                                            onClick={handleAddComment}
                                            disabled={!comment.trim() || submitting}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                        >
                                            Comment
                                        </button>
                                    </div>
                                </div>

                                {/* Comments list */}
                                <div className="space-y-3">
                                    {approval.comments?.map((c) => (
                                        <div
                                            key={c.id}
                                            className={`p-4 rounded-xl border ${isDark ? 'bg-[#1A1A1A] border-gray-800' : 'bg-white border-gray-200'}`}
                                        >
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-700'
                                                    }`}>
                                                    {c.user?.firstName?.[0] || c.reviewerEmail?.[0] || '?'}
                                                </div>
                                                <div>
                                                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                        {c.user ? `${c.user.firstName} ${c.user.lastName}` : c.reviewerEmail}
                                                    </p>
                                                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                        {new Date(c.createdAt).toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{c.content}</p>
                                        </div>
                                    ))}

                                    {(!approval.comments || approval.comments.length === 0) && (
                                        <div className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                            <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-50" />
                                            <p>No comments yet</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Details & Reviewers */}
                    <div className="space-y-6">
                        {/* Details Card */}
                        <div className={`rounded-xl border p-5 ${isDark ? 'bg-[#1A1A1A] border-gray-800' : 'bg-white border-gray-200'}`}>
                            <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Details</h3>

                            {approval.description && (
                                <div className="mb-4">
                                    <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Description</p>
                                    <p className={`mt-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{approval.description}</p>
                                </div>
                            )}

                            {approval.instructions && (
                                <div className="mb-4">
                                    <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Instructions</p>
                                    <p className={`mt-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{approval.instructions}</p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Priority</p>
                                    <p className={`mt-1 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {approval.priority}
                                    </p>
                                </div>
                                {approval.dueDate && (
                                    <div>
                                        <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Due Date</p>
                                        <p className={`mt-1 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            {new Date(approval.dueDate).toLocaleDateString()}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Reviewers Card */}
                        <div className={`rounded-xl border p-5 ${isDark ? 'bg-[#1A1A1A] border-gray-800' : 'bg-white border-gray-200'}`}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Reviewers</h3>
                                {['DRAFT', 'PENDING', 'CHANGES_REQUESTED'].includes(approval.status) && (
                                    <button
                                        onClick={() => setShowAddReviewer(true)}
                                        className="flex items-center gap-1 text-sm text-indigo-500 hover:text-indigo-400"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Add
                                    </button>
                                )}
                            </div>

                            {/* Add reviewer form */}
                            {showAddReviewer && (
                                <div className={`mb-4 p-3 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                                    <input
                                        type="email"
                                        value={reviewerEmail}
                                        onChange={(e) => setReviewerEmail(e.target.value)}
                                        placeholder="Email address"
                                        className={`w-full px-3 py-2 mb-2 rounded-lg border ${isDark
                                                ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500'
                                                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                                            } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                                    />
                                    <input
                                        type="text"
                                        value={reviewerName}
                                        onChange={(e) => setReviewerName(e.target.value)}
                                        placeholder="Name (optional)"
                                        className={`w-full px-3 py-2 mb-3 rounded-lg border ${isDark
                                                ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500'
                                                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                                            } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setShowAddReviewer(false)}
                                            className={`flex-1 py-2 rounded-lg ${isDark ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}`}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleAddReviewer}
                                            disabled={!reviewerEmail || submitting}
                                            className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                        >
                                            Add
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Reviewers list */}
                            <div className="space-y-3">
                                {approval.reviewers?.map((reviewer) => (
                                    <div
                                        key={reviewer.id}
                                        className={`flex items-center justify-between p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-700'
                                                }`}>
                                                {reviewer.name?.[0] || reviewer.email?.[0] || '?'}
                                            </div>
                                            <div>
                                                <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                    {reviewer.name || reviewer.email}
                                                </p>
                                                {reviewer.name && (
                                                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                        {reviewer.email}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {reviewer.decision && (
                                                <span className={`text-xs px-2 py-1 rounded-full ${reviewer.decision === 'APPROVED'
                                                        ? 'bg-green-500/20 text-green-400'
                                                        : reviewer.decision === 'REJECTED'
                                                            ? 'bg-red-500/20 text-red-400'
                                                            : 'bg-orange-500/20 text-orange-400'
                                                    }`}>
                                                    {reviewer.decision}
                                                </span>
                                            )}
                                            {!reviewer.decision && (
                                                <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'}`}>
                                                    Pending
                                                </span>
                                            )}
                                            {['DRAFT', 'PENDING', 'CHANGES_REQUESTED'].includes(approval.status) && !reviewer.decision && (
                                                <button
                                                    onClick={() => handleRemoveReviewer(reviewer.id)}
                                                    className={`p-1 rounded hover:bg-red-500/20 text-red-400`}
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {(!approval.reviewers || approval.reviewers.length === 0) && (
                                    <div className={`text-center py-6 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">No reviewers added</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ApprovalDetailView;
