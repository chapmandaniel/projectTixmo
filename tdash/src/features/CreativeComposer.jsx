import React, { useEffect, useMemo, useState } from 'react';
import {
    ArrowRight,
    BadgeCheck,
    Brush,
    Building2,
    Copy,
    FileText,
    Image as ImageIcon,
    LayoutTemplate,
    Megaphone,
    Palette,
    PenSquare,
    RefreshCw,
    Sparkles,
    Tags,
    Wand2,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '../lib/api';

const BRAND_STORAGE_KEY = 'tixmo_promo_brand_profile';
const HISTORY_STORAGE_KEY = 'tixmo_promo_history';

const PLATFORM_OPTIONS = [
    { id: 'instagram', label: 'Instagram' },
    { id: 'twitter', label: 'X / Twitter' },
    { id: 'linkedin', label: 'LinkedIn' },
];

const POST_SCENARIOS = [
    { id: 'event_launch', label: 'Event Launch' },
    { id: 'lineup_drop', label: 'Lineup Drop' },
    { id: 'on_sale', label: 'On Sale Now' },
    { id: 'countdown', label: 'Countdown Push' },
    { id: 'sold_out', label: 'Sold Out / Scarcity' },
    { id: 'recap', label: 'Post-Event Recap' },
];

const ARTWORK_SCENARIOS = [
    { id: 'hero_poster', label: 'Hero Poster' },
    { id: 'social_tile', label: 'Social Tile' },
    { id: 'story_frame', label: 'Story Frame' },
    { id: 'sponsor_card', label: 'Sponsor Card' },
    { id: 'countdown_graphic', label: 'Countdown Graphic' },
    { id: 'recap_carousel', label: 'Recap Carousel' },
];

const defaultBrandProfile = {
    brandName: 'TixMo',
    tagline: 'Live events, clearly sold.',
    audience: 'Concertgoers and event fans looking for high-energy live experiences.',
    voice: 'Bold, confident, polished, exciting, and community-driven.',
    ctaStyle: 'Direct and conversion-focused, but not aggressive.',
    defaultHashtags: '#TixMo #LiveEvents',
    bannedPhrases: 'cheap, once in a lifetime, unbelievable',
    visualDirection: 'High-energy event photography, bold typography, strong contrast, premium nightlife feel.',
    primaryColor: '#38bdf8',
    secondaryColor: '#f43f5e',
    logoNotes: 'Use clean logo placement with enough breathing room. Avoid cluttered sponsor stacks over the mark.',
    ticketLink: 'https://tixmo.co/tickets',
    instagramHandle: '@tixmo',
    twitterHandle: '@tixmo',
    linkedinHandle: 'TixMo',
};

const defaultPostInputs = {
    scenario: 'event_launch',
    eventId: '',
    objective: 'Drive awareness and qualified ticket intent.',
    callToAction: 'Get tickets now',
    message: '',
    urgency: 'balanced',
    platforms: ['instagram', 'twitter', 'linkedin'],
};

const defaultArtworkInputs = {
    scenario: 'hero_poster',
    eventId: '',
    format: 'Instagram feed 4:5',
    mood: 'Electric, premium, cinematic',
    headline: '',
    supportingCopy: '',
    requiredElements: '',
    visualNotes: '',
};

const toolCards = [
    {
        id: 'brand',
        label: 'Brand HQ',
        description: 'Set the brand voice, visual rules, hashtags, CTAs, and identity cues ProMo should use everywhere.',
        helper: 'Build the creative foundation first',
        icon: Building2,
        grad: 'from-cyan-400 to-blue-500',
        color: 'text-cyan-400',
    },
    {
        id: 'posts',
        label: 'Post Studio',
        description: 'Generate social copy sets for launches, on-sales, reminders, recaps, and campaign pushes.',
        helper: 'For caption and post creation',
        icon: PenSquare,
        grad: 'from-fuchsia-500 to-rose-400',
        color: 'text-fuchsia-400',
    },
    {
        id: 'artwork',
        label: 'Artwork Studio',
        description: 'Create concept directions, visual prompts, overlay copy, and production-ready art briefs.',
        helper: 'For creative direction and design prompts',
        icon: Palette,
        grad: 'from-amber-400 to-orange-500',
        color: 'text-amber-400',
    },
];

const scenarioCards = [
    {
        id: 'scenario_launch',
        label: 'Event Launch',
        description: 'Open a launch-ready post workflow with awareness-focused copy structure.',
        tool: 'posts',
        icon: Megaphone,
        grad: 'from-fuchsia-500 to-rose-400',
        preset: {
            post: {
                scenario: 'event_launch',
                objective: 'Launch the event with clear positioning and immediate awareness.',
                callToAction: 'See the lineup and get tickets',
            },
        },
    },
    {
        id: 'scenario_sale',
        label: 'On Sale Push',
        description: 'Create conversion-ready posts around on-sale urgency and ticket momentum.',
        tool: 'posts',
        icon: Tags,
        grad: 'from-cyan-400 to-blue-500',
        preset: {
            post: {
                scenario: 'on_sale',
                objective: 'Drive immediate ticket conversion while inventory is available.',
                callToAction: 'Secure your tickets',
                urgency: 'high',
            },
        },
    },
    {
        id: 'scenario_lineup',
        label: 'Lineup Drop',
        description: 'Generate posts and visual framing for artist announcements and stacked lineups.',
        tool: 'posts',
        icon: Sparkles,
        grad: 'from-emerald-400 to-teal-500',
        preset: {
            post: {
                scenario: 'lineup_drop',
                objective: 'Reveal talent in a way that builds social momentum and shares.',
                callToAction: 'Drop your favorite artist below',
            },
        },
    },
    {
        id: 'scenario_poster',
        label: 'Poster System',
        description: 'Open artwork generation with a hero-poster format and visual-identity framing.',
        tool: 'artwork',
        icon: Brush,
        grad: 'from-amber-400 to-orange-500',
        preset: {
            artwork: {
                scenario: 'hero_poster',
                format: 'Poster 1080x1350',
                mood: 'Heroic, high-energy, premium event launch',
            },
        },
    },
    {
        id: 'scenario_story',
        label: 'Story Campaign',
        description: 'Generate story-friendly creative direction for short, punchy promotion.',
        tool: 'artwork',
        icon: LayoutTemplate,
        grad: 'from-indigo-400 to-purple-500',
        preset: {
            artwork: {
                scenario: 'story_frame',
                format: 'Story 1080x1920',
                mood: 'Fast, mobile-first, bold, swipe-stopping',
            },
        },
    },
    {
        id: 'scenario_sponsor',
        label: 'Sponsor Spotlight',
        description: 'Create sponsor-safe post and artwork setups with clean hierarchy and brand placement.',
        tool: 'artwork',
        icon: BadgeCheck,
        grad: 'from-lime-400 to-emerald-500',
        preset: {
            artwork: {
                scenario: 'sponsor_card',
                format: 'Square sponsor card',
                mood: 'Clean, credible, brand-safe, polished',
            },
        },
    },
];

const readStoredValue = (key, fallback) => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
        return fallback;
    }
};

