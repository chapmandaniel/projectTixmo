import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, ShieldCheck, Globe, KeyRound, CreditCard, ScanLine } from 'lucide-react';
import {
    DashboardButton,
    DashboardChip,
    DashboardPage,
    DashboardPageHeader,
    DashboardSection,
    DashboardSurface,
} from '../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../lib/dashboardTheme';
import { cn } from '../../lib/utils';
import { MooseChat } from '../../components/dashboard/MooseChat';
import { buildSecurityReport, relativeTime } from './securityReport';
import { answerMooseQuestion, SUGGESTED_QUESTIONS as MOOSE_QUESTIONS } from './securityMooseAnswers';

const formatCount = (value) => new Intl.NumberFormat('en-CA').format(value);

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

const SoftPill = ({ isDark, tone = 'ok', children, className }) => {
    const tones = {
        ok: isDark ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700',
        info: isDark ? 'border-sky-400/30 bg-sky-400/10 text-sky-300' : 'border-sky-200 bg-sky-50 text-sky-700',
        recommended: isDark ? 'border-amber-400/30 bg-amber-400/10 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-800',
        muted: isDark ? 'border-white/10 bg-white/5 text-zinc-300' : 'border-slate-200 bg-slate-100 text-slate-600',
    };
    return (
        <span className={cn('inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-[11px] font-light', tones[tone], className)}>
            {children}
        </span>
    );
};

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

const KpiTile = ({ isDark, icon: Icon, label, value, detail, testId }) => {
    const theme = getDashboardTheme(isDark);
    return (
        <DashboardSurface isDark={isDark} accent="green" className="p-4 sm:p-5" data-testid={testId}>
            <div className="flex items-center justify-between">
                <p className={cn('text-xs font-light sm:text-sm', theme.textSecondary)}>{label}</p>
                <Icon size={16} className="text-emerald-400" />
            </div>
            <p className={cn('mt-2 text-3xl font-light tracking-tight sm:text-4xl', theme.textPrimary)}>{value}</p>
            <p className={cn('mt-1 text-xs font-light', theme.textMuted)}>{detail}</p>
        </DashboardSurface>
    );
};

const toneStyles = (tone, isDark) => {
    if (tone === 'protected') return isDark ? 'bg-sky-400/10 text-sky-300' : 'bg-sky-50 text-sky-700';
    if (tone === 'reviewed') return isDark ? 'bg-sky-400/10 text-sky-300' : 'bg-sky-50 text-sky-700';
    return isDark ? 'bg-emerald-400/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700';
};

const toneLabel = (tone) => {
    if (tone === 'protected') return 'Protected';
    if (tone === 'reviewed') return 'Reviewed';
    return 'All clear';
};

const deviceStatusLabel = (status) => {
    if (status === 'paused') return 'Paused';
    if (status === 'revoked') return 'Revoked';
    return 'Online';
};

