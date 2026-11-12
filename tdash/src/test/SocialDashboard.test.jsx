import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SocialDashboardApp from '../features/socialDashboard/SocialDashboardApp';

global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
};

const mount = (entry = '/social') => render(
    <MemoryRouter initialEntries={[entry]}>
        <Routes>
            <Route path="/social/*" element={<SocialDashboardApp isDark basePath="/social" />} />
        </Routes>
    </MemoryRouter>
);

describe('Social dashboard prototype', () => {
    it('walks Home to a post and what fans said', async () => {
        mount('/social');

        expect(screen.getByRole('heading', { name: 'Social' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Needs your attention' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'What happened' })).toBeInTheDocument();
        expect(screen.getAllByText('People reached').length).toBeGreaterThan(0);
        expect(screen.getByText(/Last 28 days/)).toBeInTheDocument();
        expect(screen.getByRole('navigation', { name: 'Social dashboard' })).toHaveTextContent('Home');
        expect(screen.getByRole('navigation', { name: 'Social dashboard' })).toHaveTextContent('Fans');
        expect(screen.queryByRole('link', { name: 'Listening' })).not.toBeInTheDocument();
        expect(screen.queryByText(/percentile/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/share of voice/i)).not.toBeInTheDocument();

        fireEvent.click(screen.getByText(/Your Aurora After Dark Reel was your best post this month/));

        expect(await screen.findByText('Better than 8 of your last 10 Reels')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'What fans loved' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'What fans complained about' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Questions fans asked' })).toBeInTheDocument();
        expect(screen.getAllByText('Mira Chen (demo)').length).toBeGreaterThan(0);
    });

    it('renders Fans and Accounts', () => {
        mount('/social/fans');
        expect(screen.getByRole('heading', { name: 'Fans' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Needs reply' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Mentions' })).toBeInTheDocument();

        mount('/social/accounts');
        expect(screen.getByRole('heading', { name: 'Accounts' })).toBeInTheDocument();
        expect(screen.getAllByText('@northlight.live.demo').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Not available for this account yet').length).toBeGreaterThan(0);
    });
});
