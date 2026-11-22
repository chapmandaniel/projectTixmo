import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle, ArrowRight, Check, CheckCircle2, Clock, Facebook, Flag, Gavel, Globe, Instagram, Mail,
    Megaphone, Music2, Radar, RotateCcw, ShieldCheck, ShoppingBag, Sparkles, Twitter, UserPlus, Users, X, XCircle,
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
    BUCKET_ORDER,
    BUCKETS,
    OFFICIAL,
    PLATFORMS,
    VERDICTS,
    assigneeName,
    bucketOf,
    buildScamRead,
    buildSeedFindings,
    countBuckets,
    eventsIn,
    fanWarningDraft,
    groupByEvent,
    mainReason,
    minutesLabel,
    nextStep,
    plainKind,
    reachWords,
    reportDraft,
    sureness,
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

const TONES = {
    needs: { dot: 'bg-rose-400', dark: 'border-rose-400/30 bg-rose-500/10 text-rose-300', light: 'border-rose-200 bg-rose-50 text-rose-700', text: { dark: 'text-rose-300', light: 'text-rose-700' } },
    look: { dot: 'bg-amber-400', dark: 'border-amber-400/30 bg-amber-400/10 text-amber-200', light: 'border-amber-200 bg-amber-50 text-amber-800', text: { dark: 'text-amber-200', light: 'text-amber-800' } },
    handled: { dot: 'bg-emerald-400', dark: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300', light: 'border-emerald-200 bg-emerald-50 text-emerald-700', text: { dark: 'text-emerald-300', light: 'text-emerald-700' } },
    fine: { dot: 'bg-slate-400', dark: 'border-white/10 bg-white/5 text-zinc-300', light: 'border-slate-200 bg-slate-100 text-slate-600', text: { dark: 'text-zinc-300', light: 'text-slate-600' } },
};
const READ_TONE = { bad: 'needs', watch: 'look', good: 'handled' };
const count = (value) => new Intl.NumberFormat('en-CA').format(value);

/** How sure Moose is, as five dots and a few words. No scores on the page. */
const SureDots = ({ finding, isDark }) => {
    const sure = sureness(finding);
    const tone = TONES[finding.verdict === 'safe' ? 'fine' : finding.verdict === 'scam' ? 'needs' : 'look'];
    return (
        <span className={cn('inline-flex items-center gap-2 text-xs font-light', isDark ? tone.text.dark : tone.text.light)} data-testid="sureness">
            <span className="flex gap-0.5" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((step) => (
                    <span key={step} className={cn('h-1.5 w-3 rounded-full', step <= sure.level ? tone.dot : (isDark ? 'bg-white/10' : 'bg-slate-200'))} />
                ))}
            </span>
            {sure.label}
        </span>
    );
};

const EventRow = ({ isDark, group, active, onPick }) => {
    const theme = getDashboardTheme(isDark);
    const quiet = !group.needs && !group.look;
    const summary = [
        group.needs ? `${count(group.needs)} ${group.needs === 1 ? 'scam' : 'scams'}` : '',
        group.look ? `${count(group.look)} to look at` : '',
        group.handled ? `${count(group.handled)} handled` : '',
        quiet && group.fine ? 'only fan pages and fair resales' : '',
    ].filter(Boolean).join(' · ');
    return (
        <li>
            <button
                type="button"
                onClick={onPick}
                aria-pressed={active}
                data-testid={`event-row-${group.event}`}
                className={cn(
                    'flex w-full items-center gap-3 rounded-md border p-2.5 text-left transition-colors',
                    theme.panelMuted,
                    active ? (isDark ? 'border-white/40' : 'border-slate-500') : (isDark ? 'hover:border-white/20' : 'hover:border-slate-300')
                )}
            >
                {group.poster ? (
                    <img src={group.poster} alt="" loading="lazy" className="h-14 w-10 shrink-0 rounded object-cover" />
                ) : (
                    <span className={cn('flex h-14 w-10 shrink-0 items-center justify-center rounded', isDark ? 'bg-white/5' : 'bg-slate-100')}><Radar size={16} className={theme.textMuted} /></span>
                )}
                <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-sm font-light', theme.textPrimary)}>{group.event}</span>
                    <span className={cn('block truncate text-xs font-light', group.needs ? (isDark ? TONES.needs.text.dark : TONES.needs.text.light) : theme.textSecondary)}>{summary}</span>
                    <span className="mt-1.5 flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
                        {BUCKET_ORDER.filter((bucket) => group[bucket]).map((bucket) => (
                            <span key={bucket} className={cn('h-full rounded-full', TONES[bucket].dot)} style={{ flexGrow: group[bucket] }} />
                        ))}
                    </span>
                </span>
                {group.reach ? (
                    <span className={cn('hidden shrink-0 text-right text-xs font-light sm:block', theme.textMuted)}>
                        <span className={cn('block text-sm', theme.textPrimary)}>{count(Math.round(group.reach / 100) * 100)}</span>
                        people at risk
                    </span>
                ) : null}
            </button>
        </li>
    );
};

