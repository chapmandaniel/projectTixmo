// Labs demo: how the Security page tells its parts apart at a glance.
//
// Each part of the business (event pages, team sign-in, checkout, doors) keeps
// one icon and one colour everywhere on the page: in the top tiles, the
// platform cards, the protection list, the attack list and the activity feed.
// Colour answers "which part is this about?". Green, amber and red are never
// used here, because on this page they only ever mean healthy, worth a look,
// or a problem.
import { Archive, Bot, Code2, CreditCard, Globe, KeyRound, ScanLine, Waves } from 'lucide-react';

const tones = (dark, light) => ({ dark, light });

export const AREAS = {
    website: {
        id: 'website',
        label: 'Event pages',
        icon: Globe,
        tone: tones(
            { badge: 'bg-blue-400/15 text-blue-300', text: 'text-blue-300', fill: 'bg-blue-400', fillSoft: 'bg-blue-400/30', stroke: 'stroke-blue-400', track: 'stroke-blue-400/15' },
            { badge: 'bg-blue-50 text-blue-700', text: 'text-blue-700', fill: 'bg-blue-500', fillSoft: 'bg-blue-500/25', stroke: 'stroke-blue-500', track: 'stroke-blue-500/15' },
        ),
    },
    account: {
        id: 'account',
        label: 'Team sign-in',
        icon: KeyRound,
        tone: tones(
            { badge: 'bg-violet-400/15 text-violet-300', text: 'text-violet-300', fill: 'bg-violet-400', fillSoft: 'bg-violet-400/30', stroke: 'stroke-violet-400', track: 'stroke-violet-400/15' },
            { badge: 'bg-violet-50 text-violet-700', text: 'text-violet-700', fill: 'bg-violet-500', fillSoft: 'bg-violet-500/25', stroke: 'stroke-violet-500', track: 'stroke-violet-500/15' },
        ),
    },
    checkout: {
        id: 'checkout',
        label: 'Checkout',
        icon: CreditCard,
        tone: tones(
            { badge: 'bg-pink-400/15 text-pink-300', text: 'text-pink-300', fill: 'bg-pink-400', fillSoft: 'bg-pink-400/30', stroke: 'stroke-pink-400', track: 'stroke-pink-400/15' },
            { badge: 'bg-pink-50 text-pink-700', text: 'text-pink-700', fill: 'bg-pink-500', fillSoft: 'bg-pink-500/25', stroke: 'stroke-pink-500', track: 'stroke-pink-500/15' },
        ),
    },
    doors: {
        id: 'doors',
        label: 'Doors',
        icon: ScanLine,
        tone: tones(
            { badge: 'bg-cyan-400/15 text-cyan-300', text: 'text-cyan-300', fill: 'bg-cyan-400', fillSoft: 'bg-cyan-400/30', stroke: 'stroke-cyan-400', track: 'stroke-cyan-400/15' },
            { badge: 'bg-cyan-50 text-cyan-700', text: 'text-cyan-700', fill: 'bg-cyan-500', fillSoft: 'bg-cyan-500/25', stroke: 'stroke-cyan-500', track: 'stroke-cyan-500/15' },
        ),
    },
    // Things that belong to no single part (backups) stay neutral.
    data: {
        id: 'data',
        label: 'Your data',
        icon: Archive,
        tone: tones(
            { badge: 'bg-white/5 text-zinc-300', text: 'text-zinc-300', fill: 'bg-zinc-400', fillSoft: 'bg-zinc-400/30', stroke: 'stroke-zinc-400', track: 'stroke-zinc-400/15' },
            { badge: 'bg-slate-100 text-slate-600', text: 'text-slate-600', fill: 'bg-slate-500', fillSoft: 'bg-slate-500/25', stroke: 'stroke-slate-500', track: 'stroke-slate-500/15' },
        ),
    },
};

export const AREA_ORDER = ['website', 'account', 'checkout', 'doors'];

export const areaOf = (id) => AREAS[id] || AREAS.data;
export const areaTone = (id, isDark) => areaOf(id).tone[isDark ? 'dark' : 'light'];

// Protection layers: which part each one looks after, and what it does in
// plain words. The technical name stays on the page as the small second line.
export const LAYER_INFO = {
    waf: { area: 'website', plain: 'Blocks break-in attempts on your pages' },
    ddos: { area: 'website', plain: 'Keeps pages up through traffic floods' },
    bots: { area: 'website', plain: 'Keeps bots and scalpers out' },
    tls: { area: 'website', plain: 'Keeps every connection private' },
    rate: { area: 'account', plain: 'Slows repeated tries at sign-in and checkout' },
    login: { area: 'account', plain: 'Guards your team sign-in' },
    breach: { area: 'account', plain: 'Watches for leaked passwords' },
    fraud: { area: 'checkout', plain: 'Screens every payment' },
    backups: { area: 'data', plain: 'Keeps a safe copy of your data' },
};

export const LAYER_GROUP_ORDER = ['website', 'account', 'checkout', 'data'];

export const groupLayers = (layers) => LAYER_GROUP_ORDER
    .map((area) => ({ area, layers: layers.filter((layer) => (LAYER_INFO[layer.id]?.area || 'data') === area) }))
    .filter((group) => group.layers.length > 0);

// Suspected attacks: the part they were aimed at, an icon for the kind, and
// what happened in plain words. The technical kind stays as the second line.
const ATTACK_INFO = {
    'Credential stuffing': { area: 'account', icon: KeyRound, plain: 'Someone tried stolen passwords on your team sign-in' },
    'Scalper bot burst': { area: 'website', icon: Bot, plain: 'Bots tried to grab tickets' },
    'Card-testing': { area: 'checkout', icon: CreditCard, plain: 'Stolen cards were tried at checkout' },
    'Request flood': { area: 'website', icon: Waves, plain: 'A flood of fake traffic hit your pages' },
    'SQL or script injection probe': { area: 'website', icon: Code2, plain: 'Someone poked at your pages looking for a way in' },
};

export const attackInfo = (kind) => ATTACK_INFO[kind] || { area: 'data', icon: AREAS.data.icon, plain: kind };
