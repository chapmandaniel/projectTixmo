import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { BRAND_ACCENT, accentClasses } from '../lib/brandAccent';
import { PAGE_ACCENTS, pageAccentFor, pageAccentStyle } from '../lib/pageAccent';
import {
    DashboardButton,
    DashboardModuleTile,
    DashboardPageHeader,
    DashboardSection,
    DashboardSurface,
} from '../components/dashboard/DashboardPrimitives';
import { CHART_COLORS } from '../components/dashboard/chartTheme';
import DashboardLayout from '../layouts/DashboardLayout';
import stylesheet from '../index.css?raw';

vi.mock('../lib/api', () => ({
    default: {
        get: vi.fn().mockResolvedValue({ data: { notifications: [] }, approvals: [] }),
        put: vi.fn().mockResolvedValue({}),
        post: vi.fn().mockResolvedValue({}),
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    },
}));

// Colours that already mean something on every page: healthy, worth a look, problem.
const STATUS_HEXES = [
    '#34d399', '#10b981', '#4ade80', '#22c55e',
    '#fbbf24', '#f59e0b', '#facc15',
    '#f87171', '#ef4444', '#fb7185', '#f43f5e',
];

describe('brand accent and page accents', () => {
    it('publishes one Tixmo purple token on the document', () => {
        expect(BRAND_ACCENT.hex).toBe('#b030fc');
        expect(document.documentElement.style.getPropertyValue('--brand-accent')).toBe('#b030fc');
        expect(document.documentElement.style.getPropertyValue('--brand-accent-rgb')).toBe('176 48 252');
        expect(CHART_COLORS.current).toBe(BRAND_ACCENT.hex);
    });

    it('keeps cards and sections free of the accent line: only a hero surface draws one', () => {
        const { container } = render(
            <>
                <DashboardSurface isDark>plain</DashboardSurface>
                <DashboardSurface isDark accent="brand">brand</DashboardSurface>
                <DashboardSurface isDark accent="green">green</DashboardSurface>
                <DashboardSection isDark accent="violet" title="A section">section</DashboardSection>
                <DashboardSurface isDark accent="hero">hero</DashboardSurface>
            </>
        );
        const strips = container.querySelectorAll('[data-testid="surface-accent"]');
        expect(strips).toHaveLength(1);
        expect(strips[0].parentElement).toHaveTextContent('hero');
        expect(strips[0].className).toContain('page-accent-strip');
        expect(strips[0].className).not.toContain(accentClasses.bar);
    });

    it('draws one soft gradient line on the page header and keeps primary buttons brand purple', () => {
        render(
            <>
                <DashboardPageHeader isDark title="Security" icon={ShieldCheck} />
                <DashboardButton isDark>Go</DashboardButton>
            </>
        );
        const strips = screen.getAllByTestId('title-accent-strip');
        expect(strips).toHaveLength(1);
        expect(strips[0].className).toContain('page-accent-strip');
        expect(strips[0].className).not.toContain(accentClasses.bar);
        expect(screen.getByRole('button', { name: 'Go' }).className).toContain('bg-[var(--brand-accent)]');

        const rule = stylesheet.slice(stylesheet.indexOf('.page-accent-strip'));
        const body = rule.slice(0, rule.indexOf('}'));
        expect(body).toContain('linear-gradient');
        expect(body).toContain('height: 2px');
        // Falls back to the brand purple when no page has set a colour.
        expect(body).toContain('var(--page-accent-rgb, var(--brand-accent-rgb))');
    });

    it('gives each dashboard its own colour, and never one that already means a status', () => {
        const views = ['dashboard', 'events', 'todo', 'team', 'assets', 'approvals', 'analytics', 'security', 'scamswarm', 'social'];
        expect(Object.keys(PAGE_ACCENTS).sort()).toEqual([...views].sort());
        const hexes = views.map((view) => pageAccentFor(view).hex);
        expect(new Set(hexes).size).toBe(views.length);
        hexes.forEach((hex) => expect(STATUS_HEXES).not.toContain(hex));

        expect(pageAccentFor('dashboard').hex).toBe(BRAND_ACCENT.hex);
        expect(pageAccentFor('a-page-with-no-colour')).toBe(pageAccentFor('dashboard'));
        expect(pageAccentStyle('security')).toEqual({
            '--page-accent': PAGE_ACCENTS.security.hex,
            '--page-accent-rgb': PAGE_ACCENTS.security.rgb,
            '--page-accent-soft': PAGE_ACCENTS.security.softHex,
            '--page-accent-ink': PAGE_ACCENTS.security.inkHex,
        });
    });

    it('tints each Home tile icon with the colour of the dashboard it opens', () => {
        const { container } = render(
            <MemoryRouter>
                <DashboardModuleTile to="/security" isDark item={{ id: 'security', icon: ShieldCheck, label: 'Security', description: 'd' }} />
                <DashboardModuleTile to="/venues" isDark item={{ id: 'venues', icon: ShieldCheck, label: 'Venues', description: 'd' }} />
            </MemoryRouter>
        );
        const [securityIcon, venuesIcon] = [...container.querySelectorAll('a')].map((tile) => tile.querySelector('svg'));
        expect(securityIcon).toHaveStyle({ color: PAGE_ACCENTS.security.softHex });
        // No colour of its own: the brand purple class is left to do its job.
        expect(venuesIcon.style.color).toBe('');
        // The tile itself draws no accent line any more.
        expect(container.querySelector('.page-accent-strip')).toBeNull();
    });

    it('sets the page colour for the open dashboard and leaves the navigation brand purple', () => {
        render(
            <MemoryRouter>
                <DashboardLayout activeView="security" isDark user={{ firstName: 'Avery', lastName: 'Quinlan', role: 'OWNER' }} onLogout={vi.fn()}>
                    <div>Security content</div>
                </DashboardLayout>
            </MemoryRouter>
        );
        const root = document.querySelector('[data-page-accent="security"]');
        expect(root).not.toBeNull();
        expect(root).toHaveTextContent('Security content');
        expect(root.style.getPropertyValue('--page-accent')).toBe(PAGE_ACCENTS.security.hex);
        expect(root.style.getPropertyValue('--page-accent-rgb')).toBe(PAGE_ACCENTS.security.rgb);

        const activeLink = screen.getAllByRole('link', { name: 'Security' })[0];
        expect(activeLink.className).toContain('--brand-accent');
        expect(activeLink.className).not.toContain('--page-accent');
    });
});
