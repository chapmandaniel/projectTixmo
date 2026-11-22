import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle, Ban, CheckCircle2, Clock, Facebook, Flag, Gavel, Globe, Instagram, Mail,
    Megaphone, Music2, Radar, RotateCcw, ShieldCheck, ShoppingBag, Twitter, UserPlus, X, XCircle,
} from 'lucide-react';
import {
    DashboardButton,
    DashboardChip,
    DashboardPage,
    DashboardPageHeader,
    DashboardSection,
    DashboardSelect,
    DashboardSurface,
} from '../../components/dashboard/DashboardPrimitives';
import { MooseChat } from '../../components/dashboard/MooseChat';
import { getDashboardTheme } from '../../lib/dashboardTheme';
import { cn } from '../../lib/utils';
import { accentClasses } from '../../lib/brandAccent';
import {
    ASSIGNEES,
    OFFICIAL,
    PLATFORMS,
    STATUSES,
    VERDICTS,
    VERDICT_ORDER,
    assigneeName,
    buildSeedFindings,
    eventsIn,
    fanWarningDraft,
    filterFindings,
    minutesLabel,
    reportDraft,
    statusLabel,
    summarize,
    sweepSummary,
    takedownDraft,
} from './scamSwarmData';
import { answerMooseQuestion, SUGGESTED_QUESTIONS as MOOSE_QUESTIONS } from './scamSwarmMooseAnswers';

const PLATFORM_ICONS = {
    instagram: Instagram,
    facebook: Facebook,
    tiktok: Music2,
    x: Twitter,
    marketplace: ShoppingBag,
    web: Globe,
};

const verdictTone = (verdict, isDark) => {
    if (verdict === 'scam') return isDark ? 'border-rose-400/30 bg-rose-500/10 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700';
    if (verdict === 'attention') return isDark ? 'border-amber-400/30 bg-amber-400/10 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-800';
    return isDark ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700';
};

const verdictDot = (verdict) => {
    if (verdict === 'scam') return 'bg-rose-400';
    if (verdict === 'attention') return 'bg-amber-400';
    return 'bg-emerald-400';
};

const verdictBar = (verdict) => {
    if (verdict === 'scam') return 'bg-rose-400';
    if (verdict === 'attention') return 'bg-amber-400';
    return 'bg-emerald-400';
};

// T143: captures share one purple-led look; the verdict pill carries the meaning.
const mediaTone = () => 'from-purple-600/45 via-violet-700/30 to-zinc-900/40';

export const VerdictPill = ({ verdict, isDark, className }) => (
    <span
        data-testid="verdict-pill"
        className={cn('inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-light', verdictTone(verdict, isDark), className)}
    >
        <span className={cn('h-1.5 w-1.5 rounded-full', verdictDot(verdict))} />
        {VERDICTS[verdict]?.label}
    </span>
);

const StatusPill = ({ finding, isDark }) => {
    const label = finding.status === 'resolved' && finding.resolution ? finding.resolution : statusLabel(finding.status);
    return (
        <span className={cn('inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-[11px] font-light', isDark ? 'border-white/10 bg-white/5 text-zinc-300' : 'border-slate-200 bg-slate-100 text-slate-600')}>
            {label}
        </span>
    );
};

const PlatformLabel = ({ platform, isDark, className }) => {
    const Icon = PLATFORM_ICONS[platform] || Globe;
    return (
        <span className={cn('inline-flex items-center gap-1.5 text-xs font-light', isDark ? 'text-zinc-300' : 'text-slate-600', className)}>
            <Icon size={13} />
            {PLATFORMS[platform]?.label || platform}
        </span>
    );
};

