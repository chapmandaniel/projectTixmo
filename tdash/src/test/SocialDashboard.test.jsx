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
    it('walks Overview to a post and its comments on mock data', async () => {
        mount('/social');

        expect(screen.getByRole('heading', { name: 'Social dashboard' })).toBeInTheDocument();
        expect(screen.getByText(/Mock data/)).toBeInTheDocument();
        expect(screen.getByText(/Last 28 complete days/)).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Insights' })).toBeInTheDocument();

        fireEvent.click(screen.getAllByTestId('post-card-ig-reel-aurora')[0]);

        expect(await screen.findByRole('heading', { name: 'Aurora After Dark Reel' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Comment breakdown' })).toBeInTheDocument();
        expect(screen.getAllByText('Mira Chen (demo)').length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Complaints about limited stock/).length).toBeGreaterThan(0);
        expect(screen.getByRole('heading', { name: 'Comments' })).toBeInTheDocument();
    });
});
