// Labs demo: the five vital signs behind an event's pulse. Each one is the
// short version of a dashboard that already exists in Labs, read for a single
// event, so the event page and the dashboards always tell the same story.
//
//   Sales          -> this event's own orders (live Labs data)
//   Interest       -> Analytics (Google Analytics mock)
//   Buzz           -> Social (mock)
//   Safety         -> ScamSwarm and Security (mock)
//   Getting ready  -> Tasks and Reviews (live Labs data)

import { ANALYTICS_PAGES, selectAnalyticsDashboard } from '../analyticsDashboard/mockAnalytics';
import { POSTS } from '../socialDashboard/mockData';
import { buildSeedFindings, plainKind } from '../scamswarm/scamSwarmData';
import { buildSuspectedAttacks } from '../security/securityReport';
import { generateEventSlug } from '../../lib/utils';

const count = (value) => new Intl.NumberFormat('en-CA').format(Math.round(value || 0));
const plural = (n, one, many = `${one}s`) => `${count(n)} ${n === 1 ? one : many}`;
// "163% more" reads like a spreadsheet; past double, say so in words.
export const changeWords = (change) => {
    if (change == null) return '';
    const size = Math.abs(Math.round(change * 100));
    if (size < 3) return 'about the same as the month before';
    if (change >= 1) return 'more than double the month before';
    return `${size}% ${change >= 0 ? 'more' : 'fewer'} than the month before`;
};
const words = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);

/** Loose name match so "Fog City Sessions" posts count for "Fog City Strobe". */
export const sameEvent = (left, right) => {
    const a = words(left);
    const b = words(right);
    if (!a.length || !b.length) return false;
    if (a.join(' ') === b.join(' ')) return true;
    return a.length >= 2 && b.length >= 2 && a[0] === b[0] && a[1] === b[1];
};

const SOURCE_NAMES = {
    'organic-social': 'your own social posts',
    'paid-social': 'your social ads',
    'organic-search': 'Google searches',
    email: 'your emails',
    direct: 'people coming straight to the page',
    referral: 'links on other sites',
};
export const plainSource = (channel) => SOURCE_NAMES[channel?.id] || channel?.label || 'other places';

const salesSign = ({ event, pulse }) => {
    const to = `/events/${generateEventSlug(event.name, event.id)}/orders`;
    const base = { id: 'sales', label: 'Sales', to, source: 'Orders' };
    if (pulse.phase === 'presale') return { ...base, state: 'quiet', headline: 'Not on sale yet', detail: pulse.daysToOnSale ? `Tickets go on sale in ${plural(pulse.daysToOnSale, 'day')}` : 'No tickets sold yet' };
    if (pulse.soldOut) return { ...base, state: 'good', headline: 'Sold out', detail: `All ${count(pulse.capacity)} tickets are gone` };
    if (pulse.phase === 'past') return { ...base, state: 'good', headline: pulse.soldPct != null ? `${Math.round(pulse.soldPct * 100)}% sold` : `${count(pulse.sold)} sold`, detail: pulse.capacity ? `${count(pulse.sold)} of ${count(pulse.capacity)} tickets` : 'Final count' };
    if (pulse.phase === 'live') return { ...base, state: 'good', headline: `${count(pulse.sold)} sold`, detail: pulse.left ? `${plural(pulse.left, 'ticket')} left for walk-ups` : 'Nothing left at the door' };
    const week = `${plural(pulse.last7, 'ticket')} in the last 7 days`;
    const versus = pulse.prev7 > 0 ? `, ${pulse.last7 >= pulse.prev7 ? 'up' : 'down'} from ${count(pulse.prev7)} the week before` : '';
    if (pulse.pace === 'ahead') return { ...base, state: 'good', headline: 'Ahead of pace', detail: `${week}${versus}` };
    if (pulse.pace === 'behind') return { ...base, state: pulse.verdict === 'attention' ? 'bad' : 'watch', headline: 'Behind pace', detail: `${week}${versus}` };
    return { ...base, state: 'good', headline: pulse.pace === 'on' ? 'On pace' : 'Selling', detail: `${week}${versus}` };
};

