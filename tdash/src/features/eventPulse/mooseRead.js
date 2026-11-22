// Labs demo: Moose's read of an event. Moose speaks first: two to four plain
// sentences built from the pulse and the vital signs, so the promoter gets the
// meaning before any number. Written on the client from the same figures the
// page shows. No model call.

import { plainSource } from './vitalSigns';

const count = (value) => new Intl.NumberFormat('en-CA').format(Math.round(value || 0));
const pct = (share) => `${Math.round((share || 0) * 100)}%`;
const days = (n) => (n <= 0 ? 'hours to go' : n === 1 ? '1 day to go' : `${count(n)} days to go`);
const listed = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);
export const shortDate = (ms) => new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', timeZone: 'America/St_Johns' }).format(new Date(ms));

export const forecastLine = (pulse) => {
    if (pulse.soldOut) return 'Every ticket is gone.';
    if (pulse.sellOutAt) return `At this pace you sell out around ${shortDate(pulse.sellOutAt)}.`;
    if (pulse.forecastPct != null) return `At this pace you finish about ${pct(pulse.forecastPct)} full.`;
    return '';
};

const ticketLine = (types) => {
    const gone = types.filter((type) => type.soldOut);
    const open = types.filter((type) => !type.soldOut && type.total > 0).sort((a, b) => b.sold - a.sold);
    if (!gone.length || !open.length) return '';
    return `${listed(gone.map((type) => type.name))} ${gone.length === 1 ? 'is' : 'are'} sold out, so ${open[0].name} is carrying sales now.`;
};

const needsYou = (signs, skip = []) => {
    const flagged = signs.filter((sign) => sign.id !== 'sales' && !skip.includes(sign.id) && (sign.state === 'watch' || sign.state === 'bad'));
    if (!flagged.length) return '';
    const things = flagged.map((sign) => {
        if (sign.id === 'interest') return 'interest is fading';
        if (sign.id === 'buzz') return sign.detail.includes('waiting') ? sign.detail.replace(' waiting for a reply', ' unanswered') : 'the mood on social has turned';
        return sign.headline.toLowerCase();
    });
    return `${flagged.length === 1 ? 'One thing needs' : `${count(flagged.length)} things need`} you: ${listed(things)}.`;
};

const whyBehind = (interest) => {
    if (!interest) return 'Not many people have found the event page yet, so it needs more promotion.';
    if (interest.trend === 'fading') return 'Fewer people are looking than last month, so it needs a fresh push.';
    const share = interest.people ? interest.purchases / interest.people : 0;
    if (share < 0.06) return 'People are looking but not buying, so the price or the checkout is the place to look.';
    return `Most interest comes from ${plainSource(interest.topSource)}, so that is where a push will go furthest.`;
};

/** The line that lists what needs the promoter, so the page can make it stand out. */
export const isNeedsLine = (line) => /needs? you: /.test(String(line || ''));

/** @returns {string[]} */
export const buildMooseRead = ({ event, pulse, signs, interest, types = [] }) => {
    const name = event.name || 'This event';
    const lines = [];
    if (pulse.phase === 'cancelled') return [`${name} was cancelled.`];
    if (pulse.phase === 'presale') {
        lines.push(pulse.daysToOnSale ? `${name} goes on sale in ${count(pulse.daysToOnSale)} ${pulse.daysToOnSale === 1 ? 'day' : 'days'}.` : `${name} is not on sale yet.`);
        if (interest?.people) lines.push(`${count(interest.people)} people have already looked at the page this month, so there is an audience waiting.`);
        const flagged = needsYou(signs);
        if (flagged) lines.push(flagged);
        return lines;
    }
    if (pulse.phase === 'live') {
        lines.push(`Doors are open. ${count(pulse.used)} of ${count(pulse.sold)} ticket holders are in so far.`);
        if (pulse.left) lines.push(`${count(pulse.left)} tickets are still available at the door.`);
        const flagged = needsYou(signs);
        if (flagged) lines.push(flagged);
        return lines;
    }
    if (pulse.phase === 'past') {
        lines.push(pulse.capacity
            ? `${name} is wrapped. You sold ${count(pulse.sold)} of ${count(pulse.capacity)} tickets, ${pct(pulse.soldPct)} full.`
            : `${name} is wrapped. You sold ${count(pulse.sold)} tickets.`);
        if (pulse.turnout != null && pulse.used) lines.push(`${pct(pulse.turnout)} of ticket holders turned up on the night.`);
        if (interest?.bestBuyers) lines.push(`Most buyers came from ${plainSource(interest.bestBuyers)}, worth repeating next time.`);
        return lines;
    }

    const opener = pulse.soldOut ? `${name} is sold out.` : pulse.verdict === 'hot' ? `${name} is flying.` : pulse.verdict === 'attention' ? `${name} needs a push.` : `${name} is on track.`;
    lines.push(opener);
    if (!pulse.soldOut && pulse.soldPct != null) {
        const usual = pulse.expectedPct != null ? ` A show like this is usually around ${pct(pulse.expectedPct)} by now.` : '';
        lines.push(`You have sold ${pct(pulse.soldPct)} with ${days(pulse.daysToGo ?? 0)}.${usual}`);
    }
    if (pulse.verdict === 'attention') lines.push(whyBehind(interest));
    else {
        const forecast = forecastLine(pulse);
        if (forecast && !pulse.soldOut) lines.push(forecast);
    }
    const tickets = ticketLine(types);
    if (tickets) lines.push(tickets);
    // A slow show's fading interest is already the explanation above, so it is not repeated as a to-do.
    const flagged = needsYou(signs, pulse.verdict === 'attention' ? ['interest'] : []);
    if (flagged) lines.push(flagged);
    return lines;
};

/** A next step for the ticket mix, when there is an obvious one. */
export const ticketTip = (types, pulse) => {
    if (pulse.phase !== 'upcoming') return '';
    const gone = types.filter((type) => type.soldOut).sort((a, b) => b.price - a.price);
    const open = types.filter((type) => !type.soldOut && type.total > 0);
    if (gone.length && open.length) return `${gone[0].name} sold out first. If the venue allows a few more, they are the easiest extra money on this event.`;
    if (gone.length && !open.length) return 'Every ticket type is sold out. A waitlist will catch returns.';
    const slow = open.filter((type) => type.pct < 0.25).sort((a, b) => a.pct - b.pct)[0];
    if (slow && pulse.verdict === 'attention') return `${slow.name} is the slowest mover. A limited-time price on it is the quickest lever to pull.`;
    return '';
};
