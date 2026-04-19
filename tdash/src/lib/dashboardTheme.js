export const dashboardColorTokens = {
    shell: '#151521',
    panel: '#1e1e2d',
    panelAlt: '#232336',
    border: '#2b2b40',
    muted: '#a1a5b7',
    nav: '#8e8fa6',
    subtle: '#5e6278',
    accent: '#ff3366',
    accentSoft: '#ff8a3d',
};

export const getDashboardTheme = (isDark) => {
    if (isDark) {
        return {
            shell: 'bg-dashboard-shell text-zinc-100 selection:bg-dashboard-accent/30',
            shellOverlay: '',
            panel: 'border-[#31324a] bg-[#1f1f31] text-[#f2f2f7]',
            panelMuted: 'border-[#242438] bg-[#171723] text-[#f2f2f7]',
            panelInteractive: 'hover:bg-[#232336]',
            divider: 'border-[#31324a]',
            textPrimary: 'text-[#f2f2f7]',
            textSecondary: 'text-[#a1a5b7]',
            textTertiary: 'text-[#9ea2b6]',
            textMuted: 'text-[#70738a]',
            iconButton: 'text-[#8e8fa6] hover:bg-[#232336] hover:text-white',
            navItem: 'text-[#8e8fa6] hover:bg-[#232336] hover:text-[#f2f2f7]',
            navItemActive: 'bg-dashboard-control text-white shadow-[0_0_15px_rgba(255,255,255,0.05)]',
            chip: 'border border-[#31324a] bg-[#232336] text-[#a1a5b7]',
            quietChip: 'border border-[#242438] bg-[#171723] text-[#70738a]',
            notificationUnread: 'bg-dashboard-accent',
            profile: 'border-dashboard-borderStrong bg-dashboard-panelAlt text-white',
        };
    }

    return {
        shell: 'bg-[#f5f6fa] text-slate-900 selection:bg-slate-200',
        shellOverlay: 'dashboard-grid-light opacity-100',
        panel: 'border-slate-200/90 bg-white text-slate-900 shadow-sm',
        panelMuted: 'border-slate-200/80 bg-slate-50 text-slate-900',
        panelInteractive: 'hover:border-slate-300 hover:bg-white hover:shadow-dashboard-soft',
        divider: 'border-slate-200/80',
        textPrimary: 'text-slate-900',
        textSecondary: 'text-slate-600',
        textTertiary: 'text-slate-500',
        textMuted: 'text-slate-400',
        iconButton: 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
        navItem: 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
        navItemActive: 'bg-slate-900 text-white shadow-sm',
        chip: 'border border-slate-200 bg-slate-50 text-slate-600',
        quietChip: 'bg-slate-100 text-slate-500',
        notificationUnread: 'bg-rose-500',
        profile: 'border-white bg-gradient-to-br from-rose-50 to-orange-50 text-rose-700 shadow-sm',
    };
};

export const dashboardAccentGradients = {
    brand: 'from-pink-500 via-rose-500 to-orange-400',
    violet: 'from-fuchsia-500 via-violet-500 to-cyan-400',
    blue: 'from-sky-500 via-cyan-500 to-blue-500',
    green: 'from-lime-400 via-emerald-500 to-teal-500',
    amber: 'from-amber-400 via-orange-500 to-rose-500',
    slate: 'from-slate-500 via-slate-600 to-slate-700',
};
