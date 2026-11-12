import { dashboardColorTokens } from '../../lib/dashboardTheme';

export const nivoDarkTheme = {
    background: 'transparent',
    text: { fontSize: 11, fill: dashboardColorTokens.muted, fontFamily: 'inherit', fontWeight: 300 },
    axis: {
        domain: { line: { stroke: dashboardColorTokens.border, strokeWidth: 1 } },
        ticks: { line: { stroke: dashboardColorTokens.border, strokeWidth: 1 }, text: { fill: dashboardColorTokens.muted, fontSize: 11 } },
        legend: { text: { fill: dashboardColorTokens.muted, fontSize: 12 } },
    },
    grid: { line: { stroke: dashboardColorTokens.border, strokeWidth: 1, strokeDasharray: '4 4' } },
    legends: { text: { fill: dashboardColorTokens.muted, fontSize: 11 } },
    tooltip: {
        container: {
            background: dashboardColorTokens.shell,
            color: '#e4e4e7',
            fontSize: 12,
            borderRadius: '12px',
            boxShadow: '0 18px 45px rgba(8, 10, 24, 0.28)',
            border: `1px solid ${dashboardColorTokens.border}`,
            padding: '8px 12px',
            fontFamily: 'inherit',
            fontWeight: 300,
        },
    },
    crosshair: { line: { stroke: '#ec4899', strokeWidth: 1, strokeOpacity: 0.5 } },
};

export const nivoLightTheme = {
    background: 'transparent',
    text: { fontSize: 11, fill: '#71717a' },
    axis: {
        domain: { line: { stroke: '#e4e4e7', strokeWidth: 1 } },
        ticks: { line: { stroke: '#e4e4e7', strokeWidth: 1 }, text: { fill: '#a1a1aa', fontSize: 11 } },
        legend: { text: { fill: '#71717a', fontSize: 12 } },
    },
    grid: { line: { stroke: '#f1f5f9', strokeWidth: 1 } },
    legends: { text: { fill: '#71717a', fontSize: 11 } },
    tooltip: {
        container: {
            background: '#ffffff',
            color: '#334155',
            fontSize: 12,
            borderRadius: '12px',
            boxShadow: '0 12px 30px rgba(15, 23, 42, 0.12)',
            border: '1px solid #e2e8f0',
            padding: '8px 12px',
        },
    },
    crosshair: { line: { stroke: '#6366f1', strokeWidth: 1, strokeOpacity: 0.5 } },
};

export const CHART_COLORS = {
    current: '#ec4899',
    prior: '#64748b',
    secondary: '#06b6d4',
    positive: '#10b981',
    negative: '#f43f5e',
    paid: '#f59e0b',
    organic: '#8b5cf6',
    forecast: '#f59e0b',
};

export const getChartTheme = (isDark) => (isDark ? nivoDarkTheme : nivoLightTheme);
