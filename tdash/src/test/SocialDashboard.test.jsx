import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SocialDashboard from '../features/SocialDashboard';

const { api } = vi.hoisted(() => ({
    api: {
        getCommandCenter: vi.fn(),
        updateSettings: vi.fn(),
        resolvePost: vi.fn(),
        refreshPost: vi.fn(),
    },
}));

vi.mock('../lib/socialCommandCenterApi', () => ({
    socialCommandCenterApi: api,
}));

vi.mock('../features/SocialPostModal', () => ({
    default: () => null,
}));

const basePayload = {
    overview: {
        totalPosts: 3,
        flaggedPosts: 1,
        watchPosts: 1,
        resolvedPosts: 1,
        avgSentimentScore: 58,
        attentionNeeded: 2,
    },
    alertQueue: [
        {
            id: 'post-1',
            platform: 'instagram',
            eventId: 'event-1',
            eventName: 'Summer Jam',
            artistId: 'artist-1',
            artistName: 'Neon Tide',
            attentionReason: 'Comments are confused about door times.',
            nextUpdateAt: '2026-03-29T12:00:00.000Z',
            alertStatus: 'flagged',
            analysis: { priority: 'high', needsAttention: true },
        },
    ],
    posts: [
        {
            id: 'post-1',
            platform: 'instagram',
            eventId: 'event-1',
            eventName: 'Summer Jam',
            artistId: 'artist-1',
            artistName: 'Neon Tide',
            handle: '@festivalalerts',
            mediaUrl: 'https://example.com/post-1.jpg',
            alertStatus: 'flagged',
            updateCadence: 'hourly',
            nextUpdateAt: '2026-03-29T12:00:00.000Z',
            engagement: { comments: 120 },
            attentionReason: 'Comments are confused about door times.',
            analysis: {
                sentimentScore: 38,
                summary: 'Door-time confusion is dominating the conversation.',
                priority: 'high',
                needsAttention: true,
            },
        },
        {
            id: 'post-2',
            platform: 'facebook',
            eventId: 'event-2',
            eventName: 'TechConf Global',
            artistId: 'artist-2',
            artistName: 'Amina Shah',
            handle: 'TechConf Global',
            mediaUrl: 'https://example.com/post-2.jpg',
            alertStatus: 'watch',
            updateCadence: 'daily',
            nextUpdateAt: '2026-03-30T12:00:00.000Z',
            engagement: { comments: 42 },
            attentionReason: 'Parking complaints are rising.',
            analysis: {
                sentimentScore: 52,
                summary: 'Parking and transit instructions need an official reply.',
                priority: 'medium',
                needsAttention: true,
            },
        },
        {
            id: 'post-3',
            platform: 'tiktok',
            eventId: 'event-1',
            eventName: 'Summer Jam',
            artistId: 'artist-3',
            artistName: 'Luna Vale',
            handle: '@backstageloop',
            mediaUrl: 'https://example.com/post-3.jpg',
            alertStatus: 'resolved',
            updateCadence: 'on-demand',
            nextUpdateAt: null,
            engagement: { comments: 18 },
            attentionReason: null,
            analysis: {
                sentimentScore: 89,
                summary: 'This is healthy pre-show hype.',
                priority: 'low',
                needsAttention: false,
            },
        },
    ],
    events: [
        { id: 'event-1', name: 'Summer Jam' },
        { id: 'event-2', name: 'TechConf Global' },
    ],
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
        usedToday: 30,
        remainingToday: 90,
        maxPerDay: 120,
    },
};

describe('SocialDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        api.getCommandCenter.mockResolvedValue(basePayload);
        api.updateSettings.mockResolvedValue(basePayload);
        api.resolvePost.mockResolvedValue({});
        api.refreshPost.mockResolvedValue({});
    });

    it('renders the simplified MVP layout', async () => {
        render(<SocialDashboard isDark />);

        await waitFor(() => {
            expect(screen.getByText('Social Command Center')).toBeInTheDocument();
        });

        expect(screen.getByText('Monitoring board')).toBeInTheDocument();
        expect(screen.getByText('Action queue')).toBeInTheDocument();
        expect(screen.getByText('Automation')).toBeInTheDocument();
        expect(screen.getAllByText('Neon Tide').length).toBeGreaterThan(0);
        expect(screen.getByText('Amina Shah')).toBeInTheDocument();
    });

    it('filters the monitoring board by status', async () => {
        render(<SocialDashboard isDark />);

        await waitFor(() => {
            expect(screen.getByText('Luna Vale')).toBeInTheDocument();
        });

        fireEvent.change(screen.getByLabelText('Social status filter'), {
            target: { value: 'attention' },
        });

        expect(screen.getAllByText('Neon Tide').length).toBeGreaterThan(0);
        expect(screen.getByText('Amina Shah')).toBeInTheDocument();
        expect(screen.queryByText('Luna Vale')).not.toBeInTheDocument();
    });

    it('opens the monitoring rules modal and saves updated settings', async () => {
        render(<SocialDashboard isDark />);

        await waitFor(() => {
            expect(screen.getByText('Monitoring rules')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Monitoring rules'));

        const maxCallsInput = screen.getByDisplayValue('120');
        fireEvent.change(maxCallsInput, {
            target: { value: '140' },
        });

        fireEvent.click(screen.getByText('Save rules'));

        await waitFor(() => {
            expect(api.updateSettings).toHaveBeenCalledWith({
                hourlyWindowDays: 3,
                dailyWindowDays: 7,
                dailyUpdateHour: 8,
                maxAICallsPerDay: 140,
            });
        });
    });
});
