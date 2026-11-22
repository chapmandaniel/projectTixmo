import React from 'react';
import { getDashboardTheme } from '../../lib/dashboardTheme';
import { cn } from '../../lib/utils';
import { shortDate } from './mooseRead';

// One picture for one question: are we where we should be, and where are we heading?
const W = 760;
const H = 330;
const M = { top: 32, right: 84, bottom: 40, left: 78 };
const count = (value) => new Intl.NumberFormat('en-CA').format(Math.round(value || 0));

const linePath = (points) => points.map((point, index) => `${index ? 'L' : 'M'}${point[0].toFixed(1)},${point[1].toFixed(1)}`).join(' ');

export const SalesPathChart = ({ isDark, path, moments = [] }) => {
    const theme = getDashboardTheme(isDark);
    if (!path?.points?.length) return null;
    const { points, capacity, totalDays, todayDay, best } = path;
    const innerW = W - M.left - M.right;
    const innerH = H - M.top - M.bottom;
    const x = (day) => M.left + (day / totalDays) * innerW;
    const y = (value) => M.top + (1 - Math.min(1, value / capacity)) * innerH;
    const floor = M.top + innerH;

    const usual = points.map((point) => [x(point.day), y(point.usual)]);
    const actualPoints = points.filter((point) => point.actual != null);
    const actual = actualPoints.map((point) => [x(point.day), y(point.actual)]);
    const forecast = points.filter((point) => point.forecast != null).map((point) => [x(point.day), y(point.forecast)]);
    const last = actualPoints[actualPoints.length - 1];
    const first = points[0];
    const end = points[points.length - 1];
    const usualArea = `${linePath(usual)} L${x(end.day).toFixed(1)},${floor} L${x(first.day).toFixed(1)},${floor} Z`;
    const actualArea = actual.length > 1 ? `${linePath(actual)} L${actual[actual.length - 1][0].toFixed(1)},${floor} L${actual[0][0].toFixed(1)},${floor} Z` : null;
    const dayOf = (ms) => Math.max(0, Math.min(totalDays, Math.round((ms - first.ms) / 86400000)));
    const valueAt = (day) => {
        const before = [...actualPoints].reverse().find((point) => point.day <= day);
        return before ? before.actual : 0;
    };
    const todayX = todayDay == null ? null : x(todayDay);
    const marks = moments
        .map((moment) => ({ ...moment, day: dayOf(moment.ms) }))
        .filter((moment) => moment.ms >= first.ms && moment.ms <= (last?.ms ?? end.ms))
        .slice(0, 2);
    const summary = `Tickets sold so far against the usual path for a show like this. ${count(last?.actual || 0)} of ${count(capacity)} sold.${path.finish ? ` Heading for ${path.finish}.` : ''}`;

    return (
        <div data-testid="sales-path-chart">
            <div className={cn('mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-light', theme.textSecondary)}>
                <span className="inline-flex items-center gap-2"><span className="h-[3px] w-5 rounded-full bg-[var(--brand-accent)]" aria-hidden="true" />Tickets sold</span>
                <span className="inline-flex items-center gap-2"><span className={cn('h-2.5 w-5 rounded-sm border-t', isDark ? 'border-white/60 bg-white/15' : 'border-slate-500 bg-slate-200')} aria-hidden="true" />Usual path for a show like this</span>
                {forecast.length > 1 ? <span className="inline-flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-[var(--brand-accent-soft)]" aria-hidden="true" />Where you are heading</span> : null}
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className={cn('h-auto w-full', theme.textMuted)}>
                {[0.25, 0.5, 0.75, 1].map((share) => (
                    <line key={share} x1={M.left} x2={W - M.right} y1={y(capacity * share)} y2={y(capacity * share)} stroke="currentColor" strokeOpacity={share === 1 ? 0.5 : 0.18} strokeDasharray={share === 1 ? undefined : '3 5'} />
                ))}
                <text x={M.left - 8} y={y(capacity) + 4} textAnchor="end" fontSize="14" fill="currentColor">Sold out</text>
                <text x={M.left - 8} y={y(capacity * 0.5) + 4} textAnchor="end" fontSize="14" fill="currentColor">Half full</text>
                <text x={M.left - 8} y={floor + 4} textAnchor="end" fontSize="14" fill="currentColor">0</text>

                <path d={usualArea} fill="currentColor" fillOpacity="0.2" />
                <path d={linePath(usual)} fill="none" stroke="currentColor" strokeOpacity="0.7" strokeWidth="1.5" />
                {actualArea ? <path d={actualArea} fill="var(--brand-accent)" fillOpacity="0.16" /> : null}
                {forecast.length > 1 ? <path d={linePath(forecast)} fill="none" stroke="var(--brand-accent-soft)" strokeWidth="2.5" strokeDasharray="7 6" strokeLinecap="round" /> : null}
                {actual.length > 1 ? <path d={linePath(actual)} fill="none" stroke="var(--brand-accent)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /> : null}

                {marks.map((moment) => (
                    <g key={moment.label} data-testid="sales-path-moment">
                        <line x1={x(moment.day)} x2={x(moment.day)} y1={y(valueAt(moment.day))} y2={floor} stroke="currentColor" strokeOpacity="0.45" strokeDasharray="2 4" />
                        <circle cx={x(moment.day)} cy={y(valueAt(moment.day))} r="5" fill="var(--brand-accent-soft)" />
                        <text x={x(moment.day)} y={y(valueAt(moment.day)) - 10} textAnchor={moment.day > totalDays * 0.7 ? 'end' : 'start'} fontSize="14" fill="currentColor">{moment.label}</text>
                    </g>
                ))}

                {forecast.length > 1 && path.finish ? (
                    <text x={forecast[forecast.length - 1][0] + 8} y={forecast[forecast.length - 1][1] + 5} textAnchor="start" fontSize="14" fill="var(--brand-accent-soft)" data-testid="sales-path-finish">{path.finish}</text>
                ) : null}

                {todayX != null && last ? (
                    <g>
                        <line x1={todayX} x2={todayX} y1={M.top - 6} y2={floor} stroke="currentColor" strokeOpacity="0.55" />
                        <text x={todayX} y={M.top - 12} textAnchor={todayDay > totalDays * 0.85 ? 'end' : 'middle'} fontSize="14" fill="currentColor">Today</text>
                        <circle cx={todayX} cy={y(last.actual)} r="6" fill="var(--brand-accent)" stroke="currentColor" strokeOpacity="0.6" />
                    </g>
                ) : null}

                <text x={M.left} y={H - 8} textAnchor="start" fontSize="14" fill="currentColor">On sale {shortDate(first.ms)}</text>
                <text x={W - M.right} y={H - 8} textAnchor="end" fontSize="14" fill="currentColor">Show day {shortDate(end.ms)}</text>
            </svg>
            {best?.tickets ? (
                <p className={cn('mt-2 text-xs font-light', theme.textMuted)}>
                    Best day so far: {count(best.tickets)} tickets on {shortDate(new Date(`${best.date}T12:00:00Z`).getTime())}.
                </p>
            ) : null}
        </div>
    );
};

export default SalesPathChart;
