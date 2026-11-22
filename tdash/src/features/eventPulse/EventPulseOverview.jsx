import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, ChevronUp, DoorOpen, Eye, Flame,
    ListChecks, MessageCircle, ShieldCheck, Sparkles, ThumbsUp, Ticket,
} from 'lucide-react';
import api from '../../lib/api';
import { DashboardButton, DashboardChip, DashboardSection, DashboardSurface } from '../../components/dashboard/DashboardPrimitives';
import { MooseChat } from '../../components/dashboard/MooseChat';
import { getDashboardTheme } from '../../lib/dashboardTheme';
import { accentClasses } from '../../lib/brandAccent';
import { cn } from '../../lib/utils';
import { vendorEventAllows } from '../../lib/ticketingMode';
import ECC_Overview from '../ECC_Overview';
import { buildPulse, buildSalesPath, summarizeTicketTypes } from './pulseModel';
import { buildVitalSigns } from './vitalSigns';
import { buildMooseRead, forecastLine, isNeedsLine, shortDate, ticketTip } from './mooseRead';
import { answerEventQuestion, SUGGESTED_QUESTIONS } from './eventMooseAnswers';
import { SalesPathChart } from './SalesPathChart';

// Labs demo: the event Overview leads with the event's pulse. A verdict in
// three words, Moose's read in plain sentences, one bar, five vital signs and
// one picture. The recorded figures stay on the page under "See the numbers".

const count = (value) => new Intl.NumberFormat('en-CA').format(Math.round(value || 0));
const pct = (share) => `${Math.round((share || 0) * 100)}%`;
// "$59", not "CA$59.00": whole dollars unless the price has cents.
const price = (amount, currency) => {
    try {
        return new Intl.NumberFormat('en-CA', { style: 'currency', currency: String(currency || 'CAD').toUpperCase(), maximumFractionDigits: Number(amount) % 1 ? 2 : 0 }).format(Number(amount) || 0);
    } catch {
        return `$${amount}`;
    }
};
const body = (response) => response?.data?.data ?? response?.data ?? null;
const listOf = (response, key) => {
    const data = response?.data;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (key && Array.isArray(response?.[key])) return response[key];
    if (key && Array.isArray(data?.[key])) return data[key];
    if (key && Array.isArray(data?.data?.[key])) return data.data[key];
    return [];
};

