import React, { useEffect, useMemo, useState } from 'react';
import {
    Activity,
    AlertTriangle,
    ArrowRight,
    Ban,
    Check,
    Clock,
    Eye,
    Layers,
    LayoutGrid,
    Pause,
    ShieldAlert,
    ShieldCheck,
    Tablet,
    Users,
} from 'lucide-react';
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
import { accentClasses } from '../../lib/brandAccent';
import { AREA_ORDER, LAYER_INFO, areaOf, areaTone, attackInfo, groupLayers } from './securityAreas';

// How this page is meant to be read:
//   colour  = which part of the business a thing is about (securityAreas.js)
//   shape   = what kind of thing it is (dots, ring, bars, device pips)
//   green / amber = is it fine, or worth a look
// When something is fine it stays quiet (a small tick). Only the few things
// worth doing get an amber tint, so they are the first thing the eye finds.

const formatCount = (value) => new Intl.NumberFormat('en-CA').format(value);

const okText = (isDark) => (isDark ? 'text-emerald-300' : 'text-emerald-700');
const nudgeText = (isDark) => (isDark ? 'text-amber-200' : 'text-amber-700');
const neutralBadge = (isDark) => (isDark ? 'bg-white/5 text-zinc-300' : 'bg-slate-100 text-slate-600');
const divider = (isDark) => (isDark ? 'divide-white/5' : 'divide-slate-200');

const HealthyPill = ({ isDark, label = 'Healthy', live = false, className }) => (
    <span
        className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-light',
            isDark ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700',
            className
        )}
    >
        <span className="relative flex h-2 w-2">
            {live ? <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" /> : null}
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        {label}
    </span>
);

const SoftPill = ({ isDark, tone = 'ok', children, className }) => {
    const pillTones = {
        ok: isDark ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700',
        info: isDark ? 'border-sky-400/30 bg-sky-400/10 text-sky-200' : 'border-sky-200 bg-sky-50 text-sky-700',
        recommended: isDark ? 'border-amber-400/30 bg-amber-400/10 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-800',
        muted: isDark ? 'border-white/10 bg-white/5 text-zinc-300' : 'border-slate-200 bg-slate-100 text-slate-600',
    };
    return (
        <span className={cn('inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-light', pillTones[tone], className)}>
            {children}
        </span>
    );
};

// A quiet "this is fine" mark: a small green tick and a word, no box around it.
const OkMark = ({ isDark, icon: Icon = Check, children, className }) => (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 text-xs font-light', okText(isDark), className)}>
        <Icon size={13} aria-hidden="true" />
        {children}
    </span>
);

const AreaBadge = ({ area, isDark, icon, size = 'md', className }) => {
    const Icon = icon || areaOf(area).icon;
    return (
        <span
            aria-hidden="true"
            className={cn(
                'flex shrink-0 items-center justify-center rounded-md',
                size === 'sm' ? 'h-7 w-7' : 'h-9 w-9',
                areaTone(area, isDark).badge,
                className
            )}
        >
            <Icon size={size === 'sm' ? 14 : 18} />
        </span>
    );
};

const SectionTitle = ({ icon: Icon, area, isDark, children }) => (
    <span className="flex items-center gap-3">
        <span
            aria-hidden="true"
            className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md', area ? areaTone(area, isDark).badge : neutralBadge(isDark))}
        >
            <Icon size={16} />
        </span>
        <span>{children}</span>
    </span>
);

// --- Small pictures, one shape per kind of thing ---------------------------

const Bars = ({ values, tone, className }) => {
    const max = Math.max(...values, 1);
    return (
        <div className={cn('flex h-10 items-end gap-[3px]', className)} aria-hidden="true">
            {values.map((v, i) => (
                <span
                    key={i}
                    className={cn('w-full rounded-sm', i === values.length - 1 ? tone.fill : tone.fillSoft)}
                    style={{ height: `${Math.max(12, Math.round((v / max) * 100))}%` }}
                />
            ))}
        </div>
    );
};

// One dot per page: lit when the page is online.
const PageDots = ({ total, online, tone }) => (
    <div className="grid w-fit grid-cols-10 gap-1" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
            <span key={i} className={cn('h-1.5 w-1.5 rounded-full', i < online ? tone.fill : tone.fillSoft)} />
        ))}
    </div>
);

