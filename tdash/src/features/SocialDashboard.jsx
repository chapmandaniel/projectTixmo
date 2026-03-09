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
        <div className="space-y-8 animate-fade-in max-w-[1520px] mx-auto">
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

            <div className="grid gap-6 xl:grid-cols-[1.55fr_0.9fr]">
                <section className={`relative overflow-hidden rounded-[32px] border p-7 ${isDark ? 'border-[#2d3348] bg-[#171b28]' : 'border-[#d7deea] bg-white'}`}>
                    <div className={`absolute right-[-4rem] top-[-5rem] h-48 w-48 rounded-full blur-3xl ${isDark ? 'bg-cyan-400/15' : 'bg-sky-200/60'}`}></div>
                    <div className={`absolute bottom-[-5rem] left-[-2rem] h-48 w-48 rounded-full blur-3xl ${isDark ? 'bg-rose-400/10' : 'bg-orange-200/60'}`}></div>

                    <div className="relative">
                        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                            <div>
                                <p className={`text-xs uppercase tracking-[0.32em] ${isDark ? 'text-cyan-300/80' : 'text-sky-600'}`}>Social Command Center</p>
                                <h2 className={`mt-3 text-4xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-[#0f172a]'}`}>Monitor sentiment, triage risk, and respond faster.</h2>
                                <p className={`mt-4 max-w-2xl text-base leading-8 ${isDark ? 'text-[#bcc5dc]' : 'text-[#475569]'}`}>
                                    Development mode is using mocked Facebook, Instagram, and TikTok feed responses. AI analysis can refresh through the backend and respects the daily call cap below.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={loadCommandCenter}
                                className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm ${isDark ? 'bg-[#243047] text-white hover:bg-[#31415f]' : 'bg-[#0f172a] text-white hover:bg-[#1e293b]'}`}
                            >
                                <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
                                <span>Reload feed</span>
                            </button>
                        </div>

                        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            {statMeta.map((stat) => {
                                const Icon = stat.icon;
                                return (
                                    <div key={stat.key} className={`rounded-[24px] border p-5 ${isDark ? 'border-[#2a3144] bg-[#111521]' : 'border-[#e8ebf2] bg-[#f8fafc]'}`}>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className={`text-xs uppercase tracking-[0.24em] ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`}>{stat.label}</p>
                                                <p className={`mt-3 text-4xl font-semibold ${isDark ? 'text-white' : 'text-[#0f172a]'}`}>{payload.overview[stat.key]}</p>
                                            </div>
                                            <div className={`rounded-2xl bg-gradient-to-br p-3 text-[#08111f] ${stat.accent}`}>
                                                <Icon size={20} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                <aside className={`rounded-[32px] border p-6 ${isDark ? 'border-[#2d3348] bg-[#171b28]' : 'border-[#d7deea] bg-white'}`}>
                    <div className="flex items-center gap-2">
                        <Settings2 size={18} className="text-amber-400" />
                        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-[#0f172a]'}`}>Admin Controls</h3>
                    </div>
                    <p className={`mt-3 text-sm leading-7 ${isDark ? 'text-[#bcc5dc]' : 'text-[#475569]'}`}>
                        Hourly for posts under {settingsDraft.hourlyWindowDays} days, morning refresh for posts under {settingsDraft.dailyWindowDays} days, and on-demand beyond that.
                    </p>

                    <div className="mt-6 space-y-4">
                        {[
                            ['hourlyWindowDays', 'Hourly window (days)'],
                            ['dailyWindowDays', 'Daily window (days)'],
                            ['dailyUpdateHour', 'Morning update hour (UTC)'],
                            ['maxAICallsPerDay', 'Max AI calls / day'],
                        ].map(([field, label]) => (
                            <label key={field} className="block">
                                <span className={`mb-2 block text-xs uppercase tracking-[0.22em] ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`}>{label}</span>
                                <input
                                    type="number"
                                    min={payload.limits[field].min}
                                    max={payload.limits[field].max}
                                    value={settingsDraft[field]}
                                    onChange={(event) => setSettingsDraft((current) => ({
                                        ...current,
                                        [field]: event.target.value,
                                    }))}
                                    className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${isDark ? 'border-[#2a3144] bg-[#111521] text-white' : 'border-[#dbe2ee] bg-[#f8fafc] text-[#0f172a]'}`}
                                />
                                <span className={`mt-2 block text-xs ${isDark ? 'text-[#68728d]' : 'text-[#94a3b8]'}`}>Allowed range: {payload.limits[field].min} to {payload.limits[field].max}</span>
                            </label>
                        ))}
                    </div>

                    <div className={`mt-6 rounded-[24px] border p-4 ${isDark ? 'border-[#2a3144] bg-[#111521]' : 'border-[#e8ebf2] bg-[#f8fafc]'}`}>
                        <div className="flex items-center justify-between">
                            <span className={`text-xs uppercase tracking-[0.22em] ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`}>AI budget</span>
                            <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-[#0f172a]'}`}>{payload.aiUsage.usedToday} / {payload.aiUsage.maxPerDay}</span>
                        </div>
                        <div className={`mt-3 h-2 overflow-hidden rounded-full ${isDark ? 'bg-[#1f2738]' : 'bg-[#e2e8f0]'}`}>
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                                style={{ width: `${Math.min(100, (payload.aiUsage.usedToday / Math.max(1, payload.aiUsage.maxPerDay)) * 100)}%` }}
                            ></div>
                        </div>
                        <p className={`mt-3 text-sm ${isDark ? 'text-[#bcc5dc]' : 'text-[#475569]'}`}>
                            {payload.aiUsage.remainingToday} calls remaining before the cap blocks manual refreshes.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={handleSaveSettings}
                        disabled={isSavingSettings}
                        className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm ${isDark ? 'bg-emerald-400 text-[#062814] hover:bg-emerald-300 disabled:bg-[#1d2230] disabled:text-[#64748b]' : 'bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-[#dbe2ee] disabled:text-[#94a3b8]'}`}
                    >
                        <Clock3 size={15} />
                        <span>{isSavingSettings ? 'Saving...' : 'Save controls'}</span>
                    </button>
                </aside>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_2fr]">
                <section className={`rounded-[32px] border p-6 ${isDark ? 'border-[#2d3348] bg-[#171b28]' : 'border-[#d7deea] bg-white'}`}>
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className={`text-xs uppercase tracking-[0.28em] ${isDark ? 'text-rose-300/80' : 'text-rose-600'}`}>Flagged Queue</p>
                            <h3 className={`mt-2 text-2xl font-semibold ${isDark ? 'text-white' : 'text-[#0f172a]'}`}>Posts that need a decision</h3>
                        </div>
                        <div className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.24em] ${isDark ? 'bg-[#111521] text-[#8a93ae]' : 'bg-[#f8fafc] text-[#64748b]'}`}>
                            {payload.alertQueue.length} active
                        </div>
                    </div>

                    <div className="mt-6 space-y-4">
                        {payload.alertQueue.length === 0 && (
                            <div className={`rounded-[24px] border px-5 py-6 text-sm ${isDark ? 'border-[#2a3144] bg-[#111521] text-[#bcc5dc]' : 'border-[#e8ebf2] bg-[#f8fafc] text-[#475569]'}`}>
                                No active alerts right now.
                            </div>
                        )}
                        {payload.alertQueue.map((post) => (
                            <button
                                key={post.id}
                                type="button"
                                onClick={() => setSelectedPostId(post.id)}
                                className={`w-full rounded-[24px] border p-5 text-left transition-colors ${isDark ? 'border-[#2a3144] bg-[#111521] hover:border-[#445070]' : 'border-[#e8ebf2] bg-[#f8fafc] hover:border-[#bcc8df]'}`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className={`text-xs uppercase tracking-[0.24em] ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`}>{post.eventName}</p>
                                        <h4 className={`mt-2 text-lg font-semibold ${isDark ? 'text-white' : 'text-[#0f172a]'}`}>{post.artistName}</h4>
                                        <p className={`mt-3 text-sm leading-7 ${isDark ? 'text-[#d6dbee]' : 'text-[#334155]'}`}>{post.attentionReason || post.analysis.summary}</p>
                                    </div>
                                    <div className={`rounded-2xl px-4 py-3 text-center ${isDark ? 'bg-[#171f31]' : 'bg-white'}`}>
                                        <p className={`text-[11px] uppercase tracking-[0.2em] ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`}>Next check</p>
                                        <p className={`mt-2 text-sm font-semibold ${isDark ? 'text-white' : 'text-[#0f172a]'}`}>{formatDateTime(post.nextUpdateAt)}</p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </section>

                <section className={`rounded-[32px] border p-6 ${isDark ? 'border-[#2d3348] bg-[#171b28]' : 'border-[#d7deea] bg-white'}`}>
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <p className={`text-xs uppercase tracking-[0.28em] ${isDark ? 'text-cyan-300/80' : 'text-sky-600'}`}>Feed Grid</p>
                            <h3 className={`mt-2 text-2xl font-semibold ${isDark ? 'text-white' : 'text-[#0f172a]'}`}>Cross-event social monitoring</h3>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <div className="relative">
                                <select
                                    value={selectedEventId}
                                    onChange={handleEventChange}
                                    className={`appearance-none rounded-full border px-4 py-2.5 pr-10 text-sm outline-none ${isDark ? 'border-[#2a3144] bg-[#111521] text-white' : 'border-[#dbe2ee] bg-[#f8fafc] text-[#0f172a]'}`}
                                >
                                    <option value="all">All events</option>
                                    {payload.events.map((event) => (
                                        <option key={event.id} value={event.id}>{event.name}</option>
                                    ))}
                                </select>
                                <ChevronDown size={16} className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`} />
                            </div>

                            <div className="relative">
                                <select
                                    value={selectedArtistId}
                                    onChange={(event) => setSelectedArtistId(event.target.value)}
                                    className={`appearance-none rounded-full border px-4 py-2.5 pr-10 text-sm outline-none ${isDark ? 'border-[#2a3144] bg-[#111521] text-white' : 'border-[#dbe2ee] bg-[#f8fafc] text-[#0f172a]'}`}
                                >
                                    <option value="all">All artists</option>
                                    {availableArtists.map((artist) => (
                                        <option key={artist.id} value={artist.id}>{artist.name}</option>
                                    ))}
                                </select>
                                <ChevronDown size={16} className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-[#8a93ae]' : 'text-[#64748b]'}`} />
                            </div>

                            <div className={`flex rounded-full border p-1 ${isDark ? 'border-[#2a3144] bg-[#111521]' : 'border-[#dbe2ee] bg-[#f8fafc]'}`}>
                                {platformOptions.map((platform) => (
                                    <button
                                        key={platform.id}
                                        type="button"
                                        onClick={() => setSelectedPlatform(platform.id)}
                                        className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors ${selectedPlatform === platform.id
                                            ? (isDark ? 'bg-[#243047] text-white' : 'bg-[#0f172a] text-white')
                                            : (isDark ? 'text-[#8a93ae] hover:text-white' : 'text-[#64748b] hover:text-[#0f172a]')
                                            }`}
                                    >
                                        <platform.icon size={14} />
                                        <span>{platform.label}</span>
                                    </button>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={() => setFlaggedOnly((current) => !current)}
                                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm ${flaggedOnly
                                    ? (isDark ? 'border-rose-400/30 bg-rose-500/10 text-rose-100' : 'border-rose-200 bg-rose-50 text-rose-700')
                                    : (isDark ? 'border-[#2a3144] bg-[#111521] text-[#8a93ae]' : 'border-[#dbe2ee] bg-[#f8fafc] text-[#64748b]')
                                    }`}
                            >
                                <Filter size={14} />
                                <span>Attention only</span>
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
                        {isLoading && Array.from({ length: 3 }).map((_, index) => (
                            <div key={index} className={`h-[31rem] animate-pulse rounded-[28px] ${isDark ? 'bg-[#111521]' : 'bg-[#f8fafc]'}`}></div>
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
            </div>
        </div>
    );
};

export default SocialDashboard;