export const readInterest = (event) => {
    const page = ANALYTICS_PAGES.find((item) => item.id !== 'all' && sameEvent(item.name, event.name));
    if (!page) return null;
    const dashboard = selectAnalyticsDashboard({ pageId: page.id, range: '28' });
    if (!dashboard || dashboard.empty || !dashboard.kpis) return null;
    const { current, prior } = dashboard.kpis.visitors;
    const change = prior > 0 ? (current - prior) / prior : null;
    const trend = change == null ? 'steady' : change >= 0.08 ? 'building' : change <= -0.08 ? 'fading' : 'steady';
    const topSource = [...(dashboard.channels || [])].sort((a, b) => b.visitors - a.visitors)[0] || null;
    const bestBuyers = [...(dashboard.channels || [])].sort((a, b) => b.purchases - a.purchases)[0] || null;
    return { pageId: page.id, people: current, prior, change, trend, liveNow: dashboard.liveNow?.people || 0, topSource, bestBuyers, purchases: dashboard.kpis.purchases.current };
};

const interestSign = ({ interest }) => {
    const base = { id: 'interest', label: 'Interest', source: 'Analytics', to: interest ? `/analytics?page=${interest.pageId}` : '/analytics' };
    if (!interest) return { ...base, state: 'quiet', headline: 'No data yet', detail: 'Nobody has visited the event page yet' };
    const looked = `${count(interest.people)} people looked in the last 28 days`;
    const pct = interest.change == null ? '' : `, ${changeWords(interest.change)}`;
    if (interest.trend === 'building') return { ...base, state: 'good', headline: 'Building', detail: `${looked}${pct}` };
    if (interest.trend === 'fading') return { ...base, state: 'watch', headline: 'Fading', detail: `${looked}${pct}` };
    return { ...base, state: 'good', headline: 'Steady', detail: looked };
};

export const readBuzz = (event) => {
    const posts = POSTS.filter((post) => sameEvent(post.campaign, event.name));
    if (!posts.length) return null;
    const classified = posts.reduce((sum, post) => sum + (post.classifiedComments || 0), 0);
    const positive = posts.reduce((sum, post) => sum + (post.positiveComments || 0), 0);
    const negative = posts.reduce((sum, post) => sum + (post.negativeComments || 0) + (post.mixedComments || 0), 0);
    const waiting = posts.reduce((sum, post) => sum + (post.comments || []).filter((comment) => comment.isQuestion && !comment.teamReplied).length, 0);
    const reach = (post) => (post.reach?.state === 'ok' ? post.reach.value : 0) || 0;
    const best = [...posts].sort((a, b) => reach(b) - reach(a))[0];
    let mood = 'mixed';
    if (classified >= 8) mood = positive / classified >= 0.55 ? 'positive' : negative / classified >= 0.3 ? 'negative' : 'mixed';
    return { posts: posts.length, mood, waiting, best, bestReach: reach(best) };
};

const buzzSign = ({ buzz }) => {
    const base = { id: 'buzz', label: 'Buzz', source: 'Social', to: '/social' };
    if (!buzz) return { ...base, state: 'quiet', headline: 'Quiet', detail: 'No posts about this event lately' };
    const headline = buzz.mood === 'positive' ? 'Mostly positive' : buzz.mood === 'negative' ? 'Mostly negative' : 'Mixed';
    const state = buzz.mood === 'negative' || buzz.waiting >= 3 ? 'watch' : buzz.mood === 'positive' ? 'good' : 'quiet';
    const detail = buzz.waiting
        ? `${plural(buzz.waiting, 'fan question')} waiting for a reply`
        : buzz.bestReach ? `Your best post reached ${count(buzz.bestReach)} people` : `${plural(buzz.posts, 'post')} about this event`;
    return { ...base, state, headline, detail };
};

export const readSafety = (event, now = Date.now()) => {
    const findings = buildSeedFindings().filter((finding) => sameEvent(finding.event, event.name) && finding.status !== 'resolved');
    const scams = findings.filter((finding) => finding.verdict === 'scam');
    const attention = findings.filter((finding) => finding.verdict === 'attention');
    const attacks = buildSuspectedAttacks(now).items.filter((attack) => String(attack.target || '').toLowerCase().includes(String(event.name || '').toLowerCase()));
    return { scams, attention, attacks };
};

