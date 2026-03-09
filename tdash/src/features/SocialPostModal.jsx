import React from 'react';
import {
    AlertTriangle,
    Bot,
    CheckCircle2,
    ExternalLink,
    Facebook,
    Instagram,
    MessageSquare,
    Music,
    RefreshCw,
    Send,
    Sparkles,
    X,
} from 'lucide-react';

const platformMeta = {
    instagram: { icon: Instagram, label: 'Instagram', accent: 'from-pink-500 via-orange-400 to-amber-300' },
    facebook: { icon: Facebook, label: 'Facebook', accent: 'from-sky-500 via-blue-500 to-indigo-500' },
    tiktok: { icon: Music, label: 'TikTok', accent: 'from-cyan-400 via-emerald-400 to-lime-300' },
};

const statusMeta = {
    flagged: { label: 'Flagged', icon: AlertTriangle, className: 'bg-rose-500/15 text-rose-300 border-rose-400/20' },
    watch: { label: 'Watch', icon: AlertTriangle, className: 'bg-amber-500/15 text-amber-200 border-amber-400/20' },
    clear: { label: 'Clear', icon: CheckCircle2, className: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/20' },
    resolved: { label: 'Resolved', icon: CheckCircle2, className: 'bg-slate-500/15 text-slate-200 border-slate-400/20' },
};

const cadenceLabel = {
    hourly: 'Hourly refresh',
    daily: 'Daily morning refresh',
    'on-demand': 'On-demand review',
};

const breakdownColor = {
    positive: 'bg-emerald-400',
    neutral: 'bg-slate-400',
    negative: 'bg-rose-400',
};

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

const SocialPostModal = ({ post, onClose, onResolve, onRefresh, isBusy, isDark }) => {
    if (!post) {
        return null;
    }

    const platform = platformMeta[post.platform] || platformMeta.instagram;
    const status = statusMeta[post.alertStatus] || statusMeta.clear;
    const PlatformIcon = platform.icon;
    const StatusIcon = status.icon;

    return (
        <div className="fixed inset-0 z-[100] bg-black/70 p-4 backdrop-blur-md" onClick={onClose}>
            <div
                onClick={(event) => event.stopPropagation()}
                className={`mx-auto flex h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-[32px] border shadow-[0_30px_120px_rgba(0,0,0,0.35)] xl:flex-row ${isDark ? 'border-[#2d3348] bg-[#141925]' : 'border-[#d7deea] bg-white'}`}
            >
                <div className="relative xl:w-[46%]">
                    <img src={post.mediaUrl} alt={post.eventName} className="h-72 w-full object-cover xl:h-full" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0c1018] via-[#0c1018]/10 to-transparent"></div>
                    <div className="absolute left-6 right-6 top-6 flex items-center justify-between">
                        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs uppercase tracking-[0.24em] ${status.className}`}>
                            <StatusIcon size={12} />
                            <span>{status.label}</span>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className={`inline-flex h-11 w-11 items-center justify-center rounded-full ${isDark ? 'bg-[#101522]/80 text-white hover:bg-[#162032]' : 'bg-white/90 text-[#0f172a] hover:bg-white'}`}
                        >
                            <X size={18} />
                        </button>
                    </div>
                    <div className="absolute bottom-6 left-6 right-6">
                        <div className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-r px-4 py-2 text-xs uppercase tracking-[0.24em] text-[#08111f] ${platform.accent}`}>
                            <PlatformIcon size={14} />
                            <span>{platform.label}</span>
                        </div>
                        <h2 className="mt-4 text-3xl font-semibold text-white">{post.eventName}</h2>
                        <p className="mt-2 text-sm uppercase tracking-[0.24em] text-white/70">{post.artistName}</p>
                        <p className="mt-4 max-w-xl text-base leading-8 text-white/88">{post.content}</p>
                    </div>
                </div>

                <div className="flex flex-1 flex-col">
                    <div className={`border-b px-6 py-5 ${isDark ? 'border-[#262d3f]' : 'border-[#e2e8f0]'}`}>
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="flex items-center gap-3">
                                <img src={post.avatarUrl} alt={post.handle} className="h-12 w-12 rounded-full bg-slate-200" />
                                <div>
                                    <p className={`text-base font-semibold ${isDark ? 'text-white' : 'text-[#0f172a]'}`}>{post.author}</p>
                                    <p className={`text-sm ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`}>{post.handle}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <div className={`rounded-2xl px-4 py-3 ${isDark ? 'bg-[#101522]' : 'bg-[#f8fafc]'}`}>
                                    <p className={`text-[11px] uppercase tracking-[0.2em] ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`}>Score</p>
                                    <p className={`mt-1 text-2xl font-semibold ${isDark ? 'text-white' : 'text-[#0f172a]'}`}>{post.analysis.sentimentScore}</p>
                                </div>
                                <div className={`rounded-2xl px-4 py-3 ${isDark ? 'bg-[#101522]' : 'bg-[#f8fafc]'}`}>
                                    <p className={`text-[11px] uppercase tracking-[0.2em] ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`}>Cadence</p>
                                    <p className={`mt-1 text-sm font-semibold ${isDark ? 'text-white' : 'text-[#0f172a]'}`}>{cadenceLabel[post.updateCadence]}</p>
                                </div>
                                <div className={`rounded-2xl px-4 py-3 ${isDark ? 'bg-[#101522]' : 'bg-[#f8fafc]'}`}>
                                    <p className={`text-[11px] uppercase tracking-[0.2em] ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`}>Checked</p>
                                    <p className={`mt-1 text-sm font-semibold ${isDark ? 'text-white' : 'text-[#0f172a]'}`}>{formatDateTime(post.lastCheckedAt)}</p>
                                </div>
                                <div className={`rounded-2xl px-4 py-3 ${isDark ? 'bg-[#101522]' : 'bg-[#f8fafc]'}`}>
                                    <p className={`text-[11px] uppercase tracking-[0.2em] ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`}>Next</p>
                                    <p className={`mt-1 text-sm font-semibold ${isDark ? 'text-white' : 'text-[#0f172a]'}`}>{formatDateTime(post.nextUpdateAt)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6">
                        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                            <section className="space-y-6">
                                <div className={`rounded-[28px] border p-5 ${isDark ? 'border-[#262d3f] bg-[#101522]' : 'border-[#e2e8f0] bg-[#f8fafc]'}`}>
                                    <div className="flex items-center gap-2">
                                        <Bot size={18} className="text-cyan-400" />
                                        <h3 className={`text-sm font-semibold uppercase tracking-[0.24em] ${isDark ? 'text-[#b8c2db]' : 'text-[#475569]'}`}>AI Summary</h3>
                                    </div>
                                    <p className={`mt-4 text-sm leading-7 ${isDark ? 'text-[#d6dbee]' : 'text-[#334155]'}`}>{post.analysis.summary}</p>
                                    {post.attentionReason && (
                                        <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${isDark ? 'border-rose-400/20 bg-rose-500/10 text-rose-100' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                                            {post.attentionReason}
                                        </div>
                                    )}
                                </div>

                                <div className={`rounded-[28px] border p-5 ${isDark ? 'border-[#262d3f] bg-[#101522]' : 'border-[#e2e8f0] bg-[#f8fafc]'}`}>
                                    <div className="flex items-center gap-2">
                                        <Sparkles size={18} className="text-amber-400" />
                                        <h3 className={`text-sm font-semibold uppercase tracking-[0.24em] ${isDark ? 'text-[#b8c2db]' : 'text-[#475569]'}`}>Sentiment Breakdown</h3>
                                    </div>
                                    <div className="mt-5 space-y-4">
                                        {Object.entries(post.analysis.breakdown).map(([key, value]) => (
                                            <div key={key}>
                                                <div className="mb-2 flex items-center justify-between">
                                                    <span className={`text-sm capitalize ${isDark ? 'text-[#d6dbee]' : 'text-[#334155]'}`}>{key}</span>
                                                    <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-[#0f172a]'}`}>{value}%</span>
                                                </div>
                                                <div className={`h-2 overflow-hidden rounded-full ${isDark ? 'bg-[#1f2738]' : 'bg-[#e2e8f0]'}`}>
                                                    <div className={`h-full rounded-full ${breakdownColor[key]}`} style={{ width: `${value}%` }}></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className={`rounded-[28px] border p-5 ${isDark ? 'border-[#262d3f] bg-[#101522]' : 'border-[#e2e8f0] bg-[#f8fafc]'}`}>
                                    <div className="flex items-center gap-2">
                                        <Send size={18} className="text-emerald-400" />
                                        <h3 className={`text-sm font-semibold uppercase tracking-[0.24em] ${isDark ? 'text-[#b8c2db]' : 'text-[#475569]'}`}>Recommended Actions</h3>
                                    </div>
                                    <div className="mt-4 space-y-3">
                                        {post.analysis.recommendedActions.map((action) => (
                                            <div key={action} className={`rounded-2xl px-4 py-3 text-sm leading-6 ${isDark ? 'bg-[#161e2f] text-[#d6dbee]' : 'bg-white text-[#334155]'}`}>
                                                {action}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>

                            <section className="space-y-6">
                                <div className={`rounded-[28px] border p-5 ${isDark ? 'border-[#262d3f] bg-[#101522]' : 'border-[#e2e8f0] bg-[#f8fafc]'}`}>
                                    <div className="flex items-center gap-2">
                                        <MessageSquare size={18} className="text-fuchsia-400" />
                                        <h3 className={`text-sm font-semibold uppercase tracking-[0.24em] ${isDark ? 'text-[#b8c2db]' : 'text-[#475569]'}`}>Key Comments</h3>
                                    </div>
                                    <div className="mt-4 space-y-3">
                                        {post.analysis.keyComments.map((comment) => (
                                            <div key={comment.id} className={`rounded-2xl border px-4 py-4 ${isDark ? 'border-[#262d3f] bg-[#161e2f]' : 'border-[#e2e8f0] bg-white'}`}>
                                                <div className="flex items-center justify-between gap-3">
                                                    <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-[#0f172a]'}`}>{comment.author}</p>
                                                    {comment.requiresResponse && (
                                                        <span className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] ${isDark ? 'bg-rose-500/15 text-rose-200' : 'bg-rose-100 text-rose-700'}`}>
                                                            Needs response
                                                        </span>
                                                    )}
                                                </div>
                                                <p className={`mt-3 text-sm leading-7 ${isDark ? 'text-[#d6dbee]' : 'text-[#334155]'}`}>{comment.text}</p>
                                                <p className={`mt-3 text-xs uppercase tracking-[0.18em] ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`}>{comment.reason}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className={`rounded-[28px] border p-5 ${isDark ? 'border-[#262d3f] bg-[#101522]' : 'border-[#e2e8f0] bg-[#f8fafc]'}`}>
                                    <h3 className={`text-sm font-semibold uppercase tracking-[0.24em] ${isDark ? 'text-[#b8c2db]' : 'text-[#475569]'}`}>Engagement</h3>
                                    <div className="mt-4 grid grid-cols-2 gap-3">
                                        {[
                                            ['Views', post.engagement.views],
                                            ['Likes', post.engagement.likes],
                                            ['Comments', post.engagement.comments],
                                            ['Shares', post.engagement.shares],
                                        ].map(([label, value]) => (
                                            <div key={label} className={`rounded-2xl px-4 py-4 ${isDark ? 'bg-[#161e2f]' : 'bg-white'}`}>
                                                <p className={`text-[11px] uppercase tracking-[0.2em] ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`}>{label}</p>
                                                <p className={`mt-2 text-xl font-semibold ${isDark ? 'text-white' : 'text-[#0f172a]'}`}>{value.toLocaleString()}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>

                    <div className={`border-t px-6 py-5 ${isDark ? 'border-[#262d3f]' : 'border-[#e2e8f0]'}`}>
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex flex-wrap gap-3">
                                <a
                                    href={post.platformUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm ${isDark ? 'bg-[#161e2f] text-white hover:bg-[#1d2840]' : 'bg-[#f1f5f9] text-[#0f172a] hover:bg-[#e2e8f0]'}`}
                                >
                                    <ExternalLink size={15} />
                                    <span>View on platform</span>
                                </a>
                                <button
                                    type="button"
                                    onClick={() => onRefresh(post.id)}
                                    disabled={isBusy}
                                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm ${isDark ? 'bg-[#243047] text-white hover:bg-[#31415f] disabled:bg-[#1d2230] disabled:text-[#64748b]' : 'bg-[#0f172a] text-white hover:bg-[#1e293b] disabled:bg-[#dbe2ee] disabled:text-[#94a3b8]'}`}
                                >
                                    <RefreshCw size={15} className={isBusy ? 'animate-spin' : ''} />
                                    <span>Refresh AI</span>
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={() => onResolve(post.id)}
                                disabled={isBusy || post.alertStatus === 'resolved'}
                                className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm ${isDark ? 'bg-emerald-400 text-[#062814] hover:bg-emerald-300 disabled:bg-[#1d2230] disabled:text-[#64748b]' : 'bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-[#dbe2ee] disabled:text-[#94a3b8]'}`}
                            >
                                <CheckCircle2 size={15} />
                                <span>{post.alertStatus === 'resolved' ? 'Resolved' : 'Resolve alert'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SocialPostModal;