const SecurityView = ({ isDark = true, now: fixedNow }) => {
    const theme = getDashboardTheme(isDark);
    const [now, setNow] = useState(() => fixedNow ?? Date.now());
    const [sent, setSent] = useState({});

    useEffect(() => {
        if (fixedNow) return undefined;
        const timer = setInterval(() => setNow(Date.now()), 30 * 1000);
        return () => clearInterval(timer);
    }, [fixedNow]);

    const report = useMemo(() => buildSecurityReport(now), [now]);
    const scannedAgo = relativeTime(report.scannedAt.getTime(), now);
    const team = report.team;

    const markSent = (id, action) => {
        setSent((current) => ({ ...current, [`${id}:${action}`]: true }));
    };

    return (
        <DashboardPage>
            <DashboardPageHeader
                isDark={isDark}
                title="Security"
                icon={ShieldCheck}
                iconClassName="text-emerald-400"
                description="A plain-language look at Northlight Live's own event pages, team dashboard, checkout and door devices — so you can see that your platforms are safe."
                glowTopClassName="bg-emerald-500/10"
                glowBottomClassName="bg-cyan-400/10"
                badges={(
                    <>
                        <HealthyPill isDark={isDark} label="Your platforms look safe" className="px-3 text-xs" />
                        <DashboardChip isDark={isDark}>
                            <Clock size={12} className="mr-1.5" />
                            Last checked {scannedAgo}
                        </DashboardChip>
                        <DashboardChip isDark={isDark}>{report.windowLabel}</DashboardChip>
                    </>
                )}
            />

            <div
                data-testid="security-home-hero"
                className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:h-[460px] lg:items-stretch"
            >
                <div data-testid="security-hero-summary" className="flex min-h-0 flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3">
                        <KpiTile
                            isDark={isDark}
                            icon={Globe}
                            label="Event pages online"
                            value={`${report.totals.pagesOnline} / ${report.totals.pagesTotal}`}
                            detail="HTTPS valid on every page"
                        />
                        <KpiTile
                            isDark={isDark}
                            icon={KeyRound}
                            label="Two-factor on your team"
                            value={`${report.totals.twoFactorOn} / ${report.totals.activeMembers}`}
                            detail={`${report.totals.pendingInvites} invites still pending — 2FA starts when they join`}
                            testId="kpi-two-factor"
                        />
                        <KpiTile
                            isDark={isDark}
                            icon={CreditCard}
                            label="Checkout screening"
                            value="All clear"
                            detail={`${report.totals.chargebackFlags} chargeback-risk flags`}
                        />
                        <KpiTile
                            isDark={isDark}
                            icon={ScanLine}
                            label="Door devices"
                            value="All in order"
                            detail={`${report.totals.devicesOnline} online · ${report.totals.devicesPaused} paused · ${report.totals.devicesRevoked} revoked`}
                        />
                    </div>
                    <DashboardSurface isDark={isDark} accent="green" className="flex flex-1 flex-col p-5 sm:p-6">
                        <h2 className={cn('text-[1.15rem] font-light tracking-tight', theme.textPrimary)}>What this means for you</h2>
                        <p className={cn('mt-2 text-sm font-light leading-6', theme.textSecondary)}>{report.meaning}</p>
                    </DashboardSurface>
                </div>
                <MooseChat
                    isDark={isDark}
                    data={report}
                    askQuestion={answerMooseQuestion}
                    suggestions={MOOSE_QUESTIONS}
                    welcomeText="Hi, I'm Moose, Tixmo's AI assistant. Ask me about how your platforms are doing."
                    resetKey="security"
                />
            </div>

            <DashboardSection
                isDark={isDark}
                accent="green"
                title="Your platforms"
                description="Each surface is checked on a regular cycle. Green means nothing urgent needs your attention."
            >
                <div className="grid gap-4 md:grid-cols-2" data-testid="security-sources">
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
                                        {source.uptime ? (
                                            <p className={cn('text-xs font-light', theme.textMuted)}>Uptime {source.uptime}</p>
                                        ) : (
                                            <p className={cn('text-xs font-light', theme.textMuted)}>Last 24 hours</p>
                                        )}
                                    </div>
                                </div>
                                <HealthyPill isDark={isDark} />
                            </div>
                            <Sparkline values={source.trend} isDark={isDark} />
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <p className={cn('text-[10px] uppercase tracking-[0.16em]', theme.textTertiary)}>{source.metricLabel}</p>
                                    <p className={cn('mt-1 text-xl font-light', theme.textPrimary)}>{formatCount(source.events)}</p>
                                </div>
                                <div>
                                    <p className={cn('text-[10px] uppercase tracking-[0.16em]', theme.textTertiary)}>{source.filterLabel}</p>
                                    <p className={cn('mt-1 text-xl font-light', theme.textPrimary)}>{formatCount(source.blocked)}</p>
                                </div>
                            </div>
                            <p className={cn('text-xs font-light leading-5', theme.textSecondary)}>{source.status}</p>
                            <ul className="space-y-1.5">
                                {source.checks.map((check) => (
                                    <li key={check} className={cn('flex items-start gap-2 text-xs font-light', theme.textSecondary)}>
                                        <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-400" />
                                        {check}
                                    </li>
                                ))}
                            </ul>
                            <div className={cn('mt-auto rounded-md border px-3 py-2.5', isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white/80')}>
                                <p className={cn('text-[10px] uppercase tracking-[0.16em]', theme.textTertiary)}>What this means for you</p>
                                <p className={cn('mt-1 text-xs font-light leading-5', theme.textSecondary)}>{source.meaning}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </DashboardSection>


            <DashboardSection
                isDark={isDark}
                accent="green"
                title="Protection Layers"
                description="The safeguards around your event pages, dashboard and checkout. Each layer is on and healthy. Last-checked times are from the latest review cycle."
            >
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="protection-layers">
                    {report.protection.layers.map((layer) => (
                        <div
                            key={layer.id}
                            data-testid={`protection-layer-${layer.id}`}
                            className={cn('flex flex-col gap-3 rounded-md border p-4', theme.panelMuted)}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <span className={cn('flex h-9 w-9 items-center justify-center rounded-md', isDark ? 'bg-emerald-400/10' : 'bg-emerald-50')}>
                                        <layer.icon size={18} className="text-emerald-400" />
                                    </span>
                                    <h3 className={cn('text-sm font-light', theme.textPrimary)}>{layer.name}</h3>
                                </div>
                                <HealthyPill isDark={isDark} label={layer.status} />
                            </div>
                            <p className={cn('text-xs font-light leading-5', theme.textSecondary)}>{layer.note}</p>
                            <p className={cn('text-xs font-light', theme.textMuted)}>
                                Last checked {relativeTime(layer.checkedAt.getTime(), now)}
                            </p>
                        </div>
                    ))}
                </div>
            </DashboardSection>

            <DashboardSection
                isDark={isDark}
                accent="green"
                title="Suspected Attacks"
                description="Attempts aimed at your event pages, dashboard or checkout. Every one was stopped automatically. Nothing was breached."
            >
                <div data-testid="suspected-attacks">
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="suspected-attacks-summary">
                        <div className={cn('rounded-md border p-4', theme.panelMuted)}>
                            <p className={cn('text-[10px] uppercase tracking-[0.16em]', theme.textTertiary)}>Last 24 hours</p>
                            <p className={cn('mt-2 text-2xl font-light', theme.textPrimary)}>{formatCount(report.attacks.totals.last24h)}</p>
                            <p className={cn('mt-1 text-xs font-light', theme.textMuted)}>Stopped automatically</p>
                        </div>
                        <div className={cn('rounded-md border p-4', theme.panelMuted)}>
                            <p className={cn('text-[10px] uppercase tracking-[0.16em]', theme.textTertiary)}>Last 7 days</p>
                            <p className={cn('mt-2 text-2xl font-light', theme.textPrimary)}>{formatCount(report.attacks.totals.last7d)}</p>
                            <p className={cn('mt-1 text-xs font-light', theme.textMuted)}>Stopped automatically</p>
                        </div>
                        <div className={cn('rounded-md border p-4', theme.panelMuted)}>
                            <p className={cn('text-[10px] uppercase tracking-[0.16em]', theme.textTertiary)}>Last 30 days</p>
                            <p className={cn('mt-2 text-2xl font-light', theme.textPrimary)}>{formatCount(report.attacks.totals.last30d)}</p>
                            <p className={cn('mt-1 text-xs font-light', theme.textMuted)}>Stopped automatically</p>
                        </div>
                        <div className={cn('rounded-md border p-4', theme.panelMuted)}>
                            <p className={cn('text-[10px] uppercase tracking-[0.16em]', theme.textTertiary)}>Reached your platforms</p>
                            <p className={cn('mt-2 text-2xl font-light', theme.textPrimary)}>{report.attacks.totals.reached}</p>
                            <p className={cn('mt-1 text-xs font-light', theme.textMuted)}>{report.attacks.totals.breached} breached · nothing got through</p>
                        </div>
                    </div>
                    <p className={cn('mt-4 text-sm font-light leading-6', theme.textSecondary)}>{report.attacks.summary}</p>
                    <ol className={cn('mt-4 divide-y', isDark ? 'divide-white/5' : 'divide-slate-200')} data-testid="suspected-attacks-list">
                        {report.attacks.items.map((item) => (
                            <li key={item.id} data-testid={item.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:gap-4">
                                <span className={cn('inline-flex w-fit shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-light', toneStyles('protected', isDark))}>
                                    {item.status}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className={cn('text-sm font-light', theme.textPrimary)}>{item.kind}</p>
                                    <p className={cn('mt-1 text-xs font-light leading-5', theme.textSecondary)}>
                                        {item.target} · {item.country} · {item.range}
                                    </p>
                                    <p className={cn('mt-1 text-xs font-light leading-5', theme.textMuted)}>{item.note}</p>
                                </div>
                                <span className={cn('shrink-0 text-xs font-light', theme.textMuted)}>
                                    {relativeTime(item.at.getTime(), now)}
                                </span>
                            </li>
                        ))}
                    </ol>
                </div>
            </DashboardSection>

            <DashboardSection
                isDark={isDark}
                accent="green"
                title="Team Account Health"
                description="A per-person look at two-factor sign-in, weak passwords, and passwords checked against known breach lists. Passwords themselves are never shown. Most of your team looks good; a few people have a simple next step."
            >
                <div data-testid="team-account-health">
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="team-health-summary">
                        <div className={cn('rounded-md border p-4', theme.panelMuted)}>
                            <p className={cn('text-[10px] uppercase tracking-[0.16em]', theme.textTertiary)}>All clear</p>
                            <p className={cn('mt-2 text-2xl font-light', theme.textPrimary)}>{team.totals.allClear}</p>
                            <p className={cn('mt-1 text-xs font-light', theme.textMuted)}>of {team.totals.roster} on the roster, including 1 already-reset breach-list match</p>
                        </div>
                        <div className={cn('rounded-md border p-4', theme.panelMuted)}>
                            <p className={cn('text-[10px] uppercase tracking-[0.16em]', theme.textTertiary)}>Two-factor sign-in</p>
                            <p className={cn('mt-2 text-2xl font-light', theme.textPrimary)}>{team.totals.twoFactorOn} / {team.totals.active}</p>
                            <p className={cn('mt-1 text-xs font-light', theme.textMuted)}>{team.totals.withoutTwoFactor} pending invites have not set up 2FA yet</p>
                        </div>
                        <div className={cn('rounded-md border p-4', theme.panelMuted)}>
                            <p className={cn('text-[10px] uppercase tracking-[0.16em]', theme.textTertiary)}>Weak passwords</p>
                            <p className={cn('mt-2 text-2xl font-light', theme.textPrimary)}>{team.totals.weakPasswords}</p>
                            <p className={cn('mt-1 text-xs font-light', theme.textMuted)}>Action recommended · {team.weakNames.join(' and ')}</p>
                        </div>
                        <div className={cn('rounded-md border p-4', theme.panelMuted)}>
                            <p className={cn('text-[10px] uppercase tracking-[0.16em]', theme.textTertiary)}>Known breach lists</p>
                            <p className={cn('mt-2 text-2xl font-light', theme.textPrimary)}>{team.totals.leakCurrent} current</p>
                            <p className={cn('mt-1 text-xs font-light', theme.textMuted)}>{team.totals.leakResolved} already reset ({team.leakResolvedNames.join(', ')})</p>
                        </div>
                    </div>

                    <ul className="mt-5 divide-y divide-white/5" data-testid="team-health-roster">
                        {team.members.map((member) => {
                            const sentKey = member.nextStep.action ? `${member.id}:${member.nextStep.action}` : null;
                            const alreadySent = sentKey ? Boolean(sent[sentKey]) : false;
                            return (
                                <li
                                    key={member.id}
                                    data-testid={`team-health-${member.id}`}
                                    className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className={cn('text-sm font-light', theme.textPrimary)}>{member.name}</h3>
                                            <SoftPill isDark={isDark} tone="muted">{member.role}</SoftPill>
                                            {member.status === 'pending' ? <SoftPill isDark={isDark} tone="info">Invite pending</SoftPill> : null}
                                            {member.attention === 'recommended' ? <SoftPill isDark={isDark} tone="recommended">Action recommended</SoftPill> : null}
                                            {member.attention === 'resolved' ? <SoftPill isDark={isDark} tone="info">Resolved</SoftPill> : null}
                                            {member.attention === 'clear' ? <SoftPill isDark={isDark} tone="ok">All clear</SoftPill> : null}
                                        </div>
                                        <p className={cn('mt-1 text-xs font-light', theme.textMuted)}>{member.title}</p>
                                        <div className="mt-2 flex flex-col gap-1.5 text-xs font-light">
                                            <p className={theme.textSecondary}>
                                                {member.twoFactor ? '2FA is on' : '2FA not set up yet'}
                                                {' · '}
                                                {member.weakPassword ? 'Password looks weak' : member.status === 'pending' ? 'Password not set yet' : 'Password looks strong'}
                                                {' · '}
                                                {member.leak.label}
                                            </p>
                                            <p className={theme.textMuted}>{member.leak.detail}</p>
                                            <p className={theme.textSecondary}>{member.nextStep.label}</p>
                                        </div>
                                    </div>
                                    {member.nextStep.action ? (
                                        <DashboardButton
                                            isDark={isDark}
                                            variant="secondary"
                                            className="h-9 shrink-0 px-3 py-0 text-xs"
                                            disabled={alreadySent}
                                            onClick={() => markSent(member.id, member.nextStep.action)}
                                        >
                                            {alreadySent ? `${member.nextStep.action} sent (demo)` : member.nextStep.action}
                                        </DashboardButton>
                                    ) : null}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </DashboardSection>

            <DashboardSection
                isDark={isDark}
                accent="green"
                title="Door devices"
                description="All 14 of your door and box-office devices, so you can see what is online, paused or revoked."
            >
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="security-devices">
                    {report.devices.map((device) => (
                        <div key={device.id} data-testid={`security-device-${device.id}`} className={cn('flex items-start justify-between gap-3 rounded-md border p-3', theme.panelMuted)}>
                            <div className="min-w-0">
                                <p className={cn('truncate text-sm font-light', theme.textPrimary)}>{device.name}</p>
                                <p className={cn('mt-0.5 text-xs font-light', theme.textMuted)}>{device.place}</p>
                            </div>
                            <SoftPill isDark={isDark} tone={device.status === 'online' ? 'ok' : 'muted'}>
                                {deviceStatusLabel(device.status)}
                            </SoftPill>
                        </div>
                    ))}
                </div>
            </DashboardSection>

            <DashboardSection
                isDark={isDark}
                accent="green"
                title="Recent activity"
                description="What has happened around your pages, team, checkout and doors. Protected items were handled automatically."
            >
                <ol className={cn('divide-y', isDark ? 'divide-white/5' : 'divide-slate-200')} data-testid="security-feed">
                    {report.feed.map((item) => (
                        <li key={item.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-4">
                            <span className={cn('inline-flex w-fit shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-light', toneStyles(item.tone, isDark))}>
                                {toneLabel(item.tone)}
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
                Next check in {Math.max(1, Math.round((report.nextScanAt.getTime() - now) / 60000))} min · Labs preview report
            </p>
        </DashboardPage>
    );
};

export default SecurityView;