const FindingCard = ({ isDark, finding, onOpen }) => {
    const theme = getDashboardTheme(isDark);
    const bucket = bucketOf(finding);
    const step = nextStep(finding);
    const tone = TONES[bucket];
    return (
        <article className={cn('flex min-w-0 flex-col gap-3 rounded-md border p-3', theme.panelMuted)} data-testid={`card-${finding.id}`}>
            <button
                type="button"
                data-testid={`finding-${finding.id}`}
                onClick={() => onOpen(finding.id, null)}
                className={cn('flex w-full min-w-0 flex-col gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2', accentClasses.ring)}
            >
                <span className="flex items-center justify-between gap-2">
                    <SureDots finding={finding} isDark={isDark} />
                    <PlatformLabel platform={finding.platform} isDark={isDark} />
                </span>
                <span className="min-w-0">
                    <span className={cn('block text-lg font-light leading-6', theme.textPrimary)}>{plainKind(finding)}</span>
                    <span className={cn('block truncate text-xs font-light', theme.textMuted)}>{finding.handle} · targets {finding.event}</span>
                </span>
                <span className="block min-w-0"><PreviewCard finding={finding} isDark={isDark} compact /></span>
                <span className={cn('flex items-start gap-2 text-sm font-light leading-5', isDark ? tone.text.dark : tone.text.light)}>
                    {bucket === 'fine' ? <Check size={15} className="mt-0.5 shrink-0" aria-hidden="true" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />}
                    {mainReason(finding)}
                </span>
                <span className={cn('flex items-center gap-2 text-xs font-light', theme.textSecondary)}>
                    <Users size={13} aria-hidden="true" />{reachWords(finding)} · found {minutesLabel(finding.minutesAgo)}
                </span>
            </button>
            <div className="mt-auto flex flex-wrap items-center gap-2">
                {step && (step.id === 'report' || step.id === 'takedown') ? (
                    <DashboardButton isDark={isDark} className="px-3 py-2" onClick={() => onOpen(finding.id, step.id)} data-testid={`step-${finding.id}`}>
                        {step.id === 'report' ? <Flag size={14} aria-hidden="true" /> : <Gavel size={14} aria-hidden="true" />}{step.label}
                    </DashboardButton>
                ) : null}
                {step && step.id === 'open' ? (
                    <DashboardButton isDark={isDark} variant="secondary" className="px-3 py-2" onClick={() => onOpen(finding.id, null)}>
                        {step.label}<ArrowRight size={14} aria-hidden="true" />
                    </DashboardButton>
                ) : null}
                {step && (step.id === 'waiting' || step.id === 'done') ? (
                    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-light', isDark ? tone.dark : tone.light)} data-testid={`state-${finding.id}`}>
                        {step.id === 'done' ? <CheckCircle2 size={12} aria-hidden="true" /> : <Clock size={12} aria-hidden="true" />}{step.label}
                    </span>
                ) : null}
                {finding.assignee ? (
                    <span className={cn('inline-flex items-center gap-1 text-[11px] font-light', theme.textSecondary)}>
                        <UserPlus size={12} aria-hidden="true" /> {assigneeName(finding.assignee)}
                    </span>
                ) : null}
                {finding.fanWarningDraft ? (
                    <span className={cn('inline-flex items-center gap-1 text-[11px] font-light', theme.textSecondary)}>
                        <Megaphone size={12} aria-hidden="true" /> Fan warning drafted
                    </span>
                ) : null}
            </div>
        </article>
    );
};