const BADGES = {
    hot: { icon: Flame, dark: 'border-[rgb(var(--brand-accent-rgb)/0.5)] bg-[rgb(var(--brand-accent-rgb)/0.16)] text-[var(--brand-accent-soft)]', light: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700', bar: accentClasses.bar },
    good: { icon: ThumbsUp, dark: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300', light: 'border-emerald-200 bg-emerald-50 text-emerald-700', bar: 'bg-emerald-500' },
    attention: { icon: AlertTriangle, dark: 'border-amber-400/40 bg-amber-400/10 text-amber-300', light: 'border-amber-200 bg-amber-50 text-amber-800', bar: 'bg-amber-500' },
    live: { icon: DoorOpen, label: 'Doors open', dark: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300', light: 'border-emerald-200 bg-emerald-50 text-emerald-700', bar: 'bg-emerald-500' },
    past: { icon: CheckCircle2, label: 'Wrapped', dark: 'border-white/15 bg-white/5 text-zinc-200', light: 'border-slate-200 bg-slate-50 text-slate-700', bar: accentClasses.bar },
    presale: { icon: Ticket, label: 'Not on sale yet', dark: 'border-white/15 bg-white/5 text-zinc-200', light: 'border-slate-200 bg-slate-50 text-slate-700', bar: accentClasses.bar },
    cancelled: { icon: AlertTriangle, label: 'Cancelled', dark: 'border-rose-400/40 bg-rose-400/10 text-rose-300', light: 'border-rose-200 bg-rose-50 text-rose-700', bar: 'bg-rose-500' },
};

const SIGN_ICONS = { sales: Ticket, interest: Eye, buzz: MessageCircle, safety: ShieldCheck, ready: ListChecks };
const SIGN_TONES = {
    good: { dark: 'text-emerald-300', light: 'text-emerald-700', dot: 'bg-emerald-400' },
    watch: { dark: 'text-amber-300', light: 'text-amber-700', dot: 'bg-amber-400' },
    bad: { dark: 'text-rose-300', light: 'text-rose-700', dot: 'bg-rose-400' },
    quiet: { dark: 'text-zinc-300', light: 'text-slate-600', dot: 'bg-slate-400' },
};

const Countdown = ({ isDark, pulse }) => {
    const theme = getDashboardTheme(isDark);
    let big = null;
    let small = null;
    if (pulse.phase === 'upcoming' && pulse.daysToGo != null) { big = count(pulse.daysToGo); small = pulse.daysToGo === 1 ? 'day to go' : 'days to go'; }
    else if (pulse.phase === 'presale' && pulse.daysToOnSale) { big = count(pulse.daysToOnSale); small = pulse.daysToOnSale === 1 ? 'day until on sale' : 'days until on sale'; }
    else if (pulse.phase === 'live') { big = pct(pulse.turnout); small = 'through the door'; }
    else if (pulse.phase === 'past' && pulse.soldPct != null) { big = pct(pulse.soldPct); small = 'full'; }
    if (!big) return null;
    return (
        <div className="shrink-0 text-right" data-testid="pulse-countdown">
            <p className={cn('text-4xl font-light tracking-tight sm:text-5xl', theme.textPrimary)}>{big}</p>
            <p className={cn('text-xs font-light', theme.textSecondary)}>{small}</p>
        </div>
    );
};

const PulseBar = ({ isDark, pulse, badge }) => {
    const theme = getDashboardTheme(isDark);
    const live = pulse.phase === 'live';
    const total = live ? pulse.sold : pulse.capacity;
    const value = live ? pulse.used : pulse.sold;
    if (!total || pulse.phase === 'presale') return null;
    const share = Math.min(1, value / total);
    const marker = pulse.phase === 'upcoming' && !pulse.soldOut && pulse.expectedPct != null ? Math.min(1, pulse.expectedPct) : null;
    return (
        <div data-testid="pulse-bar">
            <div className="flex items-baseline justify-between gap-3 text-sm font-light">
                <p className={theme.textPrimary}>
                    <span className="text-lg">{count(value)}</span> of {count(total)} {live ? 'ticket holders are in' : 'tickets sold'}
                </p>
                <p className={theme.textSecondary}>{pct(share)}</p>
            </div>
            <div className="relative mt-2">
                <div className={cn('h-3 overflow-hidden rounded-full', isDark ? 'bg-white/10' : 'bg-slate-200')}>
                    <div className={cn('h-full rounded-full', badge.bar)} style={{ width: `${Math.max(2, share * 100)}%` }} />
                </div>
                {marker != null ? (
                    <div className="absolute -top-1.5 h-6 w-0.5 rounded-full bg-current" style={{ left: `${marker * 100}%` }} aria-hidden="true" data-testid="pulse-usual-marker" />
                ) : null}
            </div>
            {marker != null ? (
                <p className={cn('mt-2 text-xs font-light', theme.textSecondary)}>
                    The marker shows where a show like this usually is by now: about {pct(marker)} sold.
                </p>
            ) : null}
        </div>
    );
};

const VitalSign = ({ isDark, sign }) => {
    const theme = getDashboardTheme(isDark);
    const Icon = SIGN_ICONS[sign.id] || Ticket;
    const tone = SIGN_TONES[sign.state] || SIGN_TONES.quiet;
    return (
        <Link to={sign.to} className={cn('block rounded-md focus-visible:outline-none focus-visible:ring-2', accentClasses.ring)} data-testid={`vital-sign-${sign.id}`}>
            <DashboardSurface isDark={isDark} accent={false} interactive className="flex h-full flex-col p-4">
                <div className="flex items-center justify-between gap-2">
                    <p className={cn('inline-flex items-center gap-2 text-xs font-light', theme.textSecondary)}>
                        <Icon size={15} aria-hidden="true" />{sign.label}
                    </p>
                    <span className={cn('h-2.5 w-2.5 rounded-full', tone.dot)} aria-hidden="true" />
                </div>
                <p className={cn('mt-2 text-lg font-light leading-6', isDark ? tone.dark : tone.light)}>{sign.headline}</p>
                <p className={cn('mt-1 flex-1 text-xs font-light leading-5', theme.textSecondary)}>{sign.detail}</p>
                <p className={cn('mt-3 inline-flex items-center gap-1 text-xs font-light', accentClasses.text)}>
                    Open {sign.source}<ArrowRight size={13} aria-hidden="true" />
                </p>
            </DashboardSurface>
        </Link>
    );
};

const TicketRows = ({ isDark, types, currency }) => {
    const theme = getDashboardTheme(isDark);
    return (
        <ul className="space-y-4" data-testid="pulse-ticket-types">
            {types.map((type) => (
                <li key={type.id}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm font-light">
                        <p className={theme.textPrimary}>{type.name} <span className={theme.textMuted}>· {price(type.price, currency)}</span></p>
                        <p className={theme.textSecondary}>
                            {type.soldOut ? <span className={isDark ? 'text-emerald-300' : 'text-emerald-700'}>Sold out · </span> : null}
                            {count(type.sold)} of {count(type.total)}
                        </p>
                    </div>
                    <div className={cn('mt-2 h-2 overflow-hidden rounded-full', isDark ? 'bg-white/10' : 'bg-slate-200')}>
                        <div className={cn('h-full rounded-full', type.soldOut ? 'bg-emerald-500' : accentClasses.bar)} style={{ width: `${Math.max(1, type.pct * 100)}%` }} />
                    </div>
                </li>
            ))}
        </ul>
    );
};

const EventPulseOverview = ({ event, isDark, onViewOrders, now: fixedNow }) => {
    const theme = getDashboardTheme(isDark);
    const external = !vendorEventAllows(event, 'orders');
    const [state, setState] = useState({ loading: true, failed: false, data: null });
    const [showNumbers, setShowNumbers] = useState(false);

    useEffect(() => {
        if (external) return undefined;
        let active = true;
        setState({ loading: true, failed: false, data: null });
        const optional = (request) => request.catch(() => null);
        Promise.all([
            api.get('/analytics/sales', { params: { eventId: event.id } }),
            api.get(`/events/${event.id}/stats`),
            optional(api.get(`/ticket-types?eventId=${event.id}`)),
            optional(api.get('/tasks', { params: { eventId: event.id } })),
            optional(api.get('/approvals?sortBy=deadline')),
        ]).then(([sales, stats, types, tasks, approvals]) => {
            if (!active) return;
            setState({
                loading: false,
                failed: false,
                data: {
                    sales: body(sales) || {},
                    stats: body(stats) || {},
                    types: listOf(types, 'ticketTypes'),
                    tasks: listOf(tasks, 'tasks'),
                    approvals: listOf(approvals, 'approvals'),
                },
            });
        }).catch(() => {
            if (active) setState({ loading: false, failed: true, data: null });
        });
        return () => { active = false; };
    }, [event.id, external]);

    const view = useMemo(() => {
        if (!state.data) return null;
        const now = fixedNow ?? Date.now();
        const pulse = buildPulse({ event, ticketsSold: state.data.stats.ticketsSold, ticketsUsed: state.data.stats.ticketsUsed, salesByDay: state.data.sales.salesByDay, now });
        const vitals = buildVitalSigns({ event, pulse, tasks: state.data.tasks, approvals: state.data.approvals, now });
        const types = summarizeTicketTypes(state.data.types);
        const read = buildMooseRead({ event, pulse, signs: vitals.signs, interest: vitals.interest, types });
        const path = buildSalesPath(pulse);
        const moments = vitals.buzz?.best?.publishedAt
            ? [{ ms: new Date(vitals.buzz.best.publishedAt).getTime(), label: `Top post: ${vitals.buzz.best.thumbnailLabel || 'your best one'}` }]
            : [];
        return { pulse, ...vitals, types, read, path, moments, tip: ticketTip(types, pulse) };
    }, [state.data, event, fixedNow]);

    // Events sold elsewhere keep the recorded overview: Tixmo has no orders to read a pulse from.
    if (external) return <ECC_Overview event={event} isDark={isDark} onViewOrders={onViewOrders} />;
    if (state.loading) return <p role="status" className={theme.textSecondary}>Checking this event's pulse…</p>;
    if (state.failed || !view) return <ECC_Overview event={event} isDark={isDark} onViewOrders={onViewOrders} />;

    const { pulse, signs, types, read, path, moments, tip } = view;
    const [headline, ...lines] = read;
    const badge = BADGES[pulse.verdict || pulse.phase] || BADGES.good;
    const BadgeIcon = badge.icon;
    const badgeLabel = pulse.label || badge.label;
    const showPath = path && (pulse.phase === 'upcoming' || pulse.phase === 'past' || pulse.phase === 'live');
    const mooseData = { event, ...view };

    return (
        <div className={cn('space-y-6', theme.textPrimary)} data-testid="event-pulse">
            <DashboardSurface isDark={isDark} accent="brand" className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <p className={cn('text-xs font-light', theme.textSecondary)}>Event pulse</p>
                        <span className={cn('mt-2 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-base font-light', isDark ? badge.dark : badge.light)} data-testid="pulse-verdict">
                            <BadgeIcon size={18} aria-hidden="true" />{badgeLabel}
                        </span>
                    </div>
                    <Countdown isDark={isDark} pulse={pulse} />
                </div>

                <div className={cn('mt-5 flex gap-3 rounded-md border p-4', isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50')} data-testid="moose-read">
                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', accentClasses.tint, accentClasses.text)}>
                        <Sparkles size={18} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                        <p className={cn('text-xs font-light', theme.textMuted)}>Moose's read</p>
                        <p className={cn('mt-1 text-xl font-light leading-7 sm:text-2xl', theme.textPrimary)}>{headline}</p>
                        {lines.filter((line) => !isNeedsLine(line)).length ? (
                            <p className={cn('mt-2 text-sm font-light leading-6 sm:text-base sm:leading-7', theme.textSecondary)}>
                                {lines.filter((line) => !isNeedsLine(line)).join(' ')}
                            </p>
                        ) : null}
                        {lines.filter(isNeedsLine).map((line) => (
                            <p key={line} className={cn('mt-3 inline-flex items-start gap-2 text-sm font-light leading-6 sm:text-base', isDark ? 'text-amber-300' : 'text-amber-800')} data-testid="moose-needs-you">
                                <AlertTriangle size={17} className="mt-1 shrink-0" aria-hidden="true" />{line}
                            </p>
                        ))}
                    </div>
                </div>

                <div className="mt-5">
                    <PulseBar isDark={isDark} pulse={pulse} badge={badge} />
                </div>
            </DashboardSurface>

            <div className={cn('grid grid-cols-2 gap-4 md:grid-cols-3', signs.length > 3 && 'xl:grid-cols-5')} data-testid="vital-signs">
                {signs.map((sign) => <VitalSign key={sign.id} isDark={isDark} sign={sign} />)}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-stretch">
                {showPath ? (
                    <DashboardSection
                        isDark={isDark}
                        accent="brand"
                        title={pulse.phase === 'upcoming' ? 'Are you where you should be?' : 'How sales built'}
                        description={pulse.phase === 'upcoming' ? forecastLine(pulse) : undefined}
                    >
                        <SalesPathChart isDark={isDark} path={path} moments={moments} />
                    </DashboardSection>
                ) : (
                    <DashboardSection isDark={isDark} accent="brand" title="Sales have not started">
                        <p className={cn('text-sm font-light leading-6', theme.textSecondary)}>
                            {pulse.salesStart && pulse.salesStart > pulse.now ? `Tickets go on sale ${shortDate(pulse.salesStart)}. The sales picture appears here once the first tickets sell.` : 'The sales picture appears here once the first tickets sell.'}
                        </p>
                    </DashboardSection>
                )}
                <MooseChat
                    isDark={isDark}
                    data={mooseData}
                    askQuestion={answerEventQuestion}
                    suggestions={SUGGESTED_QUESTIONS}
                    welcomeText={`Hi, I'm Moose, Tixmo's AI assistant. Ask me anything about ${event.name}.`}
                    resetKey={event.id}
                    className="lg:h-auto lg:min-h-[360px]"
                />
            </div>

            {types.length ? (
                <DashboardSection isDark={isDark} accent="brand" title="Tickets" description="What is gone and what is left, by ticket type.">
                    <TicketRows isDark={isDark} types={types} currency={event.currency || 'cad'} />
                    {tip ? (
                        <p className={cn('mt-5 flex items-start gap-2 text-sm font-light leading-6', theme.textSecondary)} data-testid="moose-ticket-tip">
                            <Sparkles size={16} className={cn('mt-1 shrink-0', accentClasses.text)} aria-hidden="true" />{tip}
                        </p>
                    ) : null}
                </DashboardSection>
            ) : null}

            <div>
                <DashboardButton isDark={isDark} variant="secondary" aria-expanded={showNumbers} onClick={() => setShowNumbers((open) => !open)}>
                    {showNumbers ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
                    {showNumbers ? 'Hide the numbers' : 'See the numbers'}
                </DashboardButton>
                <DashboardChip isDark={isDark} className="ml-3">Revenue, orders and daily sales</DashboardChip>
                {showNumbers ? (
                    <div className="mt-5" data-testid="pulse-numbers">
                        <ECC_Overview event={event} isDark={isDark} onViewOrders={onViewOrders} />
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default EventPulseOverview;
