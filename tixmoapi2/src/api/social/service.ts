import { aiService } from '../ai/service';

type Platform = 'instagram' | 'facebook' | 'tiktok';
type AlertStatus = 'flagged' | 'watch' | 'clear' | 'resolved';
type UpdateCadence = 'hourly' | 'daily' | 'on-demand';

interface SocialComment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  requiresResponse: boolean;
  reason: string;
}

interface SocialAnalysis {
  sentimentScore: number;
  sentimentLabel: 'positive' | 'neutral' | 'mixed' | 'negative';
  breakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  summary: string;
  flagReason: string | null;
  needsAttention: boolean;
  priority: 'low' | 'medium' | 'high';
  keyComments: SocialComment[];
  recommendedActions: string[];
}

interface SocialPost {
  id: string;
  platform: Platform;
  eventId: string;
  eventName: string;
  artistId: string;
  artistName: string;
  author: string;
  handle: string;
  avatarUrl: string;
  content: string;
  mediaUrl: string;
  platformUrl: string;
  publishedAt: string;
  lastCheckedAt: string;
  nextUpdateAt: string | null;
  updateCadence: UpdateCadence;
  alertStatus: AlertStatus;
  attentionReason: string | null;
  resolvedAt: string | null;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
  };
  analysis: SocialAnalysis;
}

interface SocialSettings {
  hourlyWindowDays: number;
  dailyWindowDays: number;
  dailyUpdateHour: number;
  maxAICallsPerDay: number;
}

interface SocialFilters {
  eventId?: string;
  artistId?: string;
  platform?: Platform;
  status?: AlertStatus | 'attention';
}

const SETTINGS_LIMITS = {
  hourlyWindowDays: { min: 1, max: 5 },
  dailyWindowDays: { min: 4, max: 14 },
  dailyUpdateHour: { min: 5, max: 11 },
  maxAICallsPerDay: { min: 10, max: 500 },
} as const;

const DEFAULT_SETTINGS: SocialSettings = {
  hourlyWindowDays: 3,
  dailyWindowDays: 7,
  dailyUpdateHour: 8,
  maxAICallsPerDay: 120,
};

const isoHoursAgo = (hoursAgo: number) => new Date(Date.now() - (hoursAgo * 60 * 60 * 1000)).toISOString();

const toPositiveInteger = (value: number) => Math.max(0, Math.round(value));

const computeCadence = (publishedAt: string, settings: SocialSettings): UpdateCadence => {
  const ageHours = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60);

  if (ageHours < settings.hourlyWindowDays * 24) {
    return 'hourly';
  }

  if (ageHours < settings.dailyWindowDays * 24) {
    return 'daily';
  }

  return 'on-demand';
};

const computeNextUpdateAt = (lastCheckedAt: string, cadence: UpdateCadence, settings: SocialSettings) => {
  const lastChecked = new Date(lastCheckedAt);

  if (cadence === 'hourly') {
    return new Date(lastChecked.getTime() + (60 * 60 * 1000)).toISOString();
  }

  if (cadence === 'daily') {
    const next = new Date(lastChecked);
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(settings.dailyUpdateHour, 0, 0, 0);
    return next.toISOString();
  }

  return null;
};

const withCadence = (post: Omit<SocialPost, 'updateCadence' | 'nextUpdateAt'>, settings: SocialSettings): SocialPost => {
  const updateCadence = computeCadence(post.publishedAt, settings);
  return {
    ...post,
    updateCadence,
    nextUpdateAt: computeNextUpdateAt(post.lastCheckedAt, updateCadence, settings),
  };
};

