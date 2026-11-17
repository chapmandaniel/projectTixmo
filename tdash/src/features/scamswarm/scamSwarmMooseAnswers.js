// Labs demo: Moose answers questions about the ScamSwarm findings on the
// page, on the client. No LLM, no API keys, no network calls.
import { assigneeName, statusLabel, summarize } from './scamSwarmData';

export const SUGGESTED_QUESTIONS = [
    'What needs my attention first?',
    'Which event is targeted the most?',
    'Which platform has the most scams?',
    'What should I tell my fans?',
];

const normalize = (value) => String(value || '')
    .toLowerCase()
    .replace(/[?!.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

const openRisky = (findings) => (findings || [])
    .filter((f) => f.status !== 'resolved' && f.verdict !== 'safe')
    .sort((a, b) => b.score - a.score);

const countBy = (items, key) => {
    const counts = new Map();
    items.forEach((item) => counts.set(item[key], (counts.get(item[key]) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
};

const answerFirst = (findings) => {
    const risky = openRisky(findings);
    if (!risky.length) return 'Nothing risky is open right now. Every likely scam has been reported or taken down. Nice work.';
    const top = risky.slice(0, 3);
    const lines = top.map((f, i) => `(${i + 1}) ${f.handle} on ${f.platformLabel}: ${f.kindLabel.toLowerCase()} targeting ${f.event} (score ${f.score}, ${statusLabel(f.status)}${f.assignee ? `, with ${assigneeName(f.assignee)}` : ', unassigned'})`);
    return `Start with the highest scores that are still open: ${lines.join('; ')}. Open each one to report it to the platform or request a takedown. If fans may already have paid, use Warn fans too.`;
};

const answerEvent = (findings) => {
    const risky = (findings || []).filter((f) => f.verdict !== 'safe');
    if (!risky.length) return 'No event has risky mentions right now.';
    const [[event, count], second] = countBy(risky, 'event');
    const kinds = [...new Set(risky.filter((f) => f.event === event).map((f) => f.kindLabel.toLowerCase()))];
    let text = `${event} is targeted the most, with ${plural(count, 'risky finding')} (${kinds.join(', ')}).`;
    if (second) text += ` Next is ${second[0]} with ${second[1]}.`;
    text += ' Big on-sale moments attract copycats, so a fan warning before the next announcement is a good idea.';
    return text;
};

const answerPlatform = (findings) => {
    const scams = (findings || []).filter((f) => f.verdict === 'scam');
    if (!scams.length) return 'There are no likely scams on any platform right now.';
    const ranked = countBy(scams, 'platformLabel');
    const [top] = ranked;
    const rest = ranked.slice(1).map(([name, count]) => `${name} ${count}`).join(', ');
    return `${top[0]} has the most likely scams (${top[1]}).${rest ? ` Then ${rest}.` : ''} Reports go through each platform's own impersonation or fraud form, and ScamSwarm prefills it for you.`;
};

const answerFans = (findings) => {
    const risky = openRisky(findings);
    const events = [...new Set(risky.map((f) => f.event))];
    const target = events.length ? ` Focus on ${events.slice(0, 3).join(', ')}.` : '';
    return `Keep it short and calm: official tickets are only sold on your Tixmo pages, transfers only happen inside Tixmo, and you never ask for card details, gift cards or e-transfers by DM.${target} Open a finding and choose Warn fans to get a draft post and email you can edit. In this demo, nothing gets sent.`;
};

const answerCounts = (findings) => {
    const s = summarize(findings);
    return `ScamSwarm is tracking ${plural(s.total, 'mention')} of your events outside Tixmo: ${s.scam} likely scams and ${s.attention} that need attention are still open, ${s.safe} look safe, ${s.reported} are reported and ${s.resolved} are taken down or resolved.`;
};

const answerSafe = (findings) => {
    const safe = (findings || []).filter((f) => f.verdict === 'safe');
    if (!safe.length) return 'Nothing is marked likely safe yet.';
    return `${plural(safe.length, 'finding')} look safe: ${safe.map((f) => `${f.handle} (${f.kindLabel.toLowerCase()})`).join(', ')}. They're usually fan pages or face-value resales that use the official Tixmo transfer. You can whitelist them so they stop showing up.`;
};

export const fallbackAnswer = (findings) => `I'm Moose, Tixmo's assistant. I can only talk about the ScamSwarm findings on this page. ${answerCounts(findings)} Try asking what needs attention first, which event or platform is targeted most, or what to tell your fans.`;

const RULES = [
    { id: 'first', test: (q) => /attention first|first|priorit|urgent|most dangerous|worst|start/.test(q), answer: answerFirst },
    { id: 'event', test: (q) => /which event|event .*target|targeted|most targeted/.test(q), answer: answerEvent },
    { id: 'platform', test: (q) => /platform|instagram|facebook|tiktok|marketplace|where/.test(q), answer: answerPlatform },
    { id: 'fans', test: (q) => /fans|tell|warn|announce|post/.test(q), answer: answerFans },
    { id: 'safe', test: (q) => /safe|legit|whitelist|fan page/.test(q), answer: answerSafe },
    { id: 'counts', test: (q) => /how many|count|total|summary|scams|found/.test(q), answer: answerCounts },
];

export const answerMooseQuestion = (question, findings) => {
    const query = normalize(question);
    if (!query) return fallbackAnswer(findings);
    const rule = RULES.find((item) => item.test(query));
    return (rule ? rule.answer : fallbackAnswer)(findings);
};
