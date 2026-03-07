import React from 'react';
import {
    MessageSquare,
    Paperclip,
    CheckCircle,
    Edit3,
    Clock,
    XCircle,
    Eye
} from 'lucide-react';

const STATUS_INDICATORS = {
    DRAFT: { icon: Clock, color: 'text-gray-400', bg: 'bg-gray-400/10' },
    PENDING: { icon: Eye, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    CHANGES_REQUESTED: { icon: Edit3, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    APPROVED: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
    REJECTED: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
};

const ApprovalGalleryCard = ({ approval, isDark, onClick }) => {
    // Get primary asset for thumbnail
    const primaryAsset = approval.assets?.[0];
    const assetCount = approval.assets?.length || 0;
    const commentCount = approval.comments?.length || 0;

    const StatusIcon = STATUS_INDICATORS[approval.status]?.icon || Clock;
    const statusColor = STATUS_INDICATORS[approval.status]?.color || 'text-gray-400';
    const statusBg = STATUS_INDICATORS[approval.status]?.bg || 'bg-gray-400/10';

    return (
        <div
            onClick={onClick}
            className={`group relative flex flex-col rounded-md border transition-all cursor-pointer hover:shadow-xl hover:-translate-y-1 overflow-hidden ${isDark
                ? 'bg-[#1e1e2d] border-[#2b2b40] hover:bg-[#232336] hover:border-[#3a3a5a]'
                : 'bg-white border-gray-200 hover:border-indigo-200'
                }`}
        >
            {/* Colorful Gradient Top Bar for Square Aesthetic */}
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-pink-500 to-orange-400 opacity-70 group-hover:opacity-100 transition-opacity duration-300 z-50"></div>
            {/* Thumbnail Header - Larger for Gallery */}
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100 dark:bg-[#222]">
                {primaryAsset?.mimeType?.startsWith('image/') ? (
                    <img
                        src={primaryAsset.s3Url}
                        alt="Preview"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/400x300/1e1e2d/a1a5b7?text=No+Image'; }}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <Paperclip className="w-12 h-12 opacity-20" />
                    </div>
                )}

                {/* Status Badge (Floating) */}
                <div className={`absolute top-2 right-2 px-2 py-1 rounded-full backdrop-blur-md border border-white/10 ${statusBg} ${statusColor} flex items-center gap-1.5 shadow-sm`}>
                    <StatusIcon className="w-3 h-3" />
                    <span className="text-[10px] font-bold uppercase tracking-wide">{approval.status.replace('_', ' ')}</span>
                </div>

                {/* Overlay on Hover */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button className="px-4 py-2 bg-white/90 text-gray-900 rounded-full text-xs font-bold hover:scale-105 transition-transform">
                        View Details
                    </button>
                </div>
            </div>

            {/* Content Body */}
            <div className="p-4 flex flex-col gap-2 z-10 transition-transform duration-300 group-hover:translate-x-1">
                <div className="flex justify-between items-start gap-2">
                    <div>
                        <h4 className={`text-lg font-light tracking-tight line-clamp-1 leading-tight ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>
                            {approval.title}
                        </h4>
                        <p className={`text-xs mt-0.5 font-light line-clamp-1 ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                            {approval.event?.name || 'General Event'}
                        </p>
                    </div>
                </div>

                {/* Footer Meta */}
                <div className={`flex items-center justify-between mt-2 pt-3 border-t ${isDark ? 'border-[#2b2b40]' : 'border-gray-100'}`}>
                    {/* Left: Reviewers Avatars */}
                    <div className="flex -space-x-1.5 pl-1">
                        {approval.reviewers?.slice(0, 3).map((r, i) => (
                            <div
                                key={i}
                                title={r.name || r.email}
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] border-2 font-light ${isDark
                                    ? 'bg-[#222] border-[#151521] text-gray-400'
                                    : 'bg-gray-100 border-white text-gray-600'
                                    }`}
                            >
                                {(r.name?.[0] || r.email?.[0] || '?').toUpperCase()}
                            </div>
                        ))}
                    </div>

                    {/* Right: Counts */}
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                        {assetCount > 0 && (
                            <div className="flex items-center gap-1">
                                <Paperclip className="w-3 h-3" />
                                <span>{assetCount}</span>
                            </div>
                        )}
                        {commentCount > 0 && (
                            <div className="flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" />
                                <span>{commentCount}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ApprovalGalleryCard;