const persistStoredValue = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error(`Failed to persist ${key}`, error);
    }
};

const getEventLabel = (event) => event?.title || event?.name || 'Selected event';

const clipText = async (value, label = 'Copied to clipboard') => {
    try {
        await navigator.clipboard.writeText(value);
        toast.success(label);
    } catch (error) {
        toast.error('Clipboard unavailable');
    }
};

const buildPostWeights = (scenario, urgency) => {
    const highEnergyScenarios = ['event_launch', 'lineup_drop', 'on_sale', 'countdown'];
    const energetic = highEnergyScenarios.includes(scenario);

    return {
        vibrancy: urgency === 'high' ? 92 : energetic ? 84 : 70,
        professionalism: scenario === 'recap' ? 62 : 48,
        humor: scenario === 'recap' ? 30 : 16,
        creativity: energetic ? 82 : 74,
    };
};

const buildArtworkWeights = () => ({
    vibrancy: 88,
    professionalism: 55,
    humor: 8,
    creativity: 90,
});

const buildPostPrompt = ({ brandProfile, event, inputs }) => {
    const selectedPlatforms = inputs.platforms.map((platformId) => PLATFORM_OPTIONS.find((item) => item.id === platformId)?.label || platformId).join(', ');

    return [
        `Create social post content for ${brandProfile.brandName || 'the brand'}.`,
        `Scenario: ${inputs.scenario}.`,
        `Event context: ${event ? getEventLabel(event) : 'General promotion without event selected'}.`,
        `Audience: ${brandProfile.audience}.`,
        `Voice: ${brandProfile.voice}.`,
        `CTA style: ${brandProfile.ctaStyle}.`,
        `Default hashtags: ${brandProfile.defaultHashtags}.`,
        `Avoid these phrases: ${brandProfile.bannedPhrases || 'none supplied'}.`,
        `Objective: ${inputs.objective}.`,
        `Core message: ${inputs.message || 'Create a clear event marketing message from the available context.'}`,
        `Urgency: ${inputs.urgency}.`,
        `Desired CTA: ${inputs.callToAction}.`,
        `Platforms to optimize for: ${selectedPlatforms}.`,
        `Ticket / destination link: ${brandProfile.ticketLink || 'none supplied'}.`,
        'Write platform-ready copy that feels intentional, modern, and brand-aware. Keep the copy scannable and campaign-ready.',
    ].join(' ');
};

const buildArtworkPrompt = ({ brandProfile, event, inputs }) => [
    `Create a visual direction brief for ${brandProfile.brandName || 'the brand'}.`,
    `Scenario: ${inputs.scenario}.`,
    `Event context: ${event ? getEventLabel(event) : 'General event artwork without event selected'}.`,
    `Visual direction: ${brandProfile.visualDirection}.`,
    `Brand colors: ${brandProfile.primaryColor} and ${brandProfile.secondaryColor}.`,
    `Logo notes: ${brandProfile.logoNotes}.`,
    `Format: ${inputs.format}.`,
    `Mood: ${inputs.mood}.`,
    `Headline: ${inputs.headline || 'Generate a strong promotional headline direction.'}`,
    `Supporting copy: ${inputs.supportingCopy || 'Keep copy minimal and readable.'}`,
    `Required elements: ${inputs.requiredElements || 'Event branding, clear hierarchy, and strong CTA treatment.'}`,
    `Additional notes: ${inputs.visualNotes || 'Push for premium, polished event marketing design.'}`,
    'Return a design-aware response with a useful visual prompt and strategic reasoning that a designer could build from.',
].join(' ');

const normalizePostResult = (response) => ({
    title: 'Campaign copy set',
    summary: response?.strategy?.explanation || 'Multi-platform post set ready for refinement.',
    strategy: response?.strategy || {},
    visuals: response?.visuals || {},
    platforms: [
        { id: 'instagram', label: 'Instagram', content: response?.platforms?.instagram || { text: '', hashtags: [] } },
        { id: 'twitter', label: 'X / Twitter', content: response?.platforms?.twitter || { text: '', hashtags: [] } },
        { id: 'linkedin', label: 'LinkedIn', content: response?.platforms?.linkedin || { text: '', hashtags: [] } },
    ],
});

const deriveArtworkConcepts = ({ response, inputs, brandProfile, event }) => {
    const basePrompt = response?.visuals?.imagePrompt || 'High-energy event artwork with premium typography and clear hierarchy.';
    const eventLabel = event ? getEventLabel(event) : brandProfile.brandName || 'Event campaign';
    const overlay = inputs.headline || eventLabel;

    return [
        {
            id: 'hero',
            title: 'Hero moment',
            useCase: inputs.format,
            description: 'Use a dominant headline, cinematic focal imagery, and a premium promotional hierarchy.',
            overlay,
            prompt: `${basePrompt} Focus on a hero composition for ${inputs.format}. Emphasize ${overlay}. Keep the layout bold and immediate.`,
        },
        {
            id: 'type_system',
            title: 'Typography-led system',
            useCase: 'Text-forward campaign asset',
            description: 'Lean on bold type, color blocking, and graphic rhythm with cleaner photography treatment.',
            overlay,
            prompt: `${basePrompt} Reframe this as a type-forward campaign system with strong contrast, disciplined spacing, and restrained supporting imagery.`,
        },
        {
            id: 'conversion',
            title: 'Conversion push',
            useCase: 'On-sale / CTA creative',
            description: 'Prioritize clarity, CTA visibility, date information, and fast-read hierarchy.',
            overlay: inputs.supportingCopy || 'Tickets on sale now',
            prompt: `${basePrompt} Build a high-clarity conversion asset with obvious CTA space, ticket urgency, and mobile-first readability.`,
        },
    ];
};

