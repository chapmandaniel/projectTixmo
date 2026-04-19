import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    Bot,
    CheckCircle2,
    ChevronDown,
    Clock3,
    Facebook,
    Filter,
    Instagram,
    Music,
    RefreshCw,
    Settings2,
    ShieldAlert,
    Sparkles,
    X,
} from 'lucide-react';
import SocialPostCard from './SocialPostCard';
import SocialPostModal from './SocialPostModal';
import { socialCommandCenterApi } from '../lib/socialCommandCenterApi';
import { DashboardChip, DashboardTitleBar } from '../components/dashboard/DashboardPrimitives';

const platformOptions = [
    { id: 'all', label: 'All platforms' },
    { id: 'instagram', label: 'Instagram' },
    { id: 'facebook', label: 'Facebook' },
    { id: 'tiktok', label: 'TikTok' },
];

const statusOptions = [
    { id: 'all', label: 'All posts' },
    { id: 'attention', label: 'Needs attention' },
    { id: 'resolved', label: 'Resolved' },
];

const platformMeta = {
    instagram: { icon: Instagram, label: 'Instagram', className: 'text-pink-300' },
    facebook: { icon: Facebook, label: 'Facebook', className: 'text-sky-300' },
    tiktok: { icon: Music, label: 'TikTok', className: 'text-emerald-300' },
};

const priorityRank = {
    high: 0,
    medium: 1,
    low: 2,
};

