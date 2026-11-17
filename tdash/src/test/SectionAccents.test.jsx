import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { SECTION_ACCENTS, getSectionAccent, resolveSection } from '../lib/sectionAccents';

vi.mock('../lib/api', () => ({
    default: {
        get: vi.fn().mockResolvedValue({ data: { notifications: [] }, approvals: [] }),
        put: vi.fn().mockResolvedValue({}),
        post: vi.fn().mockResolvedValue({}),
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    },
}));

const owner = { firstName: 'Avery', lastName: 'Stone', role: 'OWNER' };

describe('section accents (T135)', () => {
    it('gives every section a distinct accent and maps sub-routes to their section', () => {
        const hexes = Object.values(SECTION_ACCENTS).map((s) => s.hex.toLowerCase());
        expect(new Set(hexes).size).toBe(hexes.length);
        expect(resolveSection('events/abc/orders')).toBe('events');
        expect(resolveSection('scanners')).toBe('events');
        expect(resolveSection('notifications')).toBe('dashboard');
        expect(resolveSection('unknown')).toBe('dashboard');
        expect(getSectionAccent('security').rgb).toMatch(/^\d+ \d+ \d+$/);
    });

    it('scopes the active accent on the shell and colors each nav item with its own section', () => {
        const { container } = render(
            <MemoryRouter>
                <DashboardLayout activeView="security" isDark user={owner} onLogout={vi.fn()}>
                    <div>content</div>
                </DashboardLayout>
            </MemoryRouter>
        );
        const shell = container.firstChild;
        expect(shell.getAttribute('data-section')).toBe('security');
        expect(shell.style.getPropertyValue('--section-accent')).toBe(SECTION_ACCENTS.security.hex);

        const nav = screen.getByRole('navigation', { name: 'Primary' });
        const active = within(nav).getByRole('link', { name: /Security/ });
        expect(active.getAttribute('aria-current')).toBe('page');
        expect(within(active).getByTestId('nav-active-indicator')).toBeTruthy();
        const events = within(nav).getByRole('link', { name: /Events/ });
        expect(events.style.getPropertyValue('--section-accent')).toBe(SECTION_ACCENTS.events.hex);
        expect(within(nav).getAllByTestId('nav-accent-dot').length).toBe(within(nav).getAllByRole('link').length);

        fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
        const mobile = screen.getByRole('navigation', { name: 'Dashboard' });
        expect(within(mobile).getAllByTestId('nav-accent-dot').length).toBe(within(mobile).getAllByRole('link').length);
        expect(within(within(mobile).getByRole('link', { name: /Security/ })).getByTestId('nav-active-indicator')).toBeTruthy();
    });
});
