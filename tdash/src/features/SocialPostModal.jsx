import React from 'react';
import { X, Heart, MessageCircle, Share2, MoreHorizontal, Instagram, Twitter, Facebook, Linkedin, Music, BarChart, Eye, TrendingUp, Sparkles, User } from 'lucide-react';

const SocialPostModal = ({ post, onClose, isDark }) => {
    if (!post) return null;

    const PlatformIcon = {
        instagram: Instagram,
        twitter: Twitter,
        facebook: Facebook,
        linkedin: Linkedin,
        tiktok: Music
    }[post.platform] || Instagram;

    const platformColor = {
        instagram: 'text-pink-500',
        twitter: 'text-sky-500',
        facebook: 'text-blue-600',
        linkedin: 'text-blue-700',
        tiktok: 'text-pink-600'
    }[post.platform] || 'text-gray-500';

    const getSentimentColor = (sentiment) => {
        switch (sentiment) {
            case 'positive': return isDark ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-green-50 text-green-700 border-green-200';
            case 'negative': return isDark ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-50 text-red-700 border-red-200';
            default: return isDark ? 'bg-gray-500/10 text-gray-400 border-gray-500/20' : 'bg-gray-50 text-gray-700 border-gray-200';
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div
                className={`w-full max-w-5xl h-[85vh] rounded-2xl flex overflow-hidden shadow-2xl ${isDark ? 'bg-[#1e1e1e]' : 'bg-white'}`}
                onClick={e => e.stopPropagation()}
            >
                {/* Left Side - Image (if exists) */}
                {post.imageUrl ? (
                    <div className="w-1/2 bg-black flex items-center justify-center relative">
                        <img src={post.imageUrl} alt="Post" className="max-h-full max-w-full object-contain" />
                    </div>
                ) : (
                    <div className={`w-1/2 flex items-center justify-center p-12 ${isDark ? 'bg-[#252525]' : 'bg-gray-50'}`}>
                        <div className="max-w-md text-center">
                            <PlatformIcon size={48} className={`mx-auto mb-6 opacity-20 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                            <p className={`text-xl font-medium leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>"{post.content}"</p>
                        </div>
                    </div>
                )}

                {/* Right Side - Details */}
                <div className={`w-1/2 flex flex-col h-full ${isDark ? 'bg-[#1e1e1e]' : 'bg-white'}`}>
                    {/* Header */}
                    <div className={`p-5 border-b flex items-center justify-between shrink-0 ${isDark ? 'border-[#2a2a2a]' : 'border-gray-100'}`}>
                        <div className="flex items-center space-x-3">
                            <img src={post.avatar} alt={post.author} className="w-10 h-10 rounded-full bg-gray-200" />
                            <div>
                                <p className={`font-medium text-sm ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{post.authorName || post.author}</p>
                                <div className="flex items-center space-x-2">
                                    <PlatformIcon size={12} className={platformColor} />
                                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{post.author} • {new Date(post.date).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-[#2a2a2a] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                            <X size={20} />
                        </button>
                    </div>

                    {/* Scrollable Content Area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <div className="p-6 space-y-6">
                            {/* Post Text */}
                            <p className={`text-base leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                                {post.content}
                            </p>

                            {/* AI Insights & Metrics */}
                            {(post.metrics || post.sentiment) && (
                                <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#252525]/50 border-[#333]' : 'bg-gray-50/50 border-gray-100'}`}>
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <Sparkles size={16} className="text-violet-500" />
                                            <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>AI Analysis</span>
                                        </div>
                                        {post.sentiment && (
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getSentimentColor(post.sentiment)} capitalize`}>
                                                {post.sentiment} Sentiment
                                            </span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Impressions</span>
                                            <div className={`flex items-center gap-2 font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                                                <Eye size={16} className="text-blue-500" />
                                                {(post.metrics?.impressions || 0).toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Engagement Rate</span>
                                            <div className={`flex items-center gap-2 font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                                                <TrendingUp size={16} className="text-green-500" />
                                                {post.metrics?.engagementRate || 0}%
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* AI Comment Summary */}
                            <div className="space-y-4">
                                <h4 className={`text-xs font-semibold uppercase tracking-wider sticky top-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    Community Consensus
                                </h4>

                                <div className={`p-4 rounded-xl border relative overflow-hidden ${isDark ? 'bg-indigo-500/5 border-indigo-500/10' : 'bg-indigo-50 border-indigo-100'}`}>
                                    <div className="flex gap-3">
                                        <div className={`shrink-0 mt-0.5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                                            <Sparkles size={18} />
                                        </div>
                                        <div className="space-y-1">
                                            <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-indigo-400' : 'text-indigo-700'}`}>
                                                AI Summary
                                            </p>
                                            <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                {post.commentSummary || "Analyzing comments..."}
                                            </p>
                                        </div>
                                    </div>
                                    {/* Decorative background element */}
                                    <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full blur-2xl opacity-10 pointer-events-none ${isDark ? 'bg-indigo-500' : 'bg-indigo-400'}`}></div>
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        Based on {post.comments} comments
                                    </span>
                                    <button className={`text-xs font-medium hover:underline ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                                        View all comments
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className={`p-5 border-t shrink-0 ${isDark ? 'border-[#2a2a2a]' : 'border-gray-100'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex space-x-6">
                                <button className={`flex items-center space-x-2 transition-colors ${isDark ? 'text-gray-400 hover:text-rose-400' : 'text-gray-600 hover:text-rose-600'}`}>
                                    <Heart size={20} />
                                    <span className="text-sm font-medium">{post.likes.toLocaleString()}</span>
                                </button>
                                <button className={`flex items-center space-x-2 transition-colors ${isDark ? 'text-gray-400 hover:text-indigo-400' : 'text-gray-600 hover:text-indigo-600'}`}>
                                    <MessageCircle size={20} />
                                    <span className="text-sm font-medium">{post.comments.toLocaleString()}</span>
                                </button>
                                <button className={`flex items-center space-x-2 transition-colors ${isDark ? 'text-gray-400 hover:text-green-400' : 'text-gray-600 hover:text-green-600'}`}>
                                    <Share2 size={20} />
                                    <span className="text-sm font-medium">{post.shares.toLocaleString()}</span>
                                </button>
                            </div>
                            <button className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-900'}>
                                <MoreHorizontal size={20} />
                            </button>
                        </div>
                        <div className={`w-full h-10 rounded-lg flex items-center px-4 transition-colors cursor-text ${isDark ? 'bg-[#252525] text-gray-500 hover:bg-[#2a2a2a]' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                            <span className="text-sm">Write a reply...</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SocialPostModal;
