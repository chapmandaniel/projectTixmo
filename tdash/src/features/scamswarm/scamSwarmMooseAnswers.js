// Labs demo: Moose answers questions about the ScamSwarm findings on the
// page, on the client. No LLM, no API keys, no network calls.
import { assigneeName, statusLabel, summarize } from './scamSwarmData';

export const SUGGESTED_QUESTIONS = [
    'What needs my attention first?',
    'Which event is targeted the most?',
    'Which platform has the most risk?',
    'What should I tell my fans?',
];

const normalize = (value) => String(value || '')
    .toLowerCase()
    .replace(/[?!.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const joinList = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

const openRisky = (findings) => (findings || [])
    .filter((f) => f.status !== 'resolved' && f.verdict !== 'safe')
    .sort((a, b) => b.score - a.score);

const answerFirst = (findings) => {
    const risky = openRisky(findings);
    if (!risky.length) return 'Nothing risky is open right now. Every likely scam has been reported or taken down. Nice work.';
    const top = risky.slice(0, 3);
    const lines = top.map((f, i) => `(${i + 1}) ${f.handle} on ${f.platformLabel}: ${f.kindLabel.toLowerCase()} targeting ${f.event} (score ${f.score}, ${statusLabel(f.status)}${f.assignee ? `, with ${assigneeName(f.assignee)}` : ', unassigned'})`);
    return `Start with the highest scores that are still open: ${lines.join('; ')}. Open each one to report it to the platform or request a takedown. If fans may already have paid, use Warn fans too.`;
};

const rankBy = (items, key) => {
    const groups = new Map();
    items.forEach((item) => {
        const g = groups.get(item[key]) || { name: item[key], count: 0, score: 0 };
        g.count += 1;
        g.score += item.score;
        groups.set(item[key], g);
    });
    return [...groups.values()].sort((a, b) => b.count - a.count || b.score - a.score);
};

const answerEvent = (findings) => {
    const risky = openRisky(findings);
    if (!risky.length) return 'No event has open risky mentions right now.';
    const [top, second] = rankBy(risky, 'event');
    const kinds = [...new Set(risky.filter((f) => f.event === top.name).map((f) => f.kindLabel.toLowerCase()))];
    let text = `${top.name} is targeted the most, with ${plural(top.count, 'open risky finding')} (${kinds.join(', ')}).`;
    if (second && second.count === top.count) text += ` ${second.name} also has ${second.count}, but with lower risk scores.`;
    else if (second) text += ` Next is ${second.name} with ${second.count}.`;
    text += ' Big on-sale moments attract copycats, so a fan warning before the next announcement is a good idea.';
    return text;
};

const answerPlatform = (findings) => {
    const risky = openRisky(findings);
    if (!risky.length) return 'There are no open risky findings on any platform right now.';
    const ranked = rankBy(risky, 'platformLabel');
    const [top] = ranked;
    const scams = risky.filter((f) => f.platformLabel === top.name && f.verdict === 'scam').length;
    const rest = ranked.slice(1).map((g) => `${g.name} ${g.count}`).join(', ');
    return `${top.name} has the most open risky findings (${top.count}, and ${scams} ${scams === 1 ? 'is a likely scam' : 'are likely scams'}).${rest ? ` Then ${rest}.` : ''} Reports go through each platform's own impersonation or fraud form, and ScamSwarm prefills it for you.`;
};

const answerFans = (findings) => {
    const risky = openRisky(findings);
    const events = [...new Set(risky.map((f) => f.event))];
    const target = events.length ? ` Focus on ${joinList(events.slice(0, 3))}.` : '';
    return `Keep it short and calm: official tickets are only sold on your Tixmo pages, transfers only happen inside Tixmo, and you never ask for card details, gift cards or e-transfers by DM.${target} Open a finding and choose Warn fans to get a draft post and email you can edit. In this demo, nothing gets sent.`;
};

const answerCounts = (findings) => {
    const s = summarize(findings);
    return `ScamSwarm is tracking ${plural(s.total, 'mention')} of your events outside Tixmo: ${s.scam} likely scams and ${s.attention} that need attention are still open, ${s.safe} look safe, ${s.reported} ${s.reported === 1 ? 'is' : 'are'} reported and ${s.resolved} ${s.resolved === 1 ? 'is' : 'are'} taken down or resolved.`;
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
