import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, ShieldCheck, ShieldOff, Radar, FileSearch } from 'lucide-react';
import {
    DashboardChip,
    DashboardPage,
    DashboardPageHeader,
    DashboardSection,
    DashboardSurface,
} from '../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../lib/dashboardTheme';
import { cn } from '../../lib/utils';
import { buildSecurityReport, relativeTime } from './securityReport';

const formatCount = (value) => new Intl.NumberFormat('en-CA').format(value);
const formatCompact = (value) => new Intl.NumberFormat('en-CA', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

const HealthyPill = ({ isDark, label = 'Healthy', className }) => (
    <span
        className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-light',
            isDark ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700',
            className
        )}
    >
        <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        {label}
    </span>
);

const Sparkline = ({ values, isDark }) => {
    const max = Math.max(...values, 1);
    return (
        <div className="flex h-10 items-end gap-[3px]" aria-hidden="true">
            {values.map((v, i) => (
                <span
                    key={i}
                    className={cn('w-full rounded-sm', isDark ? 'bg-emerald-400/40' : 'bg-emerald-500/40', i === values.length - 1 && 'bg-emerald-400')}
                    style={{ height: `${Math.max(12, Math.round((v / max) * 100))}%` }}
                />
            ))}
        </div>
    );
};

const KpiTile = ({ isDark, icon: Icon, label, value, detail }) => {
    const theme = getDashboardTheme(isDark);
    return (
        <DashboardSurface isDark={isDark} accent="green" className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
                <p className={cn('text-xs font-light sm:text-sm', theme.textSecondary)}>{label}</p>
                <Icon size={16} className="text-emerald-400" />
            </div>
            <p className={cn('mt-2 text-3xl font-light tracking-tight sm:text-4xl', theme.textPrimary)}>{value}</p>
            <p className={cn('mt-1 text-xs font-light', theme.textMuted)}>{detail}</p>
        </DashboardSurface>
    );
};

const toneStyles = (tone, isDark) => (tone === 'blocked'
    ? (isDark ? 'bg-sky-400/10 text-sky-300' : 'bg-sky-50 text-sky-700')
    : (isDark ? 'bg-emerald-400/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'));

const SecurityView = ({ isDark = true, now: fixedNow }) => {
    const theme = getDashboardTheme(isDark);
    const [now, setNow] = useState(() => fixedNow ?? Date.now());

    useEffect(() => {
        if (fixedNow) return undefined;
        const timer = setInterval(() => setNow(Date.now()), 30 * 1000);
        return () => clearInterval(timer);
    }, [fixedNow]);

    const report = useMemo(() => buildSecurityReport(now), [now]);
    const scannedAgo = relativeTime(report.scannedAt.getTime(), now);

    return (
        <DashboardPage>
            <DashboardPageHeader
                isDark={isDark}
                title="Security"
                icon={ShieldCheck}
                iconClassName="text-emerald-400"
                description="Every log source across Tixmo is analyzed continuously. This report summarizes sign-ins, API traffic, payments, staff actions, door scanning and infrastructure."
                glowTopClassName="bg-emerald-500/10"
                glowBottomClassName="bg-cyan-400/10"
                badges={(
                    <>
                        <HealthyPill isDark={isDark} label="All systems healthy" className="px-3 text-xs" />
                        <DashboardChip isDark={isDark}>
                            <Clock size={12} className="mr-1.5" />
                            Last scanned {scannedAgo}
                        </DashboardChip>
                        <DashboardChip isDark={isDark}>{report.windowLabel}</DashboardChip>
                    </>
                )}
            />

            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                <KpiTile isDark={isDark} icon={FileSearch} label="Log events analyzed" value={formatCompact(report.totals.events)} detail={`${formatCount(report.totals.events)} in the last 24 hours`} />
                <KpiTile isDark={isDark} icon={ShieldOff} label="Threats blocked" value={formatCount(report.totals.blocked)} detail="Stopped automatically, no action needed" />
                <KpiTile isDark={isDark} icon={CheckCircle2} label="Healthy surfaces" value={`${report.totals.healthySources} / ${report.totals.sources}`} detail={`${report.totals.openIncidents} open incidents`} />
                <KpiTile isDark={isDark} icon={Radar} label="Time to detect" value={`${report.totals.detectSeconds}s`} detail="Median, scans every 5 minutes" />
            </div>

            <DashboardSection
                isDark={isDark}
                accent="green"
                title="Log sources"
                description="Each surface is scanned for unusual activity. Green means nothing needs your attention."
            >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="security-sources">
                    {report.sources.map((source) => (
                        <div
                            key={source.id}
                            data-testid={`security-source-${source.id}`}
                            className={cn('flex flex-col gap-4 rounded-md border p-4', theme.panelMuted)}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <span className={cn('flex h-9 w-9 items-center justify-center rounded-md', isDark ? 'bg-emerald-400/10' : 'bg-emerald-50')}>
                                        <source.icon size={18} className="text-emerald-400" />
                                    </span>
                                    <div>
                                        <h3 className={cn('text-sm font-light', theme.textPrimary)}>{source.name}</h3>
                                        <p className={cn('text-xs font-light', theme.textMuted)}>Uptime {source.uptime}</p>
                                    </div>
                                </div>
                                <HealthyPill isDark={isDark} />
                            </div>
                            <Sparkline values={source.trend} isDark={isDark} />
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <p className={cn('text-[10px] uppercase tracking-[0.16em]', theme.textTertiary)}>Events analyzed</p>
                                    <p className={cn('mt-1 text-xl font-light', theme.textPrimary)}>{formatCount(source.events)}</p>
                                </div>
                                <div>
                                    <p className={cn('text-[10px] uppercase tracking-[0.16em]', theme.textTertiary)}>Threats blocked</p>
                                    <p className={cn('mt-1 text-xl font-light', theme.textPrimary)}>{source.blocked}</p>
                                </div>
                            </div>
                            <p className={cn('text-xs font-light leading-5', theme.textSecondary)}>{source.status}</p>
                            <ul className="space-y-1.5">
                                {source.checks.map((check) => (
                                    <li key={check} className={cn('flex items-center gap-2 text-xs font-light', theme.textSecondary)}>
                                        <CheckCircle2 size={13} className="shrink-0 text-emerald-400" />
                                        {check}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </DashboardSection>

            <DashboardSection
                isDark={isDark}
                accent="green"
                title="Recent activity"
                description="What the log analysis noticed most recently. Blocked items were handled automatically."
            >
                <ol className={cn('divide-y', theme.divider)} data-testid="security-feed">
                    {report.feed.map((item) => (
                        <li key={item.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-4">
                            <span className={cn('inline-flex w-fit shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-light', toneStyles(item.tone, isDark))}>
                                {item.tone === 'blocked' ? 'Blocked' : 'Verified'}
                            </span>
                            <span className={cn('flex-1 text-sm font-light', theme.textPrimary)}>{item.text}</span>
                            <span className={cn('shrink-0 text-xs font-light', theme.textMuted)}>
                                {item.sourceName} · {relativeTime(item.at.getTime(), now)}
                            </span>
                        </li>
                    ))}
                </ol>
            </DashboardSection>

            <p className={cn('text-center text-[11px] font-light', theme.textMuted)}>
                Next scan in {Math.max(1, Math.round((report.nextScanAt.getTime() - now) / 60000))} min · Labs preview report
            </p>
        </DashboardPage>
    );
};

export default SecurityView;
