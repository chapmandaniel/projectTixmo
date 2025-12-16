import React from 'react';
import { X, Heart, MessageCircle, Share2, MoreHorizontal, Instagram, Twitter, Facebook, Linkedin } from 'lucide-react';

const SocialPostModal = ({ post, onClose, isDark }) => {
    if (!post) return null;

    const PlatformIcon = {
        instagram: Instagram,
        twitter: Twitter,
        facebook: Facebook,
        linkedin: Linkedin
    }[post.platform] || Instagram;

    const platformColor = {
        instagram: 'text-pink-500',
        twitter: 'text-sky-500',
        facebook: 'text-blue-600',
        linkedin: 'text-blue-700'
    }[post.platform] || 'text-gray-500';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div
                className={`w-full max-w-4xl max-h-[90vh] rounded-2xl flex overflow-hidden shadow-2xl ${isDark ? 'bg-[#1e1e1e]' : 'bg-white'}`}
                onClick={e => e.stopPropagation()}
            >
                {/* Left Side - Image (if exists) */}
                {post.imageUrl ? (
                    <div className="w-1/2 bg-black flex items-center justify-center">
                        <img src={post.imageUrl} alt="Post" className="max-h-full max-w-full object-contain" />
                    </div>
                ) : (
                    <div className={`w-1/2 flex items-center justify-center p-12 ${isDark ? 'bg-[#252525]' : 'bg-gray-50'}`}>
                        <p className={`text-2xl text-center font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>"{post.content}"</p>
                    </div>
                )}

                {/* Right Side - Details */}
                <div className={`w-1/2 flex flex-col ${isDark ? 'bg-[#1e1e1e]' : 'bg-white'}`}>
                    {/* Header */}
                    <div className={`p-6 border-b flex items-center justify-between ${isDark ? 'border-[#2a2a2a]' : 'border-gray-100'}`}>
                        <div className="flex items-center space-x-3">
                            <img src={post.avatar} alt={post.author} className="w-10 h-10 rounded-full bg-gray-200" />
                            <div>
                                <p className={`font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{post.author}</p>
                                <div className="flex items-center space-x-2">
                                    <PlatformIcon size={12} className={platformColor} />
                                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{post.platform} • {new Date(post.date).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-[#2a2a2a] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <p className={`text-base leading-relaxed mb-6 ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                            {post.content}
                        </p>

                        {/* Mock Comments */}
                        <div className="space-y-4">
                            <h4 className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Recent Comments</h4>
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex space-x-3">
                                    <div className={`w-8 h-8 rounded-full shrink-0 ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-100'}`}></div>
                                    <div>
                                        <div className={`h-3 w-24 rounded mb-1.5 ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-100'}`}></div>
                                        <div className={`h-3 w-48 rounded ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-50'}`}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className={`p-6 border-t ${isDark ? 'border-[#2a2a2a]' : 'border-gray-100'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex space-x-6">
                                <button className={`flex items-center space-x-2 transition-colors ${isDark ? 'text-gray-400 hover:text-rose-400' : 'text-gray-600 hover:text-rose-600'}`}>
                                    <Heart size={24} />
                                    <span className="text-sm font-medium">{post.likes}</span>
                                </button>
                                <button className={`flex items-center space-x-2 transition-colors ${isDark ? 'text-gray-400 hover:text-indigo-400' : 'text-gray-600 hover:text-indigo-600'}`}>
                                    <MessageCircle size={24} />
                                    <span className="text-sm font-medium">{post.comments}</span>
                                </button>
                                <button className={`flex items-center space-x-2 transition-colors ${isDark ? 'text-gray-400 hover:text-green-400' : 'text-gray-600 hover:text-green-600'}`}>
                                    <Share2 size={24} />
                                    <span className="text-sm font-medium">{post.shares}</span>
                                </button>
                            </div>
                            <button className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-900'}>
                                <MoreHorizontal size={20} />
                            </button>
                        </div>
                        <div className={`w-full h-10 rounded-lg flex items-center px-4 ${isDark ? 'bg-[#252525] text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                            <span className="text-sm">Write a comment...</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SocialPostModal;
