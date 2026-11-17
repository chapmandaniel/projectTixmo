// T143 (Labs demo): one standard accent across the dashboard, the Tixmo brand
// purple (the purple in the Tixmo logo). This file is the single source of
// truth. It publishes the colour as CSS variables on <html> so every page,
// modal and portal can read it, and charts read the hex directly.
//
// Other colours are only for meaning: green healthy/success, amber warning or
// needs attention, red error or likely scam.

export const BRAND_ACCENT = {
    hex: '#b030fc',
    rgb: '176 48 252',
    // Softer tint of the same purple for small text on the dark theme.
    softHex: '#c77dff',
};

export const brandAccentStyle = () => ({
    '--brand-accent': BRAND_ACCENT.hex,
    '--brand-accent-rgb': BRAND_ACCENT.rgb,
    '--brand-accent-soft': BRAND_ACCENT.softHex,
});

export const applyBrandAccent = (root = typeof document !== 'undefined' ? document.documentElement : null) => {
    if (!root?.style) return;
    Object.entries(brandAccentStyle()).forEach(([name, value]) => root.style.setProperty(name, value));
};

applyBrandAccent();

// Tailwind class helpers that read the brand accent variables.
export const accentClasses = {
    bar: 'bg-[var(--brand-accent)]',
    text: 'text-[var(--brand-accent-soft)]',
    textHover: 'hover:text-[var(--brand-accent-soft)]',
    tint: 'bg-[rgb(var(--brand-accent-rgb)/0.14)]',
    tintStrong: 'bg-[rgb(var(--brand-accent-rgb)/0.22)]',
    tintFaint: 'bg-[rgb(var(--brand-accent-rgb)/0.35)]',
    glow: 'bg-[rgb(var(--brand-accent-rgb)/0.12)]',
    border: 'border-[rgb(var(--brand-accent-rgb)/0.45)]',
    ring: 'focus-visible:ring-[var(--brand-accent)]',
    button: 'border-[var(--brand-accent)] bg-[var(--brand-accent)] text-white hover:brightness-110',
};
