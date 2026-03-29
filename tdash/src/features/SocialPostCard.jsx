import React from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    Clock3,
    Eye,
    Facebook,
    Instagram,
    MessageSquare,
    Music,
    RefreshCw,
    Share2,
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
    hourly: 'Hourly refresh',
    daily: 'Morning refresh',
    'on-demand': 'On demand',
};

const formatCompactNumber = (value) => new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
}).format(value);

const SocialPostCard = ({ post, onOpen, onRefresh, isBusy, isDark }) => {
    const platform = platformMeta[post.platform] || platformMeta.instagram;
    const status = statusMeta[post.alertStatus] || statusMeta.clear;
    const PlatformIcon = platform.icon;
    const StatusIcon = status.icon;

    return (
        <article
            onClick={() => onOpen(post.id)}
            className={`group overflow-hidden rounded-md border cursor-pointer transition-all duration-300 hover:-translate-y-1 ${isDark
                ? 'bg-[#151521] border-[#2b2b40] hover:border-[#445070] hover:shadow-[0_25px_80px_rgba(0,0,0,0.28)]'
                : 'bg-white border-gray-200 hover:border-[#bcc8df] hover:shadow-[0_24px_60px_rgba(15,23,42,0.08)]'
                }`}
        >
            <div className={`h-[3px] w-full bg-gradient-to-r ${platform.accent}`}></div>

            <div className="relative">
                <img
                    src={post.mediaUrl}
                    alt={post.eventName}
                    className="h-52 w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f111a] via-[#0f111a]/30 to-transparent"></div>
                <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
                    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs uppercase tracking-[0.22em] ${status.className}`}>
                        <StatusIcon size={12} />
                        <span>{status.label}</span>
                    </div>
                    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ${isDark ? 'bg-[#0f1020]/90 text-white' : 'bg-white/90 text-[#0f172a]'}`}>
                        <PlatformIcon size={14} />
                        <span>{platform.label}</span>
                    </div>
                </div>
                <div className="absolute left-4 right-4 bottom-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-white/70">{post.eventName}</p>
                    <h3 className="mt-2 text-xl font-semibold text-white">{post.artistName}</h3>
                </div>
            </div>

            <div className="space-y-5 p-5">
                <div className="flex items-center gap-3">
                    <img src={post.avatarUrl} alt={post.handle} className="h-10 w-10 rounded-full bg-slate-200" />
                    <div>
                        <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-[#0f172a]'}`}>{post.author}</p>
                        <p className={`text-xs ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`}>{post.handle}</p>
                    </div>
                </div>

                <p className={`text-sm leading-7 ${isDark ? 'text-[#d6dbee]' : 'text-[#334155]'}`}>
                    {post.content.length > 165 ? `${post.content.slice(0, 165)}...` : post.content}
                </p>

                <div className={`rounded-md border p-4 ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className={`text-[11px] uppercase tracking-[0.24em] ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`}>Sentiment</p>
                            <p className={`mt-1 text-3xl font-semibold ${isDark ? 'text-white' : 'text-[#0f172a]'}`}>{post.analysis.sentimentScore}</p>
                        </div>
                        <div className={`max-w-[12rem] text-right text-xs leading-5 ${isDark ? 'text-[#aeb6cc]' : 'text-[#475569]'}`}>
                            {post.attentionReason || post.analysis.summary}
                        </div>
                    </div>

                    <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-black/10">
                        <div className="bg-emerald-400" style={{ width: `${post.analysis.breakdown.positive}%` }}></div>
                        <div className="bg-slate-400" style={{ width: `${post.analysis.breakdown.neutral}%` }}></div>
                        <div className="bg-rose-400" style={{ width: `${post.analysis.breakdown.negative}%` }}></div>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-3 text-center">
                    <div className={`rounded-md px-3 py-3 ${isDark ? 'bg-[#1e1e2d]' : 'bg-gray-50'}`}>
                        <Eye size={15} className={`mx-auto mb-2 ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`} />
                        <p className={`text-xs ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`}>Views</p>
                        <p className={`mt-1 text-sm font-semibold ${isDark ? 'text-white' : 'text-[#0f172a]'}`}>{formatCompactNumber(post.engagement.views)}</p>
                    </div>
                    <div className={`rounded-md px-3 py-3 ${isDark ? 'bg-[#1e1e2d]' : 'bg-gray-50'}`}>
                        <MessageSquare size={15} className={`mx-auto mb-2 ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`} />
                        <p className={`text-xs ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`}>Comments</p>
                        <p className={`mt-1 text-sm font-semibold ${isDark ? 'text-white' : 'text-[#0f172a]'}`}>{formatCompactNumber(post.engagement.comments)}</p>
                    </div>
                    <div className={`rounded-md px-3 py-3 ${isDark ? 'bg-[#1e1e2d]' : 'bg-gray-50'}`}>
                        <Share2 size={15} className={`mx-auto mb-2 ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`} />
                        <p className={`text-xs ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`}>Shares</p>
                        <p className={`mt-1 text-sm font-semibold ${isDark ? 'text-white' : 'text-[#0f172a]'}`}>{formatCompactNumber(post.engagement.shares)}</p>
                    </div>
                    <div className={`rounded-md px-3 py-3 ${isDark ? 'bg-[#1e1e2d]' : 'bg-gray-50'}`}>
                        <Clock3 size={15} className={`mx-auto mb-2 ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`} />
                        <p className={`text-xs ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`}>Cadence</p>
                        <p className={`mt-1 text-sm font-semibold ${isDark ? 'text-white' : 'text-[#0f172a]'}`}>{cadenceLabel[post.updateCadence]}</p>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                    <div className={`text-xs uppercase tracking-[0.2em] ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`}>
                        {post.analysis.priority} priority
                    </div>
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onRefresh(post.id);
                        }}
                        disabled={isBusy}
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${isDark
                            ? 'bg-[#243047] text-white hover:bg-[#31415f] disabled:bg-[#1d2230] disabled:text-[#64748b]'
                            : 'bg-[#0f172a] text-white hover:bg-[#1e293b] disabled:bg-[#dbe2ee] disabled:text-[#94a3b8]'
                            }`}
                    >
                        <RefreshCw size={14} className={isBusy ? 'animate-spin' : ''} />
                        <span>Refresh AI</span>
                    </button>
                </div>
            </div>
        </article>
    );
};

export default SocialPostCard;