const ToolCard = ({ item, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="group relative overflow-hidden rounded-md border border-white/10 bg-[#0d1520] p-6 text-left transition-all duration-300 hover:border-white/20 hover:bg-[#111b27] hover:shadow-xl hover:shadow-black/20"
    >
        <div className={`absolute left-0 top-0 h-[3px] w-full bg-gradient-to-r ${item.grad}`} />
        <div className={`absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br ${item.grad} opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-10`} />
        <div className="relative">
            <div className="mb-6 flex items-center justify-between gap-4 transition-transform duration-300 group-hover:translate-x-1">
                <item.icon size={24} className={item.color} />
                <span className="rounded-full border border-white/10 bg-[#081018] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                    {item.helper}
                </span>
            </div>
            <h3 className="text-lg font-light tracking-tight text-white">{item.label}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.description}</p>
            <div className="mt-6 inline-flex items-center gap-2 text-sm text-slate-200">
                Open
                <ArrowRight size={16} />
            </div>
        </div>
    </button>
);

const ScenarioCard = ({ item, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="group relative overflow-hidden rounded-md border border-white/10 bg-[#0d1520] p-5 text-left transition-all duration-300 hover:border-white/20 hover:bg-[#111b27]"
    >
        <div className={`absolute left-0 top-0 h-[3px] w-full bg-gradient-to-r ${item.grad}`} />
        <div className="flex items-start justify-between gap-3 transition-transform duration-300 group-hover:translate-x-1">
            <div>
                <h3 className="text-base font-light tracking-tight text-white">{item.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.description}</p>
            </div>
            <item.icon size={18} className="text-slate-300 shrink-0" />
        </div>
    </button>
);

const BrandField = ({ label, children }) => (
    <label className="block">
        <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-500">{label}</span>
        {children}
    </label>
);

const inputClassName = 'w-full rounded-2xl border border-white/10 bg-[#081018] px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-fuchsia-400';

const CreativeComposer = ({ isDark }) => {
    const [events, setEvents] = useState([]);
    const [loadingEvents, setLoadingEvents] = useState(true);
    const [activeTool, setActiveTool] = useState(null);
    const [brandProfile, setBrandProfile] = useState(() => readStoredValue(BRAND_STORAGE_KEY, defaultBrandProfile));
    const [history, setHistory] = useState(() => readStoredValue(HISTORY_STORAGE_KEY, []));
    const [postInputs, setPostInputs] = useState(defaultPostInputs);
    const [artworkInputs, setArtworkInputs] = useState(defaultArtworkInputs);
    const [postResult, setPostResult] = useState(null);
    const [artworkResult, setArtworkResult] = useState(null);
    const [selectedPlatformId, setSelectedPlatformId] = useState('instagram');
    const [selectedArtworkConceptId, setSelectedArtworkConceptId] = useState('hero');
    const [isGeneratingPost, setIsGeneratingPost] = useState(false);
    const [isGeneratingArtwork, setIsGeneratingArtwork] = useState(false);

    useEffect(() => {
        const loadEvents = async () => {
            setLoadingEvents(true);
            try {
                const response = await api.get('/events?limit=100');
                setEvents(response.events || response.data?.events || []);
            } catch (error) {
                console.error('Failed to load events for ProMo', error);
                setEvents([]);
            } finally {
                setLoadingEvents(false);
            }
        };

        loadEvents();
    }, []);

    useEffect(() => {
        persistStoredValue(BRAND_STORAGE_KEY, brandProfile);
    }, [brandProfile]);

    const brandCompleteness = useMemo(() => {
        const requiredKeys = [
            'brandName',
            'audience',
            'voice',
            'ctaStyle',
            'defaultHashtags',
            'visualDirection',
            'ticketLink',
        ];

        const filled = requiredKeys.filter((key) => String(brandProfile[key] || '').trim()).length;
        return Math.round((filled / requiredKeys.length) * 100);
    }, [brandProfile]);

    const selectedPostEvent = useMemo(
        () => events.find((event) => event.id === postInputs.eventId) || null,
        [events, postInputs.eventId]
    );
    const selectedArtworkEvent = useMemo(
        () => events.find((event) => event.id === artworkInputs.eventId) || null,
        [events, artworkInputs.eventId]
    );
    const activePlatform = postResult?.platforms?.find((item) => item.id === selectedPlatformId) || postResult?.platforms?.[0] || null;
    const activeArtworkConcept = artworkResult?.concepts?.find((item) => item.id === selectedArtworkConceptId) || artworkResult?.concepts?.[0] || null;

    const pushHistory = (entry) => {
        const nextHistory = [entry, ...history].slice(0, 10);
        setHistory(nextHistory);
        persistStoredValue(HISTORY_STORAGE_KEY, nextHistory);
    };

    const applyScenario = (scenario) => {
        if (scenario.preset.post) {
            setPostInputs((current) => ({ ...current, ...scenario.preset.post }));
        }
        if (scenario.preset.artwork) {
            setArtworkInputs((current) => ({ ...current, ...scenario.preset.artwork }));
        }

        setActiveTool(scenario.tool);
        if (scenario.tool === 'posts') {
            setPostResult(null);
        }
        if (scenario.tool === 'artwork') {
            setArtworkResult(null);
        }
    };

    const saveBrandProfile = () => {
        persistStoredValue(BRAND_STORAGE_KEY, brandProfile);
        toast.success('Brand HQ saved');
    };

    const generatePosts = async () => {
        setIsGeneratingPost(true);
        setPostResult(null);

        try {
            const prompt = buildPostPrompt({
                brandProfile,
                event: selectedPostEvent,
                inputs: postInputs,
            });

            const response = await api.post('/ai/generate', {
                prompt,
                weights: buildPostWeights(postInputs.scenario, postInputs.urgency),
            });

            const normalized = normalizePostResult(response.data || response);
            setPostResult(normalized);
            setSelectedPlatformId(normalized.platforms[0]?.id || 'instagram');

            pushHistory({
                id: `post-${Date.now()}`,
                tool: 'posts',
                title: selectedPostEvent ? `${getEventLabel(selectedPostEvent)} post set` : 'General post set',
                subtitle: POST_SCENARIOS.find((item) => item.id === postInputs.scenario)?.label || 'Post Studio',
                timestamp: new Date().toISOString(),
            });

            toast.success('Post set generated');
        } catch (error) {
            console.error('Failed to generate ProMo post set', error);
            toast.error('Post generation failed');
        } finally {
            setIsGeneratingPost(false);
        }
    };

    const generateArtwork = async () => {
        setIsGeneratingArtwork(true);
        setArtworkResult(null);

        try {
            const prompt = buildArtworkPrompt({
                brandProfile,
                event: selectedArtworkEvent,
                inputs: artworkInputs,
            });

            const response = await api.post('/ai/generate', {
                prompt,
                weights: buildArtworkWeights(),
            });

            const raw = response.data || response;
            const concepts = deriveArtworkConcepts({
                response: raw,
                inputs: artworkInputs,
                brandProfile,
                event: selectedArtworkEvent,
            });

            setArtworkResult({
                summary: raw?.strategy?.explanation || 'Creative direction generated.',
                strategy: raw?.strategy || {},
                visuals: raw?.visuals || {},
                concepts,
                overlays: {
                    headline: artworkInputs.headline || getEventLabel(selectedArtworkEvent),
                    supportingCopy: artworkInputs.supportingCopy || 'Tickets available now',
                },
            });
            setSelectedArtworkConceptId(concepts[0]?.id || 'hero');

            pushHistory({
                id: `art-${Date.now()}`,
                tool: 'artwork',
                title: selectedArtworkEvent ? `${getEventLabel(selectedArtworkEvent)} artwork brief` : 'Artwork brief',
                subtitle: ARTWORK_SCENARIOS.find((item) => item.id === artworkInputs.scenario)?.label || 'Artwork Studio',
                timestamp: new Date().toISOString(),
            });

            toast.success('Artwork direction generated');
        } catch (error) {
            console.error('Failed to generate ProMo artwork', error);
            toast.error('Artwork generation failed');
        } finally {
            setIsGeneratingArtwork(false);
        }
    };

    return (
        <div className="animate-fade-in max-w-[1500px] mx-auto pb-12 space-y-8">
            <section className="relative overflow-hidden rounded-md border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(244,63,94,0.15),_transparent_35%),linear-gradient(135deg,_#0d1520,_#10161e)] p-6 shadow-2xl shadow-black/20 sm:p-8">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -right-14 -top-14 h-40 w-40 rounded-full bg-fuchsia-500/10 blur-3xl" />
                    <div className="absolute left-4 bottom-0 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
                </div>
                <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="flex flex-wrap items-baseline gap-3 text-3xl font-light tracking-tight text-white sm:text-4xl">
                            <span className="inline-flex items-center gap-2">
                                <span>ProMo</span>
                                <Brush className="h-6 w-6 text-fuchsia-300 sm:h-7 sm:w-7" />
                            </span>
                            <span className="text-base uppercase tracking-[0.16em] text-fuchsia-300 sm:text-lg">[creative assistant]</span>
                        </h1>
                        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
                            Build consistent brand-ready marketing content through focused creative tools, reusable brand settings, and scenario-driven campaign workflows.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-[#081018] px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Brand readiness</div>
                        <div className="mt-2 flex items-center gap-3">
                            <div className="h-2 w-32 overflow-hidden rounded-full bg-white/10">
                                <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400" style={{ width: `${brandCompleteness}%` }} />
                            </div>
                            <span className="text-sm text-white">{brandCompleteness}%</span>
                        </div>
                    </div>
                </div>
            </section>

            {!activeTool ? (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.16fr)_minmax(320px,0.84fr)]">
                    <div className="space-y-6">
                        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                            {toolCards.map((item) => (
                                <ToolCard key={item.id} item={item} onClick={() => setActiveTool(item.id)} />
                            ))}
                        </section>

                        <section className="rounded-md border border-white/10 bg-[#0d1520] p-6">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Creative scenarios</div>
                                    <h2 className="mt-2 text-2xl font-light tracking-tight text-white">Open ProMo already framed for the job at hand.</h2>
                                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
                                        Start with a launch, sale, lineup, poster, story, or sponsor prompt and jump straight into a prepared workspace.
                                    </p>
                                </div>
                                <ArrowRight size={18} className="text-slate-500" />
                            </div>

                            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {scenarioCards.map((item) => (
                                    <ScenarioCard key={item.id} item={item} onClick={() => applyScenario(item)} />
                                ))}
                            </div>
                        </section>
                    </div>

                    <aside className="space-y-6">
                        <div className="rounded-md border border-white/10 bg-[#0d1520] p-5">
                            <div className="flex items-center gap-2">
                                <FileText size={16} className="text-fuchsia-400" />
                                <h3 className="text-lg font-light tracking-tight text-white">Creative system</h3>
                            </div>
                            <div className="mt-4 space-y-3">
                                <div className="rounded-md border border-white/10 bg-[#081018] px-4 py-3 text-sm text-slate-300">
                                    Brand HQ locks in voice, visual cues, CTA style, hashtags, and guardrails.
                                </div>
                                <div className="rounded-md border border-white/10 bg-[#081018] px-4 py-3 text-sm text-slate-300">
                                    Post Studio turns campaign goals into platform-ready copy sets.
                                </div>
                                <div className="rounded-md border border-white/10 bg-[#081018] px-4 py-3 text-sm text-slate-300">
                                    Artwork Studio produces concept directions, overlays, and design prompts.
                                </div>
                            </div>
                        </div>

                        <div className="rounded-md border border-white/10 bg-[#0d1520] p-5">
                            <div className="flex items-center gap-2">
                                <Building2 size={16} className="text-cyan-400" />
                                <h3 className="text-lg font-light tracking-tight text-white">Brand snapshot</h3>
                            </div>
                            <div className="mt-4 space-y-3">
                                <div className="rounded-md border border-white/10 bg-[#081018] px-4 py-3">
                                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Brand</div>
                                    <div className="mt-1 text-sm text-slate-100">{brandProfile.brandName || 'Not set'}</div>
                                </div>
                                <div className="rounded-md border border-white/10 bg-[#081018] px-4 py-3">
                                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Voice</div>
                                    <div className="mt-1 text-sm text-slate-300">{brandProfile.voice || 'Not set'}</div>
                                </div>
                                <div className="rounded-md border border-white/10 bg-[#081018] px-4 py-3">
                                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Visual direction</div>
                                    <div className="mt-1 text-sm text-slate-300">{brandProfile.visualDirection || 'Not set'}</div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-md border border-white/10 bg-[#0d1520] p-5">
                            <div className="flex items-center gap-2">
                                <RefreshCw size={16} className="text-amber-400" />
                                <h3 className="text-lg font-light tracking-tight text-white">Recent outputs</h3>
                            </div>
                            <div className="mt-4 space-y-3">
                                {history.length === 0 ? (
                                    <div className="rounded-md border border-dashed border-white/10 px-4 py-6 text-sm text-slate-500">
                                        No ProMo generations yet.
                                    </div>
                                ) : history.map((item) => (
                                    <div key={item.id} className="rounded-md border border-white/10 bg-[#081018] px-4 py-3">
                                        <div className="text-sm text-white">{item.title}</div>
                                        <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{item.subtitle}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </aside>
                </div>
            ) : (
                <section className="space-y-4">
                    <button
                        type="button"
                        onClick={() => setActiveTool(null)}
                        className="rounded-md border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-[#111b27]"
                    >
                        Back to tools
                    </button>

                    {activeTool === 'brand' && (
                        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_380px]">
                            <div className="rounded-md border border-white/10 bg-[#0d1520] p-6">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h2 className="text-2xl font-light tracking-tight text-white">Brand HQ</h2>
                                        <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">
                                            Define the brand system ProMo should use for posts, artwork direction, and future campaign outputs.
                                        </p>
                                    </div>
                                    <Building2 size={20} className="text-cyan-400" />
                                </div>

                                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                                    <div className="space-y-4">
                                        <BrandField label="Brand name">
                                            <input className={inputClassName} value={brandProfile.brandName} onChange={(event) => setBrandProfile((current) => ({ ...current, brandName: event.target.value }))} />
                                        </BrandField>
                                        <BrandField label="Tagline">
                                            <input className={inputClassName} value={brandProfile.tagline} onChange={(event) => setBrandProfile((current) => ({ ...current, tagline: event.target.value }))} />
                                        </BrandField>
                                        <BrandField label="Audience">
                                            <textarea rows={4} className={inputClassName} value={brandProfile.audience} onChange={(event) => setBrandProfile((current) => ({ ...current, audience: event.target.value }))} />
                                        </BrandField>
                                        <BrandField label="Voice and tone">
                                            <textarea rows={4} className={inputClassName} value={brandProfile.voice} onChange={(event) => setBrandProfile((current) => ({ ...current, voice: event.target.value }))} />
                                        </BrandField>
                                        <BrandField label="CTA style">
                                            <input className={inputClassName} value={brandProfile.ctaStyle} onChange={(event) => setBrandProfile((current) => ({ ...current, ctaStyle: event.target.value }))} />
                                        </BrandField>
                                        <BrandField label="Default hashtags">
                                            <input className={inputClassName} value={brandProfile.defaultHashtags} onChange={(event) => setBrandProfile((current) => ({ ...current, defaultHashtags: event.target.value }))} />
                                        </BrandField>
                                    </div>

                                    <div className="space-y-4">
                                        <BrandField label="Visual direction">
                                            <textarea rows={4} className={inputClassName} value={brandProfile.visualDirection} onChange={(event) => setBrandProfile((current) => ({ ...current, visualDirection: event.target.value }))} />
                                        </BrandField>
                                        <BrandField label="Logo / layout notes">
                                            <textarea rows={4} className={inputClassName} value={brandProfile.logoNotes} onChange={(event) => setBrandProfile((current) => ({ ...current, logoNotes: event.target.value }))} />
                                        </BrandField>
                                        <BrandField label="Avoid these phrases">
                                            <input className={inputClassName} value={brandProfile.bannedPhrases} onChange={(event) => setBrandProfile((current) => ({ ...current, bannedPhrases: event.target.value }))} />
                                        </BrandField>
                                        <div className="grid grid-cols-2 gap-4">
                                            <BrandField label="Primary color">
                                                <input type="color" className="h-12 w-full rounded-2xl border border-white/10 bg-[#081018] p-2" value={brandProfile.primaryColor} onChange={(event) => setBrandProfile((current) => ({ ...current, primaryColor: event.target.value }))} />
                                            </BrandField>
                                            <BrandField label="Secondary color">
                                                <input type="color" className="h-12 w-full rounded-2xl border border-white/10 bg-[#081018] p-2" value={brandProfile.secondaryColor} onChange={(event) => setBrandProfile((current) => ({ ...current, secondaryColor: event.target.value }))} />
                                            </BrandField>
                                        </div>
                                        <BrandField label="Ticket link">
                                            <input className={inputClassName} value={brandProfile.ticketLink} onChange={(event) => setBrandProfile((current) => ({ ...current, ticketLink: event.target.value }))} />
                                        </BrandField>
                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                            <BrandField label="Instagram">
                                                <input className={inputClassName} value={brandProfile.instagramHandle} onChange={(event) => setBrandProfile((current) => ({ ...current, instagramHandle: event.target.value }))} />
                                            </BrandField>
                                            <BrandField label="X / Twitter">
                                                <input className={inputClassName} value={brandProfile.twitterHandle} onChange={(event) => setBrandProfile((current) => ({ ...current, twitterHandle: event.target.value }))} />
                                            </BrandField>
                                            <BrandField label="LinkedIn">
                                                <input className={inputClassName} value={brandProfile.linkedinHandle} onChange={(event) => setBrandProfile((current) => ({ ...current, linkedinHandle: event.target.value }))} />
                                            </BrandField>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 flex gap-3">
                                    <button type="button" onClick={saveBrandProfile} className="rounded-2xl bg-fuchsia-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-fuchsia-400">
                                        Save Brand HQ
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setBrandProfile(defaultBrandProfile)}
                                        className="rounded-2xl border border-white/10 px-5 py-3 text-sm text-slate-300 transition hover:text-white"
                                    >
                                        Reset defaults
                                    </button>
                                </div>
                            </div>

                            <aside className="space-y-6">
                                <div className="rounded-md border border-white/10 bg-[#0d1520] p-5">
                                    <div className="flex items-center gap-2">
                                        <Sparkles size={16} className="text-fuchsia-400" />
                                        <h3 className="text-lg font-light tracking-tight text-white">Live brand summary</h3>
                                    </div>
                                    <div className="mt-4 rounded-3xl border border-white/10 bg-[#081018] p-5">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Brand</div>
                                                <div className="mt-2 text-2xl font-light text-white">{brandProfile.brandName || 'Your brand'}</div>
                                                <div className="mt-1 text-sm text-slate-400">{brandProfile.tagline}</div>
                                            </div>
                                            <div className="flex gap-2">
                                                <div className="h-6 w-6 rounded-full" style={{ backgroundColor: brandProfile.primaryColor }} />
                                                <div className="h-6 w-6 rounded-full" style={{ backgroundColor: brandProfile.secondaryColor }} />
                                            </div>
                                        </div>
                                        <p className="mt-4 text-sm leading-7 text-slate-300">{brandProfile.voice}</p>
                                    </div>
                                </div>

                                <div className="rounded-md border border-white/10 bg-[#0d1520] p-5">
                                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">How ProMo uses this</div>
                                    <div className="mt-4 space-y-3">
                                        <div className="rounded-2xl border border-white/10 bg-[#081018] px-4 py-3 text-sm text-slate-300">Post Studio uses voice, hashtags, CTA style, and banned phrase rules.</div>
                                        <div className="rounded-2xl border border-white/10 bg-[#081018] px-4 py-3 text-sm text-slate-300">Artwork Studio uses colors, visual direction, and logo placement notes.</div>
                                        <div className="rounded-2xl border border-white/10 bg-[#081018] px-4 py-3 text-sm text-slate-300">Scenario presets become brand-aware instead of generic template content.</div>
                                    </div>
                                </div>
                            </aside>
                        </div>
                    )}

                    {activeTool === 'posts' && (
                        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                            <aside className="space-y-6">
                                <div className="rounded-md border border-white/10 bg-[#0d1520] p-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h2 className="text-2xl font-light tracking-tight text-white">Post Studio</h2>
                                            <p className="mt-2 text-sm leading-7 text-slate-400">Generate campaign-ready post sets tuned to scenario, event context, and your saved brand system.</p>
                                        </div>
                                        <PenSquare size={18} className="text-fuchsia-400" />
                                    </div>

                                    <div className="mt-5 space-y-4">
                                        <BrandField label="Scenario">
                                            <select className={inputClassName} value={postInputs.scenario} onChange={(event) => setPostInputs((current) => ({ ...current, scenario: event.target.value }))}>
                                                {POST_SCENARIOS.map((item) => (
                                                    <option key={item.id} value={item.id}>{item.label}</option>
                                                ))}
                                            </select>
                                        </BrandField>
                                        <BrandField label="Event">
                                            <select className={inputClassName} value={postInputs.eventId} onChange={(event) => setPostInputs((current) => ({ ...current, eventId: event.target.value }))}>
                                                <option value="">{loadingEvents ? 'Loading events…' : 'No event selected'}</option>
                                                {events.map((event) => (
                                                    <option key={event.id} value={event.id}>{getEventLabel(event)}</option>
                                                ))}
                                            </select>
                                        </BrandField>
                                        <BrandField label="Objective">
                                            <textarea rows={3} className={inputClassName} value={postInputs.objective} onChange={(event) => setPostInputs((current) => ({ ...current, objective: event.target.value }))} />
                                        </BrandField>
                                        <BrandField label="Core message">
                                            <textarea rows={4} className={inputClassName} placeholder="What must this post communicate?" value={postInputs.message} onChange={(event) => setPostInputs((current) => ({ ...current, message: event.target.value }))} />
                                        </BrandField>
                                        <BrandField label="Call to action">
                                            <input className={inputClassName} value={postInputs.callToAction} onChange={(event) => setPostInputs((current) => ({ ...current, callToAction: event.target.value }))} />
                                        </BrandField>
                                        <BrandField label="Urgency">
                                            <select className={inputClassName} value={postInputs.urgency} onChange={(event) => setPostInputs((current) => ({ ...current, urgency: event.target.value }))}>
                                                <option value="low">Low</option>
                                                <option value="balanced">Balanced</option>
                                                <option value="high">High</option>
                                            </select>
                                        </BrandField>
                                        <BrandField label="Platforms">
                                            <div className="flex flex-wrap gap-2">
                                                {PLATFORM_OPTIONS.map((item) => {
                                                    const active = postInputs.platforms.includes(item.id);
                                                    return (
                                                        <button
                                                            key={item.id}
                                                            type="button"
                                                            onClick={() => setPostInputs((current) => ({
                                                                ...current,
                                                                platforms: active
                                                                    ? current.platforms.filter((platformId) => platformId !== item.id)
                                                                    : [...current.platforms, item.id],
                                                            }))}
                                                            className={`rounded-full border px-3 py-2 text-sm transition ${active ? 'border-fuchsia-400 bg-fuchsia-500/15 text-fuchsia-100' : 'border-white/10 bg-[#081018] text-slate-300'}`}
                                                        >
                                                            {item.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </BrandField>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={generatePosts}
                                        disabled={isGeneratingPost || postInputs.platforms.length === 0}
                                        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-fuchsia-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {isGeneratingPost ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                        Generate post set
                                    </button>
                                </div>

                                <div className="rounded-md border border-white/10 bg-[#0d1520] p-5">
                                    <div className="flex items-center gap-2">
                                        <FileText size={16} className="text-cyan-400" />
                                        <h3 className="text-lg font-light tracking-tight text-white">Brand cues in use</h3>
                                    </div>
                                    <div className="mt-4 space-y-3">
                                        <div className="rounded-2xl border border-white/10 bg-[#081018] px-4 py-3 text-sm text-slate-300">{brandProfile.voice}</div>
                                        <div className="rounded-2xl border border-white/10 bg-[#081018] px-4 py-3 text-sm text-slate-300">CTA style: {brandProfile.ctaStyle}</div>
                                        <div className="rounded-2xl border border-white/10 bg-[#081018] px-4 py-3 text-sm text-slate-300">Default hashtags: {brandProfile.defaultHashtags}</div>
                                    </div>
                                </div>
                            </aside>

                            <div className="space-y-6">
                                <div className="rounded-md border border-white/10 bg-[#0d1520] p-6">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div>
                                            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Campaign output</div>
                                            <h2 className="mt-2 text-2xl font-light tracking-tight text-white">{postResult?.title || 'Ready to generate platform copy'}</h2>
                                            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">{postResult?.summary || 'Choose a scenario, add the message, and generate a post set aligned to your saved brand system.'}</p>
                                        </div>
                                        {activePlatform && (
                                            <button
                                                type="button"
                                                onClick={() => clipText(activePlatform.content.text, `${activePlatform.label} copy copied`)}
                                                className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-[#111b27]"
                                            >
                                                Copy active platform
                                            </button>
                                        )}
                                    </div>

                                    <div className="mt-6 flex flex-wrap gap-2">
                                        {(postResult?.platforms || PLATFORM_OPTIONS.map((item) => ({ id: item.id, label: item.label }))).map((item) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => setSelectedPlatformId(item.id)}
                                                className={`rounded-full border px-4 py-2 text-sm transition ${selectedPlatformId === item.id ? 'border-fuchsia-400 bg-fuchsia-500/15 text-fuchsia-100' : 'border-white/10 bg-[#081018] text-slate-300'}`}
                                            >
                                                {item.label}
                                            </button>
                                        ))}
                                    </div>

                                    {activePlatform ? (
                                        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
                                            <div className="rounded-3xl border border-white/10 bg-[#081018] p-5">
                                                <div className="flex items-center justify-between">
                                                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{activePlatform.label}</div>
                                                    <Copy size={16} className="text-slate-500" />
                                                </div>
                                                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-100">{activePlatform.content.text || 'Generate a post set to see platform copy here.'}</p>
                                                {activePlatform.content.hashtags?.length > 0 && (
                                                    <div className="mt-4 flex flex-wrap gap-2">
                                                        {activePlatform.content.hashtags.map((tag) => (
                                                            <span key={tag} className="rounded-full bg-fuchsia-500/10 px-3 py-1 text-xs text-fuchsia-200">{tag}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <aside className="space-y-4">
                                                <div className="rounded-3xl border border-white/10 bg-[#081018] p-5">
                                                    <div className="flex items-center gap-2">
                                                        <Sparkles size={16} className="text-fuchsia-400" />
                                                        <div className="text-sm uppercase tracking-[0.18em] text-slate-500">Strategy note</div>
                                                    </div>
                                                    <p className="mt-4 text-sm leading-7 text-slate-300">{postResult?.strategy?.explanation || 'ProMo strategy notes will appear here.'}</p>
                                                </div>

                                                <div className="rounded-3xl border border-white/10 bg-[#081018] p-5">
                                                    <div className="flex items-center gap-2">
                                                        <ImageIcon size={16} className="text-cyan-400" />
                                                        <div className="text-sm uppercase tracking-[0.18em] text-slate-500">Suggested visual</div>
                                                    </div>
                                                    <p className="mt-4 text-sm leading-7 text-slate-300">{postResult?.visuals?.imagePrompt || 'Generate content to see a matching visual prompt.'}</p>
                                                    {postResult?.visuals?.previewUrl && (
                                                        <img src={postResult.visuals.previewUrl} alt="Generated preview" className="mt-4 h-48 w-full rounded-2xl object-cover" />
                                                    )}
                                                </div>
                                            </aside>
                                        </div>
                                    ) : (
                                        <div className="mt-6 rounded-3xl border border-dashed border-white/10 bg-[#081018] px-6 py-16 text-center text-sm text-slate-500">
                                            No copy generated yet.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTool === 'artwork' && (
                        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                            <aside className="space-y-6">
                                <div className="rounded-md border border-white/10 bg-[#0d1520] p-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h2 className="text-2xl font-light tracking-tight text-white">Artwork Studio</h2>
                                            <p className="mt-2 text-sm leading-7 text-slate-400">Generate concept directions, overlay ideas, and visual prompts for campaign artwork.</p>
                                        </div>
                                        <Palette size={18} className="text-amber-400" />
                                    </div>

                                    <div className="mt-5 space-y-4">
                                        <BrandField label="Scenario">
                                            <select className={inputClassName} value={artworkInputs.scenario} onChange={(event) => setArtworkInputs((current) => ({ ...current, scenario: event.target.value }))}>
                                                {ARTWORK_SCENARIOS.map((item) => (
                                                    <option key={item.id} value={item.id}>{item.label}</option>
                                                ))}
                                            </select>
                                        </BrandField>
                                        <BrandField label="Event">
                                            <select className={inputClassName} value={artworkInputs.eventId} onChange={(event) => setArtworkInputs((current) => ({ ...current, eventId: event.target.value }))}>
                                                <option value="">{loadingEvents ? 'Loading events…' : 'No event selected'}</option>
                                                {events.map((event) => (
                                                    <option key={event.id} value={event.id}>{getEventLabel(event)}</option>
                                                ))}
                                            </select>
                                        </BrandField>
                                        <BrandField label="Format">
                                            <input className={inputClassName} value={artworkInputs.format} onChange={(event) => setArtworkInputs((current) => ({ ...current, format: event.target.value }))} />
                                        </BrandField>
                                        <BrandField label="Mood">
                                            <input className={inputClassName} value={artworkInputs.mood} onChange={(event) => setArtworkInputs((current) => ({ ...current, mood: event.target.value }))} />
                                        </BrandField>
                                        <BrandField label="Headline">
                                            <input className={inputClassName} value={artworkInputs.headline} onChange={(event) => setArtworkInputs((current) => ({ ...current, headline: event.target.value }))} />
                                        </BrandField>
                                        <BrandField label="Supporting copy">
                                            <input className={inputClassName} value={artworkInputs.supportingCopy} onChange={(event) => setArtworkInputs((current) => ({ ...current, supportingCopy: event.target.value }))} />
                                        </BrandField>
                                        <BrandField label="Required elements">
                                            <textarea rows={3} className={inputClassName} value={artworkInputs.requiredElements} onChange={(event) => setArtworkInputs((current) => ({ ...current, requiredElements: event.target.value }))} />
                                        </BrandField>
                                        <BrandField label="Visual notes">
                                            <textarea rows={4} className={inputClassName} value={artworkInputs.visualNotes} onChange={(event) => setArtworkInputs((current) => ({ ...current, visualNotes: event.target.value }))} />
                                        </BrandField>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={generateArtwork}
                                        disabled={isGeneratingArtwork}
                                        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {isGeneratingArtwork ? <RefreshCw size={16} className="animate-spin" /> : <Wand2 size={16} />}
                                        Generate artwork direction
                                    </button>
                                </div>

                                <div className="rounded-md border border-white/10 bg-[#0d1520] p-5">
                                    <div className="flex items-center gap-2">
                                        <Brush size={16} className="text-cyan-400" />
                                        <h3 className="text-lg font-light tracking-tight text-white">Visual system in use</h3>
                                    </div>
                                    <div className="mt-4 space-y-3">
                                        <div className="rounded-2xl border border-white/10 bg-[#081018] px-4 py-3 text-sm text-slate-300">{brandProfile.visualDirection}</div>
                                        <div className="rounded-2xl border border-white/10 bg-[#081018] px-4 py-3 text-sm text-slate-300">Logo notes: {brandProfile.logoNotes}</div>
                                        <div className="rounded-2xl border border-white/10 bg-[#081018] px-4 py-3 text-sm text-slate-300">Colors: {brandProfile.primaryColor} / {brandProfile.secondaryColor}</div>
                                    </div>
                                </div>
                            </aside>

                            <div className="space-y-6">
                                <div className="rounded-md border border-white/10 bg-[#0d1520] p-6">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div>
                                            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Creative direction</div>
                                            <h2 className="mt-2 text-2xl font-light tracking-tight text-white">{selectedArtworkEvent ? `${getEventLabel(selectedArtworkEvent)} visual system` : 'Ready to generate artwork concepts'}</h2>
                                            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">{artworkResult?.summary || 'Generate direction to produce concept cards, a selected visual prompt, and a clearer creative brief.'}</p>
                                        </div>
                                        {activeArtworkConcept && (
                                            <button
                                                type="button"
                                                onClick={() => clipText(activeArtworkConcept.prompt, 'Creative prompt copied')}
                                                className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-[#111b27]"
                                            >
                                                Copy active prompt
                                            </button>
                                        )}
                                    </div>

                                    <div className="mt-6 grid gap-4 xl:grid-cols-3">
                                        {(artworkResult?.concepts || []).length > 0 ? (
                                            artworkResult.concepts.map((concept) => (
                                                <button
                                                    key={concept.id}
                                                    type="button"
                                                    onClick={() => setSelectedArtworkConceptId(concept.id)}
                                                    className={`rounded-3xl border p-5 text-left transition ${selectedArtworkConceptId === concept.id ? 'border-amber-400 bg-amber-500/10' : 'border-white/10 bg-[#081018] hover:border-white/20'}`}
                                                >
                                                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{concept.useCase}</div>
                                                    <h3 className="mt-3 text-lg font-light text-white">{concept.title}</h3>
                                                    <p className="mt-2 text-sm leading-6 text-slate-400">{concept.description}</p>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="rounded-3xl border border-dashed border-white/10 bg-[#081018] px-6 py-16 text-center text-sm text-slate-500 xl:col-span-3">
                                                No artwork direction generated yet.
                                            </div>
                                        )}
                                    </div>

                                    {activeArtworkConcept && (
                                        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
                                            <div className="rounded-3xl border border-white/10 bg-[#081018] p-5">
                                                <div className="flex items-center gap-2">
                                                    <Palette size={16} className="text-amber-400" />
                                                    <div className="text-sm uppercase tracking-[0.18em] text-slate-500">Selected concept</div>
                                                </div>
                                                <h3 className="mt-4 text-2xl font-light text-white">{activeArtworkConcept.title}</h3>
                                                <p className="mt-3 text-sm leading-7 text-slate-300">{activeArtworkConcept.description}</p>

                                                <div className="mt-6 rounded-2xl border border-white/10 bg-[#0d1520] px-4 py-3">
                                                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Overlay copy</div>
                                                    <div className="mt-2 text-lg text-white">{activeArtworkConcept.overlay}</div>
                                                </div>

                                                <div className="mt-4 rounded-2xl border border-white/10 bg-[#0d1520] p-4">
                                                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Image prompt</div>
                                                    <p className="mt-3 text-sm leading-7 text-slate-300">{activeArtworkConcept.prompt}</p>
                                                </div>
                                            </div>

                                            <aside className="space-y-4">
                                                <div className="rounded-3xl border border-white/10 bg-[#081018] p-5">
                                                    <div className="flex items-center gap-2">
                                                        <Sparkles size={16} className="text-fuchsia-400" />
                                                        <div className="text-sm uppercase tracking-[0.18em] text-slate-500">AI strategy note</div>
                                                    </div>
                                                    <p className="mt-4 text-sm leading-7 text-slate-300">{artworkResult?.strategy?.explanation || 'Strategy note unavailable.'}</p>
                                                </div>

                                                <div className="rounded-3xl border border-white/10 bg-[#081018] p-5">
                                                    <div className="flex items-center gap-2">
                                                        <ImageIcon size={16} className="text-cyan-400" />
                                                        <div className="text-sm uppercase tracking-[0.18em] text-slate-500">Preview reference</div>
                                                    </div>
                                                    {artworkResult?.visuals?.previewUrl ? (
                                                        <img src={artworkResult.visuals.previewUrl} alt="Artwork preview" className="mt-4 h-56 w-full rounded-2xl object-cover" />
                                                    ) : (
                                                        <div className="mt-4 rounded-2xl border border-dashed border-white/10 px-4 py-12 text-center text-sm text-slate-500">
                                                            No preview returned from AI.
                                                        </div>
                                                    )}
                                                </div>
                                            </aside>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            )}
        </div>
    );
};

export default CreativeComposer;
