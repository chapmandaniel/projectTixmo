import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import BrandProtectionView from '../features/BrandProtectionView';
import DashboardLayout from '../layouts/DashboardLayout';
import api from '../lib/api';

vi.mock('../lib/api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    },
}));

const hostile = '<script>alert(1)</script><img src="https://evil.example/phish" onerror="alert(1)">';
const matchUrl = 'https://evil.example/phish';

const matchPayload = {
    data: {
        success: true,
        data: {
            newCount: 1,
            matches: [{
                id: 'match-1',
                status: 'NEW',
                category: 'FAKE_CONTEST',
                platform: 'X',
                sourceUrl: matchUrl,
                matchedText: hostile,
                matchedRule: 'contest keyword',
                accountHandle: 'fake-organizer',
                suspectDisplayName: 'Fake <b>Org</b>',
                platformAccountId: 'suspect-1',
                evidencePhones: ['7095550100'],
                evidenceEmails: ['scam@example.test'],
                detectedAt: '2026-11-01T00:00:00.000Z',
            }],
        },
    },
};

const ok = (data) => Promise.resolve({ data: { success: true, data } });

describe('Brand protection', () => {
    beforeEach(() => {
        window.__TIXMO_CONFIG__ = { giveawayProtection: 'true' };
        api.get.mockImplementation((url) => {
            if (url.startsWith('/brand-protection/matches')) return Promise.resolve(matchPayload);
            if (url.startsWith('/brand-protection/checker-status')) {
                return ok({ statuses: [{ platform: 'X', state: 'CAPTCHA', reportedAt: '2026-11-01T00:00:00.000Z' }] });
            }
            if (url.startsWith('/brand-protection/accounts')) return ok({ accounts: [] });
            if (url.startsWith('/brand-protection/giveaways')) return ok({ giveaways: [] });
            if (url.startsWith('/events')) return ok({ events: [{ id: 'event-1', name: 'Harbour Show' }] });
            if (url.startsWith('/notifications') || url.startsWith('/approvals')) {
                return Promise.resolve({ data: { notifications: [], approvals: [] } });
            }
            return ok({});
        });
    });

    afterEach(() => {
        delete window.__TIXMO_CONFIG__;
        vi.clearAllMocks();
    });

    test('shows both tabs, checker status, and renders hostile post text inert', async () => {
        const { container } = render(<BrandProtectionView isDark user={{ role: 'OWNER' }} />);
        expect(await screen.findByRole('tab', { name: 'Official accounts and giveaways' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Suspicious profiles and contests' })).toBeInTheDocument();
        expect(await screen.findByText('X: Captcha')).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: 'Event' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: 'Suspicious profiles and contests' }));
        expect(await screen.findByText(/<script>alert\(1\)<\/script>/)).toBeInTheDocument();
        expect(screen.getByText(/Fake <b>Org<\/b>/)).toBeInTheDocument();
        expect(screen.getByText('hxxps://evil[.]example/phish')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Copy defanged URL' })).toBeInTheDocument();
        expect(container.querySelector('script')).toBeNull();
        expect(container.querySelector('iframe')).toBeNull();
        expect(container.querySelector('img')).toBeNull();
        expect(container.querySelector('a')).toBeNull();
        expect(container.innerHTML).not.toContain('<script');
        expect(container.innerHTML).not.toContain('<img');
        for (const node of container.querySelectorAll('a, img, iframe, script')) {
            expect(node.getAttribute('href') || '').not.toContain('evil.example');
            expect(node.getAttribute('src') || '').not.toContain('evil.example');
        }
    });

    test('hides the page and the navigation link when the flag is off', async () => {
        window.__TIXMO_CONFIG__ = { giveawayProtection: 'false' };
        const { container } = render(<BrandProtectionView isDark user={{ role: 'OWNER' }} />);
        expect(container).toBeEmptyDOMElement();
        expect(screen.queryByText('Brand protection')).not.toBeInTheDocument();
        expect(api.get).not.toHaveBeenCalled();

        render(
            <MemoryRouter>
                <DashboardLayout activeView="dashboard" user={{ firstName: 'Test', role: 'OWNER' }}>
                    <div>Content</div>
                </DashboardLayout>
            </MemoryRouter>
        );
        expect(screen.queryByRole('link', { name: 'Brand protection' })).not.toBeInTheDocument();
    });

    test('shows the navigation link when the flag is on', async () => {
        render(
            <MemoryRouter>
                <DashboardLayout activeView="dashboard" user={{ firstName: 'Test', role: 'OWNER' }}>
                    <div>Content</div>
                </DashboardLayout>
            </MemoryRouter>
        );
        expect(await screen.findByRole('link', { name: 'Brand protection' })).toHaveAttribute('href', '/brand-protection');
    });
});
