import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { BRAND_ACCENT, accentClasses } from '../lib/brandAccent';
import { DashboardSurface, DashboardButton } from '../components/dashboard/DashboardPrimitives';
import { CHART_COLORS } from '../components/dashboard/chartTheme';

describe('T143 brand accent', () => {
    it('publishes one Tixmo purple token on the document', () => {
        expect(BRAND_ACCENT.hex).toBe('#b030fc');
        expect(document.documentElement.style.getPropertyValue('--brand-accent')).toBe('#b030fc');
        expect(document.documentElement.style.getPropertyValue('--brand-accent-rgb')).toBe('176 48 252');
        expect(CHART_COLORS.current).toBe(BRAND_ACCENT.hex);
    });

    it('draws every surface strip and primary button in the brand purple, never a gradient', () => {
        const { container } = render(
            <>
                <DashboardSurface isDark accent="green">a</DashboardSurface>
                <DashboardSurface isDark accent="violet">b</DashboardSurface>
                <DashboardButton isDark>Go</DashboardButton>
            </>
        );
        const strips = container.querySelectorAll('[data-testid="surface-accent"]');
        expect(strips).toHaveLength(2);
        strips.forEach((strip) => {
            expect(strip.className).toContain(accentClasses.bar);
            expect(strip.className).not.toMatch(/gradient|from-|to-/);
        });
        expect(container.querySelector('button').className).toContain('bg-[var(--brand-accent)]');
    });
});