const seedPosts = (settings: SocialSettings): SocialPost[] => [
  withCadence({
    id: 'social_ig_1',
    platform: 'instagram',
    eventId: 'evt_summer',
    eventName: 'Summer Music Festival',
    artistId: 'artist_neon',
    artistName: 'Neon Tide',
    author: 'Festival Alerts',
    handle: '@festivalalerts',
    avatarUrl: 'https://api.dicebear.com/7.x/glass/svg?seed=festivalalerts',
    content: 'Doors say 6:00 in the story but the ticket says 5:30. People are already queueing and comments are turning messy.',
    mediaUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80',
    platformUrl: 'https://instagram.com/p/mock-summer-festival-doors',
    publishedAt: isoHoursAgo(18),
    lastCheckedAt: isoHoursAgo(1),
    alertStatus: 'flagged',
    attentionReason: 'Mixed instructions about entry time are driving confusion in comments.',
    resolvedAt: null,
    engagement: {
      likes: 4820,
      comments: 341,
      shares: 122,
      views: 38900,
    },
    analysis: {
      sentimentScore: 38,
      sentimentLabel: 'negative',
      breakdown: { positive: 19, neutral: 24, negative: 57 },
      summary: 'Operational confusion is overwhelming excitement around the show. Comment velocity suggests this can spread without a pinned clarification.',
      flagReason: 'Entry-time confusion is creating avoidable frustration.',
      needsAttention: true,
      priority: 'high',
      keyComments: [
        {
          id: 'c1',
          author: '@kaylalive',
          text: 'Which time is real? We are already outside and staff are saying different things.',
          timestamp: isoHoursAgo(1),
          sentiment: 'negative',
          requiresResponse: true,
          reason: 'Direct operational confusion affecting arrival flow.',
        },
        {
          id: 'c2',
          author: '@drewsound',
          text: 'Love the lineup, but someone needs to pin the actual door time now.',
          timestamp: isoHoursAgo(2),
          sentiment: 'negative',
          requiresResponse: true,
          reason: 'Constructive complaint with a clear resolution path.',
        },
        {
          id: 'c3',
          author: '@northshorebeats',
          text: 'Set times look great once this gets sorted.',
          timestamp: isoHoursAgo(3),
          sentiment: 'neutral',
          requiresResponse: false,
          reason: 'Represents audience patience if clarity is provided fast.',
        },
      ],
      recommendedActions: [
        'Publish a pinned clarification with a single door time.',
        'Brief gate staff so comments and onsite messaging match.',
        'Re-check sentiment one hour after the clarification post.',
      ],
    },
  }, settings),
  withCadence({
    id: 'social_tt_1',
    platform: 'tiktok',
    eventId: 'evt_summer',
    eventName: 'Summer Music Festival',
    artistId: 'artist_luna',
    artistName: 'Luna Vale',
    author: 'Backstage Loop',
    handle: '@backstageloop',
    avatarUrl: 'https://api.dicebear.com/7.x/glass/svg?seed=backstageloop',
    content: 'POV: you hear the first soundcheck hit the field and realize this weekend is about to be chaos in the best way.',
    mediaUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80',
    platformUrl: 'https://tiktok.com/@backstageloop/video/mock-soundcheck',
    publishedAt: isoHoursAgo(9),
    lastCheckedAt: isoHoursAgo(2),
    alertStatus: 'clear',
    attentionReason: null,
    resolvedAt: null,
    engagement: {
      likes: 23100,
      comments: 288,
      shares: 1410,
      views: 192000,
    },
    analysis: {
      sentimentScore: 89,
      sentimentLabel: 'positive',
      breakdown: { positive: 78, neutral: 16, negative: 6 },
      summary: 'This is healthy pre-show hype. The audience is amplifying it without any meaningful support burden.',
      flagReason: null,
      needsAttention: false,
      priority: 'low',
      keyComments: [
        {
          id: 'c4',
          author: '@kiki_rush',
          text: 'This just sold me. Buying my pass tonight.',
          timestamp: isoHoursAgo(2),
          sentiment: 'positive',
          requiresResponse: false,
          reason: 'Strong conversion intent.',
        },
        {
          id: 'c5',
          author: '@nightdrive.fm',
          text: 'Need a full set-time drop immediately.',
          timestamp: isoHoursAgo(3),
          sentiment: 'neutral',
          requiresResponse: false,
          reason: 'Recurring curiosity, not a complaint.',
        },
      ],
      recommendedActions: [
        'Repurpose this clip in the daily recap.',
        'Reply with the set-time announcement teaser.',
      ],
    },
  }, settings),
  withCadence({
    id: 'social_fb_1',
    platform: 'facebook',
    eventId: 'evt_tech',
    eventName: 'TechConf Global',
    artistId: 'artist_keynote',
    artistName: 'Amina Shah',
    author: 'TechConf Community',
    handle: 'TechConf Global',
    avatarUrl: 'https://api.dicebear.com/7.x/glass/svg?seed=techconf',
    content: 'Parking lot B is full and several attendees say the shuttle loop is unclear. Anyone have the official overflow route?',
    mediaUrl: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
    platformUrl: 'https://facebook.com/mock-techconf-parking',
    publishedAt: isoHoursAgo(63),
    lastCheckedAt: isoHoursAgo(6),
    alertStatus: 'watch',
    attentionReason: 'Parking complaints are rising but still contain actionable questions instead of broad backlash.',
    resolvedAt: null,
    engagement: {
      likes: 640,
      comments: 126,
      shares: 39,
      views: 11800,
    },
    analysis: {
      sentimentScore: 52,
      sentimentLabel: 'mixed',
      breakdown: { positive: 21, neutral: 39, negative: 40 },
      summary: 'Audience sentiment is recoverable, but repeated logistics complaints can become event-level criticism if left unanswered.',
      flagReason: 'Parking and transit instructions need an official reply.',
      needsAttention: true,
      priority: 'medium',
      keyComments: [
        {
          id: 'c6',
          author: 'Nora P.',
          text: 'Happy to be here, but the overflow parking signs are missing from Gate 2.',
          timestamp: isoHoursAgo(5),
          sentiment: 'negative',
          requiresResponse: true,
          reason: 'Onsite logistics issue with clear corrective action.',
        },
        {
          id: 'c7',
          author: 'Leon Chen',
          text: 'Sessions are strong once you get inside.',
          timestamp: isoHoursAgo(5),
          sentiment: 'positive',
          requiresResponse: false,
          reason: 'Shows sentiment can recover after entry.',
        },
      ],
      recommendedActions: [
        'Reply with the overflow parking map.',
        'Ask ops to confirm shuttle signage.',
        'Move this post to resolved once comments stop repeating the route question.',
      ],
    },
  }, settings),
  withCadence({
    id: 'social_ig_2',
    platform: 'instagram',
    eventId: 'evt_comedy',
    eventName: 'Comedy Night Special',
    artistId: 'artist_mika',
    artistName: 'Mika Torres',
    author: 'Mika Torres',
    handle: '@mikatorreslive',
    avatarUrl: 'https://api.dicebear.com/7.x/glass/svg?seed=mika',
    content: 'Sold out again. Bringing three surprise openers and a late set. You all really did that.',
    mediaUrl: 'https://images.unsplash.com/photo-1527224857830-43a7acc85260?auto=format&fit=crop&w=1200&q=80',
    platformUrl: 'https://instagram.com/p/mock-comedy-soldout',
    publishedAt: isoHoursAgo(94),
    lastCheckedAt: isoHoursAgo(22),
    alertStatus: 'clear',
    attentionReason: null,
    resolvedAt: null,
    engagement: {
      likes: 9100,
      comments: 412,
      shares: 204,
      views: 55200,
    },
    analysis: {
      sentimentScore: 91,
      sentimentLabel: 'positive',
      breakdown: { positive: 82, neutral: 13, negative: 5 },
      summary: 'The audience is celebrating sellout momentum. There is no active issue, only strong demand and appetite for resale information.',
      flagReason: null,
      needsAttention: false,
      priority: 'low',
      keyComments: [
        {
          id: 'c8',
          author: '@denverlaughs',
          text: 'Need another night added. This is impossible.',
          timestamp: isoHoursAgo(20),
          sentiment: 'positive',
          requiresResponse: false,
          reason: 'Demand signal, not a complaint.',
        },
      ],
      recommendedActions: [
        'Use this momentum in a waitlist post.',
        'Monitor for unofficial resale scams.',
      ],
    },
  }, settings),
  withCadence({
    id: 'social_tt_2',
    platform: 'tiktok',
    eventId: 'evt_film',
    eventName: 'Indie Film Premiere',
    artistId: 'artist_solstice',
    artistName: 'Solstice Pictures',
    author: 'City Screenings',
    handle: '@cityscreenings',
    avatarUrl: 'https://api.dicebear.com/7.x/glass/svg?seed=cityscreenings',
    content: 'Seeing comments saying premiere tickets were refunded, but our order still shows active. Anyone know what is going on?',
    mediaUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80',
    platformUrl: 'https://tiktok.com/@cityscreenings/video/mock-refund-rumor',
    publishedAt: isoHoursAgo(27),
    lastCheckedAt: isoHoursAgo(1),
    alertStatus: 'flagged',
    attentionReason: 'Refund rumor needs a direct correction before it harms conversion.',
    resolvedAt: null,
    engagement: {
      likes: 7800,
      comments: 498,
      shares: 610,
      views: 86400,
    },
    analysis: {
      sentimentScore: 31,
      sentimentLabel: 'negative',
      breakdown: { positive: 15, neutral: 26, negative: 59 },
      summary: 'A refund rumor is driving uncertainty and can materially affect trust if the team does not respond with a factual update.',
      flagReason: 'Refund misinformation is spreading in comments.',
      needsAttention: true,
      priority: 'high',
      keyComments: [
        {
          id: 'c9',
          author: '@moviepulse',
          text: 'If tickets are being canceled, say it clearly before people travel in.',
          timestamp: isoHoursAgo(1),
          sentiment: 'negative',
          requiresResponse: true,
          reason: 'Trust risk tied to attendance decisions.',
        },
        {
          id: 'c10',
          author: '@filmkid',
          text: 'Order page still looks fine for me, but the rumor is everywhere now.',
          timestamp: isoHoursAgo(2),
          sentiment: 'neutral',
          requiresResponse: true,
          reason: 'Confirms rumor reach even among unaffected buyers.',
        },
      ],
      recommendedActions: [
        'Post a direct status clarification from the official account.',
        'Coordinate with support so replies match the public message.',
        'Refresh sentiment hourly until the rumor cools down.',
      ],
    },
  }, settings),
  withCadence({
    id: 'social_fb_2',
    platform: 'facebook',
    eventId: 'evt_film',
    eventName: 'Indie Film Premiere',
    artistId: 'artist_solstice',
    artistName: 'Solstice Pictures',
    author: 'Solstice Pictures',
    handle: 'Solstice Pictures',
    avatarUrl: 'https://api.dicebear.com/7.x/glass/svg?seed=solstice',
    content: 'Director Q&A seats are moving faster than expected. We just opened a second release block for the balcony.',
    mediaUrl: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1200&q=80',
    platformUrl: 'https://facebook.com/mock-premiere-balcony-release',
    publishedAt: isoHoursAgo(190),
    lastCheckedAt: isoHoursAgo(12),
    alertStatus: 'clear',
    attentionReason: null,
    resolvedAt: null,
    engagement: {
      likes: 1420,
      comments: 84,
      shares: 70,
      views: 9600,
    },
    analysis: {
      sentimentScore: 77,
      sentimentLabel: 'positive',
      breakdown: { positive: 63, neutral: 25, negative: 12 },
      summary: 'Conversation is healthy and mainly transactional. This is a candidate for on-demand monitoring only.',
      flagReason: null,
      needsAttention: false,
      priority: 'low',
      keyComments: [
        {
          id: 'c11',
          author: 'Dana W.',
          text: 'Perfect, just grabbed two balcony seats.',
          timestamp: isoHoursAgo(11),
          sentiment: 'positive',
          requiresResponse: false,
          reason: 'Direct conversion confirmation.',
        },
      ],
      recommendedActions: [
        'Leave this on on-demand monitoring.',
        'Surface it in the event sales recap.',
      ],
    },
  }, settings),
];

