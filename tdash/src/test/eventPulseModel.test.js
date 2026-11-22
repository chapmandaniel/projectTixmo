import { describe, expect, it } from 'vitest';
import { buildPulse, buildSalesPath, HEALTHY_FINISH, summarizeTicketTypes, usualShare, whenUsualShare } from '../features/eventPulse/pulseModel';
import { buildMooseRead } from '../features/eventPulse/mooseRead';
import { buildVitalSigns, changeWords, readReadiness, sameEvent } from '../features/eventPulse/vitalSigns';
import { answerEventQuestion } from '../features/eventPulse/eventMooseAnswers';

const DAY = 86400000;
const NOW = new Date('2026-11-16T15:00:00Z').getTime();
const iso = (ms) => new Date(ms).toISOString();
const day = (offset, tickets) => ({ date: iso(NOW + offset * DAY).slice(0, 10), tickets, orders: Math.ceil(tickets / 2), revenue: tickets * 50 });

// Same shape as the Labs seed: a festival 26 days out, on sale for 178 days.
const festival = (over = {}) => ({
    id: 'evt-harbour', name: 'Harbour Lights Festival', status: 'ON_SALE', capacity: 3560,
    salesStart: iso(NOW - 178 * DAY), startDatetime: iso(NOW + 26 * DAY), endDatetime: iso(NOW + 26 * DAY + 7 * 3600000), ...over,
});
const steadyWeeks = (perDayThisWeek, perDayLastWeek) => [
    ...Array.from({ length: 7 }, (_, i) => day(-13 + i, perDayLastWeek)),
    ...Array.from({ length: 7 }, (_, i) => day(-6 + i, perDayThisWeek)),
];

describe('usual sales shape', () => {
    it('rises from nothing to everything and can be read backwards', () => {
        expect(usualShare(0)).toBe(0);
        expect(usualShare(1)).toBeCloseTo(1, 5);
        expect(usualShare(0.5)).toBeGreaterThan(usualShare(0.25));
        expect(whenUsualShare(usualShare(0.62))).toBeCloseTo(0.62, 3);
    });
});

describe('event pulse verdict', () => {
    it('calls a festival that is ahead and speeding up Sizzling Hot', () => {
        const pulse = buildPulse({ event: festival(), ticketsSold: 2404, salesByDay: steadyWeeks(40, 30), now: NOW });
        expect(pulse.phase).toBe('upcoming');
        expect(pulse.daysToGo).toBe(26);
        expect(pulse.soldPct).toBeCloseTo(0.675, 2);
        expect(pulse.expectedPct).toBeCloseTo(HEALTHY_FINISH * usualShare(178 / 204), 5);
        expect(pulse.pace).toBe('ahead');
        expect(pulse.momentum).toBeCloseTo(1 / 3, 2);
        expect(pulse.label).toBe('Sizzling Hot');
        expect(pulse.forecastPct).toBeGreaterThan(0.85);
        expect(pulse.forecastPct).toBeLessThan(1);
    });
    it('calls the same festival Looking Good when sales are steady', () => {
        const pulse = buildPulse({ event: festival(), ticketsSold: 2404, salesByDay: steadyWeeks(30, 30), now: NOW });
        expect(pulse.label).toBe('Looking Good');
    });
    it('calls a show far behind its usual path Needs Attention', () => {
        const pulse = buildPulse({ event: festival({ capacity: 1680, salesStart: iso(NOW - 172 * DAY), startDatetime: iso(NOW + 40 * DAY) }), ticketsSold: 320, salesByDay: steadyWeeks(3, 4), now: NOW });
        expect(pulse.pace).toBe('behind');
        expect(pulse.label).toBe('Needs Attention');
        expect(pulse.sellOutAt).toBeNull();
        expect(pulse.forecastPct).toBeLessThan(0.5);
    });
    it('estimates a sell-out date when the forecast passes capacity', () => {
        const pulse = buildPulse({ event: festival({ capacity: 280, salesStart: iso(NOW - 25 * DAY), startDatetime: iso(NOW + 19 * DAY) }), ticketsSold: 139, salesByDay: steadyWeeks(6, 5), now: NOW });
        expect(pulse.label).toBe('Sizzling Hot');
        expect(pulse.forecastPct).toBe(1);
        expect(pulse.sellOutAt).toBeGreaterThan(NOW);
        expect(pulse.sellOutAt).toBeLessThan(pulse.start);
    });
    it('treats a sold-out show as Sizzling Hot with nothing left to forecast', () => {
        const pulse = buildPulse({ event: festival({ status: 'SOLD_OUT', capacity: 650 }), ticketsSold: 650, salesByDay: [], now: NOW });
        expect(pulse.soldOut).toBe(true);
        expect(pulse.label).toBe('Sizzling Hot');
        expect(pulse.forecastPct).toBeNull();
    });
    it('knows live, wrapped and not-yet-on-sale events and gives them no verdict', () => {
        const live = buildPulse({ event: festival({ startDatetime: iso(NOW - 3600000), endDatetime: iso(NOW + 3 * 3600000), capacity: 440 }), ticketsSold: 354, ticketsUsed: 213, now: NOW });
        expect(live.phase).toBe('live');
        expect(live.verdict).toBeNull();
        expect(live.turnout).toBeCloseTo(213 / 354, 5);
        const past = buildPulse({ event: festival({ status: 'COMPLETED', startDatetime: iso(NOW - 9 * DAY), endDatetime: iso(NOW - 9 * DAY + 3600000) }), ticketsSold: 300, ticketsUsed: 270, now: NOW });
        expect(past.phase).toBe('past');
        const presale = buildPulse({ event: festival({ status: 'PUBLISHED', salesStart: iso(NOW + 10 * DAY), startDatetime: iso(NOW + 75 * DAY) }), ticketsSold: 0, now: NOW });
        expect(presale.phase).toBe('presale');
        expect(presale.daysToOnSale).toBe(10);
    });
    it('does not invent a verdict from missing capacity', () => {
        const pulse = buildPulse({ event: festival({ capacity: null }), ticketsSold: 50, now: NOW });
        expect(pulse.soldPct).toBeNull();
        expect(pulse.label).toBe('Looking Good');
        expect(pulse.forecastPct).toBeNull();
    });
});

