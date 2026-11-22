// Labs demo: Moose answers follow-up questions about one event from the same
// pulse, vital signs and ticket figures the page shows. Keyword rules on the
// client. No model call, no network.

import { forecastLine } from './mooseRead';
import { changeWords, plainSource } from './vitalSigns';

export const SUGGESTED_QUESTIONS = [
    'Will it sell out?',
    'What needs me today?',
    'Where is interest coming from?',
    'Which tickets are selling?',
];

const count = (value) => new Intl.NumberFormat('en-CA').format(Math.round(value || 0));
const pct = (share) => `${Math.round((share || 0) * 100)}%`;
const normalize = (value) => String(value || '').toLowerCase().replace(/[?!.,]/g, ' ').replace(/\s+/g, ' ').trim();

const answerSellOut = ({ event, pulse }) => {
    if (pulse.phase === 'presale') return `${event.name} is not on sale yet, so there is nothing to forecast. Ask me again once tickets are moving.`;
    if (pulse.phase === 'past') return pulse.soldOut ? `It did. Every ticket for ${event.name} went.` : `It finished ${pct(pulse.soldPct)} full, with ${count(pulse.left)} tickets unsold.`;
    if (pulse.soldOut) return `It already has. All ${count(pulse.capacity)} tickets are gone.`;
    if (pulse.phase === 'live') return `Doors are open and ${count(pulse.left)} tickets are still available, so walk-ups can still get in.`;
    if (pulse.sellOutAt) return `Yes, on current form. ${forecastLine(pulse)} There are ${count(pulse.left)} tickets left.`;
    if (pulse.forecastPct == null) return `It is too early to call. ${count(pulse.sold)} tickets are sold so far.`;
    const perDayNow = Math.round(pulse.last7 / 7);
    const perDayNeeded = pulse.daysToGo ? Math.ceil(pulse.left / pulse.daysToGo) : pulse.left;
    return `Not at this pace. ${forecastLine(pulse)} To sell out you would need about ${count(perDayNeeded)} tickets a day, and you are selling about ${count(perDayNow)} a day.`;
};

const NEXT_STEP = {
    safety: 'Open ScamSwarm to report it and warn your fans.',
    ready: 'Open Tasks to see what is holding it up.',
    buzz: 'A quick reply keeps the mood up.',
    interest: 'A new post or an email to past buyers would bring people back.',
    sales: 'Look at price and promotion first.',
};

const answerNeeds = ({ signs }) => {
    const flagged = signs.filter((sign) => sign.state === 'watch' || sign.state === 'bad');
    if (!flagged.length) return 'Nothing needs you right now. Sales, interest, buzz, safety and prep all look fine.';
    const parts = flagged.map((sign) => `${sign.label}: ${sign.headline.toLowerCase()} (${sign.detail}). ${NEXT_STEP[sign.id] || ''}`.trim());
    return `${flagged.length === 1 ? 'One thing' : `${count(flagged.length)} things`}. ${parts.join(' ')}`;
};

const answerInterest = ({ event, interest }) => {
    if (!interest) return `Nobody has visited the ${event.name} page yet, so there is nothing to report.`;
    const change = interest.change == null ? '' : `, ${changeWords(interest.change)}`;
    let text = `${count(interest.people)} people looked at ${event.name} in the last 28 days${change}.`;
    if (interest.topSource) text += ` Most of them find it through ${plainSource(interest.topSource)}.`;
    if (interest.bestBuyers && interest.bestBuyers.id !== interest.topSource?.id) text += ` The people most likely to buy come from ${plainSource(interest.bestBuyers)}.`;
    if (interest.liveNow) text += ` ${count(interest.liveNow)} people are looking right now.`;
    return text;
};

const answerTickets = ({ types }) => {
    if (!types.length) return 'This event has no ticket types set up yet.';
    return types.map((type) => (type.soldOut ? `${type.name} is sold out (${count(type.total)}).` : `${type.name} has sold ${count(type.sold)} of ${count(type.total)}.`)).join(' ');
};

export const fallbackAnswer = ({ read }) => `I'm Moose, Tixmo's assistant. Here is the short version: ${read.join(' ')} You can ask me whether it will sell out, what needs you, where interest is coming from, or which tickets are selling.`;

const RULES = [
    { id: 'sellout', test: (q) => /sell out|sellout|sold out|finish|forecast|how many will/.test(q), answer: answerSellOut },
    { id: 'needs', test: (q) => /need|attention|to do|todo|should i|next|priorit|worry/.test(q), answer: answerNeeds },
    { id: 'interest', test: (q) => /interest|coming from|where|source|looking|traffic|visitor|who is/.test(q), answer: answerInterest },
    { id: 'tickets', test: (q) => /which ticket|ticket type|tickets are selling|vip|tier|price/.test(q), answer: answerTickets },
    { id: 'doing', test: (q) => /how|doing|going|health|pulse|summary|status/.test(q), answer: ({ read }) => read.join(' ') },
];

export const answerEventQuestion = (question, data) => {
    const query = normalize(question);
    const rule = query ? RULES.find((item) => item.test(query)) : null;
    return (rule ? rule.answer : fallbackAnswer)(data);
};