const initials = (name) => String(name || '?')
    .replace(/[^A-Za-z ]/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

// Screenshot-style capture built in HTML/CSS. No real images or accounts.
export const PreviewCard = ({ finding, isDark, compact = false }) => {
    const theme = getDashboardTheme(isDark);
    const isWeb = finding.platform === 'web';
    const isListing = finding.platform === 'marketplace';
    return (
        <div
            data-testid="scam-preview"
            className={cn('overflow-hidden rounded-md border', isDark ? 'border-white/10 bg-black/30' : 'border-slate-200 bg-white')}
            aria-label={`Captured ${finding.platformLabel} preview of ${finding.handle}`}
        >
            {isWeb ? (
                <div className={cn('flex items-center gap-2 border-b px-3 py-2', isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50')}>
                    <span className="flex gap-1">
                        <span className="h-2 w-2 rounded-full bg-rose-400/70" />
                        <span className="h-2 w-2 rounded-full bg-amber-400/70" />
                        <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
                    </span>
                    <span className={cn('min-w-0 flex-1 truncate rounded px-2 py-0.5 text-[11px] font-light', isDark ? 'bg-black/30 text-zinc-300' : 'bg-white text-slate-600')}>
                        {finding.url.replace(/^https:\/\//, '')}
                    </span>
                </div>
            ) : (
                <div className="flex items-center gap-2 px-3 py-2.5">
                    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-medium text-white', mediaTone(finding.verdict))}>
                        {initials(finding.displayName)}
                    </span>
                    <div className="min-w-0">
                        <p className={cn('truncate text-xs font-normal', theme.textPrimary)}>{finding.displayName}</p>
                        <p className={cn('truncate text-[11px] font-light', theme.textMuted)}>{finding.handle}</p>
                    </div>
                    <PlatformLabel platform={finding.platform} isDark={isDark} className="ml-auto shrink-0 text-[11px]" />
                </div>
            )}
            <div className={cn('relative flex items-center justify-center bg-gradient-to-br px-4 text-center', mediaTone(finding.verdict), compact ? 'h-24' : 'h-36')}>
                <span className={cn('font-light uppercase tracking-[0.12em] text-white drop-shadow', compact ? 'text-sm' : 'text-lg')}>
                    {finding.mediaText}
                </span>
                <span className="absolute bottom-1.5 right-2 rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-light text-white/80">
                    {finding.event}
                </span>
            </div>
            <div className="space-y-2 px-3 py-2.5">
                {isListing ? (
                    <p className={cn('text-xs font-normal', theme.textPrimary)}>{finding.displayName}</p>
                ) : null}
                <p className={cn('text-xs font-light leading-5', theme.textSecondary, compact && 'line-clamp-2')}>{finding.caption}</p>
                <div className={cn('flex gap-4 text-[11px] font-light', theme.textMuted)}>
                    <span>{finding.stats.likes}</span>
                    <span>{finding.stats.comments}</span>
                    <span className="ml-auto">{finding.reach}</span>
                </div>
            </div>
        </div>
    );
};

const KpiTile = ({ isDark, label, value, detail, tone, icon: Icon, testId, onClick, active }) => {
    const theme = getDashboardTheme(isDark);
    const accent = 'brand';
    const iconTone = tone === 'scam' ? 'text-rose-400' : tone === 'attention' ? 'text-amber-300' : tone === 'safe' ? 'text-emerald-400' : accentClasses.text;
    return (
        <DashboardSurface
            as="button"
            type="button"
            isDark={isDark}
            accent={accent}
            interactive
            onClick={onClick}
            aria-pressed={active}
            className={cn('p-4 text-left sm:p-5', active && (isDark ? 'ring-1 ring-white/20' : 'ring-1 ring-slate-300'))}
            data-testid={testId}
        >
            <div className="flex items-center justify-between">
                <p className={cn('text-xs font-light sm:text-sm', theme.textSecondary)}>{label}</p>
                <Icon size={16} className={iconTone} />
            </div>
            <p className={cn('mt-2 text-3xl font-light tracking-tight sm:text-4xl', theme.textPrimary)}>{value}</p>
            <p className={cn('mt-1 text-xs font-light', theme.textMuted)}>{detail}</p>
        </DashboardSurface>
    );
};

const ScoreMeter = ({ finding, isDark }) => {
    const theme = getDashboardTheme(isDark);
    return (
        <div data-testid="score-meter">
            <div className="flex items-end justify-between">
                <p className={cn('text-[10px] uppercase tracking-[0.16em]', theme.textTertiary)}>Risk score</p>
                <p className={cn('text-2xl font-light', theme.textPrimary)}>{finding.score}<span className={cn('text-sm', theme.textMuted)}> / 100</span></p>
            </div>
            <div className={cn('mt-2 h-2 overflow-hidden rounded-full', isDark ? 'bg-white/10' : 'bg-slate-200')}>
                <div className={cn('h-full rounded-full', verdictBar(finding.verdict))} style={{ width: `${Math.max(4, finding.score)}%` }} />
            </div>
            <div className={cn('mt-1 flex justify-between text-[10px] font-light', theme.textMuted)}>
                <span>Likely safe</span>
                <span>Needs attention 35+</span>
                <span>Likely scam 70+</span>
            </div>
        </div>
    );
};

const DraftBox = ({ isDark, label, text, testId }) => {
    const theme = getDashboardTheme(isDark);
    return (
        <div>
            <p className={cn('mb-1 text-[10px] uppercase tracking-[0.16em]', theme.textTertiary)}>{label}</p>
            <pre
                data-testid={testId}
                className={cn('max-h-56 overflow-y-auto whitespace-pre-wrap rounded-md border p-3 font-sans text-xs font-light leading-5', isDark ? 'border-white/10 bg-black/30 text-zinc-200' : 'border-slate-200 bg-slate-50 text-slate-700')}
            >
                {text}
            </pre>
        </div>
    );
};

const DemoNote = ({ isDark, children }) => (
    <p className={cn('rounded-md border px-3 py-2 text-[11px] font-light', isDark ? cn(accentClasses.border, accentClasses.tint, 'text-zinc-200') : 'border-purple-200 bg-purple-50 text-purple-800')}>
        {children}
    </p>
);

const FindingDrawer = ({ finding, isDark, onClose, onUpdate }) => {
    const theme = getDashboardTheme(isDark);
    const [panel, setPanel] = useState(null);

    useEffect(() => {
        setPanel(null);
    }, [finding?.id]);

    useEffect(() => {
        const onKey = (event) => { if (event.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    if (!finding) return null;
    const warn = fanWarningDraft(finding);
    const resolved = finding.status === 'resolved';
    const act = (patch, log) => { onUpdate(finding.id, patch, log); setPanel(null); };
    const toReported = finding.status === 'resolved' ? 'resolved' : 'reported';

    return (
        <div className="fixed inset-0 z-[70] flex justify-end" data-testid="finding-drawer">
            <button type="button" aria-label="Close finding" className="absolute inset-0 bg-black/50" onClick={onClose} />
            <aside
                role="dialog"
                aria-modal="true"
                aria-label={`Finding ${finding.handle}`}
                className={cn('relative flex h-full w-full max-w-[560px] flex-col overflow-y-auto border-l shadow-2xl', theme.panel)}
            >
                <div className={cn('sticky top-0 z-10 flex items-start justify-between gap-3 border-b px-5 py-4', theme.divider, theme.panel)}>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <VerdictPill verdict={finding.verdict} isDark={isDark} />
                            <StatusPill finding={finding} isDark={isDark} />
                        </div>
                        <h2 className={cn('mt-2 truncate text-lg font-light', theme.textPrimary)}>{finding.kindLabel}</h2>
                        <p className={cn('truncate text-xs font-light', theme.textMuted)}>{finding.handle} · targets {finding.event}</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close" className={cn('rounded-md p-2', theme.iconButton)}>
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-5 px-5 py-5">
                    <PreviewCard finding={finding} isDark={isDark} />
                    <ScoreMeter finding={finding} isDark={isDark} />

                    <div>
                        <p className={cn('mb-2 text-[10px] uppercase tracking-[0.16em]', theme.textTertiary)}>Signals behind the score</p>
                        <ul className="space-y-1.5" data-testid="finding-signals">
                            {finding.signals.map((signal) => (
                                <li key={signal.label} className={cn('flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-xs font-light', theme.panelMuted)}>
                                    <span className={theme.textSecondary}>{signal.label}</span>
                                    <span className={cn('shrink-0 tabular-nums', signal.points > 0 ? (finding.verdict === 'safe' ? theme.textMuted : 'text-rose-300') : 'text-emerald-300')}>
                                        {signal.points > 0 ? `+${signal.points}` : signal.points}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <dl className={cn('grid grid-cols-2 gap-3 rounded-md border p-3 text-xs font-light', theme.panelMuted)}>
                        <div><dt className={theme.textMuted}>Platform</dt><dd className="mt-0.5"><PlatformLabel platform={finding.platform} isDark={isDark} /></dd></div>
                        <div><dt className={theme.textMuted}>Event</dt><dd className={cn('mt-0.5', theme.textPrimary)}>{finding.event}</dd></div>
                        <div className="col-span-2"><dt className={theme.textMuted}>Link (captured)</dt><dd className={cn('mt-0.5 break-all', theme.textPrimary)}>{finding.url}</dd></div>
                        <div><dt className={theme.textMuted}>Found</dt><dd className={cn('mt-0.5', theme.textPrimary)}>{minutesLabel(finding.minutesAgo)}</dd></div>
                        <div><dt className={theme.textMuted}>Reach</dt><dd className={cn('mt-0.5', theme.textPrimary)}>{finding.reach}</dd></div>
                    </dl>

                    <div>
                        <p className={cn('mb-2 text-[10px] uppercase tracking-[0.16em]', theme.textTertiary)}>Status</p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Finding status" data-testid="status-workflow">
                            {STATUSES.map((status) => (
                                <button
                                    key={status.id}
                                    type="button"
                                    aria-pressed={finding.status === status.id}
                                    onClick={() => act({ status: status.id, resolution: status.id === 'resolved' ? (finding.resolution || 'Resolved') : null }, `Status set to ${status.label}`)}
                                    className={cn(
                                        'rounded-md border px-2 py-2 text-[11px] font-light transition-colors',
                                        finding.status === status.id
                                            ? (isDark ? 'border-white/30 bg-white/10 text-white' : 'border-slate-900 bg-slate-900 text-white')
                                            : (isDark ? 'border-white/10 text-zinc-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50')
                                    )}
                                >
                                    {status.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label htmlFor="ss-assignee" className={cn('mb-2 block text-[10px] uppercase tracking-[0.16em]', theme.textTertiary)}>Assigned to</label>
                        <DashboardSelect
                            id="ss-assignee"
                            isDark={isDark}
                            value={finding.assignee || ''}
                            onChange={(event) => {
                                const id = event.target.value || null;
                                onUpdate(
                                    finding.id,
                                    { assignee: id, status: id && finding.status === 'new' ? 'in_review' : finding.status },
                                    id ? `Assigned to ${assigneeName(id)}` : 'Unassigned'
                                );
                            }}
                        >
                            <option value="">Unassigned</option>
                            {ASSIGNEES.map((member) => (
                                <option key={member.id} value={member.id}>{member.name} — {member.title}</option>
                            ))}
                        </DashboardSelect>
                    </div>

                    <div>
                        <p className={cn('mb-2 text-[10px] uppercase tracking-[0.16em]', theme.textTertiary)}>Actions</p>
                        <div className="grid grid-cols-2 gap-2" data-testid="finding-actions">
                            <DashboardButton isDark={isDark} variant="primary" className="px-3" onClick={() => setPanel('report')}>
                                <Flag size={14} /> Report to platform
                            </DashboardButton>
                            <DashboardButton isDark={isDark} variant="secondary" className="px-3" onClick={() => setPanel('takedown')}>
                                <Gavel size={14} /> Request takedown
                            </DashboardButton>
                            <DashboardButton isDark={isDark} variant="secondary" className="px-3" onClick={() => setPanel('warn')}>
                                <Megaphone size={14} /> Warn fans
                            </DashboardButton>
                            <DashboardButton
                                isDark={isDark}
                                variant="secondary"
                                className="px-3"
                                disabled={finding.whitelisted}
                                onClick={() => act({ whitelisted: true, verdict: 'safe', status: 'resolved', resolution: 'Marked safe' }, `Marked safe and whitelisted ${finding.handle}`)}
                            >
                                <ShieldCheck size={14} /> Mark as safe
                            </DashboardButton>
                            <DashboardButton
                                isDark={isDark}
                                variant="subtle"
                                className="col-span-2 px-3"
                                disabled={resolved && finding.resolution === 'Dismissed'}
                                onClick={() => act({ status: 'resolved', resolution: 'Dismissed' }, 'Dismissed')}
                            >
                                <XCircle size={14} /> Dismiss
                            </DashboardButton>
                            {finding.takedownRequested && finding.resolution !== 'Taken down' ? (
                                <DashboardButton
                                    isDark={isDark}
                                    variant="secondary"
                                    className="col-span-2 px-3"
                                    onClick={() => act({ status: 'resolved', resolution: 'Taken down' }, 'Platform confirmed the takedown (demo)')}
                                >
                                    <CheckCircle2 size={14} /> Mark as taken down
                                </DashboardButton>
                            ) : null}
                        </div>
                    </div>

                    {panel === 'report' ? (
                        <div className="space-y-3" data-testid="panel-report">
                            <DraftBox isDark={isDark} label={`Prefilled ${finding.platformLabel} report`} text={reportDraft(finding)} testId="report-draft" />
                            <DemoNote isDark={isDark}>Demo only: this report is not sent to {finding.platformLabel}.</DemoNote>
                            <div className="flex gap-2">
                                <DashboardButton isDark={isDark} onClick={() => act({ status: toReported }, `Reported to ${finding.platformLabel} (demo, not sent)`)}>Submit report (demo)</DashboardButton>
                                <DashboardButton isDark={isDark} variant="subtle" onClick={() => setPanel(null)}>Cancel</DashboardButton>
                            </div>
                        </div>
                    ) : null}

                    {panel === 'takedown' ? (
                        <div className="space-y-3" data-testid="panel-takedown">
                            <DraftBox isDark={isDark} label="Takedown request" text={takedownDraft(finding)} testId="takedown-draft" />
                            <DemoNote isDark={isDark}>Demo only: no takedown request leaves this page.</DemoNote>
                            <div className="flex gap-2">
                                <DashboardButton isDark={isDark} onClick={() => act({ takedownRequested: true, status: toReported }, 'Takedown requested (demo, not sent)')}>Send takedown request (demo)</DashboardButton>
                                <DashboardButton isDark={isDark} variant="subtle" onClick={() => setPanel(null)}>Cancel</DashboardButton>
                            </div>
                        </div>
                    ) : null}

                    {panel === 'warn' ? (
                        <div className="space-y-3" data-testid="panel-warn">
                            <DraftBox isDark={isDark} label={`Draft post from ${OFFICIAL.handle}`} text={warn.post} testId="warn-post" />
                            <DraftBox isDark={isDark} label={`Draft email to ${finding.event} ticket holders — subject: ${warn.emailSubject}`} text={warn.emailBody} testId="warn-email" />
                            <DemoNote isDark={isDark}><Mail size={12} className="mr-1 inline" />Preview only: nothing is posted or emailed, ever, from this demo.</DemoNote>
                            <div className="flex gap-2">
                                <DashboardButton isDark={isDark} onClick={() => act({ fanWarningDraft: true }, 'Fan warning drafted (never sent)')}>Save draft (never sent)</DashboardButton>
                                <DashboardButton isDark={isDark} variant="subtle" onClick={() => setPanel(null)}>Cancel</DashboardButton>
                            </div>
                        </div>
                    ) : null}

                    <div>
                        <p className={cn('mb-2 text-[10px] uppercase tracking-[0.16em]', theme.textTertiary)}>Activity</p>
                        <ul className="space-y-1.5" data-testid="finding-activity">
                            {finding.activity.length ? finding.activity.map((entry) => (
                                <li key={entry.id} className={cn('flex justify-between gap-3 text-xs font-light', theme.textSecondary)}>
                                    <span>{entry.text}</span>
                                    <span className={cn('shrink-0', theme.textMuted)}>{entry.at}</span>
                                </li>
                            )) : (
                                <li className={cn('text-xs font-light', theme.textMuted)}>Found by ScamSwarm {minutesLabel(finding.minutesAgo)}. No actions yet.</li>
                            )}
                        </ul>
                    </div>
                </div>
            </aside>
        </div>
    );
};

const timeNow = () => new Date().toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });

const ScamSwarmView = ({ isDark = true }) => {
    const theme = getDashboardTheme(isDark);
    const [findings, setFindings] = useState(buildSeedFindings);
    // An event page can link here already filtered: /scamswarm?event=<event name>.
    const [filters, setFilters] = useState(() => {
        const wanted = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('event');
        const event = wanted && eventsIn(buildSeedFindings()).includes(wanted) ? wanted : 'all';
        return { verdict: 'all', platform: 'all', event, status: 'all' };
    });
    const [openId, setOpenId] = useState(null);

    const summary = useMemo(() => summarize(findings), [findings]);
    const visible = useMemo(() => filterFindings(findings, filters), [findings, filters]);
    const events = useMemo(() => eventsIn(findings), [findings]);
    const openFinding = findings.find((f) => f.id === openId) || null;

    const updateFinding = (id, patch, log) => {
        setFindings((current) => current.map((f) => (f.id === id
            ? { ...f, ...patch, activity: log ? [{ id: `${Date.now()}-${f.activity.length}`, text: log, at: timeNow() }, ...f.activity] : f.activity }
            : f)));
    };

    const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
    const toggleVerdict = (verdict) => setFilter('verdict', filters.verdict === verdict ? 'all' : verdict);
    const resetDemo = () => {
        setFindings(buildSeedFindings());
        setFilters({ verdict: 'all', platform: 'all', event: 'all', status: 'all' });
        setOpenId(null);
    };

    const scamsByPlatform = [...new Set(findings.filter((f) => f.verdict === 'scam' && f.status !== 'resolved').map((f) => f.platformLabel))];

    return (
        <DashboardPage>
            <DashboardPageHeader
                isDark={isDark}
                title="ScamSwarm"
                icon={Radar}
                iconClassName={accentClasses.text}
                description="Watches the internet outside Tixmo for fake giveaways, impersonator profiles, resale scams, look-alike pages and counterfeit listings that use Northlight Live's events, then scores each one so you know what to act on."
                badges={(
                    <>
                        <DashboardChip isDark={isDark}>Mock data</DashboardChip>
                        <DashboardChip isDark={isDark}>
                            <Clock size={12} className="mr-1.5" />
                            Last sweep {sweepSummary.lastSweepMinutes} min ago
                        </DashboardChip>
                        <DashboardChip isDark={isDark}>{new Intl.NumberFormat('en-CA').format(sweepSummary.mentionsScanned)} mentions scanned · 7 days</DashboardChip>
                    </>
                )}
                actions={(
                    <DashboardButton isDark={isDark} variant="secondary" onClick={resetDemo} className="px-3">
                        <RotateCcw size={14} /> Reset demo
                    </DashboardButton>
                )}
            />

            <div
                data-testid="scamswarm-hero"
                className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:h-[460px] lg:items-stretch"
            >
                <div className="flex min-h-0 flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3" data-testid="scamswarm-summary">
                        <KpiTile isDark={isDark} tone="scam" icon={AlertTriangle} label="Likely scam" value={summary.scam} detail="Open, score 70+" testId="kpi-scam" onClick={() => toggleVerdict('scam')} active={filters.verdict === 'scam'} />
                        <KpiTile isDark={isDark} tone="attention" icon={Ban} label="Needs attention" value={summary.attention} detail="Open, score 35–69" testId="kpi-attention" onClick={() => toggleVerdict('attention')} active={filters.verdict === 'attention'} />
                        <KpiTile isDark={isDark} tone="safe" icon={ShieldCheck} label="Likely safe" value={summary.safe} detail="Fan pages and fair resales" testId="kpi-safe" onClick={() => toggleVerdict('safe')} active={filters.verdict === 'safe'} />
                        <KpiTile isDark={isDark} tone="resolved" icon={CheckCircle2} label="Reported / resolved" value={`${summary.reported} / ${summary.resolved}`} detail={`${summary.inReview} in review · ${summary.newCount} new`} testId="kpi-resolved" onClick={() => setFilter('status', filters.status === 'resolved' ? 'all' : 'resolved')} active={filters.status === 'resolved'} />
                    </div>
                    <DashboardSurface isDark={isDark} accent="amber" className="flex flex-1 flex-col p-5 sm:p-6">
                        <h2 className={cn('text-[1.15rem] font-light tracking-tight', theme.textPrimary)}>What this means for you</h2>
                        <p className={cn('mt-2 text-sm font-light leading-6', theme.textSecondary)}>
                            {summary.scam
                                ? `${summary.scam} likely scams are still live and could take money from your fans, mostly on ${scamsByPlatform.slice(0, 3).join(', ')}. Report them to the platform and warn fans for the events they target. `
                                : 'No likely scams are open right now. '}
                            Everything is captured outside Tixmo. Your own pages and checkout are covered on the Security tab.
                        </p>
                        <p className={cn('mt-auto pt-3 text-[11px] font-light', theme.textMuted)}>
                            Sources: {sweepSummary.sources.join(' · ')}. Demo data; actions on this page change the screen only.
                        </p>
                    </DashboardSurface>
                </div>
                <MooseChat
                    isDark={isDark}
                    data={findings}
                    askQuestion={answerMooseQuestion}
                    suggestions={MOOSE_QUESTIONS}
                    welcomeText="Hi, I'm Moose, Tixmo's AI assistant. Ask me which scams to deal with first, or what to tell your fans."
                    resetKey="scamswarm"
                />
            </div>

            <DashboardSection
                isDark={isDark}
                accent="amber"
                title="Findings"
                description="Each finding was captured outside Tixmo and scored from the signals ScamSwarm saw. Open one to see why, and act on it."
            >
                <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="scamswarm-filters">
                    <DashboardSelect isDark={isDark} aria-label="Filter by verdict" value={filters.verdict} onChange={(e) => setFilter('verdict', e.target.value)}>
                        <option value="all">All verdicts</option>
                        {VERDICT_ORDER.map((v) => <option key={v} value={v}>{VERDICTS[v].label}</option>)}
                    </DashboardSelect>
                    <DashboardSelect isDark={isDark} aria-label="Filter by platform" value={filters.platform} onChange={(e) => setFilter('platform', e.target.value)}>
                        <option value="all">All platforms</option>
                        {Object.values(PLATFORMS).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </DashboardSelect>
                    <DashboardSelect isDark={isDark} aria-label="Filter by event" value={filters.event} onChange={(e) => setFilter('event', e.target.value)}>
                        <option value="all">All events</option>
                        {events.map((name) => <option key={name} value={name}>{name}</option>)}
                    </DashboardSelect>
                    <DashboardSelect isDark={isDark} aria-label="Filter by status" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
                        <option value="all">All statuses</option>
                        {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </DashboardSelect>
                </div>

                <p className={cn('mb-3 text-xs font-light', theme.textMuted)} data-testid="scamswarm-count">
                    Showing {visible.length} of {findings.length} findings
                </p>

                {visible.length ? (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="scamswarm-findings">
                        {visible.map((finding) => (
                            <button
                                key={finding.id}
                                type="button"
                                data-testid={`finding-${finding.id}`}
                                onClick={() => setOpenId(finding.id)}
                                className={cn('flex flex-col gap-3 rounded-md border p-3 text-left transition-colors', theme.panelMuted, isDark ? 'hover:border-white/20' : 'hover:border-slate-300')}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <VerdictPill verdict={finding.verdict} isDark={isDark} />
                                    <span className={cn('text-sm font-light tabular-nums', theme.textPrimary)}>{finding.score}</span>
                                </div>
                                <PreviewCard finding={finding} isDark={isDark} compact />
                                <div>
                                    <p className={cn('text-sm font-light', theme.textPrimary)}>{finding.kindLabel}</p>
                                    <p className={cn('text-xs font-light', theme.textMuted)}>{finding.event} · {minutesLabel(finding.minutesAgo)}</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <StatusPill finding={finding} isDark={isDark} />
                                    {finding.assignee ? (
                                        <span className={cn('inline-flex items-center gap-1 text-[11px] font-light', theme.textSecondary)}>
                                            <UserPlus size={12} /> {assigneeName(finding.assignee)}
                                        </span>
                                    ) : null}
                                    {finding.fanWarningDraft ? (
                                        <span className={cn('inline-flex items-center gap-1 text-[11px] font-light', theme.textSecondary)}>
                                            <Megaphone size={12} /> Fan warning drafted
                                        </span>
                                    ) : null}
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <p className={cn('rounded-md border p-6 text-center text-sm font-light', theme.panelMuted, theme.textSecondary)}>
                        No findings match these filters.
                    </p>
                )}
            </DashboardSection>

            <FindingDrawer
                finding={openFinding}
                isDark={isDark}
                onClose={() => setOpenId(null)}
                onUpdate={updateFinding}
            />
        </DashboardPage>
    );
};

export default ScamSwarmView;