const Ring = ({ value, total, tone, size = 44 }) => {
    const radius = 17;
    const around = 2 * Math.PI * radius;
    const share = total ? Math.min(1, value / total) : 0;
    return (
        <svg width={size} height={size} viewBox="0 0 44 44" className="-rotate-90" aria-hidden="true">
            <circle cx="22" cy="22" r={radius} fill="none" strokeWidth="5" className={tone.track} />
            <circle
                cx="22"
                cy="22"
                r={radius}
                fill="none"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${around * share} ${around}`}
                className={tone.stroke}
            />
        </svg>
    );
};

// One upright pip per door device: filled when online, amber outline when
// paused, greyed out when revoked.
const DevicePips = ({ devices, tone, isDark, className }) => (
    <div className={cn('flex items-end gap-[3px] sm:gap-1', className)} aria-hidden="true">
        {devices.map((device) => (
            <span
                key={device.id}
                className={cn(
                    'h-4 w-1.5 rounded-full',
                    device.status === 'online' && tone.fill,
                    device.status === 'paused' && 'border border-amber-400',
                    device.status === 'revoked' && (isDark ? 'bg-zinc-600' : 'bg-slate-300')
                )}
            />
        ))}
    </div>
);

// One dot per person: green all clear, amber worth a nudge, hollow not joined yet.
const RosterDots = ({ members, isDark }) => (
    <div className="grid w-fit grid-cols-11 gap-1" aria-hidden="true">
        {members.map((member) => (
            <span
                key={member.id}
                className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    member.status === 'pending' && (isDark ? 'border border-zinc-500' : 'border border-slate-400'),
                    member.status !== 'pending' && member.weakPassword && 'bg-amber-400',
                    member.status !== 'pending' && !member.weakPassword && 'bg-emerald-400'
                )}
            />
        ))}
    </div>
);

// --- Top tiles: the four vital signs ---------------------------------------

const VitalTile = ({ isDark, area, label, value, detail, visual, testId }) => {
    const theme = getDashboardTheme(isDark);
    return (
        <DashboardSurface isDark={isDark} className="p-4" data-testid={testId}>
            <div className="flex items-center gap-2.5">
                <AreaBadge area={area} isDark={isDark} size="sm" />
                <p className={cn('text-xs font-light sm:text-sm', theme.textSecondary)}>{label}</p>
            </div>
            <div className="mt-2 flex flex-col gap-2 sm:h-11 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
                <p className={cn('text-2xl font-light tracking-tight sm:text-[1.9rem] sm:leading-none', theme.textPrimary)}>{value}</p>
                <div className="flex shrink-0 items-end sm:h-11">{visual}</div>
            </div>
            <p className={cn('mt-2 text-xs font-light', theme.textMuted)}>{detail}</p>
        </DashboardSurface>
    );
};

const SummaryTile = ({ isDark, tone = 'plain', icon: Icon, iconClassName, label, value, detail, visual }) => {
    const theme = getDashboardTheme(isDark);
    const surface = tone === 'nudge'
        ? (isDark ? 'border-amber-400/30 bg-amber-400/5' : 'border-amber-200 bg-amber-50')
        : theme.panelMuted;
    return (
        <div className={cn('rounded-md border p-4', surface)}>
            <div className="flex items-center gap-2">
                {Icon ? <Icon size={14} aria-hidden="true" className={iconClassName} /> : null}
                <p className={cn('text-xs font-light', tone === 'nudge' ? nudgeText(isDark) : theme.textSecondary)}>{label}</p>
            </div>
            <div className="mt-2 flex items-end justify-between gap-3">
                <p className={cn('text-2xl font-light', theme.textPrimary)}>{value}</p>
                {visual ? <div className="shrink-0 pb-1">{visual}</div> : null}
            </div>
            <p className={cn('mt-1 text-xs font-light leading-5', theme.textMuted)}>{detail}</p>
        </div>
    );
};

// --- Team roster -----------------------------------------------------------

const initials = (name) => name.split(' ').map((part) => part[0]).slice(0, 2).join('');

const Fact = ({ isDark, state, children }) => {
    const theme = getDashboardTheme(isDark);
    if (state === 'nudge') {
        return (
            <span className={cn('inline-flex items-center gap-1.5', nudgeText(isDark))}>
                <AlertTriangle size={12} aria-hidden="true" />
                {children}
            </span>
        );
    }
    if (state === 'waiting') {
        return (
            <span className={cn('inline-flex items-center gap-1.5', theme.textMuted)}>
                <span aria-hidden="true" className={cn('h-2 w-2 rounded-full border', isDark ? 'border-zinc-500' : 'border-slate-400')} />
                {children}
            </span>
        );
    }
    return (
        <span className={cn('inline-flex items-center gap-1.5', theme.textSecondary)}>
            <Check size={12} aria-hidden="true" className={okText(isDark)} />
            {children}
        </span>
    );
};

const memberFacts = (member) => {
    const pending = member.status === 'pending';
    return [
        { id: '2fa', state: member.twoFactor ? 'ok' : 'waiting', text: member.twoFactor ? '2FA is on' : '2FA not set up yet' },
        {
            id: 'password',
            state: member.weakPassword ? 'nudge' : pending ? 'waiting' : 'ok',
            text: member.weakPassword ? 'Password looks weak' : pending ? 'Password not set yet' : 'Password looks strong',
        },
        { id: 'breach', state: pending ? 'waiting' : 'ok', text: member.leak.label },
    ];
};

const TeamRow = ({ member, isDark, sent, onSend }) => {
    const theme = getDashboardTheme(isDark);
    const pending = member.status === 'pending';
    const quiet = member.attention === 'clear';
    const action = member.nextStep.action;
    return (
        <li
            data-testid={`team-health-${member.id}`}
            className={cn(
                'flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center',
                member.weakPassword
                    ? (isDark ? 'border-amber-400/30 bg-amber-400/5' : 'border-amber-200 bg-amber-50')
                    : theme.panelMuted,
                !quiet && 'lg:col-span-2'
            )}
        >
            <div className="flex min-w-0 flex-1 items-start gap-3">
                <span
                    aria-hidden="true"
                    className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-light',
                        pending
                            ? (isDark ? 'border border-dashed border-zinc-600 text-zinc-400' : 'border border-dashed border-slate-300 text-slate-500')
                            : areaTone('account', isDark).badge
                    )}
                >
                    {initials(member.name)}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h3 className={cn('text-sm font-light', theme.textPrimary)}>{member.name}</h3>
                        {pending ? <SoftPill isDark={isDark} tone="info">Invite pending</SoftPill> : null}
                        {member.weakPassword ? <SoftPill isDark={isDark} tone="recommended">Action recommended</SoftPill> : null}
                        {member.attention === 'resolved' ? <SoftPill isDark={isDark} tone="muted">Resolved</SoftPill> : null}
                    </div>
                    <p className={cn('mt-0.5 text-xs font-light', theme.textMuted)}>{member.role} · {member.title}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-light">
                        {memberFacts(member).map((fact) => (
                            <Fact key={fact.id} isDark={isDark} state={fact.state}>{fact.text}</Fact>
                        ))}
                    </div>
                    {quiet ? null : (
                        <p className={cn('mt-2 text-xs font-light leading-5', theme.textSecondary)}>
                            {member.nextStep.label}
                            {member.attention === 'resolved' ? <span className={theme.textMuted}> {member.leak.detail}</span> : null}
                        </p>
                    )}
                </div>
            </div>
            {action ? (
                <DashboardButton
                    isDark={isDark}
                    variant="secondary"
                    className="h-9 shrink-0 px-3 py-0 text-xs"
                    disabled={sent}
                    onClick={() => onSend(member.id, action)}
                >
                    {sent ? `${action} sent (demo)` : action}
                </DashboardButton>
            ) : null}
        </li>
    );
};

// --- Door devices ----------------------------------------------------------

const deviceStatusLabel = (status) => {
    if (status === 'paused') return 'Paused';
    if (status === 'revoked') return 'Revoked';
    return 'Online';
};

const DeviceCard = ({ device, isDark }) => {
    const theme = getDashboardTheme(isDark);
    const online = device.status === 'online';
    const paused = device.status === 'paused';
    const DeviceIcon = paused ? Pause : !online ? Ban : device.id.startsWith('tablet') ? Tablet : areaOf('doors').icon;
    return (
        <div
            data-testid={`security-device-${device.id}`}
            className={cn('flex items-center gap-3 rounded-md border p-3', theme.panelMuted)}
        >
            <span
                aria-hidden="true"
                className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                    online && areaTone('doors', isDark).badge,
                    paused && (isDark ? 'bg-amber-400/10 text-amber-200' : 'bg-amber-100 text-amber-700'),
                    !online && !paused && neutralBadge(isDark)
                )}
            >
                <DeviceIcon size={15} />
            </span>
            <div className="min-w-0 flex-1">
                <p className={cn('truncate text-sm font-light', online || paused ? theme.textPrimary : cn(theme.textMuted, 'line-through'))}>{device.name}</p>
                <p className={cn('mt-0.5 truncate text-xs font-light', theme.textMuted)}>{device.place}</p>
            </div>
            {online ? (
                <span className={cn('inline-flex shrink-0 items-center gap-1.5 text-xs font-light', okText(isDark))}>
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Online
                </span>
            ) : (
                <SoftPill isDark={isDark} tone={paused ? 'recommended' : 'muted'}>{deviceStatusLabel(device.status)}</SoftPill>
            )}
        </div>
    );
};

// --- Activity feed ---------------------------------------------------------

const FeedTone = ({ tone, isDark }) => {
    if (tone === 'protected') {
        return (
            <SoftPill isDark={isDark} tone="ok">
                <ShieldCheck size={11} aria-hidden="true" />
                Protected
            </SoftPill>
        );
    }
    if (tone === 'reviewed') {
        return (
            <SoftPill isDark={isDark} tone="muted">
                <Eye size={11} aria-hidden="true" />
                Reviewed
            </SoftPill>
        );
    }
    return null;
};

const FilterChip = ({ isDark, active, onClick, children }) => (
    <button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-light transition-colors focus-visible:outline-none focus-visible:ring-2',
            accentClasses.ring,
            active
                ? (isDark ? 'border-white/25 bg-white/10 text-zinc-100' : 'border-slate-400 bg-slate-200 text-slate-900')
                : (isDark ? 'border-white/10 text-zinc-400 hover:text-zinc-200' : 'border-slate-200 text-slate-500 hover:text-slate-800')
        )}
    >
        {children}
    </button>
);

// Big groups get a column each; the small ones share the last column.
const layerColumnsOf = (groups) => {
    const big = groups.filter((group) => group.layers.length > 1).map((group) => [group]);
    const small = groups.filter((group) => group.layers.length <= 1);
    return small.length ? [...big, small] : big;
};

// People with something to do first, then people still to join, then everyone who is fine.
const rosterRank = (member) => {
    if (member.weakPassword) return 0;
    if (member.status === 'pending') return 1;
    if (member.attention === 'resolved') return 2;
    return 3;
};
const byNextStep = (members) => members
    .map((member, index) => ({ member, index }))
    .sort((a, b) => rosterRank(a.member) - rosterRank(b.member) || a.index - b.index)
    .map((entry) => entry.member);

const scrollToSection = (id) => {
    if (typeof document === 'undefined') return;
    document.getElementById(id)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
};

const SecurityView = ({ isDark = true, now: fixedNow }) => {
    const theme = getDashboardTheme(isDark);
    const [now, setNow] = useState(() => fixedNow ?? Date.now());
    const [sent, setSent] = useState({});
    const [feedArea, setFeedArea] = useState('all');

    useEffect(() => {
        if (fixedNow) return undefined;
        const timer = setInterval(() => setNow(Date.now()), 30 * 1000);
        return () => clearInterval(timer);
    }, [fixedNow]);

    const report = useMemo(() => buildSecurityReport(now), [now]);
    const scannedAgo = relativeTime(report.scannedAt.getTime(), now);
    const team = report.team;
    const layerColumns = useMemo(() => layerColumnsOf(groupLayers(report.protection.layers)), [report]);
    const roster = useMemo(() => byNextStep(team.members), [team]);
    const checkoutTrend = report.sources.find((source) => source.id === 'checkout')?.trend ?? [];
    const feed = feedArea === 'all' ? report.feed : report.feed.filter((item) => item.source === feedArea);
    const attackPeriods = [
        { label: 'Last 24 hours', value: report.attacks.totals.last24h },
        { label: 'Last 7 days', value: report.attacks.totals.last7d },
        { label: 'Last 30 days', value: report.attacks.totals.last30d },
    ];
    const mostAttacks = Math.max(...attackPeriods.map((period) => period.value), 1);

    const markSent = (id, action) => {
        setSent((current) => ({ ...current, [`${id}:${action}`]: true }));
    };

    return (
        <DashboardPage>
            <DashboardPageHeader
                isDark={isDark}
                title="Security"
                icon={ShieldCheck}
                iconClassName={accentClasses.text}
                description="A plain-language look at Northlight Live's own event pages, team dashboard, checkout and door devices — so you can see that your platforms are safe."
                badges={(
                    <>
                        <HealthyPill isDark={isDark} live label="Your platforms look safe" className="px-3 text-xs" />
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
                className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:min-h-[460px] lg:items-stretch"
            >
                <div data-testid="security-hero-summary" className="flex min-h-0 flex-col gap-4">
                    <DashboardSurface isDark={isDark} className="p-5 sm:p-6">
                        <h2 className={cn('text-sm font-light', theme.textSecondary)}>What this means for you</h2>
                        <p className={cn('mt-1 text-[1.15rem] font-light tracking-tight', theme.textPrimary)}>{report.meaningHeadline}</p>
                        <ul className="mt-3 space-y-2">
                            {report.meaningPoints.map((point) => (
                                <li key={point.text} className={cn('flex items-start gap-2.5 text-sm font-light leading-6', theme.textSecondary)}>
                                    {point.tone === 'nudge' ? (
                                        <AlertTriangle size={15} aria-hidden="true" className={cn('mt-1 shrink-0', nudgeText(isDark))} />
                                    ) : point.tone === 'protected' ? (
                                        <ShieldCheck size={15} aria-hidden="true" className={cn('mt-1 shrink-0', okText(isDark))} />
                                    ) : (
                                        <Check size={15} aria-hidden="true" className={cn('mt-1 shrink-0', okText(isDark))} />
                                    )}
                                    <span>
                                        {point.text}
                                        {point.tone === 'nudge' ? (
                                            <button
                                                type="button"
                                                onClick={() => scrollToSection('team-account-health')}
                                                className={cn('ml-2 inline-flex items-center gap-1 rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2', isDark ? accentClasses.text : 'text-purple-700', accentClasses.ring)}
                                            >
                                                See who
                                                <ArrowRight size={13} aria-hidden="true" />
                                            </button>
                                        ) : null}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </DashboardSurface>
                    <div className="grid flex-1 grid-cols-2 gap-3">
                        <VitalTile
                            isDark={isDark}
                            area="website"
                            label="Event pages online"
                            value={`${report.totals.pagesOnline} / ${report.totals.pagesTotal}`}
                            detail="HTTPS valid on every page"
                            visual={<PageDots total={report.totals.pagesTotal} online={report.totals.pagesOnline} tone={areaTone('website', isDark)} />}
                        />
                        <VitalTile
                            isDark={isDark}
                            area="account"
                            label="Two-factor on your team"
                            value={`${report.totals.twoFactorOn} / ${report.totals.activeMembers}`}
                            detail={`${report.totals.pendingInvites} invites still pending — 2FA starts when they join`}
                            visual={<Ring value={report.totals.twoFactorOn} total={report.totals.activeMembers} tone={areaTone('account', isDark)} />}
                            testId="kpi-two-factor"
                        />
                        <VitalTile
                            isDark={isDark}
                            area="checkout"
                            label="Checkout screening"
                            value="All clear"
                            detail={`${report.totals.chargebackFlags} chargeback-risk flags`}
                            visual={<Bars values={checkoutTrend} tone={areaTone('checkout', isDark)} className="h-9 w-24" />}
                        />
                        <VitalTile
                            isDark={isDark}
                            area="doors"
                            label="Door devices"
                            value="All in order"
                            detail={`${report.totals.devicesOnline} online · ${report.totals.devicesPaused} paused · ${report.totals.devicesRevoked} revoked`}
                            visual={<DevicePips devices={report.devices} tone={areaTone('doors', isDark)} isDark={isDark} />}
                        />
                    </div>
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
                title={<SectionTitle icon={LayoutGrid} isDark={isDark}>Your platforms</SectionTitle>}
                description="Each surface is checked on a regular cycle. Green means nothing urgent needs your attention."
            >
                <div className="grid gap-4 md:grid-cols-2" data-testid="security-sources">
                    {report.sources.map((source) => {
                        const tone = areaTone(source.id, isDark);
                        return (
                            <div
                                key={source.id}
                                data-testid={`security-source-${source.id}`}
                                className={cn('flex flex-col gap-4 rounded-md border p-4', theme.panelMuted)}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <AreaBadge area={source.id} isDark={isDark} />
                                        <div>
                                            <h3 className={cn('text-sm font-light', theme.textPrimary)}>{source.name}</h3>
                                            <p className={cn('text-xs font-light', theme.textMuted)}>
                                                {source.uptime ? `Uptime ${source.uptime}` : 'Last 24 hours'}
                                            </p>
                                        </div>
                                    </div>
                                    <HealthyPill isDark={isDark} />
                                </div>
                                <Bars values={source.trend} tone={tone} />
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <p className={cn('text-xs font-light', theme.textTertiary)}>{source.metricLabel}</p>
                                        <p className={cn('mt-1 text-xl font-light', theme.textPrimary)}>{formatCount(source.events)}</p>
                                    </div>
                                    <div>
                                        <p className={cn('text-xs font-light', theme.textTertiary)}>{source.filterLabel}</p>
                                        <p className={cn('mt-1 text-xl font-light', theme.textPrimary)}>{formatCount(source.blocked)}</p>
                                    </div>
                                </div>
                                <p className={cn('text-xs font-light leading-5', theme.textSecondary)}>{source.status}</p>
                                <ul className="space-y-1.5">
                                    {source.checks.map((check) => (
                                        <li key={check} className={cn('flex items-start gap-2 text-xs font-light', theme.textSecondary)}>
                                            <Check size={13} aria-hidden="true" className={cn('mt-0.5 shrink-0', okText(isDark))} />
                                            {check}
                                        </li>
                                    ))}
                                </ul>
                                <div className={cn('mt-auto rounded-md border px-3 py-2.5', isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white/80')}>
                                    <p className={cn('text-xs font-light', tone.text)}>What this means for you</p>
                                    <p className={cn('mt-1 text-xs font-light leading-5', theme.textSecondary)}>{source.meaning}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </DashboardSection>

            <DashboardSection
                isDark={isDark}
                title={<SectionTitle icon={Layers} isDark={isDark}>Protection Layers</SectionTitle>}
                description="The safeguards around your event pages, dashboard and checkout, grouped by what they look after. Each layer is on and healthy. Last-checked times are from the latest review cycle."
            >
                <div className="grid gap-x-6 gap-y-6 md:grid-cols-2 xl:grid-cols-3" data-testid="protection-layers">
                    {layerColumns.map((column) => (
                        <div key={column.map((group) => group.area).join('-')} className="space-y-6">
                            {column.map((group) => {
                                const area = areaOf(group.area);
                                const tone = areaTone(group.area, isDark);
                                return (
                                    <div key={group.area} data-testid={`protection-group-${group.area}`}>
                                        <div className="flex items-center gap-2">
                                            <area.icon size={14} aria-hidden="true" className={tone.text} />
                                            <h3 className={cn('text-sm font-light', tone.text)}>{area.label}</h3>
                                            <span className={cn('text-xs font-light', theme.textMuted)}>
                                                {group.layers.length} {group.layers.length === 1 ? 'layer' : 'layers'} on
                                            </span>
                                        </div>
                                        <ul className="mt-3 space-y-2">
                                            {group.layers.map((layer) => (
                                                <li
                                                    key={layer.id}
                                                    data-testid={`protection-layer-${layer.id}`}
                                                    className={cn('flex items-start gap-3 rounded-md border p-3', theme.panelMuted)}
                                                >
                                                    <AreaBadge area={group.area} icon={layer.icon} isDark={isDark} size="sm" className="mt-0.5" />
                                                    <div className="min-w-0 flex-1">
                                                        <h4 className={cn('text-sm font-light', theme.textPrimary)}>{LAYER_INFO[layer.id]?.plain ?? layer.name}</h4>
                                                        <p className={cn('mt-0.5 text-xs font-light', theme.textMuted)}>{layer.name}</p>
                                                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                                                            <OkMark isDark={isDark}>{layer.status}</OkMark>
                                                            <span className={cn('text-xs font-light', theme.textMuted)}>
                                                                Last checked {relativeTime(layer.checkedAt.getTime(), now)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </DashboardSection>

            <DashboardSection
                isDark={isDark}
                title={<SectionTitle icon={ShieldAlert} isDark={isDark}>Suspected Attacks</SectionTitle>}
                description="Attempts aimed at your event pages, dashboard or checkout. Every one was stopped automatically. Nothing was breached."
            >
                <div data-testid="suspected-attacks">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]" data-testid="suspected-attacks-summary">
                        <div className={cn('flex items-center gap-4 rounded-md border p-4', isDark ? 'border-emerald-400/25 bg-emerald-400/5' : 'border-emerald-200 bg-emerald-50')}>
                            <span
                                aria-hidden="true"
                                className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-full', isDark ? 'bg-emerald-400/15 text-emerald-300' : 'bg-emerald-100 text-emerald-700')}
                            >
                                <ShieldCheck size={24} />
                            </span>
                            <div>
                                <p className={cn('text-xs font-light', okText(isDark))}>Reached your platforms</p>
                                <p className={cn('text-4xl font-light leading-tight', theme.textPrimary)}>{report.attacks.totals.reached}</p>
                                <p className={cn('text-xs font-light', theme.textSecondary)}>{report.attacks.totals.breached} breached · nothing got through</p>
                            </div>
                        </div>
                        <div className={cn('rounded-md border p-4', theme.panelMuted)}>
                            <p className={cn('text-xs font-light', theme.textSecondary)}>Stopped automatically</p>
                            <div className="mt-2 grid grid-cols-3 gap-4">
                                {attackPeriods.map((period) => (
                                    <div key={period.label}>
                                        <p className={cn('text-2xl font-light', theme.textPrimary)}>{formatCount(period.value)}</p>
                                        <div className={cn('mt-2 h-1.5 overflow-hidden rounded-full', isDark ? 'bg-white/5' : 'bg-slate-200')} aria-hidden="true">
                                            <div
                                                className={cn('h-full rounded-full', isDark ? 'bg-zinc-400' : 'bg-slate-500')}
                                                style={{ width: `${Math.max(4, Math.round((period.value / mostAttacks) * 100))}%` }}
                                            />
                                        </div>
                                        <p className={cn('mt-2 text-xs font-light', theme.textMuted)}>{period.label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <p className={cn('mt-4 text-sm font-light leading-6', theme.textSecondary)}>{report.attacks.summary}</p>
                    <ol className={cn('mt-2 divide-y', divider(isDark))} data-testid="suspected-attacks-list">
                        {report.attacks.items.map((item) => {
                            const info = attackInfo(item.kind);
                            return (
                                <li key={item.id} data-testid={item.id} className="flex items-start gap-3 py-3.5">
                                    <AreaBadge area={info.area} icon={info.icon} isDark={isDark} />
                                    <div className="min-w-0 flex-1">
                                        <p className={cn('text-sm font-light', theme.textPrimary)}>{info.plain}</p>
                                        <p className={cn('mt-0.5 text-xs font-light leading-5', theme.textMuted)}>
                                            {item.kind} · {item.target} · {item.country} · {item.range}
                                        </p>
                                        <p className={cn('mt-1 text-xs font-light leading-5', theme.textSecondary)}>{item.note}</p>
                                    </div>
                                    <div className="flex shrink-0 flex-col items-end gap-1">
                                        <OkMark isDark={isDark} icon={ShieldCheck}>{item.status}</OkMark>
                                        <span className={cn('text-xs font-light', theme.textMuted)}>
                                            {relativeTime(item.at.getTime(), now)}
                                        </span>
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                </div>
            </DashboardSection>

            <DashboardSection
                isDark={isDark}
                title={<SectionTitle icon={Users} area="account" isDark={isDark}>Team Account Health</SectionTitle>}
                description="A per-person look at two-factor sign-in, weak passwords, and passwords checked against known breach lists. Passwords themselves are never shown. Most of your team looks good; a few people have a simple next step."
            >
                <div data-testid="team-account-health" id="team-account-health" className="scroll-mt-24">
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="team-health-summary">
                        <SummaryTile
                            isDark={isDark}
                            icon={Check}
                            iconClassName={okText(isDark)}
                            label="All clear"
                            value={team.totals.allClear}
                            detail={`of ${team.totals.roster} on the roster, including 1 already-reset breach-list match`}
                            visual={<RosterDots members={roster} isDark={isDark} />}
                        />
                        <SummaryTile
                            isDark={isDark}
                            icon={areaOf('account').icon}
                            iconClassName={areaTone('account', isDark).text}
                            label="Two-factor sign-in"
                            value={`${team.totals.twoFactorOn} / ${team.totals.active}`}
                            detail={`${team.totals.withoutTwoFactor} pending invites have not set up 2FA yet`}
                            visual={<Ring value={team.totals.twoFactorOn} total={team.totals.active} tone={areaTone('account', isDark)} size={32} />}
                        />
                        <SummaryTile
                            isDark={isDark}
                            tone="nudge"
                            icon={AlertTriangle}
                            iconClassName={nudgeText(isDark)}
                            label="Weak passwords"
                            value={team.totals.weakPasswords}
                            detail={`Action recommended · ${team.weakNames.join(' and ')}`}
                        />
                        <SummaryTile
                            isDark={isDark}
                            icon={ShieldCheck}
                            iconClassName={okText(isDark)}
                            label="Known breach lists"
                            value={`${team.totals.leakCurrent} current`}
                            detail={`${team.totals.leakResolved} already reset (${team.leakResolvedNames.join(', ')})`}
                        />
                    </div>

                    <p className={cn('mt-5 text-xs font-light leading-5', theme.textMuted)}>
                        Every active password was checked against known breach lists. People with a next step are listed first.
                    </p>
                    <ul className="mt-3 grid gap-2 lg:grid-cols-2" data-testid="team-health-roster">
                        {roster.map((member) => {
                            const action = member.nextStep.action;
                            return (
                                <TeamRow
                                    key={member.id}
                                    member={member}
                                    isDark={isDark}
                                    sent={action ? Boolean(sent[`${member.id}:${action}`]) : false}
                                    onSend={markSent}
                                />
                            );
                        })}
                    </ul>
                </div>
            </DashboardSection>

            <DashboardSection
                isDark={isDark}
                title={<SectionTitle icon={areaOf('doors').icon} area="doors" isDark={isDark}>Door devices</SectionTitle>}
                description="All 14 of your door and box-office devices, so you can see what is online, paused or revoked."
                actions={(
                    <div className="flex items-center gap-3">
                        <DevicePips devices={report.devices} tone={areaTone('doors', isDark)} isDark={isDark} />
                        <span className={cn('text-xs font-light', theme.textSecondary)}>
                            {report.totals.devicesOnline} of {report.totals.devicesTotal} online
                        </span>
                    </div>
                )}
            >
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" data-testid="security-devices">
                    {report.devices.map((device) => (
                        <DeviceCard key={device.id} device={device} isDark={isDark} />
                    ))}
                </div>
            </DashboardSection>

            <DashboardSection
                isDark={isDark}
                title={<SectionTitle icon={Activity} isDark={isDark}>Recent activity</SectionTitle>}
                description="What has happened around your pages, team, checkout and doors. Protected items were handled automatically."
                actions={(
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Show activity for">
                        <FilterChip isDark={isDark} active={feedArea === 'all'} onClick={() => setFeedArea('all')}>All</FilterChip>
                        {AREA_ORDER.map((id) => {
                            const area = areaOf(id);
                            return (
                                <FilterChip key={id} isDark={isDark} active={feedArea === id} onClick={() => setFeedArea(id)}>
                                    <area.icon size={12} aria-hidden="true" className={areaTone(id, isDark).text} />
                                    {area.label}
                                </FilterChip>
                            );
                        })}
                    </div>
                )}
            >
                <ol className={cn('divide-y', divider(isDark))} data-testid="security-feed">
                    {feed.map((item) => (
                        <li key={item.id} className="flex items-start gap-3 py-2.5">
                            <AreaBadge area={item.source} isDark={isDark} size="sm" />
                            <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                                <span className={cn('flex-1 text-sm font-light leading-6', theme.textPrimary)}>{item.text}</span>
                                <FeedTone tone={item.tone} isDark={isDark} />
                                <span className={cn('shrink-0 text-xs font-light', theme.textMuted)}>
                                    {areaOf(item.source).label} · {relativeTime(item.at.getTime(), now)}
                                </span>
                            </div>
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
