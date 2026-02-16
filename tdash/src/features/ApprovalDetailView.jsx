import React, { useState, useEffect, useRef } from 'react';
import {
    X,
    ArrowLeft,
    CheckCircle,
    XCircle,
    Clock,
    Send,
    Paperclip,
    Download,
    Eye,
    Edit3,
    MoreHorizontal,
    FileText,
    MessageSquare,
    ChevronRight,

    Users,
    Instagram,
    Facebook,
    Twitter,
    Linkedin,
    Heart,
    MessageCircle,
    Share2,
    Bookmark
} from 'lucide-react';
import { api } from '../lib/api';

const STATUS_CONFIG = {
    DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-600', icon: FileText },
    PENDING: { label: 'Pending Review', color: 'bg-amber-100 text-amber-700', icon: Clock },
    APPROVED: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
    CHANGES_REQUESTED: { label: 'Changes Requested', color: 'bg-orange-100 text-orange-700', icon: Edit3 },
    REJECTED: { label: 'Rejected', color: 'bg-rose-100 text-rose-700', icon: XCircle },
};

const ApprovalDetailView = ({ approval, isDark, user, isDrawer, onBack, onUpdate, onDelete }) => {
    // State
    const [assets, setAssets] = useState(approval?.assets || []);
    const [comments, setComments] = useState(approval?.comments || []);
    const [reviewers, setReviewers] = useState(approval?.reviewers || []);
    const [newComment, setNewComment] = useState('');
    const [activeAssetIndex, setActiveAssetIndex] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const commentsEndRef = useRef(null);

    useEffect(() => {
        if (approval) {
            setAssets(approval.assets || []);
            setComments(approval.comments || []);
            setReviewers(approval.reviewers || []);
            // Default to latest asset
            if (approval.assets?.length > 0) {
                setActiveAssetIndex(approval.assets.length - 1);
            }
        }
    }, [approval]);

    // Scroll to bottom of comments
    useEffect(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [comments]);

    const handleCommentSubmit = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        try {
            const response = await api.post(`/approvals/${approval.id}/comments`, { content: newComment });
            const addedComment = response.comment || response;
            const updatedComments = [...comments, { ...addedComment, user: { name: user.name, email: user.email } }];
            setComments(updatedComments);
            setNewComment('');
            onUpdate({ ...approval, comments: updatedComments });
        } catch (err) {
            console.error('Failed to post comment:', err);
        }
    };

    const handleReviewAction = async (decision) => {
        setSubmitting(true);
        try {
            const response = await api.post(`/approvals/${approval.id}/review`, { decision, feedback: newComment });
            onUpdate(response);
            setNewComment('');
        } catch (err) {
            console.error('Failed to submit review:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        try {
            setUploading(true);
            const formData = new FormData();
            files.forEach(file => formData.append('files', file));

            const response = await api.upload(`/approvals/${approval.id}/assets`, formData);
            const newAssets = Array.isArray(response) ? response : (response.assets || []);

            const updatedAssets = [...assets, ...newAssets];
            setAssets(updatedAssets);
            onUpdate({ ...approval, assets: updatedAssets });
            setActiveAssetIndex(updatedAssets.length - 1);
        } catch (err) {
            console.error('Upload failed:', err);
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const primaryAsset = assets[activeAssetIndex];
    const StatusIcon = STATUS_CONFIG[approval.status]?.icon || Clock;
    const isMyReviewPending = reviewers.some(r => r.email === user?.email && !r.decision);
    const isSocial = approval.type === 'SOCIAL';

    const SocialIcon = {
        instagram: Instagram,
        facebook: Facebook,
        twitter: Twitter,
        linkedin: Linkedin
    }[approval.content?.platform] || Instagram;

    return (
        <div className={`flex flex-col h-full bg-[#FAFAFA] dark:bg-[#050505] text-gray-900 dark:text-gray-100`}>

            {/* 1. Global Header */}
            <header className={`flex items-center justify-between px-6 py-4 border-b bg-white dark:bg-[#0A0A0A] border-gray-200 dark:border-gray-800 shadow-sm z-10`}>
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-bold tracking-tight">{approval.title}</h1>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1.5 ${STATUS_CONFIG[approval.status].color}`}>
                                <StatusIcon className="w-3.5 h-3.5" />
                                {STATUS_CONFIG[approval.status].label}
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 flex items-center gap-2 mt-0.5">
                            <span className="font-medium text-gray-900 dark:text-gray-300">{approval.event?.name || 'General Project'}</span>
                            <span>•</span>
                            <span>v{assets.length} recently updated</span>
                        </p>
                    </div>
                </div>

                {/* Primary Actions Area */}
                <div className="flex items-center gap-3">
                    {/* Only show upload if allowed (e.g. owner or changes requested) */}
                    <label className="cursor-pointer px-4 py-2 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#252525] text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-all flex items-center gap-2 shadow-sm">
                        <Paperclip className="w-4 h-4" />
                        Upload New Version
                        <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                    </label>

                    {isMyReviewPending && (
                        <>
                            <button
                                onClick={() => handleReviewAction('CHANGES_REQUESTED')}
                                disabled={submitting}
                                className="px-4 py-2 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 rounded-lg text-sm font-semibold hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-all flex items-center gap-2"
                            >
                                <Edit3 className="w-4 h-4" />
                                Request Changes
                            </button>
                            <button
                                onClick={() => handleReviewAction('APPROVED')}
                                disabled={submitting}
                                className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 shadow-md shadow-indigo-500/20 transition-all flex items-center gap-2"
                            >
                                <CheckCircle className="w-4 h-4" />
                                Approve
                            </button>
                        </>
                    )}
                </div>
            </header>

            {/* 2. Main Content Grid */}
            <div className="flex-1 flex overflow-hidden">

                {/* LEFT: Asset Canvas (Dominant) */}
                <div className="flex-1 flex flex-col bg-gray-100 dark:bg-[#0F0F0F] relative overflow-hidden">
                    {/* Canvas Toolbar */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white/90 dark:bg-[#222]/90 backdrop-blur shadow-sm border border-gray-200 dark:border-gray-700 p-1 rounded-full z-10 transition-all hover:shadow-md">
                        {assets.map((a, i) => (
                            <button
                                key={a.id}
                                onClick={() => setActiveAssetIndex(i)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activeAssetIndex === i
                                    ? 'bg-indigo-500 text-white shadow-sm'
                                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                                    }`}
                            >
                                v{i + 1}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
                        {isSocial ? (
                            <div className="w-[375px] bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
                                {/* Social Header */}
                                <div className="p-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center">
                                            <span className="font-bold text-xs">T</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-semibold dark:text-white">tixmo_official</span>
                                            <span className="text-[10px] text-gray-500">{approval.content?.platform}</span>
                                        </div>
                                    </div>
                                    <SocialIcon className="w-5 h-5 text-gray-400" />
                                </div>

                                {/* Social Content (Image/Asset) */}
                                <div className="aspect-square bg-gray-100 dark:bg-gray-900 flex items-center justify-center overflow-hidden">
                                    {primaryAsset ? (
                                        primaryAsset.mimeType?.startsWith('image/') ? (
                                            <img src={primaryAsset.s3Url} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="text-center p-4">
                                                <FileText className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                                                <p className="text-sm text-gray-500">{primaryAsset.originalName}</p>
                                            </div>
                                        )
                                    ) : (
                                        <div className="text-gray-400 text-sm">No media attached</div>
                                    )}
                                </div>

                                {/* Social Actions */}
                                <div className="p-3">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-4">
                                            <Heart className="w-6 h-6 text-gray-800 dark:text-white" />
                                            <MessageCircle className="w-6 h-6 text-gray-800 dark:text-white" />
                                            <Share2 className="w-6 h-6 text-gray-800 dark:text-white" />
                                        </div>
                                        <Bookmark className="w-6 h-6 text-gray-800 dark:text-white" />
                                    </div>

                                    <div className="space-y-1">
                                        <p className="text-sm font-semibold dark:text-white">1,234 likes</p>
                                        <p className="text-sm dark:text-gray-200">
                                            <span className="font-semibold mr-1">tixmo_official</span>
                                            {approval.content?.caption}
                                        </p>
                                        {approval.content?.hashtags && (
                                            <p className="text-sm text-blue-500">{approval.content.hashtags}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : primaryAsset ? (
                            primaryAsset.mimeType?.startsWith('image/') ? (
                                <img
                                    src={primaryAsset.s3Url}
                                    alt="Asset Preview"
                                    className="max-w-full max-h-full object-contain rounded shadow-xl ring-1 ring-black/5 dark:ring-white/10"
                                />
                            ) : (
                                <div className="bg-white dark:bg-[#1A1A1A] p-12 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 text-center">
                                    <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <FileText className="w-10 h-10 text-gray-400" />
                                    </div>
                                    <h3 className="text-lg font-semibold mb-1">{primaryAsset.originalName}</h3>
                                    <p className="text-sm text-gray-500 mb-6 uppercase tracking-wide font-medium">{primaryAsset.mimeType}</p>
                                    <a
                                        href={primaryAsset.s3Url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                                    >
                                        <Download className="w-4 h-4" />
                                        Download Asset
                                    </a>
                                </div>
                            )
                        ) : (
                            <div className="text-center text-gray-400">
                                <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>No assets uploaded yet</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: Control Panel (Sidebar) */}
                <div className="w-[400px] flex flex-col border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0A0A0A]">

                    {/* Reviewers Status Card */}
                    <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                Review Status
                            </h3>
                            <button className="text-xs text-indigo-500 font-medium hover:underline">Manage</button>
                        </div>

                        <div className="space-y-3">
                            {reviewers.map((r, i) => (
                                <div key={i} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-white dark:ring-[#111] ${r.decision === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                            r.decision === 'CHANGES_REQUESTED' ? 'bg-orange-100 text-orange-700' :
                                                r.decision === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                                    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                            }`}>
                                            {r.name?.[0] || r.email?.[0]}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium leading-none">{r.name || r.email}</p>
                                            <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">
                                                {r.decision?.replace('_', ' ') || 'Pending Review'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <MoreHorizontal className="w-4 h-4 text-gray-400 cursor-pointer" />
                                    </div>
                                </div>
                            ))}
                            {reviewers.length === 0 && (
                                <p className="text-sm text-gray-500 italic">No reviewers assigned.</p>
                            )}
                        </div>
                    </div>

                    {/* Chat / Activity Feed */}
                    <div className="flex-1 flex flex-col min-h-0 bg-gray-50/50 dark:bg-[#0C0C0C]">
                        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-gray-400" />
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Discussion</span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {comments.length === 0 && (
                                <div className="text-center py-10 opacity-50">
                                    <p className="text-sm">Start the conversation</p>
                                </div>
                            )}

                            {comments.map((comment, i) => {
                                const isMe = comment.user?.email === user?.email; // Simplified check
                                return (
                                    <div key={i} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 flex-shrink-0 flex items-center justify-center text-xs font-bold">
                                            {comment.user?.name?.[0]}
                                        </div>
                                        <div className={`flex flex-col max-w-[85%] ${isMe ? 'items-end' : 'items-start'}`}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{comment.user?.name}</span>
                                                <span className="text-[10px] text-gray-400">{new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${isMe
                                                ? 'bg-indigo-600 text-white rounded-tr-none'
                                                : 'bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-200 rounded-tl-none'
                                                }`}>
                                                {comment.content}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={commentsEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white dark:bg-[#0A0A0A] border-t border-gray-200 dark:border-gray-800">
                            <form onSubmit={handleCommentSubmit} className="relative rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
                                <textarea
                                    className="w-full bg-transparent p-3 pr-12 text-sm max-h-32 resize-none focus:outline-none dark:text-gray-200"
                                    placeholder="Type a message..."
                                    rows="2"
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleCommentSubmit(e);
                                        }
                                    }}
                                />
                                <button
                                    type="submit"
                                    disabled={!newComment.trim()}
                                    className="absolute right-2 bottom-2 p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 disabled:bg-gray-300 transition-colors"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </form>
                            <p className="text-[10px] text-gray-400 mt-2 text-center">
                                Press <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">Enter</span> to send
                            </p>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default ApprovalDetailView;
