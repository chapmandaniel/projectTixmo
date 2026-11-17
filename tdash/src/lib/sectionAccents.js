// T135 (Labs demo): one accent color per dashboard section, replacing the
// multi-color gradients. This file is the single source of truth: the layout
// exposes the active section's accent as CSS variables, nav items and Home
// shortcut tiles set their own section's variables, and charts read the hex.
//
// Hues avoid the semantic status colors (green healthy, amber warning, red
// error) so status badges keep their meaning on every page.

export const SECTION_ACCENTS = {
    dashboard: { label: 'Home', hex: '#ff5c8a' },
    events: { label: 'Events', hex: '#ff8a5c' },
    todo: { label: 'Tasks', hex: '#3cc8f0' },
    team: { label: 'Team', hex: '#2fd4b0' },
    assets: { label: 'Assets', hex: '#b5e04f' },
    approvals: { label: 'Reviews', hex: '#bd72ff' },
    analytics: { label: 'Analytics', hex: '#5b8cff' },
    security: { label: 'Security', hex: '#8f7dff' },
    social: { label: 'Social', hex: '#f062d8' },
};

// Routes that are not top-level nav items borrow the accent of the section
// they belong to (orders, venues, scanners live under the Event Manager).
const SECTION_ALIASES = {
    orders: 'events',
    venues: 'events',
    scanners: 'events',
    notifications: 'dashboard',
    settings: 'dashboard',
    'staff-actions': 'dashboard',
    'personal-todo': 'todo',
};

export const resolveSection = (view) => {
    const key = String(view || '').replace(/^\//, '').split('/')[0] || 'dashboard';
    if (SECTION_ACCENTS[key]) return key;
    return SECTION_ALIASES[key] || 'dashboard';
};

const hexToRgbTriplet = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

export const getSectionAccent = (view) => {
    const section = resolveSection(view);
    const { hex, label } = SECTION_ACCENTS[section];
    return { section, label, hex, rgb: hexToRgbTriplet(hex) };
};

// Inline style that scopes --section-accent / --section-accent-rgb to an element.
export const sectionAccentStyle = (view) => {
    const { hex, rgb } = getSectionAccent(view);
    return { '--section-accent': hex, '--section-accent-rgb': rgb };
};

// Tailwind class helpers that read the nearest scoped accent variables.
export const accentClasses = {
    bar: 'bg-[var(--section-accent)]',
    text: 'text-[var(--section-accent)]',
    textHover: 'hover:text-[var(--section-accent)]',
    tint: 'bg-[rgb(var(--section-accent-rgb)/0.14)]',
    tintStrong: 'bg-[rgb(var(--section-accent-rgb)/0.22)]',
    tintFaint: 'bg-[rgb(var(--section-accent-rgb)/0.35)]',
    glow: 'bg-[rgb(var(--section-accent-rgb)/0.12)]',
    border: 'border-[rgb(var(--section-accent-rgb)/0.45)]',
    ring: 'focus-visible:ring-[var(--section-accent)]',
    button: 'border-[var(--section-accent)] bg-[var(--section-accent)] text-zinc-950 hover:brightness-110',
};