const safetySign = ({ safety }) => {
    const base = { id: 'safety', label: 'Safety' };
    const risky = safety.scams.length + safety.attention.length;
    if (risky) {
        const first = safety.scams[0] || safety.attention[0];
        return {
            ...base,
            source: 'ScamSwarm',
            to: `/scamswarm?event=${encodeURIComponent(first.event)}`,
            state: safety.scams.length ? 'bad' : 'watch',
            headline: safety.scams.length ? plural(safety.scams.length, 'likely scam') : `${plural(risky, 'thing')} to check`,
            detail: `${plainKind(first)} on ${first.platformLabel}${risky > 1 ? ` and ${count(risky - 1)} more to check` : ''}`,
        };
    }
    if (safety.attacks.length) {
        const attack = safety.attacks[0];
        return { ...base, source: 'Security', to: '/security', state: 'good', headline: 'Protected', detail: `${attack.kind} stopped at your ticket page` };
    }
    return { ...base, source: 'Security', to: '/security', state: 'good', headline: 'All clear', detail: 'No fakes or attacks found' };
};

const turnoutSign = ({ event, pulse }) => {
    const base = { id: 'turnout', label: 'Turnout', source: 'Attendees', to: `/events/${generateEventSlug(event.name, event.id)}/attendees` };
    if (pulse.turnout == null || !pulse.used) return { ...base, state: 'quiet', headline: 'No door scans', detail: 'Nobody was checked in with a scanner' };
    return { ...base, state: pulse.turnout >= 0.8 ? 'good' : 'watch', headline: `${Math.round(pulse.turnout * 100)}% turned up`, detail: `${count(pulse.used)} of ${count(pulse.sold)} ticket holders came` };
};

const WAITING_REVIEW = new Set(['PENDING_REVIEW', 'PENDING', 'UPDATED', 'IN_REVIEW']);

export const readReadiness = ({ event, tasks, approvals, now = Date.now() }) => {
    const mine = (item) => !item?.eventId || item.eventId === event.id || item.event?.id === event.id;
    const open = (Array.isArray(tasks) ? tasks : []).filter((task) => mine(task) && String(task.status || '').toUpperCase() !== 'DONE');
    const overdue = open.filter((task) => task.dueDate && new Date(task.dueDate).getTime() < now);
    const waiting = (Array.isArray(approvals) ? approvals : []).filter((approval) => (approval.eventId === event.id || approval.event?.id === event.id) && WAITING_REVIEW.has(String(approval.status || '').toUpperCase()));
    return { open, overdue, waiting };
};

const readySign = ({ event, ready }) => {
    const base = { id: 'ready', label: 'Getting ready', source: 'Tasks', to: `/todo?event=${encodeURIComponent(event.id)}` };
    if (ready.overdue.length) return { ...base, state: 'watch', headline: `${plural(ready.overdue.length, 'task')} overdue`, detail: ready.overdue[0].title || `${plural(ready.open.length, 'task')} still open` };
    if (ready.waiting.length) return { ...base, source: 'Reviews', to: '/approvals', state: 'watch', headline: `${plural(ready.waiting.length, 'creative')} waiting`, detail: ready.waiting[0].title || 'Waiting on a reviewer' };
    if (ready.open.length) return { ...base, state: 'good', headline: 'On schedule', detail: `${plural(ready.open.length, 'task')} still open, none overdue` };
    return { ...base, state: 'good', headline: 'Nothing outstanding', detail: 'No open tasks for this event' };
};

/**
 * @returns {{ signs: Array, interest: object|null, buzz: object|null, safety: object, ready: object }}
 */
export const buildVitalSigns = ({ event, pulse, tasks, approvals, now = Date.now() }) => {
    const interest = readInterest(event);
    const buzz = readBuzz(event);
    const safety = readSafety(event, now);
    const ready = readReadiness({ event, tasks, approvals, now });
    // Once the show is over the questions change: how full was it, who turned up, what did people say.
    const signs = pulse.phase === 'past'
        ? [salesSign({ event, pulse }), turnoutSign({ event, pulse }), buzzSign({ buzz })]
        : [
            salesSign({ event, pulse }),
            interestSign({ interest }),
            buzzSign({ buzz }),
            safetySign({ safety }),
            readySign({ event, ready }),
        ];
    return { signs, interest, buzz, safety, ready };
};
