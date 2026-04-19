/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Exo', 'ui-sans-serif', 'system-ui', 'sans-serif'],
            },
            colors: {
                dashboard: {
                    shell: '#151521',
                    topbar: '#1f1e30',
                    panel: '#1e1e2d',
                    panelStrong: '#1f1f31',
                    panelMuted: '#171723',
                    panelAlt: '#232336',
                    border: '#2b2b40',
                    borderStrong: '#31324a',
                    borderMuted: '#242438',
                    control: '#2a2b40',
                    muted: '#a1a5b7',
                    nav: '#8e8fa6',
                    subtle: '#5e6278',
                    subtleAlt: '#70738a',
                    icon: '#4a4d64',
                    accent: '#ff3366',
                    accentSoft: '#ff8a3d',
                },
            },
            boxShadow: {
                'dashboard-soft': '0 18px 45px rgba(8, 10, 24, 0.18)',
                'dashboard-glow': '0 0 18px rgba(255, 255, 255, 0.06)',
            },
            borderRadius: {
                dashboard: '1rem',
            },
        },
    },
    plugins: [],
}
