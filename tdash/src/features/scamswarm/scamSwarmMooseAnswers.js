// Labs demo: Moose answers questions about the ScamSwarm findings on the
// page, on the client. No LLM, no API keys, no network calls. Answers use
// the same plain words as the page: no scores, no status codes.
import { bucketOf, countBuckets, describeFinding, groupByEvent, joinPlain, plainKind } from './scamSwarmData';

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

const plural = (count, word, many = `${word}s`) => `${count} ${count === 1 ? word : many}`;

// Still up and not harmless: live scams first, then the ones worth a look, then reported ones.
const stillUp = (findings) => (findings || [])
    .filter((f) => f.status !== 'resolved' && f.verdict !== 'safe')
    .sort((a, b) => b.score - a.score);

const answerFirst = (findings) => {
    const needs = (findings || []).filter((f) => bucketOf(f) === 'needs').sort((a, b) => b.score - a.score);
    if (!needs.length) {
        const look = countBuckets(findings).look;
        return look
            ? `No scam is waiting on you. ${plural(look, 'post is', 'posts are')} worth a look when you have a minute.`
            : 'Nothing is waiting on you. Every scam has been reported or taken down. Nice work.';
    }
    const lines = needs.slice(0, 3).map((f, i) => `(${i + 1}) ${describeFinding(f)}, aimed at ${f.event} (${f.handle})`);
    return `Start with these, worst first: ${lines.join('; ')}. I have the report written for each. Use "Report all for me" at the top, or open one to read it first. If fans may already have paid, warn them too.`;
};

const answerEvent = (findings) => {
    const up = stillUp(findings);
    if (!up.length) return 'None of your events has anything suspicious up right now.';
    const [top, second] = groupByEvent(up).sort((a, b) => (b.needs + b.look + b.handled) - (a.needs + a.look + a.handled) || b.needs - a.needs);
    const count = top.needs + top.look + top.handled;
    const kinds = [...new Set(up.filter((f) => f.event === top.event).map((f) => plainKind(f).toLowerCase()))];
    let text = `${top.event} is targeted the most, with ${plural(count, 'scam or suspicious post', 'scams and suspicious posts')} still up (${joinPlain(kinds)}).`;
    if (second) text += ` Next is ${second.event} with ${second.needs + second.look + second.handled}.`;
    text += ' Big on-sale moments attract copycats, so a warning to fans before your next announcement is a good idea.';
    return text;
};

const answerPlatform = (findings) => {
    const up = stillUp(findings);
    if (!up.length) return 'Nothing suspicious is up on any platform right now.';
    const groups = new Map();
    up.forEach((f) => groups.set(f.platformLabel, (groups.get(f.platformLabel) || 0) + 1));
    const ranked = [...groups.entries()].sort((a, b) => b[1] - a[1]);
    const [name, count] = ranked[0];
    const scams = up.filter((f) => f.platformLabel === name && f.verdict === 'scam').length;
    const rest = ranked.slice(1).map(([label, n]) => `${label} ${n}`).join(', ');
    return `${name} has the most: ${plural(count, 'scam or suspicious post is', 'scams and suspicious posts are')} still up there${scams ? `, and ${plural(scams, 'is a likely scam', 'are likely scams')}` : ''}.${rest ? ` Then ${rest}.` : ''} Each platform has its own form for fakes and fraud, and I fill it in for you.`;
};

const answerFans = (findings) => {
    const events = [...new Set(stillUp(findings).map((f) => f.event))];
    const target = events.length ? ` Start with ticket holders for ${joinPlain(events.slice(0, 3))}.` : '';
    return `Keep it short and calm: official tickets are only sold on your Tixmo pages, transfers only happen inside Tixmo, and you never ask for card details, gift cards or e-transfers by DM.${target} Open a scam and choose "Warn your fans": the post and the email are already written, and nothing goes out until you send it.`;
};

const answerCounts = (findings) => {
    const c = countBuckets(findings);
    return `ScamSwarm found ${plural((findings || []).length, 'post or page', 'posts and pages')} using your events: ${plural(c.needs, 'scam needs', 'scams need')} you, ${c.look} ${c.look === 1 ? 'is' : 'are'} worth a look, ${c.handled} ${c.handled === 1 ? 'is' : 'are'} handled and ${c.fine} ${c.fine === 1 ? 'looks' : 'look'} fine.`;
};

const answerSafe = (findings) => {
    const safe = (findings || []).filter((f) => f.verdict === 'safe');
    if (!safe.length) return 'Nothing has been marked as fine yet.';
    return `${plural(safe.length, 'looks', 'look')} fine: ${joinPlain(safe.map((f) => `${f.handle} (${plainKind(f).toLowerCase()})`))}. They are fan pages or face-value resales that use the official Tixmo transfer, so there is nothing to do.`;
};

export const fallbackAnswer = (findings) => `I'm Moose, Tixmo's assistant. I can only talk about the ScamSwarm findings on this page. ${answerCounts(findings)} Try asking what needs attention first, which event or platform is targeted most, or what to tell your fans.`;

const RULES = [
    { id: 'first', test: (q) => /attention first|first|priorit|urgent|most dangerous|worst|start/.test(q), answer: answerFirst },
    { id: 'event', test: (q) => /which event|event .*target|targeted|most targeted/.test(q), answer: answerEvent },
    { id: 'platform', test: (q) => /platform|instagram|facebook|tiktok|marketplace|where/.test(q), answer: answerPlatform },
    { id: 'fans', test: (q) => /fans|tell|warn|announce|post/.test(q), answer: answerFans },
    { id: 'safe', test: (q) => /safe|fine|legit|fan page/.test(q), answer: answerSafe },
    { id: 'counts', test: (q) => /how many|count|total|summary|scams|found/.test(q), answer: answerCounts },
];

export const answerMooseQuestion = (question, findings) => {
    const query = normalize(question);
    if (!query) return fallbackAnswer(findings);
    const rule = RULES.find((item) => item.test(query));
    return (rule ? rule.answer : fallbackAnswer)(findings);
};
