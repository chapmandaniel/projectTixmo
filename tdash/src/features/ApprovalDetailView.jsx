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
    const [activeAssetIndex, setActiveAssetIndex] = useState(0);

    const statusConfig = STATUS_CONFIG[approval.status] || STATUS_CONFIG.DRAFT;
    const assets = approval.assets || [];
    const activeAsset = assets[activeAssetIndex];

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        try {
            setUploading(true);
            setError(null);

            const formData = new FormData();
            files.forEach(file => formData.append('files', file));

            const response = await api.upload(`/approvals/${approval.id}/assets`, formData);
            // API returns array of assets directly
            const newAssets = Array.isArray(response) ? response : (response.assets || []);

            onUpdate({ ...approval, assets: [...assets, ...newAssets] });
            // Switch to the newly uploaded asset
            if (newAssets.length > 0) {
                setActiveAssetIndex(assets.length);
            }
        } catch (err) {
            console.error('Upload failed:', err);
            setError('Failed to upload files');
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteAsset = async (assetId) => {
        console.log('Attempting to delete asset:', assetId);
        if (!confirm('Delete this asset?')) return;

        try {
            await api.delete(`/approvals/${approval.id}/assets/${assetId}`);
            console.log('Asset deleted successfully');
            const newAssets = assets.filter(a => a.id !== assetId);
            onUpdate({ ...approval, assets: newAssets });
            // Adjust index if needed
            if (activeAssetIndex >= newAssets.length) {
                setActiveAssetIndex(Math.max(0, newAssets.length - 1));
            }
        } catch (err) {
            console.error('Delete failed:', err);
            setError('Failed to delete asset');
        }
    };

    // ... (keep handleAddReviewer, handleRemoveReviewer, handleSubmitForReview, handleAddComment, handleCreateRevision as is)

    const handleAddReviewer = async () => {
        if (!reviewerEmail) return;

        try {
            setSubmitting(true);
            // API expects { reviewers: [{ email, name }] } and returns array
            const response = await api.post(`/approvals/${approval.id}/reviewers`, {
                reviewers: [{
                    email: reviewerEmail,
                    name: reviewerName || undefined,
                }]
            });

            const newReviewers = Array.isArray(response) ? response : (response.reviewers || [response.reviewer]);
            onUpdate({ ...approval, reviewers: [...(approval.reviewers || []), ...newReviewers] });

            setReviewerEmail('');
            setReviewerName('');
            setShowAddReviewer(false);
        } catch (err) {
            console.error('Add reviewer failed:', err);
            setError('Failed to add reviewer');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemoveReviewer = async (reviewerId) => {
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
            // API returns comment object directly
            const newComment = response.comment || response;
            onUpdate({ ...approval, comments: [...(approval.comments || []), newComment] });
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
        <div className={`fixed inset-0 z-50 flex flex-col ${isDark ? 'bg-[#0A0A0A]' : 'bg-gray-50'}`}>
            {/* Header */}
            <div className={`flex items-center justify-between px-6 py-3 border-b ${isDark ? 'bg-[#0A0A0A] border-gray-800' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
                    >
                        <ArrowLeft className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {approval.title}
                            </h1>
                            {approval.version > 1 && (
                                <span className={`text-xs px-2 py-0.5 rounded ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                                    v{approval.version}
                                </span>
                            )}
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${statusConfig.color}/20 ${statusConfig.textColor}`}>
                                {statusConfig.label}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Primary Actions based on Status */}
                    {approval.status === 'DRAFT' && (
                        <>
                            <label className="cursor-pointer flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium">
                                <input
                                    type="file"
                                    multiple
                                    className="hidden"
                                    onChange={handleFileUpload}
                                    accept="image/*,.pdf"
                                />
                                <Upload className="w-4 h-4" />
                                {uploading ? 'Uploading...' : (approval.version > 1 ? 'Upload Revision' : 'Upload Assets')}
                            </label>
                            <button
                                onClick={handleSubmitForReview}
                                disabled={submitting}
                                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm font-medium"
                            >
                                <Send className="w-4 h-4" />
                                Submit
                            </button>
                        </>
                    )}
                    {(approval.status === 'CHANGES_REQUESTED' || approval.status === 'REJECTED') && (
                        <button
                            onClick={handleCreateRevision}
                            disabled={submitting}
                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm font-medium"
                        >
                            <RefreshCw className="w-4 h-4" />
                            New Revision
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content Split */}
            <div className="flex-1 flex overflow-hidden">
                {/* LEFT PANEL: Asset Preview (70%) */}
                <div className={`flex-1 flex flex-col relative ${isDark ? 'bg-[#121212]' : 'bg-gray-200'}`}>
                    {/* Main Preview */}
                    <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
                        {activeAsset ? (
                            <div className="relative max-w-full max-h-full">
                                {activeAsset.mimeType?.startsWith('image/') ? (
                                    <img
                                        src={activeAsset.s3Url}
                                        alt={activeAsset.originalName}
                                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center p-20 bg-white/5 rounded-xl text-center">
                                        <FileText className="w-20 h-20 text-gray-400 mb-4" />
                                        <p className="text-xl text-gray-400">{activeAsset.originalName}</p>
                                        <a
                                            href={activeAsset.s3Url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                        >
                                            View File
                                        </a>
                                    </div>
                                )}

                                {/* Asset Actions overlay (Delete) */}
                                {approval.status === 'DRAFT' && (
                                    <button
                                        onClick={() => handleDeleteAsset(activeAsset.id)}
                                        className="absolute top-4 right-4 p-2 bg-red-500/80 hover:bg-red-600 text-white rounded-full shadow-lg transition-all z-10"
                                        title="Delete Asset"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="text-center text-gray-500">
                                <Image className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                <p className="text-lg">No assets uploaded</p>
                                {approval.status === 'DRAFT' && (
                                    <p className="text-sm mt-2">Use the "Upload Assets" button to add files</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Bottom Thumbnail Strip */}
                    {assets.length > 0 && (
                        <div className={`h-24 px-6 py-3 border-t overflow-x-auto flex items-center gap-3 ${isDark ? 'bg-[#0A0A0A] border-gray-800' : 'bg-white border-gray-200'}`}>
                            {assets.map((asset, idx) => (
                                <button
                                    key={asset.id}
                                    onClick={() => setActiveAssetIndex(idx)}
                                    className={`relative flex-shrink-0 h-16 w-16 rounded-lg overflow-hidden border-2 transition-all ${activeAssetIndex === idx
                                        ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                                        : 'border-transparent opacity-60 hover:opacity-100'
                                        }`}
                                >
                                    {asset.mimeType?.startsWith('image/') ? (
                                        <img src={asset.s3Url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className={`w-full h-full flex items-center justify-center ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                            <FileText className="w-6 h-6 text-gray-400" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* RIGHT PANEL: Sidebar (30%, min 350px) */}
                <div className={`w-96 flex flex-col border-l ${isDark ? 'bg-[#0A0A0A] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>

                    {/* 1. Details & Status */}
                    <div className="p-5 border-b border-gray-200/50 dark:border-gray-800/50 shrink-0">
                        {/* Description */}
                        {approval.description && (
                            <div className="mb-4">
                                <p className={`text-xs uppercase font-semibold mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Description</p>
                                <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{approval.description}</p>
                            </div>
                        )}

                        {/* Reviewers */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className={`text-xs uppercase font-semibold ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Reviewers</p>
                                {['DRAFT', 'PENDING', 'CHANGES_REQUESTED'].includes(approval.status) && (
                                    <button onClick={() => setShowAddReviewer(!showAddReviewer)} className="text-xs text-indigo-500 hover:text-indigo-400 font-medium">
                                        {showAddReviewer ? 'Cancel' : '+ Add'}
                                    </button>
                                )}
                            </div>

                            {showAddReviewer && (
                                <div className="mb-3 space-y-2">
                                    <input
                                        type="email"
                                        value={reviewerEmail}
                                        onChange={(e) => setReviewerEmail(e.target.value)}
                                        placeholder="Email..."
                                        className={`w-full px-2 py-1.5 text-sm rounded border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300'}`}
                                    />
                                    <button onClick={handleAddReviewer} className="w-full py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700">Add Reviewer</button>
                                </div>
                            )}

                            <div className="space-y-2">
                                {approval.reviewers?.map(r => (
                                    <div key={r.id} className="flex items-center justify-between text-sm">
                                        <span className={`truncate mr-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{r.name || r.email}</span>
                                        <div className="flex items-center gap-2">
                                            {r.decision === 'APPROVED' && <CheckCircle className="w-4 h-4 text-green-500" />}
                                            {r.decision === 'REJECTED' && <XCircle className="w-4 h-4 text-red-500" />}
                                            {r.decision === 'CHANGES_REQUESTED' && <Edit3 className="w-4 h-4 text-orange-500" />}
                                            {!r.decision && <Clock className="w-4 h-4 text-gray-400" />}
                                        </div>
                                    </div>
                                ))}
                                {(!approval.reviewers || approval.reviewers.length === 0) && (
                                    <p className="text-sm text-gray-500 italic">No reviewers yet</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 2. Comments List (Scrollable) */}
                    <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
                        <p className={`text-xs uppercase font-semibold mb-3 sticky top-0 bg-inherit z-10 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Comments</p>
                        <div className="space-y-4">
                            {approval.comments?.map((c) => (
                                <div key={c.id} className="flex gap-3">
                                    <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-medium ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>
                                        {c.user?.firstName?.[0] || c.reviewerEmail?.[0] || '?'}
                                    </div>
                                    <div>
                                        <div className="flex items-baseline gap-2 mb-0.5">
                                            <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                                                {c.user ? `${c.user.firstName}` : 'Reviewer'}
                                            </span>
                                            <span className="text-[10px] text-gray-500">{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{c.content}</p>
                                    </div>
                                </div>
                            ))}
                            {(!approval.comments || approval.comments.length === 0) && (
                                <div className="text-center py-8">
                                    <MessageSquare className="w-6 h-6 mx-auto mb-2 text-gray-600 opacity-20" />
                                    <p className="text-sm text-gray-500">No comments yet</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 3. Comment Input (Fixed Bottom) */}
                    <div className={`p-4 border-t ${isDark ? 'bg-[#0A0A0A] border-gray-800' : 'bg-white border-gray-200'}`}>
                        <div className={`flex gap-2 p-2 rounded-xl border transition-colors ${isDark ? 'bg-[#151515] border-gray-800 focus-within:border-gray-700' : 'bg-white border-gray-300 focus-within:border-indigo-500'}`}>
                            <input
                                type="text"
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAddComment()}
                                placeholder="Write a comment..."
                                className={`flex-1 bg-transparent px-2 text-sm focus:outline-none ${isDark ? 'text-white placeholder-gray-600' : 'text-gray-900 placeholder-gray-400'}`}
                            />
                            <button
                                onClick={handleAddComment}
                                disabled={!comment.trim() || submitting}
                                className={`p-1.5 rounded-lg transition-colors ${comment.trim()
                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                    : 'bg-transparent text-gray-400 cursor-not-allowed'
                                    }`}
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ApprovalDetailView;


