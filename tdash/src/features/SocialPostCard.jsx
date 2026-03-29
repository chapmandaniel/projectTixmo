import React from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    Clock3,
    Facebook,
    Instagram,
    MessageSquare,
    Music,
    RefreshCw,
} from 'lucide-react';

const platformMeta = {
    instagram: { icon: Instagram, label: 'Instagram', accent: 'from-pink-500 via-orange-400 to-amber-300' },
    facebook: { icon: Facebook, label: 'Facebook', accent: 'from-sky-500 via-blue-500 to-indigo-500' },
    tiktok: { icon: Music, label: 'TikTok', accent: 'from-cyan-400 via-emerald-400 to-lime-300' },
};

const statusMeta = {
    flagged: { label: 'Flagged', icon: AlertTriangle, className: 'bg-rose-500/15 text-rose-300 border-rose-400/20' },
    watch: { label: 'Watch', icon: Clock3, className: 'bg-amber-500/15 text-amber-200 border-amber-400/20' },
    clear: { label: 'Clear', icon: CheckCircle2, className: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/20' },
    resolved: { label: 'Resolved', icon: CheckCircle2, className: 'bg-slate-500/15 text-slate-200 border-slate-400/20' },
};

const cadenceLabel = {
    hourly: 'Hourly',
    daily: 'Daily',
    'on-demand': 'On demand',
};

const formatCompactNumber = (value) =>
    new Intl.NumberFormat('en', {
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(value);

const formatDateTime = (value) => {
    if (!value) {
        return 'On demand';
    }

    return new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(value));
};

const SocialPostCard = ({ post, onOpen, onRefresh, isBusy, isDark }) => {
    const platform = platformMeta[post.platform] || platformMeta.instagram;
    const status = statusMeta[post.alertStatus] || statusMeta.clear;
    const PlatformIcon = platform.icon;
    const StatusIcon = status.icon;
    const summary = post.attentionReason || post.analysis.summary;

    return (
        <article
            className={`group overflow-hidden rounded-md border transition-all duration-300 ${isDark
                ? 'bg-[#151521] border-[#2b2b40] hover:border-[#445070] hover:shadow-[0_20px_60px_rgba(0,0,0,0.22)]'
                : 'bg-white border-gray-200 hover:border-[#bcc8df] hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]'
            }`}
        >
            <div className={`h-[3px] w-full bg-gradient-to-r ${platform.accent}`}></div>

            <div className="relative">
                <img
                    src={post.mediaUrl}
                    alt={post.eventName}
                    className="h-36 w-full object-cover"
                    loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#10131f] via-[#10131f]/25 to-transparent"></div>
                <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${status.className}`}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        {status.label}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${isDark ? 'bg-[#0f1020]/90 text-white' : 'bg-white/90 text-[#0f172a]'}`}>
                        <PlatformIcon className="h-3.5 w-3.5" />
                        {platform.label}
                    </span>
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/70">{post.eventName}</p>
                    <h3 className="mt-1 text-lg font-light tracking-tight text-white">{post.artistName}</h3>
                </div>
            </div>

            <div className="space-y-4 p-4">
                <div className="space-y-2">
                    <p className={`text-xs uppercase tracking-[0.18em] ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`}>
                        {post.handle}
                    </p>
                    <p className={`text-sm leading-6 ${isDark ? 'text-[#d6dbee]' : 'text-[#334155]'}`}>
                        {summary}
                    </p>
                </div>

                <div className="grid grid-cols-3 gap-3 text-left">
                    <div className={`rounded-md px-3 py-3 ${isDark ? 'bg-[#1e1e2d]' : 'bg-gray-50'}`}>
                        <p className={`text-[10px] uppercase tracking-[0.18em] ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`}>Score</p>
                        <p className={`mt-1 text-lg font-light ${isDark ? 'text-white' : 'text-[#0f172a]'}`}>{post.analysis.sentimentScore}</p>
                    </div>
                    <div className={`rounded-md px-3 py-3 ${isDark ? 'bg-[#1e1e2d]' : 'bg-gray-50'}`}>
                        <div className="flex items-center gap-1">
                            <MessageSquare className={`h-3.5 w-3.5 ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`} />
                            <p className={`text-[10px] uppercase tracking-[0.18em] ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`}>Comments</p>
                        </div>
                        <p className={`mt-1 text-lg font-light ${isDark ? 'text-white' : 'text-[#0f172a]'}`}>{formatCompactNumber(post.engagement.comments)}</p>
                    </div>
                    <div className={`rounded-md px-3 py-3 ${isDark ? 'bg-[#1e1e2d]' : 'bg-gray-50'}`}>
                        <p className={`text-[10px] uppercase tracking-[0.18em] ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`}>Cadence</p>
                        <p className={`mt-1 text-sm font-light ${isDark ? 'text-white' : 'text-[#0f172a]'}`}>{cadenceLabel[post.updateCadence]}</p>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className={`text-[10px] uppercase tracking-[0.18em] ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`}>Next check</p>
                        <p className={`mt-1 text-sm font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{formatDateTime(post.nextUpdateAt)}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${post.analysis.priority === 'high'
                        ? 'bg-rose-500/10 text-rose-200'
                        : post.analysis.priority === 'medium'
                            ? 'bg-amber-500/10 text-amber-200'
                            : isDark ? 'bg-white/5 text-[#8a93ae]' : 'bg-gray-100 text-gray-600'
                    }`}>
                        {post.analysis.priority} priority
                    </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                    <button
                        type="button"
                        onClick={() => onOpen(post.id)}
                        className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${isDark ? 'bg-sky-500 text-white hover:bg-sky-400' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                    >
                        Review
                    </button>
                    <button
                        type="button"
                        onClick={() => onRefresh(post.id)}
                        disabled={isBusy}
                        className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${isDark
                            ? 'border border-white/10 bg-white/5 text-gray-100 hover:border-sky-400/30 hover:bg-sky-500/10 disabled:border-[#2b2b40] disabled:text-[#64748b]'
                            : 'border border-gray-200 bg-white text-gray-800 hover:border-gray-300 hover:bg-gray-50 disabled:text-gray-400'
                        }`}
                    >
                        <RefreshCw className={`h-4 w-4 ${isBusy ? 'animate-spin' : ''}`} />
                        Refresh AI
                    </button>
                </div>
            </div>
        </article>
    );
};

export default SocialPostCard;