describe('sales path picture', () => {
    it('ends the sold line at today on the headline number and carries a forecast to show day', () => {
        const pulse = buildPulse({ event: festival(), ticketsSold: 2404, salesByDay: steadyWeeks(40, 30), now: NOW });
        const path = buildSalesPath(pulse);
        expect(path.points.length).toBeLessThanOrEqual(64);
        const today = path.points.find((point) => point.day === path.todayDay);
        expect(today.actual).toBe(2404);
        expect(today.forecast).toBeCloseTo(2404, 5);
        const last = path.points[path.points.length - 1];
        expect(last.actual).toBeNull();
        expect(last.forecast).toBeCloseTo(pulse.forecastPct * 3560, 0);
        expect(last.usual).toBeCloseTo(3560 * HEALTHY_FINISH, 5);
        expect(path.finish).toBe(`${Math.round(pulse.forecastPct * 100)}% full`);
        expect(path.best.tickets).toBe(40);
    });
    it('needs a capacity and a sale window', () => {
        expect(buildSalesPath(buildPulse({ event: festival({ capacity: 0 }), ticketsSold: 5, now: NOW }))).toBeNull();
    });
});

describe('ticket types', () => {
    it('reads sold-out types from status or from the count', () => {
        const types = summarizeTicketTypes([
            { id: 'a', name: 'VIP Deck', price: '189.00', quantity: 260, sold: 260, status: 'SOLD_OUT' },
            { id: 'b', name: 'General Admission', price: 69, quantity: 2200, sold: 1576, status: 'ACTIVE' },
            { id: 'c', name: 'Weekend Pass', price: 159, quantity: 500, sold: 500, status: 'ACTIVE' },
        ]);
        expect(types.map((type) => type.soldOut)).toEqual([true, false, true]);
        expect(types[1].pct).toBeCloseTo(1576 / 2200, 5);
    });
});