class SocialCommandCenterService {
  private settings: SocialSettings = { ...DEFAULT_SETTINGS };
  private posts: SocialPost[] = seedPosts(DEFAULT_SETTINGS);
  private aiUsage = {
    usedToday: 18,
    lastResetAt: new Date().toISOString().slice(0, 10),
  };

  private resetUsageIfNeeded() {
    const today = new Date().toISOString().slice(0, 10);
    if (this.aiUsage.lastResetAt !== today) {
      this.aiUsage = {
        usedToday: 0,
        lastResetAt: today,
      };
    }
  }

  private reapplyCadences() {
    this.posts = this.posts.map((post) => {
      const { nextUpdateAt: _nextUpdateAt, updateCadence: _updateCadence, ...basePost } = post;
      return withCadence(basePost, this.settings);
    });
  }

  private getEvents() {
    const map = new Map<string, { id: string; name: string }>();

    this.posts.forEach((post) => {
      map.set(post.eventId, { id: post.eventId, name: post.eventName });
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  private getArtists() {
    const map = new Map<string, { id: string; name: string; eventIds: string[] }>();

    this.posts.forEach((post) => {
      const current = map.get(post.artistId);
      if (current) {
        if (!current.eventIds.includes(post.eventId)) {
          current.eventIds.push(post.eventId);
        }
        return;
      }

      map.set(post.artistId, {
        id: post.artistId,
        name: post.artistName,
        eventIds: [post.eventId],
      });
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  private getFilteredPosts(filters: SocialFilters = {}) {
    return this.posts.filter((post) => {
      if (filters.eventId && post.eventId !== filters.eventId) {
        return false;
      }

      if (filters.artistId && post.artistId !== filters.artistId) {
        return false;
      }

      if (filters.platform && post.platform !== filters.platform) {
        return false;
      }

      if (filters.status) {
        if (filters.status === 'attention') {
          return post.analysis.needsAttention && post.alertStatus !== 'resolved';
        }

        if (post.alertStatus !== filters.status) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      const priorityOrder = { flagged: 0, watch: 1, clear: 2, resolved: 3 };
      return priorityOrder[a.alertStatus] - priorityOrder[b.alertStatus] || new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });
  }

  getCommandCenter(filters: SocialFilters = {}) {
    this.resetUsageIfNeeded();

    const posts = this.getFilteredPosts(filters);
    const activePosts = posts.filter((post) => post.alertStatus !== 'resolved');
    const totalSentiment = activePosts.reduce((sum, post) => sum + post.analysis.sentimentScore, 0);
    const aiRemaining = Math.max(0, this.settings.maxAICallsPerDay - this.aiUsage.usedToday);

    return {
      overview: {
        totalPosts: posts.length,
        flaggedPosts: posts.filter((post) => post.alertStatus === 'flagged').length,
        watchPosts: posts.filter((post) => post.alertStatus === 'watch').length,
        resolvedPosts: posts.filter((post) => post.alertStatus === 'resolved').length,
        avgSentimentScore: activePosts.length ? toPositiveInteger(totalSentiment / activePosts.length) : 0,
        attentionNeeded: posts.filter((post) => post.analysis.needsAttention && post.alertStatus !== 'resolved').length,
      },
      platformSummary: ['instagram', 'facebook', 'tiktok'].map((platform) => ({
        platform,
        posts: posts.filter((post) => post.platform === platform).length,
        flagged: posts.filter((post) => post.platform === platform && post.alertStatus === 'flagged').length,
      })),
      alertQueue: posts
        .filter((post) => post.analysis.needsAttention && post.alertStatus !== 'resolved')
        .slice(0, 4),
      posts,
      events: this.getEvents(),
      artists: this.getArtists(),
      settings: this.settings,
      limits: SETTINGS_LIMITS,
      aiUsage: {
        usedToday: this.aiUsage.usedToday,
        remainingToday: aiRemaining,
        maxPerDay: this.settings.maxAICallsPerDay,
        lastResetAt: this.aiUsage.lastResetAt,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  updateSettings(nextSettings: SocialSettings) {
    this.settings = { ...nextSettings };
    this.reapplyCadences();
    return this.getCommandCenter();
  }

  resolvePost(postId: string) {
    this.posts = this.posts.map((post) => post.id === postId ? {
      ...post,
      alertStatus: 'resolved',
      attentionReason: null,
      resolvedAt: new Date().toISOString(),
      analysis: {
        ...post.analysis,
        needsAttention: false,
        flagReason: null,
        priority: 'low',
      },
    } : post);

    return this.posts.find((post) => post.id === postId) || null;
  }

  async refreshPost(postId: string) {
    this.resetUsageIfNeeded();

    if (this.aiUsage.usedToday >= this.settings.maxAICallsPerDay) {
      const error = new Error('Daily AI analysis cap reached');
      Object.assign(error, { statusCode: 429 });
      throw error;
    }

    const target = this.posts.find((post) => post.id === postId);

    if (!target) {
      return null;
    }

    const analysis = await aiService.analyzeSocialPost(
      {
        platform: target.platform,
        author: target.handle,
        content: target.content,
        eventName: target.eventName,
        artistName: target.artistName,
      },
      target.analysis.keyComments.map((comment) => ({
        author: comment.author,
        text: comment.text,
      })),
    );

    this.aiUsage.usedToday += 1;

    this.posts = this.posts.map((post) => {
      if (post.id !== postId) {
        return post;
      }

      const lastCheckedAt = new Date().toISOString();
      const alertStatus: AlertStatus = analysis.needsAttention
        ? (analysis.priority === 'high' ? 'flagged' : 'watch')
        : 'clear';

      return withCadence({
        ...post,
        lastCheckedAt,
        alertStatus,
        attentionReason: analysis.flagReason,
        resolvedAt: null,
        analysis: {
          ...analysis,
          keyComments: analysis.keyComments.map((comment, index) => ({
            id: `${post.id}_refresh_${index}`,
            timestamp: lastCheckedAt,
            ...comment,
          })),
        },
      }, this.settings);
    });

    return this.posts.find((post) => post.id === postId) || null;
  }
}

export const socialCommandCenterService = new SocialCommandCenterService();
