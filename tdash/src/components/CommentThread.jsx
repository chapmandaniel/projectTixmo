import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Loader2 } from 'lucide-react';

const CommentThread = ({
    comments = [],
    onAddComment,
    isDark,
    currentUser,
    disabled = false,
    placeholder = 'Add a comment...'
}) => {
    const [content, setContent] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const commentsEndRef = useRef(null);

    useEffect(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [comments.length]);

    const handleSubmit = async () => {
        if (!content.trim() || submitting || disabled) return;

        try {
            setSubmitting(true);
            await onAddComment({ content: content.trim() });
            setContent('');
        } catch (err) {
            console.error('Failed to add comment:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const formatTime = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
        return date.toLocaleDateString();
    };

    const getInitials = (comment) => {
        if (comment.user) {
            return `${comment.user.firstName?.[0] || ''}${comment.user.lastName?.[0] || ''}`;
        }
        if (comment.reviewerEmail) {
            return comment.reviewerEmail[0].toUpperCase();
        }
        return '?';
    };

    const getName = (comment) => {
        if (comment.user) {
            return `${comment.user.firstName} ${comment.user.lastName}`;
        }
        return comment.reviewerName || comment.reviewerEmail || 'External Reviewer';
    };

    const isOwn = (comment) => {
        if (!currentUser) return false;
        return comment.userId === currentUser.id;
    };

    return (
        <div className="flex flex-col h-full">
            {/* Comments List */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                {comments.length === 0 ? (
                    <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p>No comments yet</p>
                        <p className="text-sm mt-1">Start the conversation</p>
                    </div>
                ) : (
                    comments.map((comment) => (
                        <div
                            key={comment.id}
                            className={`flex gap-3 ${isOwn(comment) ? 'flex-row-reverse' : ''}`}
                        >
                            <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-medium ${isOwn(comment)
                                    ? 'bg-indigo-600 text-white'
                                    : isDark
                                        ? 'bg-gray-700 text-white'
                                        : 'bg-gray-200 text-gray-700'
                                }`}>
                                {getInitials(comment)}
                            </div>
                            <div className={`flex-1 max-w-[80%] ${isOwn(comment) ? 'text-right' : ''}`}>
                                <div className={`inline-block p-3 rounded-2xl ${isOwn(comment)
                                        ? 'bg-indigo-600 text-white rounded-br-sm'
                                        : isDark
                                            ? 'bg-gray-800 text-gray-200 rounded-bl-sm'
                                            : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                                    }`}>
                                    <p className="whitespace-pre-wrap break-words text-sm">{comment.content}</p>
                                </div>
                                <div className={`flex items-center gap-2 mt-1 text-xs ${isOwn(comment) ? 'justify-end' : ''
                                    } ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    <span className="font-medium">{getName(comment)}</span>
                                    <span>•</span>
                                    <span>{formatTime(comment.createdAt)}</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
                <div ref={commentsEndRef} />
            </div>

            {/* Input */}
            {!disabled && (
                <div className={`flex items-end gap-3 border-t pt-4 ${isDark ? 'border-gray-800' : 'border-gray-200'
                    }`}>
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-medium bg-indigo-600 text-white`}>
                        {currentUser?.firstName?.[0]}{currentUser?.lastName?.[0]}
                    </div>
                    <div className={`flex-1 relative rounded-2xl border ${isDark
                            ? 'bg-gray-800 border-gray-700'
                            : 'bg-gray-50 border-gray-200'
                        }`}>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder}
                            rows={1}
                            className={`w-full px-4 py-3 pr-12 bg-transparent resize-none focus:outline-none text-sm ${isDark
                                    ? 'text-white placeholder-gray-500'
                                    : 'text-gray-900 placeholder-gray-400'
                                }`}
                            style={{
                                minHeight: '44px',
                                maxHeight: '120px',
                                height: 'auto'
                            }}
                            onInput={(e) => {
                                e.target.style.height = 'auto';
                                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                            }}
                        />
                        <button
                            onClick={handleSubmit}
                            disabled={!content.trim() || submitting}
                            className={`absolute right-2 bottom-2 p-2 rounded-full transition-colors ${content.trim()
                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                    : isDark
                                        ? 'bg-gray-700 text-gray-500'
                                        : 'bg-gray-200 text-gray-400'
                                } disabled:opacity-50`}
                        >
                            {submitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                </div>
            )}

            {!disabled && (
                <p className={`text-xs mt-2 text-center ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                    Press ⌘+Enter to send
                </p>
            )}
        </div>
    );
};

export default CommentThread;