const emptyPayload = {
    overview: {
        totalPosts: 0,
        flaggedPosts: 0,
        watchPosts: 0,
        resolvedPosts: 0,
        avgSentimentScore: 0,
        attentionNeeded: 0,
    },
    platformSummary: [],
    alertQueue: [],
    posts: [],
    events: [],
    artists: [],
    settings: {
        hourlyWindowDays: 3,
        dailyWindowDays: 7,
        dailyUpdateHour: 8,
        maxAICallsPerDay: 120,
    },
    limits: {
        hourlyWindowDays: { min: 1, max: 5 },
        dailyWindowDays: { min: 4, max: 14 },
        dailyUpdateHour: { min: 5, max: 11 },
        maxAICallsPerDay: { min: 10, max: 500 },
    },
    aiUsage: {
        usedToday: 0,
        remainingToday: 120,
        maxPerDay: 120,
    },
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

const MonitoringRulesModal = ({
    isDark,
    limits,
    onClose,
    onDraftChange,
    onSave,
    settingsDraft,
    isSaving,
    aiUsage,
}) => (
    <div
        className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label="Monitoring rules"
        onClick={onClose}
    >
        <div
            onClick={(event) => event.stopPropagation()}
            className={`w-full max-w-2xl rounded-md border p-6 shadow-2xl shadow-black/30 ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white'}`}
        >
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className={`text-2xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Monitoring rules</h2>
                    <p className={`mt-2 text-sm leading-6 ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                        Keep the dashboard simple. Only adjust how often AI revisits posts and the daily budget cap.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className={`rounded-full border p-2 transition-colors ${isDark ? 'border-white/10 bg-white/5 text-[#8f94aa] hover:text-white' : 'border-gray-200 bg-gray-50 text-gray-500 hover:text-gray-900'}`}
                    aria-label="Close monitoring rules modal"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
                {[
                    ['hourlyWindowDays', 'Hourly window (days)'],
                    ['dailyWindowDays', 'Daily window (days)'],
                    ['dailyUpdateHour', 'Morning refresh hour (UTC)'],
                    ['maxAICallsPerDay', 'Max AI calls per day'],
                ].map(([field, label]) => (
                    <label key={field} className="block">
                        <span className={`mb-2 block text-xs uppercase tracking-[0.18em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>
                            {label}
                        </span>
                        <input
                            type="number"
                            min={limits[field].min}
                            max={limits[field].max}
                            value={settingsDraft[field]}
                            onChange={(event) => onDraftChange(field, event.target.value)}
                            className={`w-full rounded-md border px-3 py-2.5 text-sm outline-none ${isDark ? 'border-[#2b2b40] bg-[#151521] text-white' : 'border-gray-200 bg-gray-50 text-[#0f172a]'}`}
                        />
                    </label>
                ))}
            </div>

            <div className={`mt-6 rounded-md border p-4 ${isDark ? 'border-[#2b2b40] bg-[#151521]' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className={`text-xs uppercase tracking-[0.18em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>AI budget</p>
                        <p className={`mt-1 text-sm ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                            {aiUsage.remainingToday} calls remaining today
                        </p>
                    </div>
                    <p className={`text-sm font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                        {aiUsage.usedToday} / {aiUsage.maxPerDay}
                    </p>
                </div>
                <div className={`mt-3 h-2 overflow-hidden rounded-full ${isDark ? 'bg-[#0f1320]' : 'bg-gray-200'}`}>
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                        style={{ width: `${Math.min(100, (aiUsage.usedToday / Math.max(1, aiUsage.maxPerDay)) * 100)}%` }}
                    />
                </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
                <button
                    type="button"
                    onClick={onClose}
                    className={`rounded-md border px-4 py-2 text-sm transition-colors ${isDark ? 'border-white/10 bg-white/5 text-[#a1a5b7] hover:text-white' : 'border-gray-200 bg-gray-50 text-gray-600 hover:text-gray-900'}`}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={onSave}
                    disabled={isSaving}
                    className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm transition-colors ${isDark ? 'bg-sky-500 text-white hover:bg-sky-400 disabled:bg-[#1d2230] disabled:text-[#64748b]' : 'bg-gray-900 text-white hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-500'}`}
                >
                    <Settings2 className="h-4 w-4" />
                    {isSaving ? 'Saving...' : 'Save rules'}
                </button>
            </div>
        </div>
    </div>
);

const kpiMeta = [
    {
        key: 'attentionNeeded',
        label: 'Need action',
        accent: 'from-rose-500 to-orange-400',
        icon: ShieldAlert,
        formatter: (payload) => payload.overview.attentionNeeded,
        helper: 'Posts that still need a human decision.',
    },
    {
        key: 'totalPosts',
        label: 'Live coverage',
        accent: 'from-sky-400 to-cyan-500',
        icon: Sparkles,
        formatter: (payload) => payload.overview.totalPosts,
        helper: 'Posts currently in the monitoring pool.',
    },
    {
        key: 'resolvedPosts',
        label: 'Resolved',
        accent: 'from-emerald-400 to-teal-500',
        icon: CheckCircle2,
        formatter: (payload) => payload.overview.resolvedPosts,
        helper: 'Posts already handled by the team.',
    },
    {
        key: 'aiBudget',
        label: 'AI remaining',
        accent: 'from-fuchsia-500 to-violet-500',
        icon: Bot,
        formatter: (payload) => payload.aiUsage.remainingToday,
        helper: (payload) => `${payload.aiUsage.usedToday}/${payload.aiUsage.maxPerDay} used today`,
    },
];

const QueueItem = ({ isDark, post, onOpen, onResolve, isBusy }) => {
    const PlatformIcon = (platformMeta[post.platform] || platformMeta.instagram).icon;

    return (
        <div className={`rounded-md border p-4 ${isDark ? 'border-[#2b2b40] bg-[#151521]' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] ${isDark ? 'bg-rose-500/10 text-rose-200' : 'bg-rose-50 text-rose-700'}`}>
                            <PlatformIcon className="h-3.5 w-3.5" />
                            {(platformMeta[post.platform] || platformMeta.instagram).label}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] ${post.analysis.priority === 'high'
                            ? 'bg-rose-500/10 text-rose-200'
                            : post.analysis.priority === 'medium'
                                ? 'bg-amber-500/10 text-amber-200'
                                : isDark ? 'bg-white/5 text-[#a1a5b7]' : 'bg-gray-100 text-gray-600'
                        }`}>
                            {post.analysis.priority} priority
                        </span>
                    </div>
                    <p className={`mt-3 text-xs uppercase tracking-[0.18em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>{post.eventName}</p>
                    <h3 className={`mt-1 text-lg font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{post.artistName}</h3>
                    <p className={`mt-2 text-sm leading-6 ${isDark ? 'text-[#d7d9e4]' : 'text-gray-600'}`}>
                        {post.attentionReason || post.analysis.summary}
                    </p>
                </div>
                <div className={`rounded-md px-3 py-2 text-right ${isDark ? 'bg-[#1e1e2d]' : 'bg-white'}`}>
                    <p className={`text-[10px] uppercase tracking-[0.18em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>Next check</p>
                    <p className={`mt-2 text-xs font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{formatDateTime(post.nextUpdateAt)}</p>
                </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={() => onOpen(post.id)}
                    className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${isDark ? 'bg-sky-500 text-white hover:bg-sky-400' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                >
                    Review
                </button>
                <button
                    type="button"
                    onClick={() => onResolve(post.id)}
                    disabled={isBusy || post.alertStatus === 'resolved'}
                    className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${isDark ? 'border border-white/10 bg-white/5 text-gray-100 hover:border-emerald-400/30 hover:bg-emerald-500/10 disabled:border-[#2b2b40] disabled:text-[#5e6278]' : 'border border-gray-200 bg-white text-gray-800 hover:border-emerald-200 hover:bg-emerald-50 disabled:text-gray-400'}`}
                >
                    {post.alertStatus === 'resolved' ? 'Resolved' : 'Resolve'}
                </button>
            </div>
        </div>
    );
};

const SocialDashboard = ({ isDark }) => {
    const [payload, setPayload] = useState(emptyPayload);
    const [selectedEventId, setSelectedEventId] = useState('all');
    const [selectedPlatform, setSelectedPlatform] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [selectedPostId, setSelectedPostId] = useState(null);
    const [settingsDraft, setSettingsDraft] = useState(emptyPayload.settings);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [busyPostId, setBusyPostId] = useState(null);
    const [error, setError] = useState('');
    const [isAutomationModalOpen, setIsAutomationModalOpen] = useState(false);

    const loadCommandCenter = async ({ background = false } = {}) => {
        try {
            if (background) {
                setIsRefreshing(true);
            } else {
                setIsLoading(true);
            }
            setError('');

            const data = await socialCommandCenterApi.getCommandCenter();
            setPayload(data);
            setSettingsDraft(data.settings);
        } catch (requestError) {
            setError(requestError?.response?.data?.error || requestError?.message || 'Failed to load social command center.');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        loadCommandCenter();
    }, []);

    const filteredPosts = useMemo(
        () =>
            payload.posts.filter((post) => {
                const eventMatch = selectedEventId === 'all' || post.eventId === selectedEventId;
                const platformMatch = selectedPlatform === 'all' || post.platform === selectedPlatform;
                const statusMatch = (() => {
                    if (selectedStatus === 'attention') {
                        return post.analysis.needsAttention && post.alertStatus !== 'resolved';
                    }

                    if (selectedStatus === 'resolved') {
                        return post.alertStatus === 'resolved';
                    }

                    return true;
                })();

                return eventMatch && platformMatch && statusMatch;
            }),
        [payload.posts, selectedEventId, selectedPlatform, selectedStatus]
    );

    const actionQueue = useMemo(
        () =>
            payload.alertQueue
                .filter((post) => {
                    const eventMatch = selectedEventId === 'all' || post.eventId === selectedEventId;
                    const platformMatch = selectedPlatform === 'all' || post.platform === selectedPlatform;
                    return eventMatch && platformMatch;
                })
                .sort((left, right) => {
                    const priorityGap =
                        (priorityRank[left.analysis.priority] ?? 3) - (priorityRank[right.analysis.priority] ?? 3);

                    if (priorityGap !== 0) {
                        return priorityGap;
                    }

                    return new Date(left.nextUpdateAt || 0).getTime() - new Date(right.nextUpdateAt || 0).getTime();
                }),
        [payload.alertQueue, selectedEventId, selectedPlatform]
    );

    const selectedPost = payload.posts.find((post) => post.id === selectedPostId) || null;

    const handleRefreshPost = async (postId) => {
        setBusyPostId(postId);
        try {
            setError('');
            await socialCommandCenterApi.refreshPost(postId);
            await loadCommandCenter({ background: true });
        } catch (requestError) {
            setError(requestError?.response?.data?.error || requestError?.message || 'Failed to refresh post.');
        } finally {
            setBusyPostId(null);
        }
    };

    const handleResolvePost = async (postId) => {
        setBusyPostId(postId);
        try {
            setError('');
            await socialCommandCenterApi.resolvePost(postId);
            await loadCommandCenter({ background: true });
        } catch (requestError) {
            setError(requestError?.response?.data?.error || requestError?.message || 'Failed to resolve post.');
        } finally {
            setBusyPostId(null);
        }
    };

    const handleSaveSettings = async () => {
        setIsSavingSettings(true);
        try {
            setError('');
            const nextSettings = {
                hourlyWindowDays: Number(settingsDraft.hourlyWindowDays),
                dailyWindowDays: Number(settingsDraft.dailyWindowDays),
                dailyUpdateHour: Number(settingsDraft.dailyUpdateHour),
                maxAICallsPerDay: Number(settingsDraft.maxAICallsPerDay),
            };

            const data = await socialCommandCenterApi.updateSettings(nextSettings);
            setPayload(data);
            setSettingsDraft(data.settings);
            setIsAutomationModalOpen(false);
        } catch (requestError) {
            setError(requestError?.response?.data?.error || requestError?.message || 'Failed to save monitoring rules.');
        } finally {
            setIsSavingSettings(false);
        }
    };

    const aiBudgetPercent = Math.min(
        100,
        (payload.aiUsage.usedToday / Math.max(1, payload.aiUsage.maxPerDay)) * 100
    );

    return (
        <div className="space-y-8 animate-fade-in max-w-[1500px] mx-auto pb-12">
            {selectedPost && (
                <SocialPostModal
                    post={selectedPost}
                    onClose={() => setSelectedPostId(null)}
                    onResolve={handleResolvePost}
                    onRefresh={handleRefreshPost}
                    isBusy={busyPostId === selectedPost.id}
                    isDark={isDark}
                />
            )}

            {isAutomationModalOpen && (
                <MonitoringRulesModal
                    isDark={isDark}
                    limits={payload.limits}
                    onClose={() => setIsAutomationModalOpen(false)}
                    onDraftChange={(field, value) =>
                        setSettingsDraft((current) => ({
                            ...current,
                            [field]: value,
                        }))
                    }
                    onSave={handleSaveSettings}
                    settingsDraft={settingsDraft}
                    isSaving={isSavingSettings}
                    aiUsage={payload.aiUsage}
                />
            )}

            <DashboardTitleBar
                isDark={isDark}
                title="Social Command Center"
                description="A calmer operating view for social monitoring. Triage what needs action, keep tabs on live coverage, and adjust automation only when the cadence actually needs to change."
                icon={Sparkles}
                iconClassName={isDark ? 'text-cyan-300' : 'text-sky-700'}
                glowTopClassName="bg-cyan-400/10"
                glowBottomClassName="bg-sky-500/10"
                badges={(
                    <>
                        <DashboardChip isDark={isDark} className="uppercase tracking-[0.2em]">
                            {filteredPosts.length} posts in view
                        </DashboardChip>
                        {isRefreshing ? (
                            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${isDark ? 'border-sky-400/20 bg-sky-500/10 text-sky-200' : 'border-sky-200 bg-sky-50 text-sky-700'}`}>
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                Syncing
                            </span>
                        ) : null}
                    </>
                )}
                actions={(
                    <>
                        <div className={`flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm font-light ${isDark ? 'border-[#2b2b40] bg-[#151521] text-gray-100' : 'border-gray-200 bg-gray-50 text-gray-800'}`}>
                            <Filter className={`h-4 w-4 ${isDark ? 'text-[#5e6278]' : 'text-gray-400'}`} />
                            <select
                                aria-label="Social event filter"
                                value={selectedEventId}
                                onChange={(event) => setSelectedEventId(event.target.value)}
                                className="min-w-[11rem] bg-transparent outline-none"
                            >
                                <option value="all">All events</option>
                                {payload.events.map((event) => (
                                    <option key={event.id} value={event.id}>
                                        {event.name}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className={`h-4 w-4 ${isDark ? 'text-[#5e6278]' : 'text-gray-400'}`} />
                        </div>

                        <div className={`flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm font-light ${isDark ? 'border-[#2b2b40] bg-[#151521] text-gray-100' : 'border-gray-200 bg-gray-50 text-gray-800'}`}>
                            <Sparkles className={`h-4 w-4 ${isDark ? 'text-[#5e6278]' : 'text-gray-400'}`} />
                            <select
                                aria-label="Social platform filter"
                                value={selectedPlatform}
                                onChange={(event) => setSelectedPlatform(event.target.value)}
                                className="min-w-[10rem] bg-transparent outline-none"
                            >
                                {platformOptions.map((platform) => (
                                    <option key={platform.id} value={platform.id}>
                                        {platform.label}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className={`h-4 w-4 ${isDark ? 'text-[#5e6278]' : 'text-gray-400'}`} />
                        </div>

                        <div className={`flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm font-light ${isDark ? 'border-[#2b2b40] bg-[#151521] text-gray-100' : 'border-gray-200 bg-gray-50 text-gray-800'}`}>
                            <ShieldAlert className={`h-4 w-4 ${isDark ? 'text-[#5e6278]' : 'text-gray-400'}`} />
                            <select
                                aria-label="Social status filter"
                                value={selectedStatus}
                                onChange={(event) => setSelectedStatus(event.target.value)}
                                className="min-w-[10rem] bg-transparent outline-none"
                            >
                                {statusOptions.map((option) => (
                                    <option key={option.id} value={option.id}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className={`h-4 w-4 ${isDark ? 'text-[#5e6278]' : 'text-gray-400'}`} />
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsAutomationModalOpen(true)}
                            className={`inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm transition-colors ${isDark ? 'border border-white/10 bg-white/5 text-gray-100 hover:border-sky-400/30 hover:bg-sky-500/10' : 'border border-gray-200 bg-white text-gray-800 hover:border-gray-300 hover:bg-gray-50'}`}
                        >
                            <Settings2 className="h-4 w-4" />
                            Monitoring rules
                        </button>

                        <button
                            type="button"
                            onClick={() => loadCommandCenter({ background: true })}
                            className={`inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm transition-colors ${isDark ? 'bg-sky-500 text-white hover:bg-sky-400' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                        >
                            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            Refresh feed
                        </button>
                    </>
                )}
            />

            {error && (
                <div className={`rounded-md border px-4 py-3 text-sm font-light ${isDark ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                    {error}
                </div>
            )}

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {kpiMeta.map((stat) => {
                    const Icon = stat.icon;
                    const helperText = typeof stat.helper === 'function' ? stat.helper(payload) : stat.helper;

                    return (
                        <div key={stat.key} className={`relative overflow-hidden rounded-md border p-5 ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white shadow-sm'}`}>
                            <div className={`absolute left-0 top-0 h-[3px] w-full bg-gradient-to-r ${stat.accent}`} />
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className={`text-xs uppercase tracking-[0.18em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>{stat.label}</p>
                                    <p className={`mt-3 text-3xl font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{stat.formatter(payload)}</p>
                                    <p className={`mt-2 text-sm leading-6 ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>{helperText}</p>
                                </div>
                                <div className={`flex h-11 w-11 items-center justify-center rounded-md bg-gradient-to-br text-[#08111f] ${stat.accent}`}>
                                    <Icon size={18} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                <section className={`rounded-md border p-5 ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white shadow-sm'}`}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                        <div>
                            <h3 className={`text-2xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Monitoring board</h3>
                            <p className={`mt-1 text-sm font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                                Clean coverage cards for the posts inside your current scope.
                            </p>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${isDark ? 'border-white/10 bg-white/5 text-[#8f94aa]' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                            {filteredPosts.length} posts
                        </span>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                        {isLoading &&
                            Array.from({ length: 6 }, (_, index) => (
                                <div
                                    key={index}
                                    className={`h-[23rem] animate-pulse rounded-md ${isDark ? 'bg-[#151521]' : 'bg-[#f8fafc]'}`}
                                />
                            ))}

                        {!isLoading &&
                            filteredPosts.map((post) => (
                                <SocialPostCard
                                    key={post.id}
                                    post={post}
                                    onOpen={setSelectedPostId}
                                    onRefresh={handleRefreshPost}
                                    isBusy={busyPostId === post.id}
                                    isDark={isDark}
                                />
                            ))}
                    </div>

                    {!isLoading && filteredPosts.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 opacity-70">
                            <Filter className={isDark ? 'h-10 w-10 text-[#4f5972]' : 'h-10 w-10 text-[#94a3b8]'} />
                            <p className={`mt-4 text-sm ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`}>No posts match the current scope.</p>
                        </div>
                    )}
                </section>

                <aside className="space-y-4">
                    <section className={`rounded-md border p-5 ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white shadow-sm'}`}>
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h3 className={`text-lg font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Action queue</h3>
                                <p className={`mt-1 text-sm font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                                    The few issues worth opening first.
                                </p>
                            </div>
                            <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${isDark ? 'border-white/10 bg-white/5 text-[#8f94aa]' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                                {actionQueue.length}
                            </span>
                        </div>

                        <div className="mt-4 space-y-3">
                            {isLoading && (
                                Array.from({ length: 3 }, (_, index) => (
                                    <div
                                        key={index}
                                        className={`h-40 animate-pulse rounded-md ${isDark ? 'bg-[#151521]' : 'bg-gray-50'}`}
                                    />
                                ))
                            )}

                            {!isLoading && actionQueue.length === 0 && (
                                <div className={`rounded-md border border-dashed px-4 py-8 text-sm font-light ${isDark ? 'border-[#2b2b40] bg-[#151521] text-[#a1a5b7]' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                                    Nothing urgent in the current scope.
                                </div>
                            )}

                            {!isLoading &&
                                actionQueue.map((post) => (
                                    <QueueItem
                                        key={post.id}
                                        isDark={isDark}
                                        post={post}
                                        onOpen={setSelectedPostId}
                                        onResolve={handleResolvePost}
                                        isBusy={busyPostId === post.id}
                                    />
                                ))}
                        </div>
                    </section>

                    <section className={`rounded-md border p-5 ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white shadow-sm'}`}>
                        <div className="flex items-center gap-2">
                            <Settings2 className="h-4 w-4 text-amber-400" />
                            <h3 className={`text-lg font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Automation</h3>
                        </div>

                        <div className={`mt-4 rounded-md border p-4 ${isDark ? 'border-[#2b2b40] bg-[#151521]' : 'border-gray-200 bg-gray-50'}`}>
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className={`text-xs uppercase tracking-[0.18em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>Coverage cadence</p>
                                    <p className={`mt-2 text-sm leading-6 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                                        Hourly for {payload.settings.hourlyWindowDays} days, then daily until day {payload.settings.dailyWindowDays}.
                                    </p>
                                </div>
                                <Clock3 className={`h-5 w-5 shrink-0 ${isDark ? 'text-cyan-300' : 'text-sky-700'}`} />
                            </div>
                        </div>

                        <div className={`mt-3 rounded-md border p-4 ${isDark ? 'border-[#2b2b40] bg-[#151521]' : 'border-gray-200 bg-gray-50'}`}>
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className={`text-xs uppercase tracking-[0.18em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>AI budget</p>
                                    <p className={`mt-2 text-sm leading-6 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                                        {payload.aiUsage.remainingToday} calls left before manual refreshes pause.
                                    </p>
                                </div>
                                <Bot className={`h-5 w-5 shrink-0 ${isDark ? 'text-fuchsia-300' : 'text-fuchsia-700'}`} />
                            </div>
                            <div className={`mt-3 h-2 overflow-hidden rounded-full ${isDark ? 'bg-[#0f1320]' : 'bg-gray-200'}`}>
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                                    style={{ width: `${aiBudgetPercent}%` }}
                                />
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsAutomationModalOpen(true)}
                            className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm transition-colors ${isDark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                        >
                            <Settings2 className="h-4 w-4" />
                            Edit monitoring rules
                        </button>
                    </section>
                </aside>
            </section>
        </div>
    );
};

export default SocialDashboard;