const DraftBox = ({ isDark, label, text, testId }) => {
    const theme = getDashboardTheme(isDark);
    return (
        <div>
            <p className={cn('mb-1 text-xs font-light', theme.textTertiary)}>{label}</p>
            <pre
                data-testid={testId}
                className={cn('max-h-56 overflow-y-auto whitespace-pre-wrap rounded-md border p-3 font-sans text-xs font-light leading-5', isDark ? 'border-white/10 bg-black/30 text-zinc-200' : 'border-slate-200 bg-slate-50 text-slate-700')}
            >
                {text}
            </pre>
        </div>
    );
};

/** Found -> Reported -> Taken down, as three dots instead of a status menu. */
const Progress = ({ isDark, finding }) => {
    const theme = getDashboardTheme(isDark);
    if (finding.status === 'resolved' && finding.resolution !== 'Taken down') {
        return <p className={cn('text-xs font-light', theme.textSecondary)} data-testid="finding-progress">{finding.resolution || 'Resolved'}. Nothing more to do.</p>;
    }
    const reached = finding.status === 'resolved' ? 2 : finding.status === 'reported' ? 1 : 0;
    const steps = ['Found', finding.platform === 'web' ? 'Takedown requested' : 'Reported', 'Taken down'];
    return (
        <ol className="flex items-center gap-2" data-testid="finding-progress" aria-label={`Progress: ${steps[reached]}`}>
            {steps.map((label, index) => (
                <li key={label} className="flex flex-1 items-center gap-2">
                    <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]', index <= reached ? 'bg-emerald-500 text-white' : (isDark ? 'bg-white/10 text-zinc-400' : 'bg-slate-200 text-slate-500'))}>
                        {index <= reached ? <Check size={12} aria-hidden="true" /> : index + 1}
                    </span>
                    <span className={cn('text-xs font-light', index <= reached ? theme.textPrimary : theme.textMuted)}>{label}</span>
                    {index < steps.length - 1 ? <span className={cn('h-px flex-1', isDark ? 'bg-white/10' : 'bg-slate-200')} aria-hidden="true" /> : null}
                </li>
            ))}
        </ol>
    );
};

