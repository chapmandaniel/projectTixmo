import React from 'react';
import { Link } from 'react-router-dom';
import { DashboardSection, DashboardSurface } from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';

export const HeadsUpCards = ({ isDark, cards }) => {
    const theme = getDashboardTheme(isDark);
    if (!cards?.length) return null;

    return (
        <DashboardSection isDark={isDark} accent="brand" title="Heads up">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {cards.map((card) => (
                    <DashboardSurface
                        key={card.id}
                        isDark={isDark}
                        accent="slate"
                        className="flex h-full flex-col border-l-4 border-l-amber-400 p-4"
                    >
                        <p className={cn('text-lg font-light leading-6', theme.textPrimary)}>{card.title}</p>
                        <p className={cn('mt-2 text-sm font-light leading-6', theme.textSecondary)}>{card.reason}</p>
                        {card.to?.startsWith('#') ? (
                            <a
                                href={card.to}
                                className="mt-4 inline-flex items-center text-sm font-light text-pink-400 hover:text-pink-300"
                            >
                                See why
                            </a>
                        ) : card.to ? (
                            <Link
                                to={card.to}
                                className="mt-4 inline-flex items-center text-sm font-light text-pink-400 hover:text-pink-300"
                            >
                                See why
                            </Link>
                        ) : null}
                    </DashboardSurface>
                ))}
            </div>
        </DashboardSection>
    );
};
