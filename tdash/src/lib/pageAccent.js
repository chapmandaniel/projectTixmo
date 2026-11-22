// Labs demo: each dashboard gets one quiet colour of its own, so a page is
// recognisable at a glance without painting everything the brand purple.
//
// The colour is used sparingly: the thin gradient line and soft glow on the
// page header, and the header icon. Buttons, links, focus rings and the
// navigation stay the Tixmo brand purple (src/lib/brandAccent.js) so actions
// look the same on every page. Green, amber and red are kept for meaning
// (healthy, worth a look, problem), so no dashboard uses them as its colour.

import { BRAND_ACCENT } from './brandAccent';

// hex: the line and glow. softHex: small icons on the dark theme.
// inkHex: the same icon on the light theme, dark enough to read on white.
const tone = (hex, rgb, softHex, inkHex) => ({ hex, rgb, softHex, inkHex });

export const PAGE_ACCENTS = {
    dashboard: tone(BRAND_ACCENT.hex, BRAND_ACCENT.rgb, BRAND_ACCENT.softHex, '#9333ea'),
    events: tone('#f472b6', '244 114 182', '#f9a8d4', '#be185d'),
    todo: tone('#818cf8', '129 140 248', '#a5b4fc', '#4338ca'),
    team: tone('#38bdf8', '56 189 248', '#7dd3fc', '#0369a1'),
    assets: tone('#22d3ee', '34 211 238', '#67e8f9', '#0e7490'),
    approvals: tone('#a78bfa', '167 139 250', '#c4b5fd', '#6d28d9'),
    analytics: tone('#60a5fa', '96 165 250', '#93c5fd', '#1d4ed8'),
    security: tone('#2dd4bf', '45 212 191', '#5eead4', '#0f766e'),
    scamswarm: tone('#fb923c', '251 146 60', '#fdba74', '#c2410c'),
    social: tone('#e879f9', '232 121 249', '#f0abfc', '#a21caf'),
};

// Pages without a colour of their own (settings, placeholders) keep the brand purple.
export const pageAccentFor = (view) => PAGE_ACCENTS[view] || PAGE_ACCENTS.dashboard;

/** CSS variables for a page; the header line, glow and icon read them. */
export const pageAccentStyle = (view) => {
    const accent = pageAccentFor(view);
    return {
        '--page-accent': accent.hex,
        '--page-accent-rgb': accent.rgb,
        '--page-accent-soft': accent.softHex,
        '--page-accent-ink': accent.inkHex,
    };
};

// Outside a dashboard page (tests, modals, public pages) these fall back to the brand purple.
export const pageAccentClasses = {
    strip: 'page-accent-strip',
    glow: 'page-accent-glow',
};

export const pageAccentIconStyle = (isDark) => ({
    color: isDark
        ? 'var(--page-accent-soft, var(--brand-accent-soft))'
        : 'var(--page-accent-ink, var(--brand-accent))',
});
