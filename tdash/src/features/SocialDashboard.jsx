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
} from 'lucide-react';
import SocialPostCard from './SocialPostCard';
import SocialPostModal from './SocialPostModal';
import { socialCommandCenterApi } from '../lib/socialCommandCenterApi';

const platformOptions = [
    { id: 'all', label: 'All platforms', icon: Sparkles },
    { id: 'instagram', label: 'Instagram', icon: Instagram },
    { id: 'facebook', label: 'Facebook', icon: Facebook },
    { id: 'tiktok', label: 'TikTok', icon: Music },
];

const statMeta = [
    { key: 'attentionNeeded', label: 'Need Attention', icon: ShieldAlert, accent: 'from-rose-500 to-orange-400' },
    { key: 'flaggedPosts', label: 'Flagged', icon: AlertTriangle, accent: 'from-amber-400 to-rose-500' },
    { key: 'avgSentimentScore', label: 'Avg Sentiment', icon: Bot, accent: 'from-cyan-400 to-sky-500' },
    { key: 'resolvedPosts', label: 'Resolved', icon: CheckCircle2, accent: 'from-emerald-400 to-teal-500' },
];

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

const SocialDashboard = ({ isDark }) => {
    const [payload, setPayload] = useState(emptyPayload);
    const [selectedEventId, setSelectedEventId] = useState('all');
    const [selectedArtistId, setSelectedArtistId] = useState('all');
    const [selectedPlatform, setSelectedPlatform] = useState('all');
    const [flaggedOnly, setFlaggedOnly] = useState(false);
    const [selectedPostId, setSelectedPostId] = useState(null);
    const [settingsDraft, setSettingsDraft] = useState(emptyPayload.settings);
    const [isLoading, setIsLoading] = useState(true);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [busyPostId, setBusyPostId] = useState(null);

    const loadCommandCenter = async () => {
        setIsLoading(true);
        try {
            const data = await socialCommandCenterApi.getCommandCenter();
            setPayload(data);
            setSettingsDraft(data.settings);
        } catch (error) {
            console.error('Failed to load social command center', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadCommandCenter();
    }, []);

    const availableArtists = useMemo(() => {
        if (selectedEventId === 'all') {
            return payload.artists;
        }

        return payload.artists.filter((artist) => artist.eventIds.includes(selectedEventId));
    }, [payload.artists, selectedEventId]);

    const filteredPosts = useMemo(() => payload.posts.filter((post) => {
        const eventMatch = selectedEventId === 'all' || post.eventId === selectedEventId;
        const artistMatch = selectedArtistId === 'all' || post.artistId === selectedArtistId;
        const platformMatch = selectedPlatform === 'all' || post.platform === selectedPlatform;
        const statusMatch = !flaggedOnly || (post.analysis.needsAttention && post.alertStatus !== 'resolved');

        return eventMatch && artistMatch && platformMatch && statusMatch;
    }), [payload.posts, selectedEventId, selectedArtistId, selectedPlatform, flaggedOnly]);

    const selectedPost = payload.posts.find((post) => post.id === selectedPostId) || null;

    const handleEventChange = (event) => {
        setSelectedEventId(event.target.value);
        setSelectedArtistId('all');
    };

    const handleRefreshPost = async (postId) => {
        setBusyPostId(postId);
        try {
            await socialCommandCenterApi.refreshPost(postId);
            await loadCommandCenter();
        } catch (error) {
            console.error('Failed to refresh post', error);
        } finally {
            setBusyPostId(null);
        }
    };

    const handleResolvePost = async (postId) => {
        setBusyPostId(postId);
        try {
            await socialCommandCenterApi.resolvePost(postId);
            await loadCommandCenter();
        } catch (error) {
            console.error('Failed to resolve post', error);
        } finally {
            setBusyPostId(null);
        }
    };

    const handleSaveSettings = async () => {
        setIsSavingSettings(true);
        try {
            const nextSettings = {
                hourlyWindowDays: Number(settingsDraft.hourlyWindowDays),
                dailyWindowDays: Number(settingsDraft.dailyWindowDays),
                dailyUpdateHour: Number(settingsDraft.dailyUpdateHour),
                maxAICallsPerDay: Number(settingsDraft.maxAICallsPerDay),
            };

            const data = await socialCommandCenterApi.updateSettings(nextSettings);
            setPayload(data);
            setSettingsDraft(data.settings);
        } catch (error) {
            console.error('Failed to save social settings', error);
        } finally {
            setIsSavingSettings(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in max-w-[1520px] mx-auto pb-12">
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

            <section className={`relative overflow-hidden rounded-md border p-6 sm:p-8 ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40] shadow-2xl shadow-black/20' : 'bg-white border-gray-200 shadow-sm'}`}>
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
                    <div className="absolute left-10 bottom-0 h-40 w-40 rounded-full bg-rose-400/10 blur-3xl" />
                </div>
                <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h2 className={`flex flex-wrap items-baseline gap-3 text-3xl sm:text-4xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                            <span className="inline-flex items-center gap-2">
                                <span>Social Command Center</span>
                                <Sparkles className={`h-6 w-6 sm:h-7 sm:w-7 ${isDark ? 'text-cyan-300' : 'text-sky-700'}`} />
                            </span>
                        </h2>
                        <p className={`mt-3 max-w-3xl text-sm leading-7 ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                            Monitor sentiment, surface posts that need intervention, and keep your AI review cadence under control from one operating view.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={loadCommandCenter}
                        className={`inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm transition-colors ${isDark ? 'bg-sky-500 text-white hover:bg-sky-400' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                    >
                        <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
                        <span>Reload feed</span>
                    </button>
                </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {statMeta.map((stat) => {
                    const Icon = stat.icon;
                    const rawValue = payload.overview[stat.key];
                    const value = stat.key === 'avgSentimentScore' ? Number(rawValue || 0).toFixed(1) : rawValue;

                    return (
                        <div key={stat.key} className={`relative overflow-hidden rounded-md border p-5 ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white shadow-sm'}`}>
                            <div className={`absolute left-0 top-0 h-[3px] w-full bg-gradient-to-r ${stat.accent}`} />
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className={`text-xs uppercase tracking-[0.18em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>{stat.label}</p>
                                    <p className={`mt-3 text-3xl font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{value}</p>
                                </div>
                                <div className={`flex h-11 w-11 items-center justify-center rounded-md bg-gradient-to-br text-[#08111f] ${stat.accent}`}>
                                    <Icon size={18} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
                <aside className="space-y-4">
                    <section className={`rounded-md border p-5 ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white shadow-sm'}`}>
                        <div className="flex items-center gap-2">
                            <Filter size={16} className={isDark ? 'text-cyan-300' : 'text-sky-700'} />
                            <h3 className={`text-lg font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Filters</h3>
                        </div>

                        <div className="mt-4 space-y-4">
                            <label className="block">
                                <span className={`mb-2 block text-xs uppercase tracking-[0.18em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>Event</span>
                                <div className={`relative flex items-center rounded-md border px-3 py-2.5 ${isDark ? 'border-[#2b2b40] bg-[#151521]' : 'border-gray-200 bg-gray-50'}`}>
                                    <select
                                        value={selectedEventId}
                                        onChange={handleEventChange}
                                        className={`w-full appearance-none bg-transparent pr-8 text-sm outline-none ${isDark ? 'text-gray-100' : 'text-gray-900'}`}
                                    >
                                        <option value="all">All events</option>
                                        {payload.events.map((event) => (
                                            <option key={event.id} value={event.id}>{event.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={16} className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`} />
                                </div>
                            </label>

                            <label className="block">
                                <span className={`mb-2 block text-xs uppercase tracking-[0.18em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>Artist</span>
                                <div className={`relative flex items-center rounded-md border px-3 py-2.5 ${isDark ? 'border-[#2b2b40] bg-[#151521]' : 'border-gray-200 bg-gray-50'}`}>
                                    <select
                                        value={selectedArtistId}
                                        onChange={(event) => setSelectedArtistId(event.target.value)}
                                        className={`w-full appearance-none bg-transparent pr-8 text-sm outline-none ${isDark ? 'text-gray-100' : 'text-gray-900'}`}
                                    >
                                        <option value="all">All artists</option>
                                        {availableArtists.map((artist) => (
                                            <option key={artist.id} value={artist.id}>{artist.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={16} className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`} />
                                </div>
                            </label>

                            <div>
                                <span className={`mb-2 block text-xs uppercase tracking-[0.18em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>Platform</span>
                                <div className="flex flex-wrap gap-2">
                                    {platformOptions.map((platform) => (
                                        <button
                                            key={platform.id}
                                            type="button"
                                            onClick={() => setSelectedPlatform(platform.id)}
                                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors ${selectedPlatform === platform.id
                                                ? (isDark ? 'border-sky-400/30 bg-sky-500/10 text-white' : 'border-gray-900 bg-gray-900 text-white')
                                                : (isDark ? 'border-[#2b2b40] bg-[#151521] text-[#8a93ae] hover:text-white' : 'border-gray-200 bg-gray-50 text-gray-600 hover:text-gray-900')
                                            }`}
                                        >
                                            <platform.icon size={14} />
                                            <span>{platform.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setFlaggedOnly((current) => !current)}
                                className={`inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm transition-colors ${flaggedOnly
                                    ? (isDark ? 'border-rose-400/30 bg-rose-500/10 text-rose-100' : 'border-rose-200 bg-rose-50 text-rose-700')
                                    : (isDark ? 'border-[#2b2b40] bg-[#151521] text-[#8a93ae]' : 'border-gray-200 bg-gray-50 text-gray-600')
                                }`}
                            >
                                <AlertTriangle size={14} />
                                <span>Attention only</span>
                            </button>
                        </div>
                    </section>

                    <section className={`rounded-md border p-5 ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white shadow-sm'}`}>
                        <div className="flex items-center gap-2">
                            <Settings2 size={16} className="text-amber-400" />
                            <h3 className={`text-lg font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Automation</h3>
                        </div>
                        <p className={`mt-2 text-sm font-light leading-6 ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                            Hourly for posts under {settingsDraft.hourlyWindowDays} days, morning refresh for posts under {settingsDraft.dailyWindowDays} days, and on-demand beyond that.
                        </p>

                        <div className="mt-4 grid gap-3">
                            {[
                                ['hourlyWindowDays', 'Hourly window (days)'],
                                ['dailyWindowDays', 'Daily window (days)'],
                                ['dailyUpdateHour', 'Morning update hour (UTC)'],
                                ['maxAICallsPerDay', 'Max AI calls / day'],
                            ].map(([field, label]) => (
                                <label key={field} className="block">
                                    <span className={`mb-2 block text-xs uppercase tracking-[0.16em] ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`}>{label}</span>
                                    <input
                                        type="number"
                                        min={payload.limits[field].min}
                                        max={payload.limits[field].max}
                                        value={settingsDraft[field]}
                                        onChange={(event) => setSettingsDraft((current) => ({
                                            ...current,
                                            [field]: event.target.value,
                                        }))}
                                        className={`w-full rounded-md border px-3 py-2.5 text-sm outline-none ${isDark ? 'border-[#2b2b40] bg-[#151521] text-white' : 'border-gray-200 bg-gray-50 text-[#0f172a]'}`}
                                    />
                                </label>
                            ))}
                        </div>

                        <div className={`mt-4 rounded-md border p-4 ${isDark ? 'border-[#2b2b40] bg-[#151521]' : 'border-gray-200 bg-gray-50'}`}>
                            <div className="flex items-center justify-between">
                                <span className={`text-xs uppercase tracking-[0.18em] ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`}>AI budget</span>
                                <span className={`text-sm font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{payload.aiUsage.usedToday} / {payload.aiUsage.maxPerDay}</span>
                            </div>
                            <div className={`mt-3 h-2 overflow-hidden rounded-full ${isDark ? 'bg-[#111521]' : 'bg-[#e2e8f0]'}`}>
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                                    style={{ width: `${Math.min(100, (payload.aiUsage.usedToday / Math.max(1, payload.aiUsage.maxPerDay)) * 100)}%` }}
                                ></div>
                            </div>
                            <p className={`mt-3 text-sm font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                                {payload.aiUsage.remainingToday} calls remaining before the cap blocks manual refreshes.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={handleSaveSettings}
                            disabled={isSavingSettings}
                            className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm transition-colors ${isDark ? 'bg-emerald-400 text-[#062814] hover:bg-emerald-300 disabled:bg-[#1d2230] disabled:text-[#64748b]' : 'bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-[#dbe2ee] disabled:text-[#94a3b8]'}`}
                        >
                            <Clock3 size={15} />
                            <span>{isSavingSettings ? 'Saving...' : 'Save controls'}</span>
                        </button>
                    </section>

                    <section className={`rounded-md border p-5 ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white shadow-sm'}`}>
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h3 className={`text-lg font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Flagged queue</h3>
                                <p className={`mt-1 text-sm font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>Posts that need a decision soon.</p>
                            </div>
                            <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${isDark ? 'border border-white/10 bg-white/5 text-[#8a93ae]' : 'border border-gray-200 bg-gray-50 text-[#64748b]'}`}>
                                {payload.alertQueue.length}
                            </span>
                        </div>

                        <div className="mt-4 space-y-3">
                            {payload.alertQueue.length === 0 ? (
                                <div className={`rounded-md border border-dashed px-4 py-8 text-sm font-light ${isDark ? 'border-[#2b2b40] bg-[#151521] text-[#a1a5b7]' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                                    No active alerts right now.
                                </div>
                            ) : payload.alertQueue.map((post) => (
                                <button
                                    key={post.id}
                                    type="button"
                                    onClick={() => setSelectedPostId(post.id)}
                                    className={`w-full rounded-md border p-4 text-left transition-colors ${isDark ? 'border-[#2b2b40] bg-[#151521] hover:border-[#445070]' : 'border-gray-200 bg-gray-50 hover:border-[#bcc8df]'}`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className={`text-xs uppercase tracking-[0.16em] ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`}>{post.eventName}</p>
                                            <h4 className={`mt-2 text-base font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{post.artistName}</h4>
                                            <p className={`mt-2 text-sm leading-6 ${isDark ? 'text-[#d6dbee]' : 'text-[#334155]'}`}>{post.attentionReason || post.analysis.summary}</p>
                                        </div>
                                        <div className={`rounded-md px-3 py-2 text-center ${isDark ? 'bg-[#1e1e2d]' : 'bg-white'}`}>
                                            <p className={`text-[10px] uppercase tracking-[0.16em] ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`}>Next</p>
                                            <p className={`mt-2 text-xs font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{formatDateTime(post.nextUpdateAt)}</p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>
                </aside>

                <section className={`rounded-md border p-5 ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white shadow-sm'}`}>
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <h3 className={`text-2xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Feed grid</h3>
                            <p className={`mt-1 text-sm font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                                Cross-event social monitoring with AI refresh and modal drill-in.
                            </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${isDark ? 'border border-white/10 bg-white/5 text-[#8a93ae]' : 'border border-gray-200 bg-gray-50 text-[#64748b]'}`}>
                            {filteredPosts.length} posts
                        </span>
                    </div>

                    <div className="mt-6 grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
                        {isLoading && Array.from({ length: 3 }).map((_, index) => (
                            <div key={index} className={`h-[31rem] animate-pulse rounded-md ${isDark ? 'bg-[#151521]' : 'bg-[#f8fafc]'}`}></div>
                        ))}

                        {!isLoading && filteredPosts.map((post) => (
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
                            <Filter size={42} className={isDark ? 'text-[#4f5972]' : 'text-[#94a3b8]'} />
                            <p className={`mt-4 text-sm ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`}>No posts match the current filters.</p>
                        </div>
                    )}
                </section>
            </section>
        </div>
    );
};

export default SocialDashboard;