const FindingDrawer = ({ finding, startPanel, isDark, onClose, onUpdate }) => {
    const theme = getDashboardTheme(isDark);
    const [panel, setPanel] = useState(null);

    // Moose has the paperwork ready: a scam opens with its report already written out.
    useEffect(() => {
        if (!finding) { setPanel(null); return; }
        const recommended = nextStep(finding);
        setPanel(startPanel || (recommended && (recommended.id === 'report' || recommended.id === 'takedown') ? recommended.id : null));
    }, [finding?.id, startPanel]);

    useEffect(() => {
        const onKey = (event) => { if (event.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    if (!finding) return null;
    const bucket = bucketOf(finding);
    const warn = fanWarningDraft(finding);
    const resolved = finding.status === 'resolved';
    const fine = finding.verdict === 'safe';
    const act = (patch, log) => { onUpdate(finding.id, patch, log); setPanel(null); };
    const where = finding.platform === 'web' ? 'the site host' : finding.platformLabel;
    const whyTitle = fine ? 'Why this looks fine' : finding.verdict === 'scam' ? 'Why Moose thinks this is a scam' : 'Why Moose flagged this';
    const SignalIcon = fine ? Check : AlertTriangle;

    return (
        <div className="fixed inset-0 z-[70] flex justify-end" data-testid="finding-drawer">
            <button type="button" aria-label="Close finding" className="absolute inset-0 bg-black/50" onClick={onClose} />
            <aside
                role="dialog"
                aria-modal="true"
                aria-label={`${plainKind(finding)}: ${finding.handle}`}
                className={cn('relative flex h-full w-full max-w-[560px] flex-col overflow-y-auto border-l shadow-2xl', theme.panel)}
            >
                <div className={cn('sticky top-0 z-10 flex items-start justify-between gap-3 border-b px-5 py-4', theme.divider, theme.panel)}>
                    <div className="min-w-0">
                        <SureDots finding={finding} isDark={isDark} />
                        <h2 className={cn('mt-1.5 truncate text-xl font-light', theme.textPrimary)}>{plainKind(finding)}</h2>
                        <p className={cn('truncate text-xs font-light', theme.textMuted)}>{finding.handle} on {PLATFORMS[finding.platform]?.label || finding.platform} · targets {finding.event}</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close" className={cn('rounded-md p-2', theme.iconButton)}>
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-5 px-5 py-5">
                    {!fine || resolved ? <Progress isDark={isDark} finding={finding} /> : null}
                    <PreviewCard finding={finding} isDark={isDark} />

                    <div>
                        <p className={cn('mb-2 text-sm font-light', theme.textPrimary)}>{whyTitle}</p>
                        <ul className="space-y-1.5" data-testid="finding-signals">
                            {finding.signals.map((signal) => (
                                <li key={signal.label} className={cn('flex items-start gap-2 text-sm font-light leading-5', theme.textSecondary)}>
                                    <SignalIcon size={15} className={cn('mt-0.5 shrink-0', isDark ? TONES[bucket === 'handled' ? 'needs' : bucket].text.dark : TONES[bucket === 'handled' ? 'needs' : bucket].text.light)} aria-hidden="true" />
                                    {signal.label}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <p className={cn('flex items-start gap-2 text-sm font-light leading-5', theme.textSecondary)}>
                        <Users size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                        <span>{reachWords(finding)}. Found {minutesLabel(finding.minutesAgo)} at <span className="break-all">{finding.url.replace(/^https:\/\//, '')}</span></span>
                    </p>

                    {!fine ? (
                        <div className={cn('space-y-3 rounded-md border p-4', theme.panelMuted)} data-testid="finding-actions">
                            <p className={cn('flex items-center gap-2 text-sm font-light', theme.textPrimary)}>
                                <Sparkles size={15} className={accentClasses.text} aria-hidden="true" />
                                {bucket === 'handled' ? 'What is left to do' : 'What to do. Moose has it written.'}
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                <DashboardButton isDark={isDark} variant={panel === 'report' || (!panel && bucket === 'needs' && finding.platform !== 'web') ? 'primary' : 'secondary'} className="px-3" aria-pressed={panel === 'report'} onClick={() => setPanel(panel === 'report' ? null : 'report')}>
                                    <Flag size={14} aria-hidden="true" /> Report it
                                </DashboardButton>
                                <DashboardButton isDark={isDark} variant={panel === 'takedown' ? 'primary' : 'secondary'} className="px-3" aria-pressed={panel === 'takedown'} onClick={() => setPanel(panel === 'takedown' ? null : 'takedown')}>
                                    <Gavel size={14} aria-hidden="true" /> Get it taken down
                                </DashboardButton>
                                <DashboardButton isDark={isDark} variant={panel === 'warn' ? 'primary' : 'secondary'} className="px-3" aria-pressed={panel === 'warn'} onClick={() => setPanel(panel === 'warn' ? null : 'warn')}>
                                    <Megaphone size={14} aria-hidden="true" /> Warn your fans
                                </DashboardButton>
                                {finding.status === 'reported' ? (
                                    <DashboardButton isDark={isDark} variant="secondary" className="px-3" onClick={() => act({ status: 'resolved', resolution: 'Taken down' }, `${finding.platform === 'web' ? 'The host' : finding.platformLabel} took it down`)}>
                                        <CheckCircle2 size={14} aria-hidden="true" /> It is gone now
                                    </DashboardButton>
                                ) : (
                                    <DashboardButton isDark={isDark} variant="secondary" className="px-3" disabled={finding.whitelisted} onClick={() => act({ whitelisted: true, verdict: 'safe', status: 'resolved', resolution: 'Marked fine' }, `Marked ${finding.handle} as fine`)}>
                                        <ShieldCheck size={14} aria-hidden="true" /> This one is fine
                                    </DashboardButton>
                                )}
                            </div>

                            {panel === 'report' ? (
                                <div className="space-y-3" data-testid="panel-report">
                                    <DraftBox isDark={isDark} label={`Report for ${where}, ready to send`} text={reportDraft(finding)} testId="report-draft" />
                                    <DashboardButton isDark={isDark} onClick={() => act({ status: resolved ? 'resolved' : 'reported' }, `Reported to ${where}`)}>Send report</DashboardButton>
                                </div>
                            ) : null}

                            {panel === 'takedown' ? (
                                <div className="space-y-3" data-testid="panel-takedown">
                                    <DraftBox isDark={isDark} label="Takedown request, ready to send" text={takedownDraft(finding)} testId="takedown-draft" />
                                    <DashboardButton isDark={isDark} onClick={() => act({ takedownRequested: true, status: resolved ? 'resolved' : 'reported' }, 'Takedown requested')}>Send takedown request</DashboardButton>
                                </div>
                            ) : null}

                            {panel === 'warn' ? (
                                <div className="space-y-3" data-testid="panel-warn">
                                    <DraftBox isDark={isDark} label={`Post from ${OFFICIAL.handle}`} text={warn.post} testId="warn-post" />
                                    <DraftBox isDark={isDark} label={`Email to ${finding.event} ticket holders. Subject: ${warn.emailSubject}`} text={warn.emailBody} testId="warn-email" />
                                    <DashboardButton isDark={isDark} onClick={() => act({ fanWarningDraft: true }, 'Fan warning saved as a draft')}><Mail size={14} aria-hidden="true" /> Save both as drafts</DashboardButton>
                                </div>
                            ) : null}

                            {!resolved ? (
                                <button type="button" className={cn('inline-flex items-center gap-1.5 text-xs font-light underline-offset-2 hover:underline', theme.textMuted)} onClick={() => act({ status: 'resolved', resolution: 'Dismissed' }, 'Dismissed')}>
                                    <XCircle size={13} aria-hidden="true" /> Dismiss without doing anything
                                </button>
                            ) : null}
                        </div>
                    ) : null}

                    <div>
                        <label htmlFor="ss-assignee" className={cn('mb-2 block text-sm font-light', theme.textPrimary)}>Hand this to a teammate</label>
                        <DashboardSelect
                            id="ss-assignee"
                            isDark={isDark}
                            value={finding.assignee || ''}
                            onChange={(event) => {
                                const id = event.target.value || null;
                                onUpdate(
                                    finding.id,
                                    { assignee: id, status: id && finding.status === 'new' ? 'in_review' : finding.status },
                                    id ? `Handed to ${assigneeName(id)}` : 'Nobody is on it'
                                );
                            }}
                        >
                            <option value="">Nobody yet</option>
                            {ASSIGNEES.map((member) => (
                                <option key={member.id} value={member.id}>{member.name}, {member.title}</option>
                            ))}
                        </DashboardSelect>
                    </div>

                    <div>
                        <p className={cn('mb-2 text-sm font-light', theme.textPrimary)}>What has happened</p>
                        <ul className="space-y-1.5" data-testid="finding-activity">
                            {finding.activity.map((entry) => (
                                <li key={entry.id} className={cn('flex justify-between gap-3 text-xs font-light', theme.textSecondary)}>
                                    <span>{entry.text}</span>
                                    <span className={cn('shrink-0', theme.textMuted)}>{entry.at}</span>
                                </li>
                            ))}
                            <li className={cn('text-xs font-light', theme.textMuted)}>Found by ScamSwarm {minutesLabel(finding.minutesAgo)}.</li>
                        </ul>
                    </div>

                    <p className={cn('text-[11px] font-light', theme.textMuted)}>Labs preview: nothing is sent or posted from this page.</p>
                </div>
            </aside>
        </div>
    );
};

const timeNow = () => new Date().toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
const startingEvent = () => {
    const wanted = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('event');
    return wanted && eventsIn(buildSeedFindings()).includes(wanted) ? wanted : 'all';
};
const BUCKET_RANK = { needs: 0, look: 1, handled: 2, fine: 3 };

const ScamSwarmView = ({ isDark = true }) => {
    const theme = getDashboardTheme(isDark);
    const [findings, setFindings] = useState(buildSeedFindings);
    // An event page can link here already filtered: /scamswarm?event=<event name>.
    const [eventFilter, setEventFilter] = useState(startingEvent);
    // Open on what needs the promoter, not on all fourteen things at once.
    const [bucket, setBucket] = useState(() => (startingEvent() !== 'all' ? 'all' : countBuckets(buildSeedFindings()).needs ? 'needs' : 'all'));
    const [open, setOpen] = useState({ id: null, panel: null });
    const [bulkDone, setBulkDone] = useState(0);

    const inEvent = useMemo(() => findings.filter((f) => eventFilter === 'all' || f.event === eventFilter), [findings, eventFilter]);
    const counts = useMemo(() => countBuckets(inEvent), [inEvent]);
    const read = useMemo(() => buildScamRead(findings), [findings]);
    const groups = useMemo(() => groupByEvent(findings), [findings]);
    const visible = useMemo(() => inEvent
        .filter((f) => bucket === 'all' || bucketOf(f) === bucket)
        .sort((a, b) => BUCKET_RANK[bucketOf(a)] - BUCKET_RANK[bucketOf(b)] || b.score - a.score || a.minutesAgo - b.minutesAgo), [inEvent, bucket]);
    const needsNow = useMemo(() => findings.filter((f) => bucketOf(f) === 'needs').sort((a, b) => b.score - a.score), [findings]);
    const openFinding = findings.find((f) => f.id === open.id) || null;
    const readTone = TONES[READ_TONE[read.tone]];

    const updateFinding = (id, patch, log) => {
        setFindings((current) => current.map((f) => (f.id === id
            ? { ...f, ...patch, activity: log ? [{ id: `${Date.now()}-${f.activity.length}`, text: log, at: timeNow() }, ...f.activity] : f.activity }
            : f)));
    };

    // "Report all for me": Moose sends the report it already wrote for each live scam.
    const reportAll = () => {
        const ids = new Set(needsNow.map((f) => f.id));
        setFindings((current) => current.map((f) => {
            if (!ids.has(f.id)) return f;
            const web = f.platform === 'web';
            const text = web ? 'Takedown requested by Moose' : `Reported to ${f.platformLabel} by Moose`;
            return { ...f, status: 'reported', takedownRequested: web || f.takedownRequested, activity: [{ id: `${Date.now()}-${f.id}`, text, at: timeNow() }, ...f.activity] };
        }));
        setBulkDone(ids.size);
        setBucket('handled');
    };

    const resetDemo = () => {
        setFindings(buildSeedFindings());
        setEventFilter('all');
        setBucket('needs');
        setOpen({ id: null, panel: null });
        setBulkDone(0);
    };

    return (
        <DashboardPage>
            <DashboardPageHeader
                isDark={isDark}
                title="ScamSwarm"
                icon={Radar}
                iconClassName={accentClasses.text}
                description="Finds fake tickets and impostor accounts that use your events, and helps you shut them down."
                badges={(
                    <>
                        <DashboardChip isDark={isDark}>
                            <Clock size={12} className="mr-1.5" />
                            Checked {sweepSummary.lastSweepMinutes} min ago
                        </DashboardChip>
                        <DashboardChip isDark={isDark}>{count(sweepSummary.mentionsScanned)} posts and pages checked this week</DashboardChip>
                    </>
                )}
            />

            <DashboardSurface isDark={isDark} accent="brand" className="p-5 sm:p-6" data-testid="scamswarm-hero">
                <span className={cn('inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-base font-light', isDark ? readTone.dark : readTone.light)} data-testid="scam-verdict">
                    {read.tone === 'good' ? <ShieldCheck size={18} aria-hidden="true" /> : <AlertTriangle size={18} aria-hidden="true" />}{read.pill}
                </span>
                <div className={cn('mt-4 flex gap-3 rounded-md border p-4', isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50')} data-testid="moose-read">
                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', accentClasses.tint, accentClasses.text)}>
                        <Sparkles size={18} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                        <p className={cn('text-xs font-light', theme.textMuted)}>Moose's read</p>
                        <p className={cn('mt-1 text-xl font-light leading-7 sm:text-2xl', theme.textPrimary)}>{read.headline}</p>
                        {read.lines.length ? <p className={cn('mt-2 text-sm font-light leading-6 sm:text-base sm:leading-7', theme.textSecondary)}>{read.lines.join(' ')}</p> : null}
                        {bulkDone ? (
                            <p className={cn('mt-3 inline-flex items-start gap-2 text-sm font-light leading-6 sm:text-base', isDark ? 'text-emerald-300' : 'text-emerald-700')} data-testid="bulk-done">
                                <CheckCircle2 size={17} className="mt-1 shrink-0" aria-hidden="true" />
                                Done. {count(bulkDone)} {bulkDone === 1 ? 'report is' : 'reports are'} with the platforms. I will tell you when they come down.
                            </p>
                        ) : null}
                        {needsNow.length ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                                <DashboardButton isDark={isDark} onClick={reportAll} data-testid="report-all">
                                    <Flag size={15} aria-hidden="true" /> Report {needsNow.length === 1 ? 'it' : `all ${count(needsNow.length)}`} for me
                                </DashboardButton>
                                <DashboardButton isDark={isDark} variant="secondary" onClick={() => setOpen({ id: needsNow[0].id, panel: null })}>
                                    Show me the worst one<ArrowRight size={15} aria-hidden="true" />
                                </DashboardButton>
                            </div>
                        ) : null}
                    </div>
                </div>
            </DashboardSurface>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-stretch">
                <DashboardSection isDark={isDark} accent="brand" title="Which events are being targeted" description="Pick an event to see only what was found for it.">
                    <ul className="grid gap-2 sm:grid-cols-2" data-testid="scamswarm-events">
                        {groups.map((group) => (
                            <EventRow
                                key={group.event}
                                isDark={isDark}
                                group={group}
                                active={eventFilter === group.event}
                                onPick={() => { const next = eventFilter === group.event ? 'all' : group.event; setEventFilter(next); setBucket(next === 'all' && counts.needs ? 'needs' : 'all'); }}
                            />
                        ))}
                    </ul>
                </DashboardSection>
                <MooseChat
                    isDark={isDark}
                    data={findings}
                    askQuestion={answerMooseQuestion}
                    suggestions={MOOSE_QUESTIONS}
                    welcomeText="Hi, I'm Moose, Tixmo's AI assistant. Ask me which scams to deal with first, or what to tell your fans."
                    resetKey="scamswarm"
                    className="lg:h-auto lg:min-h-[360px]"
                />
            </div>

            <DashboardSection
                isDark={isDark}
                accent="brand"
                title={eventFilter === 'all' ? 'What ScamSwarm found' : `Found for ${eventFilter}`}
                description="Each one was found outside Tixmo. Open it to see why Moose flagged it and what to do."
            >
                <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Show" data-testid="scamswarm-filters">
                    {BUCKET_ORDER.map((id) => (
                        <button
                            key={id}
                            type="button"
                            aria-pressed={bucket === id}
                            onClick={() => setBucket(bucket === id ? 'all' : id)}
                            data-testid={`bucket-${id}`}
                            className={cn(
                                'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-light transition-colors',
                                bucket === id ? (isDark ? TONES[id].dark : TONES[id].light) : (isDark ? 'border-white/10 text-zinc-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50')
                            )}
                        >
                            <span className={cn('h-2 w-2 rounded-full', TONES[id].dot)} aria-hidden="true" />
                            {BUCKETS[id].label}
                            <span className="tabular-nums">{count(counts[id])}</span>
                        </button>
                    ))}
                    <button
                        type="button"
                        aria-pressed={bucket === 'all'}
                        onClick={() => setBucket('all')}
                        data-testid="bucket-all"
                        className={cn('rounded-full border px-3.5 py-1.5 text-sm font-light transition-colors', bucket === 'all' ? (isDark ? 'border-white/30 bg-white/10 text-white' : 'border-slate-900 bg-slate-900 text-white') : (isDark ? 'border-white/10 text-zinc-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'))}
                    >
                        Everything {count(inEvent.length)}
                    </button>
                    {eventFilter !== 'all' ? (
                        <button type="button" onClick={() => { setEventFilter('all'); setBucket(countBuckets(findings).needs ? 'needs' : 'all'); }} className={cn('ml-auto inline-flex items-center gap-1 text-xs font-light underline-offset-2 hover:underline', theme.textSecondary)} data-testid="clear-event">
                            <X size={13} aria-hidden="true" /> Show all events
                        </button>
                    ) : null}
                </div>

                {visible.length ? (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="scamswarm-findings">
                        {visible.map((finding) => (
                            <FindingCard key={finding.id} isDark={isDark} finding={finding} onOpen={(id, panel) => setOpen({ id, panel })} />
                        ))}
                    </div>
                ) : (
                    <p className={cn('rounded-md border p-6 text-center text-sm font-light', theme.panelMuted, theme.textSecondary)} data-testid="scamswarm-empty">
                        {bucket === 'needs' ? 'Nothing is waiting on you here.' : 'Nothing to show here.'}
                    </p>
                )}
            </DashboardSection>

            <div className={cn('flex flex-wrap items-center justify-between gap-3 text-[11px] font-light', theme.textMuted)}>
                <p>Labs preview with made-up accounts. Nothing on this page is sent or posted. Watching {sweepSummary.sources.join(', ')}.</p>
                <button type="button" onClick={resetDemo} className="inline-flex items-center gap-1.5 underline-offset-2 hover:underline">
                    <RotateCcw size={12} aria-hidden="true" /> Start the demo over
                </button>
            </div>

            <FindingDrawer
                finding={openFinding}
                startPanel={open.panel}
                isDark={isDark}
                onClose={() => setOpen({ id: null, panel: null })}
                onUpdate={updateFinding}
            />
        </DashboardPage>
    );
};

export default ScamSwarmView;
