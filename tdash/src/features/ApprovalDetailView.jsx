import React, { useState, useCallback, useRef, useEffect } from 'react';
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
    AlertTriangle,
    Save
} from 'lucide-react';
import { api } from '../lib/api';
import ConfirmationModal from '../components/ConfirmationModal';

const STATUS_CONFIG = {
    DRAFT: { label: 'Draft', color: 'bg-gray-500', textColor: 'text-gray-400' },
    PENDING: { label: 'Pending Review', color: 'bg-yellow-500', textColor: 'text-yellow-400' },
    APPROVED: { label: 'Approved', color: 'bg-green-500', textColor: 'text-green-400' },
    CHANGES_REQUESTED: { label: 'Changes Requested', color: 'bg-orange-500', textColor: 'text-orange-400' },
    REJECTED: { label: 'Rejected', color: 'bg-red-500', textColor: 'text-red-400' },
};

const ALLOWED_FILE_TYPES = "image/*,.pdf,.svg,video/mp4,video/webm";

const ApprovalDetailView = ({ approval, isDark, user, onBack, onUpdate, onDelete }) => {
    const [uploading, setUploading] = useState(false);
    const [showAddReviewer, setShowAddReviewer] = useState(false);
    const [reviewerEmail, setReviewerEmail] = useState('');
    const [reviewerName, setReviewerName] = useState('');
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [activeAssetIndex, setActiveAssetIndex] = useState(0);

    // Editing states
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        title: '',
        description: '',
        instructions: ''
    });

    // Modal states
    const [modalConfig, setModalConfig] = useState({
        isOpen: false,
        type: null, // 'delete', 'revision', 'delete_asset'
        data: null
    });

    const commentRef = useRef(null);

    // Auto-resize comment textarea
    useEffect(() => {
        if (commentRef.current) {
            commentRef.current.style.height = 'auto';
            commentRef.current.style.height = commentRef.current.scrollHeight + 'px';
        }
    }, [comment]);

    const statusConfig = STATUS_CONFIG[approval.status] || STATUS_CONFIG.DRAFT;
    const assets = approval.assets || [];
    const activeAsset = assets[activeAssetIndex];

    const openModal = (type, data = null) => {
        setModalConfig({ isOpen: true, type, data });
    };

    const closeModal = () => {
        setModalConfig({ isOpen: false, type: null, data: null });
    };

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        if (files.length > 5) {
            setError('Maximum 5 files allowed per upload');
            return;
        }

        try {
            setUploading(true);
            setError(null);

            const formData = new FormData();
            files.forEach(file => formData.append('files', file));

            const response = await api.upload(`/approvals/${approval.id}/assets`, formData);
            const newAssets = Array.isArray(response) ? response : (response.assets || []);

            onUpdate({ ...approval, assets: [...assets, ...newAssets] });
            if (newAssets.length > 0) {
                setActiveAssetIndex(assets.length);
            }
        } catch (err) {
            console.error('Upload failed:', err);
            setError(err.response?.data?.message || 'Failed to upload files');
        } finally {
            setUploading(false);
            // Reset input
            e.target.value = '';
        }
    };

    const handleConfirmAction = async () => {
        const { type, data } = modalConfig;

        try {
            setSubmitting(true);

            if (type === 'delete') {
                await onDelete(approval.id); // Parent handler should call API
            } else if (type === 'revision') {
                const response = await api.post(`/approvals/${approval.id}/revise`);
                onUpdate(response);
            } else if (type === 'delete_asset') {
                await api.delete(`/approvals/${approval.id}/assets/${data}`);
                const newAssets = assets.filter(a => a.id !== data);
                onUpdate({ ...approval, assets: newAssets });
                if (activeAssetIndex >= newAssets.length) {
                    setActiveAssetIndex(Math.max(0, newAssets.length - 1));
                }
            }
            closeModal();
        } catch (err) {
            console.error('Action failed:', err);
            setError(err.response?.data?.message || 'Action failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddReviewer = async () => {
        if (!reviewerEmail) return;

        try {
            setSubmitting(true);
            setError(null);

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
            setError(err.response?.data?.message || 'Failed to add reviewer');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemoveReviewer = async (reviewerId) => {
        try {
            setSubmitting(true);
            await api.delete(`/approvals/${approval.id}/reviewers/${reviewerId}`);
            const newReviewers = approval.reviewers.filter(r => r.id !== reviewerId);
            onUpdate({ ...approval, reviewers: newReviewers });
        } catch (err) {
            console.error('Remove reviewer failed:', err);
            setError(err.response?.data?.message || 'Failed to remove reviewer');
        } finally {
            setSubmitting(false);
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
            setError(err.response?.data?.message || 'Failed to submit for review');
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
            const newComment = response.comment || response;
            onUpdate({ ...approval, comments: [...(approval.comments || []), newComment] });
            setComment('');
        } catch (err) {
            console.error('Add comment failed:', err);
            setError(err.response?.data?.message || 'Failed to add comment');
        } finally {
            setSubmitting(false);
        }
    };

    const startEditing = () => {
        setEditForm({
            title: approval.title,
            description: approval.description || '',
            instructions: approval.instructions || ''
        });
        setIsEditing(true);
    };

    const saveEdits = async () => {
        if (!editForm.title.trim()) return;

        try {
            setSubmitting(true);
            const response = await api.put(`/approvals/${approval.id}`, {
                title: editForm.title,
                description: editForm.description,
                instructions: editForm.instructions
            });
            onUpdate(response);
            setIsEditing(false);
        } catch (err) {
            console.error('Update failed:', err);
            setError(err.response?.data?.message || 'Failed to update approval');
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
                            <span className={`text-xs px-2 py-0.5 rounded ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                                v{approval.version}
                            </span>
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
                            {/* Delete Button */}
                            <button
                                onClick={() => openModal('delete')}
                                disabled={submitting}
                                className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-red-900/20 text-red-400' : 'hover:bg-red-50 text-red-600'}`}
                                title="Delete Approval Request"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>

                            <label className={`cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                                <input
                                    type="file"
                                    multiple
                                    className="hidden"
                                    onChange={handleFileUpload}
                                    accept={ALLOWED_FILE_TYPES}
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
                            onClick={() => openModal('revision')}
                            disabled={submitting}
                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm font-medium"
                        >
                            <RefreshCw className="w-4 h-4" />
                            New Revision
                        </button>
                    )}
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-red-400 text-sm">
                        <AlertTriangle className="w-4 h-4" />
                        {error}
                    </div>
                    <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Main Content Split */}
            <div className="flex-1 flex overflow-hidden">
                {/* LEFT PANEL: Asset Preview (70%) */}
                <div className={`flex-1 flex flex-col relative ${isDark ? 'bg-[#121212]' : 'bg-gray-200'}`}>
                    {/* Main Preview */}
                    <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
                        {activeAsset ? (
                            <div className="relative max-w-full max-h-full group">
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
                                    </div>
                                )}

                                {/* Overlay Actions */}
                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <a
                                        href={activeAsset.s3Url}
                                        download
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-colors"
                                        title="Download"
                                    >
                                        <Download className="w-5 h-5" />
                                    </a>
                                    {approval.status === 'DRAFT' && (
                                        <button
                                            onClick={() => openModal('delete_asset', activeAsset.id)}
                                            className="p-2 bg-red-500/80 hover:bg-red-600 text-white rounded-full shadow-lg transition-all"
                                            title="Delete Asset"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-gray-500">
                                <Image className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                <p className="text-lg">No assets uploaded</p>
                                {approval.status === 'DRAFT' && (
                                    <p className="text-sm mt-2">Use the "Upload Assets" button above to add files</p>
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
                        {/* Edit Toggle */}
                        <div className="flex justify-end mb-2">
                            {!isEditing && ['DRAFT', 'PENDING', 'CHANGES_REQUESTED'].includes(approval.status) && (
                                <button onClick={startEditing} className="text-xs text-indigo-500 hover:text-indigo-400 font-medium flex items-center gap-1">
                                    <Edit3 className="w-3 h-3" /> Edit Details
                                </button>
                            )}
                        </div>

                        {/* Editable Form */}
                        {isEditing ? (
                            <div className="space-y-3 mb-4">
                                <input
                                    type="text"
                                    value={editForm.title}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                                    className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300'}`}
                                    placeholder="Title"
                                />
                                <textarea
                                    value={editForm.description}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                    className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300'}`}
                                    placeholder="Description"
                                    rows={3}
                                />
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setIsEditing(false)} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-300">Cancel</button>
                                    <button onClick={saveEdits} className="px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700">Save</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {approval.instructions && (
                                    <div className="mb-4 bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20">
                                        <p className="text-xs uppercase font-semibold mb-1 text-yellow-500 flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" /> Instructions
                                        </p>
                                        <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{approval.instructions}</p>
                                    </div>
                                )}
                                {approval.description && (
                                    <div className="mb-4">
                                        <p className={`text-xs uppercase font-semibold mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Description</p>
                                        <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{approval.description}</p>
                                    </div>
                                )}
                            </>
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
                                <div className="mb-3 space-y-2 p-3 bg-gray-50/5 rounded-lg border border-gray-800">
                                    <input
                                        type="text"
                                        value={reviewerName}
                                        onChange={(e) => setReviewerName(e.target.value)}
                                        placeholder="Name (Optional)"
                                        className={`w-full px-2 py-1.5 text-sm rounded border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300'}`}
                                    />
                                    <input
                                        type="email"
                                        value={reviewerEmail}
                                        onChange={(e) => setReviewerEmail(e.target.value)}
                                        placeholder="Email..."
                                        className={`w-full px-2 py-1.5 text-sm rounded border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300'}`}
                                    />
                                    <button onClick={handleAddReviewer} className="w-full py-1.5 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 font-medium">Add Reviewer</button>
                                </div>
                            )}

                            <div className="space-y-3">
                                {approval.reviewers?.map(r => (
                                    <div key={r.id} className="text-sm group relative pr-6">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex flex-col">
                                                <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{r.name || r.email}</span>
                                                {r.name && <span className="text-xs text-gray-500">{r.email}</span>}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {r.decision === 'APPROVED' && <span title="Approved" className="flex items-center gap-1 text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full"><CheckCircle className="w-3 h-3" /> Approved</span>}
                                                {r.decision === 'REJECTED' && <span title="Rejected" className="flex items-center gap-1 text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" /> Rejected</span>}
                                                {r.decision === 'CHANGES_REQUESTED' && <span title="Changes Requested" className="flex items-center gap-1 text-xs text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full"><Edit3 className="w-3 h-3" /> Changes</span>}
                                                {!r.decision && <span title="Pending" className="text-gray-500"><Clock className="w-4 h-4" /></span>}
                                            </div>
                                        </div>
                                        {r.decisionNote && (
                                            <p className={`text-xs italic pl-2 border-l-2 ${r.decision === 'APPROVED' ? 'border-green-500/30' : r.decision === 'REJECTED' ? 'border-red-500/30' : 'border-orange-500/30'} ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                "{r.decisionNote}"
                                            </p>
                                        )}
                                        {['DRAFT', 'PENDING', 'CHANGES_REQUESTED'].includes(approval.status) && (
                                            <button
                                                onClick={() => handleRemoveReviewer(r.id)}
                                                className="absolute top-0 right-0 p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="Remove Reviewer"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
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
                                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-medium ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>
                                        {c.user?.firstName?.[0] || c.reviewerEmail?.[0] || '?'}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-baseline justify-between mb-1">
                                            <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                                                {c.user ? `${c.user.firstName} ${c.user.lastName || ''}` : c.reviewerName || c.reviewerEmail || 'Reviewer'}
                                            </span>
                                            <span className="text-[10px] text-gray-500">{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{c.content}</p>
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

                    {/* 3. Comment Input */}
                    <div className={`p-4 border-t ${isDark ? 'bg-[#0A0A0A] border-gray-800' : 'bg-white border-gray-200'}`}>
                        <div className={`flex flex-col gap-2 p-3 rounded-xl border transition-colors ${isDark ? 'bg-[#151515] border-gray-800 focus-within:border-gray-700' : 'bg-white border-gray-300 focus-within:border-indigo-500'}`}>
                            <textarea
                                ref={commentRef}
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleAddComment();
                                    }
                                }}
                                placeholder="Write a comment..."
                                className={`flex-1 bg-transparent text-sm resize-none focus:outline-none max-h-32 ${isDark ? 'text-white placeholder-gray-600' : 'text-gray-900 placeholder-gray-400'}`}
                                rows={1}
                            />
                            <div className="flex justify-end">
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

            <ConfirmationModal
                isOpen={modalConfig.isOpen}
                onClose={closeModal}
                onConfirm={handleConfirmAction}
                title={modalConfig.type === 'delete' ? 'Delete Approval Request?' :
                    modalConfig.type === 'revision' ? 'Create New Revision?' : 'Delete Asset?'}
                message={modalConfig.type === 'delete' ? 'This action cannot be undone. All assets and comments will be permanently removed.' :
                    modalConfig.type === 'revision' ? 'This will create a new version of the request. Reviewer decisions will be reset, but existing assets are kept.' :
                        'Are you sure you want to remove this file?'}
                confirmText={modalConfig.type === 'revision' ? 'Create Revision' : 'Delete'}
                variant={modalConfig.type === 'revision' ? 'warning' : 'danger'}
                isLoading={submitting}
            />
        </div>
    );
};

export default ApprovalDetailView;
