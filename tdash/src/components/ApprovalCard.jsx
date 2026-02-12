import React from 'react';
import {
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    FileEdit,
    FileText,
    Image,
    MessageSquare,
    Users,
    Calendar,
    ChevronRight
} from 'lucide-react';

const STATUS_CONFIG = {
    DRAFT: {
        label: 'Draft',
        color: 'bg-gray-500',
        bgColor: 'bg-gray-500/10',
        textColor: 'text-gray-400',
        icon: FileEdit
    },
    PENDING: {
        label: 'Pending Review',
        color: 'bg-yellow-500',
        bgColor: 'bg-yellow-500/10',
        textColor: 'text-yellow-400',
        icon: Clock
    },
    APPROVED: {
        label: 'Approved',
        color: 'bg-green-500',
        bgColor: 'bg-green-500/10',
        textColor: 'text-green-400',
        icon: CheckCircle
    },
    CHANGES_REQUESTED: {
        label: 'Changes Requested',
        color: 'bg-orange-500',
        bgColor: 'bg-orange-500/10',
        textColor: 'text-orange-400',
        icon: AlertCircle
    },
    REJECTED: {
        label: 'Rejected',
        color: 'bg-red-500',
        bgColor: 'bg-red-500/10',
        textColor: 'text-red-400',
        icon: XCircle
    },
};

const PRIORITY_CONFIG = {
    STANDARD: { label: 'Standard', color: 'text-gray-400' },
    URGENT: { label: 'Urgent', color: 'text-orange-400' },
    CRITICAL: { label: 'Critical', color: 'text-red-400' },
};

const ApprovalCard = ({
    approval,
    onClick,
    isDark,
    compact = false
}) => {
    const status = STATUS_CONFIG[approval.status] || STATUS_CONFIG.DRAFT;
    const priority = PRIORITY_CONFIG[approval.priority] || PRIORITY_CONFIG.STANDARD;
    const StatusIcon = status.icon;

    const formatDate = (dateStr) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        const now = new Date();
        const diff = date - now;

        if (diff < 0) return 'Overdue';
        if (diff < 86400000) return 'Today';
        if (diff < 172800000) return 'Tomorrow';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const getThumbnail = () => {
        const imageAsset = approval.assets?.find(a => a.mimeType?.startsWith('image/'));
        return imageAsset?.s3Url;
    };

    const thumbnail = getThumbnail();
    const reviewersCount = approval.reviewers?.length || 0;
    const decidedCount = approval.reviewers?.filter(r => r.decision)?.length || 0;
    const commentsCount = approval._count?.comments || approval.comments?.length || 0;
    const assetsCount = approval.assets?.length || 0;

    if (compact) {
        return (
            <div
                onClick={onClick}
                className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all ${isDark
                    ? 'bg-[#1A1A1A] hover:bg-[#222222] border border-gray-800'
                    : 'bg-white hover:bg-gray-50 border border-gray-200'
                    }`}
            >
                {/* Thumbnail */}
                <div className={`w-12 h-12 rounded-lg flex-shrink-0 overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-gray-100'
                    }`}>
                    {thumbnail ? (
                        <img src={thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Image className={`w-5 h-5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {approval.title}
                    </p>
                    <p className={`text-sm truncate ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {approval.event?.name}
                    </p>
                </div>

                {/* Status */}
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${status.bgColor} ${status.textColor}`}>
                    {status.label}
                </div>

                <ChevronRight className={`w-5 h-5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
            </div>
        );
    }

    return (
        <div
            onClick={onClick}
            className={`group rounded-xl overflow-hidden cursor-pointer transition-all ${isDark
                ? 'bg-[#1A1A1A] hover:bg-[#222222] border border-gray-800'
                : 'bg-white hover:bg-gray-50 border border-gray-200 shadow-sm'
                }`}
        >
            {/* Thumbnail / Preview */}
            <div className={`relative aspect-[16/10] overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-gray-100'
                }`}>
                {thumbnail ? (
                    <img
                        src={thumbnail}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                ) : (approval.description || approval.instructions) ? (
                    <div className={`w-full h-full p-4 flex flex-col gap-2 overflow-hidden ${isDark ? 'bg-gradient-to-b from-gray-800 to-gray-800/80' : 'bg-gradient-to-b from-gray-50 to-gray-100'}`}>
                        <div className={`flex items-center gap-2 mb-1`}>
                            <div className={`w-6 h-6 rounded flex items-center justify-center ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                <FileText className={`w-3.5 h-3.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                            </div>
                            <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                                {approval.description ? 'Description' : 'Instructions'}
                            </span>
                        </div>
                        <p className={`text-xs leading-relaxed line-clamp-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {approval.description || approval.instructions}
                        </p>
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Image className={`w-12 h-12 ${isDark ? 'text-gray-700' : 'text-gray-300'}`} />
                    </div>
                )}

                {/* Status Badge */}
                <div className={`absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-sm ${status.bgColor} ${status.textColor}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {status.label}
                </div>

                {/* Version Badge */}
                {approval.version > 1 && (
                    <div className={`absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm ${isDark ? 'bg-black/50 text-white' : 'bg-white/80 text-gray-700'
                        }`}>
                        v{approval.version}
                    </div>
                )}

                {/* Assets Count */}
                {assetsCount > 1 && (
                    <div className={`absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full text-xs backdrop-blur-sm ${isDark ? 'bg-black/50 text-white' : 'bg-white/80 text-gray-700'
                        }`}>
                        <Image className="w-3.5 h-3.5" />
                        {assetsCount}
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-4">
                <h3 className={`font-semibold truncate mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {approval.title}
                </h3>
                <p className={`text-sm truncate mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {approval.event?.name}
                </p>

                {/* Meta */}
                <div className="flex items-center gap-4 text-sm">
                    {/* Reviewers */}
                    <div className={`flex items-center gap-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        <Users className="w-4 h-4" />
                        <span>{decidedCount}/{reviewersCount}</span>
                    </div>

                    {/* Comments */}
                    {commentsCount > 0 && (
                        <div className={`flex items-center gap-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            <MessageSquare className="w-4 h-4" />
                            <span>{commentsCount}</span>
                        </div>
                    )}

                    {/* Due Date */}
                    {approval.dueDate && (
                        <div className={`flex items-center gap-1.5 ml-auto ${new Date(approval.dueDate) < new Date()
                            ? 'text-red-400'
                            : isDark ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                            <Calendar className="w-4 h-4" />
                            <span>{formatDate(approval.dueDate)}</span>
                        </div>
                    )}

                    {/* Priority (if not standard) */}
                    {approval.priority !== 'STANDARD' && (
                        <span className={`text-xs font-medium ${priority.color}`}>
                            {priority.label}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ApprovalCard;
