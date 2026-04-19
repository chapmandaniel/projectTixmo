import React from 'react';
import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardHome from '../features/DashboardHome';
import {
    DASHBOARD_HOME_DEFAULT_FAVORITES,
    DASHBOARD_HOME_DEFAULT_HIDDEN,
    DASHBOARD_HOME_TRUTH_ORDER,
    DASHBOARD_HOME_TRUTH_VERSION,
} from '../lib/dashboardTruth';

const apiGet = vi.fn();

vi.mock('../lib/api', () => ({
    default: {
        get: (...args) => apiGet(...args),
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() },
        },
    },
}));

describe('Dashboard truth', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        apiGet.mockResolvedValue({ data: { approvals: [] } });
    });

    it('renders the dashboard home in the pinned truth state by default', async () => {
        await act(async () => {
            render(
                <MemoryRouter>
                    <DashboardHome isDark user={{ firstName: 'Admin' }} />
                </MemoryRouter>
            );
        });

        expect(localStorage.getItem('tixmo_dashboard_prefs_version')).toBe(DASHBOARD_HOME_TRUTH_VERSION);
        expect(JSON.parse(localStorage.getItem('tixmo_dashboard_favorites'))).toEqual(DASHBOARD_HOME_DEFAULT_FAVORITES);
        expect(JSON.parse(localStorage.getItem('tixmo_dashboard_hidden'))).toEqual(DASHBOARD_HOME_DEFAULT_HIDDEN);

        const cards = screen.getAllByTestId(/^dashboard-card-/);
        const orderedIds = cards.map((card) => card.getAttribute('data-card-id'));
        expect(orderedIds).toEqual(DASHBOARD_HOME_TRUTH_ORDER);

        const homeHeading = screen.getByRole('heading', { name: 'Welcome back, Admin' });
        const titleBar = homeHeading.closest('section');
        expect(titleBar?.className).toContain('rounded-md');
        expect(titleBar?.className).toContain('border');
        expect(titleBar?.className).toContain('bg-[#1e1e2d]');

        const eventCard = screen.getByTestId('dashboard-card-events');
        const eventVisibilityButton = within(eventCard).getByTestId('dashboard-visibility-events');
        const eventFavoriteButton = within(eventCard).getByTestId('dashboard-favorite-events');
        const eventFavoriteIcon = eventFavoriteButton.querySelector('svg');
        expect(eventCard.className).toContain('border-[#31324a]');
        expect(eventCard.className).not.toContain('border-white');
        expect(eventVisibilityButton.className).toContain('opacity-0');
        expect(eventFavoriteButton.className).not.toContain('opacity-0');
        expect(eventFavoriteIcon?.className.baseVal || eventFavoriteIcon?.getAttribute('class')).toContain('fill-[#ff3366]');

        const hiddenTeamCard = screen.getByTestId('dashboard-card-team');
        const hiddenTeamVisibilityButton = within(hiddenTeamCard).getByTestId('dashboard-visibility-team');
        const hiddenTeamFavoriteButton = within(hiddenTeamCard).getByTestId('dashboard-favorite-team');
        const hiddenTeamFavoriteIcon = hiddenTeamFavoriteButton.querySelector('svg');
        expect(hiddenTeamCard.className).toContain('border-[#242438]');
        expect(hiddenTeamVisibilityButton.className).toContain('opacity-100');
        expect(hiddenTeamFavoriteIcon?.className.baseVal || hiddenTeamFavoriteIcon?.getAttribute('class')).not.toContain('fill-dashboard-accent');
    });
});
