import React from 'react';
import { Link } from 'react-router-dom';
import { DashboardSection, DashboardSurface } from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { PlatformLogoRow } from './PlatformLogo';

const stripe = {
    urgent: 'border-l-rose-500',
    watch: 'border-l-amber-400',
    calm: 'border-l-emerald-400',
};

const dot = {
    urgent: 'bg-rose-500',
    watch: 'bg-amber-400',
    calm: 'bg-emerald-400',
};

export const AttentionGrid = ({ isDark, cards, href }) => {
    const theme = getDashboardTheme(isDark);
    const rows = cards.length
        ? cards
        : [{
            id: 'all-clear',
            count: 0,
            label: 'All clear',
            severity: 'calm',
            platforms: [],
            context: 'Nothing needs you right now.',
            trend: '',
            actionLabel: null,
            to: null,
        }];

    return (
        <DashboardSection isDark={isDark} accent="brand" title="Needs your attention">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {rows.map((card) => (
                    <DashboardSurface
                        key={card.id}
                        isDark={isDark}
                        accent="slate"
                        className={cn('flex h-full flex-col border-l-4 p-4', stripe[card.severity] || stripe.watch)}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                {card.id === 'all-clear' ? (
                                    <p className={cn('text-lg font-light leading-6', theme.textPrimary)}>All clear, nothing needs you right now.</p>
                                ) : (
                                    <>
                                        <p className={cn('text-4xl font-light tracking-tight', theme.textPrimary)}>{card.count}</p>
                                        <p className={cn('mt-1 text-sm', theme.textSecondary)}>{card.label}</p>
                                    </>
                                )}
                            </div>
                            <span className="inline-flex items-center gap-2">
                                <span className={cn('mt-1 inline-block h-2.5 w-2.5 rounded-full', dot[card.severity] || dot.watch)} aria-hidden />
                                <PlatformLogoRow platforms={card.platforms} />
                            </span>
                        </div>
                        {card.id !== 'all-clear' && card.context ? (
                            <p className={cn('mt-3 text-sm font-light', theme.textSecondary)}>{card.context}</p>
                        ) : null}
                        {card.trend ? (
                            <p className={cn('mt-2 text-xs', theme.textMuted)}>{card.trend}</p>
                        ) : null}
                        {card.actionLabel && card.to ? (
                            <Link
                                to={href(card.to)}
                                className="mt-4 inline-flex items-center justify-center rounded-md border border-dashboard-accent bg-dashboard-accent px-4 py-2.5 text-sm font-light text-white"
                            >
                                {card.actionLabel}
                            </Link>
                        ) : null}
                    </DashboardSurface>
                ))}
            </div>
        </DashboardSection>
    );
};
