import React from 'react';
import { Heart, MessageCircle, Share2, Instagram, Twitter, Facebook, Linkedin } from 'lucide-react';

const SocialPostCard = ({ post, onClick, isDark }) => {
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
        <div
            onClick={() => onClick(post)}
            className={`group relative break-inside-avoid mb-6 rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 ${isDark ? 'bg-[#1e1e1e] hover:shadow-xl hover:shadow-indigo-500/10' : 'bg-white hover:shadow-xl hover:shadow-gray-200'}`}
        >
            {/* Header */}
            <div className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <img src={post.avatar} alt={post.author} className="w-8 h-8 rounded-full bg-gray-200" />
                    <div>
                        <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{post.author}</p>
                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{new Date(post.date).toLocaleDateString()}</p>
                    </div>
                </div>
                <PlatformIcon size={18} className={platformColor} />
            </div>

            {/* Image */}
            {post.imageUrl && (
                <div className="relative aspect-video w-full overflow-hidden">
                    <img
                        src={post.imageUrl}
                        alt="Post content"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                </div>
            )}

            {/* Content */}
            <div className="p-4">
                <p className={`text-sm mb-4 line-clamp-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {post.content}
                </p>

                {/* Metrics */}
                <div className={`flex items-center justify-between pt-3 border-t ${isDark ? 'border-[#2a2a2a]' : 'border-gray-100'}`}>
                    <div className="flex items-center space-x-4">
                        <div className={`flex items-center space-x-1.5 text-xs ${isDark ? 'text-gray-400 group-hover:text-rose-400' : 'text-gray-500 group-hover:text-rose-500'}`}>
                            <Heart size={14} />
                            <span>{post.likes}</span>
                        </div>
                        <div className={`flex items-center space-x-1.5 text-xs ${isDark ? 'text-gray-400 group-hover:text-indigo-400' : 'text-gray-500 group-hover:text-indigo-500'}`}>
                            <MessageCircle size={14} />
                            <span>{post.comments}</span>
                        </div>
                    </div>
                    <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        <Share2 size={14} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SocialPostCard;
