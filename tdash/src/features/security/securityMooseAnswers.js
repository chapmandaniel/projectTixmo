// Labs demo: Moose answers questions about the currently loaded Security
// report on the client. No LLM, no API keys, no network calls.
export const SUGGESTED_QUESTIONS = [
    'Is my account safe right now?',
    'What attacks did we stop this week?',
    'Who on my team needs to fix their password or 2FA?',
    'What protects my event pages?',
];

const formatCount = (value) => new Intl.NumberFormat('en-CA').format(value);

const normalize = (value) => String(value || '')
    .toLowerCase()
    .replace(/[?!.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const joinNames = (names) => {
    const list = (names || []).filter(Boolean);
    if (list.length === 0) return '';
    if (list.length === 1) return list[0];
    if (list.length === 2) return `${list[0]} and ${list[1]}`;
    return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`;
};

const uniqueKinds = (items) => {
    const seen = [];
    (items || []).forEach((item) => {
        if (item?.kind && !seen.includes(item.kind)) seen.push(item.kind);
    });
    return seen;
};

const answerSafe = (report) => {
    const team = report.team.totals;
    const attacks = report.attacks.totals;
    const pages = `${formatCount(report.totals.pagesOnline)} of ${formatCount(report.totals.pagesTotal)}`;
    let text = `Yes — your Northlight Live platforms look safe right now. ${pages} event pages are online with HTTPS valid, ${formatCount(team.twoFactorOn)} of ${formatCount(team.active)} active members use two-factor sign-in, checkout has ${formatCount(report.totals.chargebackFlags)} chargeback-risk flags, and your door devices are all in order (${formatCount(report.totals.devicesOnline)} online, ${formatCount(report.totals.devicesPaused)} paused, ${formatCount(report.totals.devicesRevoked)} revoked).`;
    text += ` In the last 24 hours ${formatCount(attacks.last24h)} suspected attacks were stopped automatically; ${formatCount(attacks.reached)} reached your platforms and ${formatCount(attacks.breached)} were breached.`;
    if (team.leakCurrent === 0) {
        text += ` No current passwords match known breach lists`;
        if (team.leakResolved) {
            text += ` (${formatCount(team.leakResolved)} earlier match${team.leakResolved === 1 ? '' : 'es'} already reset — ${joinNames(report.team.leakResolvedNames)})`;
        }
        text += '.';
    }
    if (team.weakPasswords || team.withoutTwoFactor) {
        text += ` There are a few recommended follow-ups in Team Account Health, but nothing urgent is open.`;
    }
    return text;
};

const answerAttacks = (report) => {
    const totals = report.attacks.totals;
    const kinds = uniqueKinds(report.attacks.items);
    let text = `Over the last 7 days we stopped ${formatCount(totals.last7d)} suspected attacks aimed at your event pages, dashboard or checkout. That's ${formatCount(totals.last24h)} in the last 24 hours and ${formatCount(totals.last30d)} over the last 30 days.`;
    if (kinds.length) {
        text += ` The ones listed on this page include ${joinNames(kinds).toLowerCase()}.`;
    }
    const statuses = [...new Set((report.attacks.items || []).map((item) => item.status).filter(Boolean))];
    if (statuses.length) {
        text += ` Every one was ${joinNames(statuses).toLowerCase()}.`;
    }
    text += ` ${formatCount(totals.reached)} reached your platforms and ${formatCount(totals.breached)} were breached — nothing got through, and no action is needed from you.`;
    return text;
};

const answerTeamFixes = (report) => {
    const team = report.team;
    const totals = team.totals;
    const parts = [];
    if (totals.weakPasswords) {
        parts.push(`${joinNames(team.weakNames)} ${totals.weakPasswords === 1 ? 'has' : 'have'} a weak password — ask them to choose a longer, less common one (you can send a reminder from this page)`);
    }
    if (totals.withoutTwoFactor) {
        parts.push(`${joinNames(team.pendingNames)} ${totals.withoutTwoFactor === 1 ? 'has' : 'have'} not set up 2FA yet because ${totals.withoutTwoFactor === 1 ? 'the invite is' : 'their invites are'} still pending — they'll turn it on when they join`);
    }
    let text = `Of ${formatCount(totals.roster)} people on your roster, ${formatCount(totals.twoFactorOn)} of ${formatCount(totals.active)} active members already use two-factor sign-in.`;
    if (parts.length) {
        text += ` ${parts.join('. ')}.`;
    } else {
        text += ' Nobody on the active team needs a password or 2FA fix right now.';
    }
    if (totals.leakResolved) {
        text += ` ${joinNames(team.leakResolvedNames)} had a password appear on a known breach list; it is already reset and no further action is needed.`;
    }
    if (totals.leakCurrent) {
        text += ` ${formatCount(totals.leakCurrent)} current breach-list ${totals.leakCurrent === 1 ? 'match still needs' : 'matches still need'} a reset.`;
    } else {
        text += ` There are ${formatCount(totals.leakCurrent)} current breach-list matches.`;
    }
    return text;
};

const answerLayers = (report) => {
    const layers = report.protection.layers || [];
    const allActive = report.protection.allActive || layers.every((layer) => layer.status);
    const names = layers.map((layer) => layer.name);
    const status = layers[0]?.status || 'Active / Healthy';
    let text = `${formatCount(layers.length)} protection layers sit around your event pages, dashboard and checkout`;
    if (allActive) {
        text += `, and all of them are ${status.toLowerCase()}`;
    }
    text += '.';
    if (names.length) {
        text += ` They are ${joinNames(names)}.`;
    }
    const website = (report.sources || []).find((source) => source.id === 'website');
    if (website?.uptime) {
        text += ` Your public event and ticket pages currently show ${formatCount(report.totals.pagesOnline)} of ${formatCount(report.totals.pagesTotal)} online, with ${website.uptime} uptime and HTTPS valid.`;
    } else {
        text += ` ${formatCount(report.totals.pagesOnline)} of ${formatCount(report.totals.pagesTotal)} event pages are online.`;
    }
    return text;
};

export const fallbackAnswer = (report) => {
    if (!report?.totals) {
        return "I can only talk about the security report on this page, and there isn't enough here yet to go on.";
    }
    const team = report.team.totals;
    const attacks = report.attacks.totals;
    const layers = report.protection.layers?.length || 0;
    return `I'm Moose, Tixmo's assistant. I can only talk about the security numbers on this page. Right now ${formatCount(report.totals.pagesOnline)} of ${formatCount(report.totals.pagesTotal)} event pages are online, ${formatCount(team.twoFactorOn)} of ${formatCount(team.active)} active members use 2FA, ${formatCount(attacks.last24h)} / ${formatCount(attacks.last7d)} / ${formatCount(attacks.last30d)} suspected attacks were stopped in the last 24 hours, 7 days and 30 days (${formatCount(attacks.breached)} breached), and ${formatCount(layers)} protection layers are on. ${formatCount(team.weakPasswords)} teammate${team.weakPasswords === 1 ? '' : 's'} ${team.weakPasswords === 1 ? 'has' : 'have'} a weak password, ${formatCount(team.withoutTwoFactor)} pending invite${team.withoutTwoFactor === 1 ? ' has' : 's have'} not set up 2FA yet, and ${formatCount(team.leakResolved)} earlier breach-list ${team.leakResolved === 1 ? 'match is' : 'matches are'} already reset. Try asking whether your account is safe, what attacks we stopped this week, who needs a password or 2FA fix, or what protects your event pages.`;
};

const RULES = [
    { id: 'safe', test: (q) => /account safe|am i safe|platforms look safe|is (everything|my account|it) safe|right now/.test(q), answer: answerSafe },
    { id: 'attacks', test: (q) => /attack|stopped this week|what did we stop|blocked|mitigated|threat/.test(q), answer: answerAttacks },
    { id: 'team', test: (q) => /who on my team|password or 2fa|weak password|without 2fa|needs to fix|two-factor|2fa|breach/.test(q), answer: answerTeamFixes },
    { id: 'layers', test: (q) => /protects my event|protection layer|what protects|waf|ddos|firewall/.test(q), answer: answerLayers },
];

export const answerMooseQuestion = (question, report) => {
    const query = normalize(question);
    if (!query) return fallbackAnswer(report);
    const rule = RULES.find((item) => item.test(query));
    return (rule ? rule.answer : fallbackAnswer)(report);
};