describe('vital signs and Moose', () => {
    const types = summarizeTicketTypes([
        { id: 'a', name: 'VIP Deck', price: 189, quantity: 260, sold: 260 },
        { id: 'b', name: 'General Admission', price: 69, quantity: 2200, sold: 1576 },
    ]);
    const tasks = [
        { id: 't1', title: 'Confirm stage-two power and generator backup', status: 'IN_PROGRESS', eventId: 'evt-harbour', dueDate: iso(NOW - 2 * DAY) },
        { id: 't2', title: 'Door staffing plan', status: 'TODO', eventId: 'evt-harbour', dueDate: iso(NOW + 5 * DAY) },
        { id: 't3', title: 'Old job', status: 'DONE', eventId: 'evt-harbour', dueDate: iso(NOW - 20 * DAY) },
    ];
    const approvals = [
        { id: 'a1', title: 'Harbour Lights main poster', status: 'PENDING_REVIEW', eventId: 'evt-harbour' },
        { id: 'a2', title: 'Someone else', status: 'PENDING_REVIEW', eventId: 'evt-other' },
    ];

    it('says big swings in words, not triple-digit percentages', () => {
        expect(changeWords(0.34)).toBe('34% more than the month before');
        expect(changeWords(-0.11)).toBe('11% fewer than the month before');
        expect(changeWords(1.63)).toBe('more than double the month before');
        expect(changeWords(0.01)).toBe('about the same as the month before');
    });
    it('matches loosely on event names', () => {
        expect(sameEvent('Fog City Sessions', 'Fog City Strobe')).toBe(true);
        expect(sameEvent('Harbour Lights Festival', 'Harbour Lights Festival')).toBe(true);
        expect(sameEvent('Aurora After Dark', 'Harbour Lights Festival')).toBe(false);
    });
    it('counts only this event\'s open, overdue and waiting work', () => {
        const ready = readReadiness({ event: festival(), tasks, approvals, now: NOW });
        expect(ready.open).toHaveLength(2);
        expect(ready.overdue).toHaveLength(1);
        expect(ready.waiting).toHaveLength(1);
    });
    it('gives five signs, each pointing at the dashboard behind it', () => {
        const pulse = buildPulse({ event: festival(), ticketsSold: 2404, salesByDay: steadyWeeks(40, 30), now: NOW });
        const { signs, interest } = buildVitalSigns({ event: festival(), pulse, tasks, approvals, now: NOW });
        expect(signs.map((sign) => sign.id)).toEqual(['sales', 'interest', 'buzz', 'safety', 'ready']);
        expect(signs[0]).toMatchObject({ headline: 'Ahead of pace', state: 'good' });
        expect(signs[1].to).toBe('/analytics?page=harbour-lights-festival');
        expect(interest.people).toBeGreaterThan(0);
        expect(signs[3].to).toBe('/scamswarm?event=Harbour%20Lights%20Festival');
        expect(signs[4]).toMatchObject({ headline: '1 task overdue', state: 'watch', to: '/todo?event=evt-harbour' });
    });
    it('has Moose lead with the verdict and name what needs the promoter', () => {
        const pulse = buildPulse({ event: festival(), ticketsSold: 2404, salesByDay: steadyWeeks(40, 30), now: NOW });
        const vitals = buildVitalSigns({ event: festival(), pulse, tasks, approvals, now: NOW });
        const read = buildMooseRead({ event: festival(), pulse, signs: vitals.signs, interest: vitals.interest, types });
        expect(read[0]).toBe('Harbour Lights Festival is flying.');
        expect(read.join(' ')).toContain('You have sold 68% with 26 days to go.');
        expect(read.join(' ')).toContain('VIP Deck is sold out, so General Admission is carrying sales now.');
        expect(read.join(' ')).toMatch(/need(s)? you: /);
        expect(read.join(' ')).toContain('1 task overdue');
    });
    it('answers follow-up questions from the same figures', () => {
        const pulse = buildPulse({ event: festival(), ticketsSold: 2404, salesByDay: steadyWeeks(40, 30), now: NOW });
        const vitals = buildVitalSigns({ event: festival(), pulse, tasks, approvals, now: NOW });
        const read = buildMooseRead({ event: festival(), pulse, signs: vitals.signs, interest: vitals.interest, types });
        const data = { event: festival(), pulse, ...vitals, types, read };
        expect(answerEventQuestion('Will it sell out?', data)).toMatch(/^Not at this pace\. At this pace you finish about \d+% full\./);
        expect(answerEventQuestion('What needs me today?', data)).toContain('Getting ready: 1 task overdue');
        expect(answerEventQuestion('Which tickets are selling?', data)).toContain('VIP Deck is sold out (260).');
        expect(answerEventQuestion('tell me a joke', data)).toContain("I'm Moose");
    });
    it('explains a slow show in plain words instead of a number', () => {
        const event = festival({ id: 'evt-fog', name: 'Fog City Strobe', capacity: 1680, salesStart: iso(NOW - 172 * DAY), startDatetime: iso(NOW + 40 * DAY) });
        const pulse = buildPulse({ event, ticketsSold: 320, salesByDay: steadyWeeks(3, 4), now: NOW });
        const vitals = buildVitalSigns({ event, pulse, tasks: [], approvals: [], now: NOW });
        const read = buildMooseRead({ event, pulse, signs: vitals.signs, interest: vitals.interest, types: [] });
        expect(read[0]).toBe('Fog City Strobe needs a push.');
        expect(read[2]).toMatch(/promotion|fresh push|price or the checkout|push will go furthest/);
        expect(vitals.signs[0]).toMatchObject({ headline: 'Behind pace', state: 'bad' });
    });
});
