/* eslint-disable no-console */
/**
 * Labs presentation demo seed (T123, expanded in T124 so every section looks in daily use). FAKE data only: fictional org "Northlight Live", fictional people
 * (example.com / example.org emails), test-only orders (no Stripe, no real money).
 *
 * Re-runnable and idempotent: every run first deletes ONLY its own rows (the org with slug
 * DEMO_SLUG and users whose email ends with a demo suffix), then recreates them with dates relative to now.
 * The demo OWNER keeps its user id across runs (upsert) so open sessions survive a reseed.
 *
 * Refuses to run unless it is inside the Railway `labs` environment with the labs Postgres host,
 * or (for local development only) LABS_DEMO_LOCAL=1 with a localhost DATABASE_URL.
 *
 * Inputs (env): DEMO_OWNER_EMAIL, DEMO_OWNER_HASH (bcrypt cost 12, hashed off-box; plaintext never sent),
 *   DEMO_LOCKED_HASH (bcrypt of a random throwaway value, so the other fake people cannot sign in).
 * Run: see docs/labs-demo-seed.md
 */
const crypto = require('crypto');
const { PrismaClient, Prisma } = require('@prisma/client');

const LABS_ENV_ID = '810da028-c2b7-4874-a0d4-e95242dc2cb1';
const LABS_DB_HOST = 'labs-postgres.railway.internal';
const DEMO_SLUG = 'northlight-live-demo';
const TEAM_DOMAIN = '@northlight.example.com';
const FAN_SUFFIX = '+nldemo@example.org';
const ASSET_BASE = process.env.DEMO_ASSET_BASE || 'https://labs.tixmo.co/demo-assets';

function refuse(msg) { console.error(`REFUSED: ${msg}`); process.exit(3); }
function guard() {
  let host = '';
  try { host = new URL(process.env.DATABASE_URL || '').hostname; } catch { /* empty */ }
  if (process.env.LABS_DEMO_LOCAL === '1') {
    if (!['localhost', '127.0.0.1'].includes(host)) refuse(`local mode needs a localhost DATABASE_URL, got [${host}]`);
    if (process.env.RAILWAY_ENVIRONMENT_ID) refuse('local mode is not allowed inside Railway');
    return 'local';
  }
  if (process.env.RAILWAY_ENVIRONMENT_ID !== LABS_ENV_ID) refuse('RAILWAY_ENVIRONMENT_ID is not labs');
  if (String(process.env.RAILWAY_ENVIRONMENT_NAME || '').toLowerCase() !== 'labs') refuse('RAILWAY_ENVIRONMENT_NAME is not labs');
  if (host !== LABS_DB_HOST) refuse(`DATABASE_URL host [${host}] is not ${LABS_DB_HOST}`);
  return 'labs';
}

// Deterministic PRNGs so every reseed has the same shape (per-event streams below).
let seed = 20261115;
function rnd() { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const pick = (a) => a[Math.floor(rnd() * a.length)];
const DAY = 86400000;
const now = new Date();
function at(daysFromNow, hour = 19, minute = 0) { const d = new Date(now.getTime() + daysFromNow * DAY); d.setUTCHours(hour + 3, minute + 30, 0, 0); return d; } // hour in NST (UTC-3:30)
const money = (v) => new Prisma.Decimal(v.toFixed(2));
const uuid = () => crypto.randomUUID();

const prisma = new PrismaClient({ log: [] });

async function reset() {
  const org = await prisma.organization.findUnique({ where: { slug: DEMO_SLUG }, select: { id: true } });
  const demoUsers = await prisma.user.findMany({ where: { OR: [{ email: { endsWith: TEAM_DOMAIN } }, { email: { endsWith: FAN_SUFFIX } }] }, select: { id: true, email: true } });
  const ownerEmail = String(process.env.DEMO_OWNER_EMAIL || '').toLowerCase();
  const userIds = demoUsers.map((u) => u.id);
  const deletableUserIds = demoUsers.filter((u) => u.email !== ownerEmail).map((u) => u.id);
  const orgId = org?.id || '00000000-0000-0000-0000-000000000000';
  const eventIds = (await prisma.event.findMany({ where: { organizationId: orgId }, select: { id: true } })).map((e) => e.id);
  const orderIds = (await prisma.order.findMany({ where: { OR: [{ eventId: { in: eventIds } }, { userId: { in: userIds } }] }, select: { id: true } })).map((o) => o.id);
  const approvalIds = (await prisma.approvalRequest.findMany({ where: { organizationId: orgId }, select: { id: true } })).map((a) => a.id);
  const counts = {};
  await prisma.$transaction(async (tx) => {
    const del = async (name, p) => { counts[name] = (await p).count; };
    await del('scanLogs', tx.scanLog.deleteMany({ where: { OR: [{ eventId: { in: eventIds } }, { scanner: { organizationId: orgId } }] } }));
    await del('scanners', tx.scanner.deleteMany({ where: { organizationId: orgId } }));
    await del('shareFolders', tx.assetLibraryFolderShareFolder.deleteMany({ where: { share: { organizationId: orgId } } }));
    await del('shares', tx.assetLibraryFolderShare.deleteMany({ where: { organizationId: orgId } }));
    await del('assets', tx.assetLibraryAsset.deleteMany({ where: { organizationId: orgId } }));
    await tx.assetLibraryFolder.updateMany({ where: { organizationId: orgId }, data: { parentId: null } });
    await del('folders', tx.assetLibraryFolder.deleteMany({ where: { organizationId: orgId } }));
    await del('approvalComments', tx.approvalComment.deleteMany({ where: { approvalRequestId: { in: approvalIds } } }));
    await tx.approvalReviewDecision.deleteMany({ where: { approvalRequestId: { in: approvalIds } } });
    await tx.approvalReminder.deleteMany({ where: { approvalRevision: { approvalRequestId: { in: approvalIds } } } });
    await tx.approvalAsset.deleteMany({ where: { approvalRevision: { approvalRequestId: { in: approvalIds } } } });
    await tx.approvalReviewer.deleteMany({ where: { approvalRequestId: { in: approvalIds } } });
    await tx.approvalRevision.deleteMany({ where: { approvalRequestId: { in: approvalIds } } });
    await del('approvals', tx.approvalRequest.deleteMany({ where: { organizationId: orgId } }));
    await tx.taskComment.deleteMany({ where: { task: { organizationId: orgId } } });
    await del('tasks', tx.task.deleteMany({ where: { organizationId: orgId } }));
    await del('notifications', tx.notification.deleteMany({ where: { userId: { in: userIds } } }));
    await tx.notificationPreference.deleteMany({ where: { userId: { in: deletableUserIds } } });
    await tx.waitlist.deleteMany({ where: { OR: [{ eventId: { in: eventIds } }, { userId: { in: userIds } }] } });
    await del('tickets', tx.ticket.deleteMany({ where: { OR: [{ eventId: { in: eventIds } }, { orderId: { in: orderIds } }] } }));
    await tx.paymentAttempt.deleteMany({ where: { orderId: { in: orderIds } } });
    await tx.orderIdempotencyKey.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { userId: { in: userIds } }] } });
    await del('orders', tx.order.deleteMany({ where: { id: { in: orderIds } } }));
    await tx.ticketTier.deleteMany({ where: { ticketType: { eventId: { in: eventIds } } } });
    await tx.ticketType.deleteMany({ where: { eventId: { in: eventIds } } });
    await tx.promoCode.deleteMany({ where: { organizationId: orgId } });
    await tx.eventSalesControl.deleteMany({ where: { eventId: { in: eventIds } } });
    await tx.staffActionAudit.deleteMany({ where: { organizationId: orgId } });
    await del('events', tx.event.deleteMany({ where: { id: { in: eventIds } } }));
    await tx.venue.deleteMany({ where: { organizationId: orgId } });
    await tx.staffInvitation.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { issuerId: { in: deletableUserIds } }] } });
    await del('users', tx.user.deleteMany({ where: { id: { in: deletableUserIds } } }));
    // The org row itself is kept (upserted below) so its id, and the owner's session, survive a reseed.
  }, { maxWait: 30000, timeout: 120000 });
  return counts;
}

// ---------------------------------------------------------------------------------------------
// T124: a promoter account in daily use. 22 staff, 19 events, ~6.5k test orders, door scans,
// a full task board, review rounds, an asset library, devices and a recent notification feed.
// ---------------------------------------------------------------------------------------------
const HOUR = 3600000;
const MIN = 60000;
const ago = (ms) => new Date(now.getTime() - ms);
const hash = (str) => { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function mkRng(key) { let s = hash(key); return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// Start of "today" in St. John's (UTC-3:30, no DST handling needed for a demo in Nov-Mar).
const todayStart = (() => { const d = new Date(now.getTime() - 3.5 * HOUR); d.setUTCHours(0, 0, 0, 0); return new Date(d.getTime() + 3.5 * HOUR); })();

// [first, last, role, title, lastActive (minutes ago) or 'pending']
const TEAM = [
  ['Priya', 'Raman', 'ADMIN', 'Director of Finance & Operations', 38],
  ['Tomas', 'Reyes', 'ADMIN', 'General Manager', 95],
  ['Jordan', 'Okafor', 'MANAGER', 'Marketing Lead', 12],
  ['Sofia', 'Marchetti', 'MANAGER', 'Production Manager', 64],
  ['Grace', 'Whelan', 'MANAGER', 'Venue Operations Manager', 260],
  ['Nathan', 'Pike', 'MANAGER', 'Box Office Manager', 22],
  ['Liam', 'Byrne', 'TEAM_MEMBER', 'Box Office Coordinator', 7],
  ['Hana', 'Sato', 'TEAM_MEMBER', 'Social & Content Producer', 4],
  ['Marcus', 'Bell', 'TEAM_MEMBER', 'Ticketing Operations', 140],
  ['Imogen', 'Hart', 'TEAM_MEMBER', 'Graphic Designer', 55],
  ['Kwame', 'Mensah', 'TEAM_MEMBER', 'Artist Liaison', 1500],
  ['Lucia', 'Ferreira', 'TEAM_MEMBER', 'Marketing Coordinator', 31],
  ['Owen', 'Murphy', 'TEAM_MEMBER', 'Box Office Associate', 75],
  ['Rachel', 'Tobin', 'TEAM_MEMBER', 'Hospitality & VIP Lead', 2900],
  ['Chloe', 'Dubois', 'TEAM_MEMBER', 'Partnerships Associate', 'pending'],
  ['Ethan', 'Clarke', 'TEAM_MEMBER', 'Sponsorship Manager', 'pending'],
  ['Dev', 'Kapoor', 'SCANNER', 'Door & Access Lead', 9],
  ['Fiona', 'Walsh', 'SCANNER', 'Door Supervisor', 18],
  ['Sean', 'Power', 'SCANNER', 'Door Staff', 46],
  ['Maya', 'Kowalski', 'SCANNER', 'Door Staff', 5800],
  ['Ben', 'Abbott', 'SCANNER', 'Door Staff', 'pending'],
];
const FIRST = ['Maya', 'Eli', 'Nia', 'Omar', 'Jules', 'Sam', 'Alex', 'Ren', 'Taylor', 'Casey', 'Morgan', 'Riley', 'Aisha', 'Ben', 'Clara', 'Diego', 'Erin', 'Felix', 'Grace', 'Hugo', 'Ines', 'Jamal', 'Kira', 'Leo', 'Mina', 'Noah', 'Olive', 'Pablo', 'Quinn', 'Rosa', 'Seth', 'Tara', 'Uma', 'Victor', 'Wren', 'Yara', 'Zane', 'Ada', 'Brody', 'Celine', 'Darius', 'Elena', 'Finn', 'Gemma', 'Hassan', 'Isla', 'Jonah', 'Keira', 'Luca', 'Mei'];
const LAST = ['Lopez', 'Grant', 'Brooks', 'Kim', 'Carter', 'Nguyen', 'Patel', 'Morgan', 'West', 'Lane', 'Drew', 'Cole', 'Walsh', 'Power', 'Murphy', 'Ryan', 'Hayes', 'Fitzgerald', 'Abbott', 'Tremblay', 'Gagnon', 'Roy', 'Singh', 'Chen', 'Haddad', 'Silva', 'Novak', 'Kowalski', 'Osei', 'Andersen', 'Dunne', 'Barry', 'Kelly', 'Pardy', 'Hiscock', 'Noseworthy', 'Squires', 'Tucker', 'Butt', 'Sheppard'];
const CUSTOMERS = 1400;

const VENUES = {
  commons: ['Harbourfront Commons', '1 Harbour Drive', 4200],
  lantern: ['The Lantern Room', '214 Water Street', 1200],
  foundry: ['Foundry Hall', '88 Duckworth Street', 1800],
  chapel: ['Chapel Street Studio', '12 Chapel Street', 360],
  battery: ['The Battery Club', '40 Battery Road', 450],
  signal: ['Signal Hill Amphitheatre', '230 Signal Hill Road', 2500],
  gower: ['Gower Street Theatre', '61 Gower Street', 650],
};

// ga: paid orders per days-ago band, matching the Analytics (GA4 mock) purchases for that page:
// c7 = last 7 days, c28/c90 = last 28/90 days, p7/p28/p90 = the 90-day period before that.
const EVENTS = [
  { key: 'harbour', name: 'Harbour Lights Festival', venue: 'commons', start: 26, hour: 17, hours: 7, status: 'ON_SALE', category: 'Festival', salesOpen: -178, tags: ['festival', 'outdoor', 'all-ages'],
    desc: 'Two stages on the waterfront: twelve acts, local food trucks and a lantern walk at sunset. Headliners Lantern Static and The Grey Sounds, with Mara Vale and the North Shore Youth Choir.',
    types: [['Early Bird GA', 59, 600, 'sold'], ['General Admission', 69, 2200], ['VIP Deck', 189, 260, 'tiers'], ['Weekend Pass', 159, 500]],
    ga: { c7: 164, c28: 540, c90: 730, p7: 122, p28: 380, p90: 490 } },
  { key: 'aurora', name: 'Aurora After Dark', venue: 'lantern', start: 12, hour: 21, hours: 5, status: 'ON_SALE', category: 'Concert', salesOpen: -176, tags: ['electronic', 'late-night', '19+'],
    desc: 'A late-night electronic showcase with a full light installation by the Northlight visuals crew. Three DJs, one room, lights until 2 AM.',
    types: [['General Admission', 35, 900], ['Balcony', 55, 180], ['Table for Four', 220, 12]],
    ga: { c7: 28, c28: 118, c90: 248, p7: 24, p28: 92, p90: 196 } },
  { key: 'fog', name: 'Fog City Strobe', venue: 'foundry', start: 40, hour: 20, hours: 4, status: 'ON_SALE', category: 'Concert', salesOpen: -172, tags: ['indie', 'dance'],
    desc: 'Indie-dance double bill with a support set from Lantern Static. Standing floor, mezzanine bar.',
    types: [['General Admission', 45, 1500], ['VIP Mezzanine', 95, 180]],
    ga: { c7: 12, c28: 40, c90: 74, p7: 16, p28: 52, p90: 88 } },
  { key: 'quiet', name: 'Quiet Harbour Acoustic', venue: 'chapel', start: -9, hour: 19, hours: 3, status: 'COMPLETED', category: 'Concert', salesOpen: -85, tags: ['acoustic', 'seated'],
    desc: 'An intimate seated evening of songwriters in the round.',
    types: [['Seated', 42, 300], ['Front Row', 65, 40]],
    ga: { c7: 0, c28: 46, c90: 128, p7: 0, p28: 0, p90: 0 } },
  { key: 'static', name: 'Northern Static Live', venue: 'foundry', start: -31, hour: 20, hours: 4, status: 'COMPLETED', category: 'Concert', salesOpen: -110, tags: ['rock', 'all-ages'],
    desc: 'Sold-out homecoming show for Northern Static, with The Battery Boys opening.',
    types: [['General Admission', 39, 1600], ['VIP Mezzanine', 85, 180]], orders: 760 },
  { key: 'kitchen', name: 'Kitchen Party Social', venue: 'battery', live: true, hours: 4, status: 'ON_SALE', category: 'Concert', salesOpen: -30, tags: ['trad', 'folk', 'tonight'],
    desc: 'Fiddles, accordions and a room full of sing-alongs. Doors are open now; walk-up tickets at the box office.',
    types: [['General Admission', 25, 380], ['Kitchen Table', 40, 60]], orders: 175 },
  { key: 'comedy', name: 'Late Show Comedy Club', venue: 'gower', start: 3, hour: 21, hours: 2, status: 'SOLD_OUT', category: 'Comedy', salesOpen: -45, tags: ['comedy', '19+'],
    desc: 'Five comics, one mic. The monthly late show is sold out; join the waitlist for returns.',
    types: [['General Admission', 32, 560], ['Front Tables', 48, 90]], sellOut: true },
  { key: 'saltwater', name: 'Saltwater Sessions: Mara Vale', venue: 'chapel', start: 6, hour: 20, hours: 3, status: 'ON_SALE', category: 'Concert', salesOpen: -38, tags: ['singer-songwriter', 'seated'],
    desc: 'Mara Vale plays the new record front to back in the studio, with a short Q&A after the set.',
    types: [['Seated', 38, 300], ['Meet & Greet', 85, 20]], orders: 105 },
  { key: 'jazz', name: 'Iceberg Alley Jazz Brunch', venue: 'battery', start: 19, hour: 11, hours: 3, status: 'ON_SALE', category: 'Food & Music', salesOpen: -25, tags: ['jazz', 'brunch', 'all-ages'],
    desc: 'The Sunday trio plays standards while the kitchen serves brunch from 11 to 2.',
    types: [['Brunch Seating', 55, 160], ['Bar Standing', 30, 120]], orders: 70 },
  { key: 'nye', name: "New Year's Eve at Harbourfront", venue: 'commons', start: 46, hour: 21, hours: 5, status: 'ON_SALE', category: 'Special Event', salesOpen: -60, tags: ['nye', 'party', '19+'],
    desc: 'Three rooms, a midnight countdown on the harbour and fireworks over the Narrows.',
    types: [['Early Bird', 59, 400, 'sold'], ['General Admission', 79, 2600], ['VIP Lounge', 199, 300]], orders: 520 },
  { key: 'blues', name: 'Battery Road Blues Night', venue: 'battery', start: 33, hour: 20, hours: 4, status: 'ON_SALE', category: 'Concert', salesOpen: -14, tags: ['blues', '19+'],
    desc: 'The house band and two guest players. Doors at 8.',
    types: [['General Admission', 28, 400]], orders: 48 },
  { key: 'signalsunset', name: 'Signal Hill Sunset Sessions', venue: 'signal', start: -62, hour: 18, hours: 4, status: 'COMPLETED', category: 'Festival', salesOpen: -140, tags: ['outdoor', 'all-ages'],
    desc: 'Open-air golden-hour concert on the hill. Bring a blanket.',
    types: [['Lawn', 35, 2000], ['Reserved Seating', 60, 300]], orders: 900 },
  { key: 'masquerade', name: 'Halloween Masquerade', venue: 'foundry', start: -16, hour: 21, hours: 5, status: 'COMPLETED', category: 'Special Event', salesOpen: -70, tags: ['halloween', '19+'],
    desc: 'Masks required. Costume contest at midnight with a $500 prize.',
    types: [['General Admission', 40, 1500], ['VIP Balcony', 85, 200]], orders: 640 },
  { key: 'indie', name: 'Duckworth Indie Weekender', venue: 'foundry', start: -88, hour: 18, hours: 30, status: 'COMPLETED', category: 'Festival', salesOpen: -170, tags: ['festival', 'indie'],
    desc: 'Two nights, ten bands, one street. The weekender that started Northlight.',
    types: [['Weekend Pass', 89, 900], ['Friday Only', 49, 400], ['Saturday Only', 55, 400]], orders: 780 },
  { key: 'choir', name: 'Ember Choir: Winter Songs', venue: 'gower', start: -3, hour: 19, hours: 2, status: 'COMPLETED', category: 'Concert', salesOpen: -50, tags: ['choral', 'seated', 'all-ages'],
    desc: 'A candlelit evening of choral music for the start of winter.',
    types: [['Orchestra', 45, 450], ['Balcony', 32, 150]], orders: 240 },
  { key: 'gala', name: 'Winter Lanterns Gala', venue: 'commons', start: 75, hour: 18, hours: 5, status: 'PUBLISHED', category: 'Special Event', salesOpen: 10, tags: ['gala', 'fundraiser'],
    desc: 'Black-tie fundraiser for the Harbourfront Arts Trust. On sale in ten days.',
    types: [['Gala Ticket', 150, 400], ['Patron Table (8)', 1400, 20]] },
  { key: 'filmscore', name: 'Tidewater Film Score Live', venue: 'gower', start: 95, hour: 19, hours: 3, status: 'PUBLISHED', category: 'Concert', salesOpen: 18, tags: ['orchestra', 'film'],
    desc: 'A full orchestra plays the Tidewater score live to picture. Announced; tickets on sale soon.',
    types: [['Orchestra', 65, 450], ['Balcony', 45, 150]] },
  { key: 'spring', name: 'Spring Tide Sessions', venue: 'lantern', start: 128, hour: 20, hours: 4, status: 'DRAFT', category: 'Concert', salesOpen: 30, tags: ['series'],
    desc: 'Monthly emerging-artist series. Lineup in progress.',
    types: [['General Admission', 25, 400]] },
  { key: 'solstice', name: 'Solstice Block Party', venue: 'commons', start: 215, hour: 14, hours: 10, status: 'DRAFT', category: 'Festival', salesOpen: 90, tags: ['outdoor', 'street-food'],
    desc: 'The longest day of the year: street food, three stages and a parade. Budget in review.',
    types: [['Day Pass', 35, 3000], ['VIP Garden', 95, 400]] },
];

async function main() {
  const mode = guard();
  const ownerEmail = String(process.env.DEMO_OWNER_EMAIL || '').trim().toLowerCase();
  const ownerHash = process.env.DEMO_OWNER_HASH || '';
  if (!ownerEmail.endsWith(TEAM_DOMAIN)) refuse(`DEMO_OWNER_EMAIL must end with ${TEAM_DOMAIN}`);
  const lockedHash = process.env.DEMO_LOCKED_HASH || '';
  for (const [n, h] of [['DEMO_OWNER_HASH', ownerHash], ['DEMO_LOCKED_HASH', lockedHash]]) {
    if (!/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(h)) refuse(`${n} must be a bcrypt cost-12 hash`);
  }
  if (lockedHash === ownerHash) refuse('DEMO_LOCKED_HASH must differ from DEMO_OWNER_HASH');
  console.log(`guard ok mode=${mode}`);
  const removed = await reset();
  console.log('reset removed', JSON.stringify(removed));

  const orgData = { name: 'Northlight Live', type: 'PROMOTER', status: 'ACTIVE',
    settings: { demoData: true, currency: 'CAD', timezone: 'America/St_Johns', seededBy: 'tixmoapi2/scripts/seed-labs-demo.cjs' } };
  const org = await prisma.organization.upsert({ where: { slug: DEMO_SLUG }, update: orgData, create: { slug: DEMO_SLUG, ...orgData } });

  // ---- Team ----
  const ownerData = { passwordHash: ownerHash, firstName: 'Avery', lastName: 'Quinlan', title: 'Head of Live Operations', role: 'OWNER', organizationId: org.id,
    emailVerified: true, disabledAt: null, phone: '709-555-0100', lastLogin: ago(2 * MIN), createdAt: at(-420, 9) };
  const existingOwner = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
  const owner = existingOwner
    ? await prisma.user.update({ where: { email: ownerEmail }, data: ownerData })
    : await prisma.user.create({ data: { email: ownerEmail, ...ownerData } });
  const team = { Avery: owner };
  const pendingInvites = [];
  for (const [i, [f, l, role, title, active]] of TEAM.entries()) {
    const pending = active === 'pending';
    team[f] = await prisma.user.create({ data: { email: `${f}.${l}${TEAM_DOMAIN}`.toLowerCase(), passwordHash: lockedHash, firstName: f, lastName: l, title, role, organizationId: org.id,
      emailVerified: !pending, phone: `709-555-01${String(i + 1).padStart(2, '0')}`, lastLogin: pending ? null : ago(active * MIN),
      createdAt: pending ? ago((2 + i % 4) * 24 * HOUR) : at(-400 + i * 15, 10),
      permissions: role === 'TEAM_MEMBER' ? { canManageEvents: true, canManageOrders: true, canViewAnalytics: true } : undefined } });
    if (pending) pendingInvites.push(team[f]);
  }
  for (const [i, u] of pendingInvites.entries()) {
    await prisma.staffInvitation.create({ data: { userId: u.id, issuerId: i % 2 ? team.Tomas.id : owner.id, tokenHash: crypto.createHash('sha256').update(uuid()).digest('hex'),
      sessionVersion: u.sessionVersion, expiresAt: at(5 - i), createdAt: u.createdAt } });
  }
  const staff = Object.values(team).filter((u) => u.emailVerified);

  // ---- Customers (fake fans) ----
  const fans = [];
  const fanRows = [];
  for (let i = 0; i < CUSTOMERS; i += 1) {
    const f = FIRST[i % FIRST.length]; const l = LAST[(i * 7 + Math.floor(i / FIRST.length)) % LAST.length];
    const id = uuid();
    const createdAt = i >= CUSTOMERS - 9 ? ago((i - CUSTOMERS + 10) * 47 * MIN) : at(-200 + Math.floor((i / CUSTOMERS) * 196), 9 + (i % 12));
    fanRows.push({ id, email: `${f}.${l}.${i}${FAN_SUFFIX}`.toLowerCase(), passwordHash: lockedHash, firstName: f, lastName: l, role: 'CUSTOMER', emailVerified: true, createdAt, updatedAt: createdAt });
    fans.push(id);
  }
  for (let i = 0; i < fanRows.length; i += 500) await prisma.user.createMany({ data: fanRows.slice(i, i + 500) });

  // ---- Venues ----
  const venues = {};
  for (const [i, [k, [name, street, capacity]]] of Object.entries(VENUES).entries()) {
    venues[k] = await prisma.venue.create({ data: { organizationId: org.id, name, capacity, timezone: 'America/St_Johns',
      address: { street, city: "St. John's", state: 'NL', zip: `A1C ${i + 1}B${i + 2}`, country: 'Canada' }, metadata: { demoData: true }, createdAt: at(-380 + i * 30, 10) } });
  }

  // ---- Scanners / devices ----
  // [name, venue, assigned event, status, lastUsed (minutes ago)]
  const SCANNERS = [
    ['Battery Club Door 1', 'battery', 'kitchen', 'ACTIVE', 1], ['Battery Club Door 2', 'battery', 'kitchen', 'ACTIVE', 3],
    ['Main Gate A', 'commons', 'harbour', 'ACTIVE', 1450], ['Main Gate B', 'commons', 'harbour', 'ACTIVE', 1460], ['VIP Lane', 'commons', 'harbour', 'ACTIVE', 2900],
    ['Lantern Room Door', 'lantern', 'aurora', 'ACTIVE', 4300], ['Foundry North', 'foundry', 'fog', 'ACTIVE', 23000], ['Foundry South', 'foundry', 'fog', 'ACTIVE', 23100],
    ['Gower Lobby', 'gower', 'comedy', 'ACTIVE', 4400], ['Chapel Street Door', 'chapel', 'saltwater', 'ACTIVE', 12900],
    ['Box Office Tablet 1', null, null, 'ACTIVE', 6], ['Box Office Tablet 2', null, null, 'ACTIVE', 140],
    ['Signal Hill Gate', 'signal', null, 'DISABLED', 89000], ['Old iPad (lost)', null, null, 'REVOKED', 130000],
  ];
  const scannerRows = SCANNERS.map(([name, venue, ek, status, mins], i) => ({ id: uuid(), name, venue, ek, deviceId: `nld-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    apiKey: `sk_demo_${crypto.randomBytes(18).toString('hex')}`, organizationId: org.id, createdBy: (i % 3 ? team.Dev : team.Fiona).id, status, lastUsedAt: ago(mins * MIN), createdAt: at(-300 + i * 12, 11) }));
  // Devices exist before any scan log; their event assignment is set once the events exist.
  await prisma.scanner.createMany({ data: scannerRows.map(({ venue, ek, ...s }) => s) });

  // ---- Events, ticket types, orders, tickets, scans ----
  const totals = { events: 0, ticketTypes: 0, orders: 0, tickets: 0, scans: 0, ordersToday: 0, scansToday: 0 };
  const eventsByKey = {};
  const ga = {};
  let orderNo = 1000;
  const fanRnd = mkRng('fans');
  const QTY = [1, 2, 2, 2, 3, 4, 2, 1, 2, 1];
  for (const e of EVENTS) {
    const r = mkRng(e.key);
    const start = e.live ? new Date(now.getTime() - 70 * MIN) : at(e.start, e.hour);
    const salesStart = at(e.salesOpen, 10);
    const salesEnd = e.live ? new Date(start.getTime() + 2 * HOUR) : new Date(start.getTime() - HOUR);
    const minP = Math.min(...e.types.map((t) => t[1])); const maxP = Math.max(...e.types.map((t) => t[1]));
    const capacity = e.types.reduce((s, t) => s + t[2], 0);
    const event = await prisma.event.create({ data: { organizationId: org.id, venueId: venues[e.venue].id, name: e.name, slug: `${DEMO_SLUG}-${e.key}`, description: e.desc,
      category: e.category, tags: e.tags, startDatetime: start, endDatetime: new Date(start.getTime() + e.hours * HOUR), timezone: 'America/St_Johns', status: e.status,
      images: { main: `${ASSET_BASE}/${e.key}-poster.svg`, poster: `${ASSET_BASE}/${e.key}-poster.svg`, hero: `${ASSET_BASE}/${e.key}-banner.svg`, square: `${ASSET_BASE}/${e.key}-square.svg` }, metadata: { demoData: true },
      salesStart, salesEnd, capacity, minTicketPrice: minP, maxTicketPrice: maxP, currency: 'CAD',
      createdAt: new Date(Math.min(salesStart.getTime() - 9 * 24 * HOUR, now.getTime() - 5 * 24 * HOUR)) } });
    eventsByKey[e.key] = event; totals.events += 1;
    const types = [];
    for (const [i, [name, price, qty, flag]] of e.types.entries()) {
      const tt = await prisma.ticketType.create({ data: { eventId: event.id, name, price, quantityTotal: qty, quantityAvailable: qty, sortOrder: i, maxPerOrder: price > 500 ? 1 : 8,
        salesStart, salesEnd, description: `${name} admission for ${e.name}.` } });
      let tiers = [];
      if (flag === 'tiers') {
        tiers = [await prisma.ticketTier.create({ data: { ticketTypeId: tt.id, name: 'Founders Release', price: price - 30, quantityLimit: 80, sortOrder: 0, endsAt: at(e.salesOpen + 40) } }),
          await prisma.ticketTier.create({ data: { ticketTypeId: tt.id, name: 'Standard Release', price, quantityLimit: qty - 80, sortOrder: 1 } })];
      }
      types.push({ tt, name, price, qty, flag, tiers, sold: 0 });
      totals.ticketTypes += 1;
    }

    // Order timestamps.
    const lo = salesStart.getTime(); const hi = Math.min(now.getTime() - 4 * MIN, salesEnd.getTime());
    const times = [];
    const within = (a, b, n) => { const A = Math.max(a, lo); const B = Math.min(b, hi); for (let k = 0; k < n; k += 1) times.push({ t: A + r() * Math.max(0, B - A), band: null }); };
    if (e.ga) {
      const D = 24 * HOUR; const T = now.getTime();
      const bands = [[0, 7, e.ga.c7], [7, 28, e.ga.c28 - e.ga.c7], [28, 90, e.ga.c90 - e.ga.c28], [90, 97, e.ga.p7], [97, 118, e.ga.p28 - e.ga.p7], [118, 180, e.ga.p90 - e.ga.p28]];
      for (const [a, b, n] of bands) {
        const before = times.length;
        if (a === 0 && hi > todayStart.getTime()) { const nt = Math.round(n * 0.3); within(todayStart.getTime(), hi, nt); within(T - b * D, T - a * D, n - nt); }
        else within(T - b * D + 1, T - a * D - 1, n);
        for (let k = before; k < times.length; k += 1) times[k].band = a;
      }
    } else if (e.orders || e.sellOut) {
      const n = e.sellOut ? 2000 : e.orders;
      const span = Math.max(1, hi - lo);
      for (let k = 0; k < n; k += 1) {
        const x = r(); const f = x < 0.2 ? r() * 0.05 : x < 0.78 ? r() : 0.82 + r() * 0.18;
        times.push({ t: lo + f * span + r() * HOUR, band: null });
      }
      if (e.start === undefined || e.start > 0 || e.live) { if (hi > todayStart.getTime() + 20 * MIN) within(todayStart.getTime(), hi, Math.max(3, Math.round((e.orders || 80) * 0.03))); }
    }
    times.sort((a, b) => a.t - b.t);
    const orders = []; const tickets = [];
    const bandStats = {};
    const firstT = times.length ? times[0].t : 0; const lastT = times.length ? times[times.length - 1].t : 1;
    for (const { t: ms, band } of times) {
      const createdAt = new Date(Math.min(hi, ms));
      const frac = (ms - firstT) / Math.max(1, lastT - firstT);
      const avail = types.filter((t) => t.sold < t.qty && !(t.flag === 'sold' && frac > 0.3));
      if (!avail.length) { if (e.ga) throw new Error(`${e.key}: sold out before GA band orders were placed`); break; }
      const t = avail[Math.floor(Math.pow(r(), 1.6) * avail.length)];
      const qty = Math.max(1, Math.min(t.qty - t.sold, t.price > 500 ? 1 : QTY[Math.floor(r() * QTY.length)]));
      const status = !e.ga && r() < 0.025 ? 'REFUNDED' : 'PAID';
      const tier = t.tiers.length ? (createdAt < t.tiers[0].endsAt && (t.tiers[0]._sold || 0) + qty <= 80 ? t.tiers[0] : t.tiers[1]) : null;
      const unit = tier ? Number(tier.price) : t.price;
      const subtotal = unit * qty; const fees = subtotal * 0.085; const tax = (subtotal + fees) * 0.15;
      const total = Math.round((subtotal + fees + tax) * 100) / 100;
      const id = uuid();
      const no = String(orderNo++).padStart(6, '0');
      const userId = fans[Math.floor(fanRnd() * fans.length)];
      orders.push({ id, orderNumber: `NL-${no}`, userId, eventId: event.id, status, totalAmount: money(total), feesAmount: money(fees), taxAmount: money(tax),
        paymentStatus: status === 'PAID' ? 'SUCCEEDED' : 'REFUNDED', paymentIntentId: `pi_labsdemo_${no}`, paymentMethod: 'card', currency: 'cad',
        refundStatus: status === 'REFUNDED' ? 'REFUNDED' : 'NONE', receiptStatus: 'SENT', receiptSentAt: createdAt, paymentClosedAt: createdAt,
        ipAddress: `198.51.100.${(orderNo % 250) + 1}`, userAgent: 'Labs demo seed (test order, no payment)', createdAt, updatedAt: createdAt });
      for (let k = 0; k < qty; k += 1) {
        tickets.push({ id: uuid(), orderId: id, eventId: event.id, ticketTypeId: t.tt.id, tierId: tier?.id || null, userId, barcode: `NL${no}${String(k + 1).padStart(2, '0')}${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
          status: status === 'PAID' ? 'VALID' : 'CANCELLED', inventoryState: status === 'PAID' ? 'SOLD' : 'RELEASED', pricePaid: money(unit), createdAt, updatedAt: createdAt });
      }
      if (status === 'PAID') { t.sold += qty; if (tier) tier._sold = (tier._sold || 0) + qty; }
      if (createdAt >= todayStart) totals.ordersToday += 1;
      if (band !== null) { bandStats[band] = bandStats[band] || { orders: 0, revenue: 0 }; bandStats[band].orders += 1; bandStats[band].revenue += total; }
    }
    if (e.ga) {
      const sumB = (bs) => bs.reduce((acc, b) => ({ orders: acc.orders + (bandStats[b]?.orders || 0), revenue: acc.revenue + (bandStats[b]?.revenue || 0) }), { orders: 0, revenue: 0 });
      const fmt = (x) => ({ purchases: x.orders, revenue: Math.round(x.revenue) });
      ga[e.key] = { current: { 7: fmt(sumB([0])), 28: fmt(sumB([0, 7])), 90: fmt(sumB([0, 7, 28])) }, prior: { 7: fmt(sumB([90])), 28: fmt(sumB([90, 97])), 90: fmt(sumB([90, 97, 118])) } };
    }
    for (let i = 0; i < orders.length; i += 500) await prisma.order.createMany({ data: orders.slice(i, i + 500) });
    for (let i = 0; i < tickets.length; i += 1000) await prisma.ticket.createMany({ data: tickets.slice(i, i + 1000) });
    for (const t of types) {
      await prisma.ticketType.update({ where: { id: t.tt.id }, data: { quantitySold: t.sold, quantityAvailable: t.qty - t.sold, status: t.sold >= t.qty ? 'SOLD_OUT' : 'ACTIVE' } });
      for (const tier of t.tiers) await prisma.ticketTier.update({ where: { id: tier.id }, data: { quantitySold: tier._sold || 0, isActive: tier.sortOrder === 1 ? true : tier.endsAt > now } });
    }
    e._types = types;
    totals.orders += orders.length; totals.tickets += tickets.length;

    // Door scans: completed events (~91% attendance) and tonight's live event (doors open, ~62% in so far).
    if ((e.start !== undefined && e.start < 0) || e.live) {
      const evScanners = scannerRows.filter((s) => s.venue === e.venue);
      const pool = evScanners.length ? evScanners : scannerRows.filter((s) => s.name.startsWith('Box Office'));
      const valid = tickets.filter((t) => t.status === 'VALID');
      const used = valid.filter(() => r() < (e.live ? 0.62 : 0.91));
      const logs = [];
      const doors = e.live ? now.getTime() - 100 * MIN : start.getTime() - 50 * MIN;
      const window = e.live ? 96 * MIN : 140 * MIN;
      for (const t of used) {
        const scannedAt = new Date(doors + Math.floor(Math.pow(r(), e.live ? 1.1 : 0.8) * window));
        const sc = pool[Math.floor(r() * pool.length)];
        t.checkedInAt = scannedAt; t.scannerId = sc.id;
        logs.push({ id: uuid(), scannerId: sc.id, ticketId: t.id, eventId: event.id, scanType: 'ENTRY', success: true, metadata: { lane: r() < 0.8 ? 'main' : 'vip' }, scannedAt });
      }
      for (let k = 0; k < Math.ceil(used.length * 0.012); k += 1) {
        const t = used[Math.floor(r() * used.length)];
        const at2 = new Date(Math.min(now.getTime() - MIN, t.checkedInAt.getTime() + 25 * MIN));
        logs.push({ id: uuid(), scannerId: t.scannerId, ticketId: t.id, eventId: event.id, scanType: 'ENTRY', success: false, failureReason: 'ALREADY_USED', metadata: { lane: 'main' }, scannedAt: at2 });
      }
      for (let i = 0; i < logs.length; i += 1000) await prisma.scanLog.createMany({ data: logs.slice(i, i + 1000) });
      const usedIds = used.map((t) => t.id);
      for (let i = 0; i < usedIds.length; i += 1000) {
        await prisma.$executeRaw`UPDATE tickets t SET status = 'USED', checked_in_at = s.first, checked_in_by = s.scanner FROM (SELECT ticket_id, MIN(scanned_at) AS first, MIN(scanner_id) AS scanner FROM scan_logs WHERE success AND ticket_id = ANY(${usedIds.slice(i, i + 1000)}::text[]) GROUP BY ticket_id) s WHERE t.id = s.ticket_id`;
      }
      totals.scans += logs.length;
      totals.scansToday += logs.filter((l) => l.scannedAt >= todayStart).length;
    }
  }
  for (const s of scannerRows.filter((x) => x.ek)) await prisma.scanner.update({ where: { id: s.id }, data: { eventId: eventsByKey[s.ek].id } });

  // ---- Promo codes ----
  const promo = (code, description, type, value, max, used, from, until, ek, status) => ({ organizationId: org.id, code, description, discountType: type, discountValue: value, maxUses: max, usesCount: used, validFrom: at(from), validUntil: at(until), applicableEvents: ek.map((k) => eventsByKey[k].id), status });
  const promoRows = [
    promo('NLHARBOUR15', 'Newsletter subscribers: 15% off Harbour Lights.', 'PERCENTAGE', 15, 400, 312, -50, 20, ['harbour'], 'ACTIVE'),
    promo('AURORACREW', 'Crew and artist guest allocation.', 'FIXED_AMOUNT', 10, 60, 41, -30, 11, ['aurora'], 'ACTIVE'),
    promo('NYEEARLY', 'Early-bird presale for mailing list.', 'PERCENTAGE', 10, 250, 250, -60, -40, ['nye'], 'EXPIRED'),
    promo('MARAVALE20', 'Fan club code for Saltwater Sessions.', 'PERCENTAGE', 20, 50, 23, -30, 5, ['saltwater'], 'ACTIVE'),
    promo('BRUNCHFORTWO', 'Two brunch seats, $15 off.', 'FIXED_AMOUNT', 15, 40, 9, -20, 18, ['jazz'], 'ACTIVE'),
    promo('STATICHOME', 'Homecoming presale (ended).', 'PERCENTAGE', 10, 200, 200, -100, -80, ['static'], 'EXPIRED'),
    promo('MASK25', 'Costume shop partner code.', 'PERCENTAGE', 25, 100, 88, -40, -17, ['masquerade'], 'EXPIRED'),
    promo('STAFFCOMP', 'Staff comps (paused).', 'PERCENTAGE', 100, 30, 6, -60, 60, ['harbour', 'aurora', 'fog'], 'DISABLED'),
  ];
  await prisma.promoCode.createMany({ data: promoRows });

  // ---- Asset library ----
  const brand = await prisma.assetLibraryFolder.create({ data: { organizationId: org.id, createdById: team.Imogen.id, name: 'Northlight Brand Kit', category: 'Brand', usageType: 'BRAND', createdAt: at(-300) } });
  const templates = await prisma.assetLibraryFolder.create({ data: { organizationId: org.id, createdById: team.Imogen.id, name: 'Templates', category: 'Brand', usageType: 'BRAND', createdAt: at(-240) } });
  const partners = await prisma.assetLibraryFolder.create({ data: { organizationId: org.id, createdById: team.Ethan.id, name: 'Sponsors & partners', category: 'Partnerships', usageType: 'BRAND', createdAt: at(-200) } });
  const folders = { brand, templates, partners };
  const campaignKeys = ['harbour', 'aurora', 'fog', 'kitchen', 'comedy', 'saltwater', 'jazz', 'nye', 'blues', 'gala', 'filmscore', 'masquerade', 'choir', 'static'];
  for (const [i, k] of campaignKeys.entries()) {
    folders[k] = await prisma.assetLibraryFolder.create({ data: { organizationId: org.id, eventId: eventsByKey[k].id, createdById: (i % 2 ? team.Hana : team.Lucia).id, name: `${eventsByKey[k].name} campaign`, category: 'Event Marketing', usageType: 'EVENT', createdAt: at(-120 + i * 5) } });
  }
  const assetRows = [];
  const addAsset = (folder, ek, file, orig, category, size, daysAgo, who) => assetRows.push({ organizationId: org.id, folderId: folders[folder].id, eventId: ek ? eventsByKey[ek].id : null,
    uploadedById: who.id, filename: file, originalName: orig, mimeType: 'image/svg+xml', size, s3Key: `labs-demo/${file}`, s3Url: `${ASSET_BASE}/${file}`, category, usageType: ek ? 'EVENT' : 'BRAND', createdAt: ago(daysAgo * 24 * HOUR), updatedAt: ago(daysAgo * 24 * HOUR) });
  [['northlight-logo.svg', 'Northlight Live logo (dark).svg', 'Logo'], ['northlight-logo-light.svg', 'Northlight Live logo (light).svg', 'Logo'], ['northlight-mark-mono.svg', 'Northlight mark (mono).svg', 'Logo'],
    ['northlight-wordmark.svg', 'Northlight wordmark.svg', 'Logo'], ['brand-palette.svg', 'Brand palette 2026.svg', 'Guidelines'], ['brand-typography.svg', 'Typography sheet.svg', 'Guidelines'],
    ['merch-tee-mockup.svg', 'Crew tee 2026 mockup.svg', 'Merch']].forEach(([f, o, c], i) => addAsset('brand', null, f, o, c, 12000 + i * 3100, 200 - i * 9, team.Imogen));
  [['social-template-square.svg', 'Social post template 1080.svg', 'Template'], ['ticket-design-template.svg', 'Ticket design template.svg', 'Template'], ['email-header.svg', 'Newsletter header.svg', 'Email']]
    .forEach(([f, o, c], i) => addAsset('templates', null, f, o, c, 42000 + i * 9000, 90 - i * 20, team.Imogen));
  addAsset('partners', null, 'sponsor-wall.svg', 'Partner wall 2026.svg', 'Sponsors', 88000, 12, team.Ethan);
  for (const [i, k] of campaignKeys.entries()) {
    const ev = eventsByKey[k]; const who = [team.Hana, team.Imogen, team.Lucia][i % 3];
    const base = Math.max(1, Math.min(60, Math.round((ev.createdAt.getTime() > now.getTime() - 60 * 24 * HOUR ? (now.getTime() - ev.createdAt.getTime()) / (24 * HOUR) : 60) * 0.8)));
    addAsset(k, k, `${k}-poster.svg`, `${ev.name} poster v${1 + (i % 4)}.svg`, 'Poster', 380000 + i * 7100, base, who);
    addAsset(k, k, `${k}-square.svg`, `${ev.name} feed post 1080.svg`, 'Social', 210000 + i * 5300, Math.max(0.2, base * 0.6), who);
    if (i < 10) addAsset(k, k, `${k}-story.svg`, `${ev.name} story 1080x1920.svg`, 'Social', 260000 + i * 4100, Math.max(0.1, base * 0.4), team.Hana);
    if (i < 8) addAsset(k, k, `${k}-banner.svg`, `${ev.name} web banner.svg`, 'Web', 120000 + i * 3900, Math.max(0.3, base * 0.5), team.Imogen);
  }
  addAsset('harbour', 'harbour', 'harbour-lineup.svg', 'Harbour Lights lineup card.svg', 'Social', 198000, 0.15, team.Hana);
  await prisma.assetLibraryAsset.createMany({ data: assetRows });

  // ---- Reviews (approvals) ----
  // [event, title, status, revisions, file, reviewer, association, thread [who, text, hoursAgo]]
  const R = (who, text, h) => ({ who, text, h });
  const approvalDefs = [
    ['harbour', 'Harbour Lights main poster', 'PENDING_REVIEW', 3, 'harbour-poster.svg', 'Lantern Static management', 'MANAGEMENT', [R('Hana', 'v3 uploaded: bigger headliner type and the lantern walk line added.', 3)]],
    ['harbour', 'Harbour Lights lineup card', 'APPROVED', 2, 'harbour-lineup.svg', 'Lantern Static management', 'MANAGEMENT', [R('reviewer', 'Order looks right now. Approved for Tuesday.', 30), R('Jordan', 'Thank you! Scheduling it for 10 AM.', 29)]],
    ['harbour', 'Sponsor wall: Harbourfront Credit Union', 'CHANGES_REQUESTED', 2, 'sponsor-wall.svg', 'Harbourfront CU brand team', 'OTHER', [R('reviewer', 'Logo needs 20% more clear space on the right, and please use the reversed version.', 20), R('Ethan', 'On it. New version tomorrow morning.', 18)]],
    ['aurora', 'Aurora After Dark story teaser', 'APPROVED', 1, 'aurora-story.svg', 'Aurora visuals crew', 'ARTIST', [R('reviewer', 'Looks great, approved for Friday.', 52)]],
    ['aurora', 'Aurora table-service menu card', 'UPDATED', 2, 'aurora-square.svg', 'Lantern Room venue', 'OTHER', [R('reviewer', 'Prices on the menu card are last season\'s.', 70), R('Imogen', 'Updated with the new price list.', 6)]],
    ['fog', 'Fog City Strobe announce poster', 'PENDING_REVIEW', 1, 'fog-poster.svg', 'Fog City Strobe agent', 'AGENT', []],
    ['nye', "New Year's Eve key art", 'PENDING_REVIEW', 2, 'nye-poster.svg', 'Harbourfront Commons events', 'OTHER', [R('Imogen', 'Second pass: warmer gold and the fireworks burst moved up.', 26)]],
    ['nye', "New Year's Eve VIP lounge banner", 'DECLINED', 1, 'nye-banner.svg', 'Harbourfront Commons events', 'OTHER', [R('reviewer', 'We cannot use the lounge name in paid ads this year. Please drop this one.', 96), R('Jordan', 'Understood, pulling it from the ad set.', 94)]],
    ['saltwater', 'Saltwater Sessions poster', 'APPROVED', 2, 'saltwater-poster.svg', 'Mara Vale', 'ARTIST', [R('reviewer', 'Love the waves. Approved.', 120)]],
    ['saltwater', 'Mara Vale meet & greet post', 'CHANGES_REQUESTED', 1, 'saltwater-square.svg', 'Mara Vale management', 'MANAGEMENT', [R('reviewer', 'Please say "limited to 20 fans", not "exclusive".', 8)]],
    ['jazz', 'Jazz Brunch menu and poster', 'PENDING_REVIEW', 1, 'jazz-poster.svg', 'The Battery Club kitchen', 'OTHER', []],
    ['comedy', 'Late Show sold-out graphic', 'APPROVED', 1, 'comedy-square.svg', 'Gower Street Theatre', 'OTHER', [R('reviewer', 'Approved. Nice work.', 40)]],
    ['gala', 'Winter Lanterns Gala invitation', 'UPDATED', 3, 'gala-poster.svg', 'Harbourfront Arts Trust', 'OTHER', [R('reviewer', 'Please add the Trust\'s charity number at the bottom.', 50), R('Imogen', 'Added in v3.', 2)]],
    ['blues', 'Blues Night poster', 'DECLINED', 1, 'blues-poster.svg', 'House band management', 'MANAGEMENT', [R('reviewer', 'The band would prefer a photo-free design with just the name. Declining this concept.', 140)]],
    ['filmscore', 'Film Score Live announcement', 'PENDING_REVIEW', 1, 'filmscore-poster.svg', 'Tidewater studio', 'AGENT', [R('Jordan', 'Embargo until the studio confirms the date.', 1)]],
  ];
  const approvalCounts = {};
  let reviewerNo = 1;
  for (const [i, [ek, title, status, revs, file, rname, assoc, thread]] of approvalDefs.entries()) {
    approvalCounts[status] = (approvalCounts[status] || 0) + 1;
    const submitted = ago((10 + i * 13) * HOUR + revs * 30 * HOUR);
    const done = status === 'APPROVED' || status === 'DECLINED';
    const lastH = thread.length ? Math.min(...thread.map((c) => c.h)) : null;
    const a = await prisma.approvalRequest.create({ data: { organizationId: org.id, eventId: eventsByKey[ek].id, createdById: (i % 3 ? team.Jordan : team.Hana).id, title, description: `Review ${title.toLowerCase()} before it goes live.`,
      status, deadline: done ? ago((i + 1) * 20 * HOUR) : at(1 + (i % 6), 17), latestRevisionNumber: revs, submittedAt: submitted, createdAt: submitted, updatedAt: lastH !== null ? ago(lastH * HOUR) : submitted,
      completedAt: done ? ago((lastH || 24) * HOUR) : null, lastCommentAt: lastH !== null ? ago(lastH * HOUR) : null } });
    const reviewer = await prisma.approvalReviewer.create({ data: { approvalRequestId: a.id, email: `review.${reviewerNo++}@example.com`, name: rname, reviewerType: 'EXTERNAL', association: assoc,
      token: crypto.randomBytes(24).toString('hex'), tokenExpiresAt: at(14), firstViewedAt: new Date(submitted.getTime() + 2 * HOUR), lastViewedAt: ago(((lastH || 6) + 0.5) * HOUR), lastCommentAt: lastH !== null ? ago(lastH * HOUR) : null,
      lastInteractionAt: ago(((lastH || 6) + 0.2) * HOUR), lastInteractionRevisionNumber: revs } });
    if (i % 4 === 0) await prisma.approvalReviewer.create({ data: { approvalRequestId: a.id, email: `review.${reviewerNo++}@example.com`, name: 'Agency producer', reviewerType: 'EXTERNAL', association: 'AGENT', token: crypto.randomBytes(24).toString('hex'), tokenExpiresAt: at(14), firstViewedAt: ago(20 * HOUR) } });
    let rev;
    for (let n = 1; n <= revs; n += 1) {
      const revAt = new Date(submitted.getTime() + (n - 1) * 26 * HOUR);
      rev = await prisma.approvalRevision.create({ data: { approvalRequestId: a.id, revisionNumber: n, summary: n === 1 ? 'First draft for review.' : `Revision ${n}: updated per reviewer notes.`, uploadedById: team.Imogen.id, createdAt: revAt } });
      await prisma.approvalAsset.create({ data: { approvalRevisionId: rev.id, filename: file, originalName: file.replace('.svg', `-v${n}.svg`), mimeType: 'image/svg+xml', size: 280000 + n * 9000, s3Key: `labs-demo/${file}`, s3Url: `${ASSET_BASE}/${file}`, createdAt: revAt,
        approvedForLibraryAt: status === 'APPROVED' && n === revs ? ago((lastH || 24) * HOUR) : null, approvedForLibraryById: status === 'APPROVED' && n === revs ? team.Jordan.id : null } });
    }
    let parent = null;
    for (const c of [...thread].sort((x, y) => y.h - x.h)) {
      const isRev = c.who === 'reviewer';
      const row = await prisma.approvalComment.create({ data: { approvalRequestId: a.id, approvalRevisionId: rev.id, reviewerId: isRev ? reviewer.id : null, userId: isRev ? null : team[c.who].id, parentCommentId: parent?.id || null, content: c.text, createdAt: ago(c.h * HOUR) } });
      if (!parent) parent = row;
    }
    if (status !== 'PENDING_REVIEW' && status !== 'UPDATED') {
      const decision = status === 'APPROVED' ? 'APPROVED' : status === 'DECLINED' ? 'DECLINED' : 'CHANGES_REQUESTED';
      const note = thread.find((c) => c.who === 'reviewer')?.text || null;
      await prisma.approvalReviewDecision.create({ data: { approvalRequestId: a.id, approvalRevisionId: rev.id, reviewerId: reviewer.id, decision, note, createdAt: ago((lastH || 24) * HOUR) } });
    }
  }

  // ---- Task board ----
  // [title, status, priority, tag, assignee, event, due (days from now), comments [[who, text, hoursAgo]], attachment file]
  const TASKS = [
    ['Confirm stage-two power and generator backup', 'IN_PROGRESS', 'HIGH', 'OPS', 'Sofia', 'harbour', 4, [['Sofia', 'Vendor sent the load calc; waiting on the fuel plan.', 26], ['Avery', 'Thanks Sofia, let\'s lock it by Thursday.', 22], ['Grace', 'Fuel plan attached to the venue folder.', 2]]],
    ['Finalize VIP Deck catering headcount', 'TO_DO', 'MEDIUM', 'OPS', 'Rachel', 'harbour', 9, []],
    ['Schedule lineup announcement posts', 'REVIEW', 'HIGH', 'MARKETING', 'Hana', 'harbour', 2, [['Hana', 'Three posts + stories drafted, in the Harbour Lights folder.', 5], ['Jordan', 'Swap post 2 and 3 so the headliner lands Tuesday.', 3]], 'harbour-lineup.svg'],
    ['Door staffing plan: 6 lanes', 'TO_DO', 'HIGH', 'OPS', 'Dev', 'harbour', 12, [['Dev', 'Two VIP lanes, four GA lanes, one box office tablet.', 30]]],
    ['Order wristbands for Weekend Pass holders', 'IN_PROGRESS', 'MEDIUM', 'OPS', 'Marcus', 'harbour', 8, [['Marcus', 'Quote in from Battery Print, 600 units.', 20]]],
    ['Lantern walk safety briefing with volunteers', 'TO_DO', 'MEDIUM', 'OPS', 'Grace', 'harbour', 22, []],
    ['Food truck contracts (8 vendors)', 'IN_PROGRESS', 'HIGH', 'LEGAL', 'Tomas', 'harbour', 6, [['Tomas', '5 of 8 signed. Chasing the last three today.', 4]]],
    ['Paid social: Harbour Lights final push', 'TO_DO', 'MEDIUM', 'MARKETING', 'Lucia', 'harbour', 14, []],
    ['Light installation load-in schedule', 'IN_PROGRESS', 'MEDIUM', 'OPS', 'Sofia', 'aurora', 3, [['Sofia', 'Crew call moved to 2 PM.', 9]]],
    ['Send Aurora set times to artists', 'DONE', 'MEDIUM', 'GENERAL', 'Kwame', 'aurora', -2, [['Kwame', 'All three DJs confirmed.', 60]]],
    ['Balcony seating chart review', 'REVIEW', 'LOW', 'DESIGN', 'Marcus', 'aurora', 5, []],
    ['Table-for-four host scripts', 'TO_DO', 'LOW', 'GENERAL', 'Rachel', 'aurora', 10, []],
    ['Announce support act for Fog City Strobe', 'TO_DO', 'MEDIUM', 'MARKETING', 'Jordan', 'fog', 7, [['Jordan', 'Waiting on the agent to clear the name.', 48]]],
    ['Fog City: slow sales plan', 'IN_PROGRESS', 'HIGH', 'MARKETING', 'Lucia', 'fog', 2, [['Lucia', 'Proposing a 2-for-1 midweek push and an email to past Foundry buyers.', 7], ['Priya', 'OK on email; hold the 2-for-1 until next week.', 5]]],
    ['Settlement report: Quiet Harbour Acoustic', 'REVIEW', 'HIGH', 'GENERAL', 'Priya', 'quiet', 1, [['Priya', 'Box office and online reconciled; one refund pending.', 10]]],
    ['Post-show survey to attendees', 'DONE', 'LOW', 'MARKETING', 'Hana', 'static', -20, []],
    ['Northern Static settlement', 'DONE', 'HIGH', 'GENERAL', 'Priya', 'static', -24, [['Priya', 'Paid out to the band.', 500]]],
    ['Tonight: Kitchen Party door brief', 'DONE', 'HIGH', 'OPS', 'Fiona', 'kitchen', 0, [['Fiona', 'Briefed at 6:30. Two doors open.', 2]]],
    ['Tonight: walk-up ticket float', 'IN_PROGRESS', 'MEDIUM', 'OPS', 'Owen', 'kitchen', 0, [['Owen', 'Float counted, tablet 1 at the front.', 1]]],
    ['Kitchen Party photo recap', 'TO_DO', 'LOW', 'MARKETING', 'Hana', 'kitchen', 1, []],
    ['Late Show waitlist emails', 'IN_PROGRESS', 'MEDIUM', 'MARKETING', 'Liam', 'comedy', 2, [['Liam', '42 people on the waitlist; releasing 6 returns.', 6]]],
    ['Comedy Club rider and green room', 'DONE', 'LOW', 'OPS', 'Kwame', 'comedy', -1, []],
    ['Mara Vale meet & greet logistics', 'TO_DO', 'MEDIUM', 'OPS', 'Kwame', 'saltwater', 5, []],
    ['Saltwater Sessions merch table', 'REVIEW', 'LOW', 'GENERAL', 'Rachel', 'saltwater', 4, [['Rachel', 'Vinyl and tees confirmed with management.', 30]]],
    ['Brunch menu sign-off with Battery Club', 'TO_DO', 'MEDIUM', 'GENERAL', 'Grace', 'jazz', 9, []],
    ['NYE fireworks permit', 'IN_PROGRESS', 'HIGH', 'LEGAL', 'Tomas', 'nye', 11, [['Tomas', 'City says 10 business days. Submitted Monday.', 72], ['Avery', 'Please flag if anything comes back.', 70]]],
    ['NYE security plan with harbour authority', 'TO_DO', 'HIGH', 'OPS', 'Dev', 'nye', 20, []],
    ['NYE VIP lounge pricing review', 'REVIEW', 'MEDIUM', 'GENERAL', 'Priya', 'nye', 3, [['Priya', 'Recommend holding at $199 until December.', 15]]],
    ['NYE countdown screen content', 'TO_DO', 'LOW', 'DESIGN', 'Imogen', 'nye', 25, []],
    ['Blues Night poster concept v2', 'IN_PROGRESS', 'MEDIUM', 'DESIGN', 'Imogen', 'blues', 4, [['Imogen', 'Type-only version per the band\'s note.', 8]], 'blues-poster.svg'],
    ['Gala sponsor contract countersign', 'TO_DO', 'HIGH', 'LEGAL', 'Avery', 'gala', 6, []],
    ['Gala seating plan (20 patron tables)', 'IN_PROGRESS', 'MEDIUM', 'OPS', 'Rachel', 'gala', 30, []],
    ['Gala on-sale checklist', 'TO_DO', 'MEDIUM', 'GENERAL', 'Nathan', 'gala', 9, []],
    ['Film Score Live: orchestra contract', 'REVIEW', 'HIGH', 'LEGAL', 'Tomas', 'filmscore', 7, [['Tomas', 'Union rider attached; needs Avery\'s sign-off.', 28]]],
    ['Draft Spring Tide Sessions lineup', 'TO_DO', 'LOW', 'GENERAL', 'Jordan', 'spring', 30, []],
    ['Solstice Block Party budget', 'TO_DO', 'MEDIUM', 'GENERAL', 'Priya', 'solstice', 45, []],
    ['Masquerade costume prize payout', 'DONE', 'LOW', 'GENERAL', 'Priya', 'masquerade', -12, []],
    ['Masquerade lost & found returns', 'DONE', 'LOW', 'OPS', 'Owen', 'masquerade', -9, [['Owen', 'All 11 items collected.', 200]]],
    ['Ember Choir settlement', 'REVIEW', 'MEDIUM', 'GENERAL', 'Priya', 'choir', 2, []],
    ['Ember Choir thank-you email', 'DONE', 'LOW', 'MARKETING', 'Lucia', 'choir', -1, []],
    ['Signal Hill post-event report', 'DONE', 'MEDIUM', 'GENERAL', 'Grace', 'signalsunset', -50, []],
    ['Indie Weekender 2027 date hold', 'DONE', 'MEDIUM', 'GENERAL', 'Tomas', 'indie', -40, []],
    ['Accessibility page review', 'DONE', 'MEDIUM', 'LEGAL', 'Priya', null, -4, []],
    ['Refresh brand kit for winter season', 'IN_PROGRESS', 'LOW', 'DESIGN', 'Imogen', null, 14, [['Imogen', 'Palette and type sheet done; logo lockups next.', 50]], 'brand-palette.svg'],
    ['Box office tablet: update scanner app', 'TO_DO', 'MEDIUM', 'DEV', 'Dev', null, 3, []],
    ['Revoke lost iPad scanner', 'DONE', 'HIGH', 'OPS', 'Dev', null, -6, [['Dev', 'Revoked; it can no longer scan.', 140]]],
    ['Weekly newsletter: this week at Northlight', 'REVIEW', 'MEDIUM', 'MARKETING', 'Lucia', null, 1, [['Lucia', 'Draft ready, header in Templates.', 4]], 'email-header.svg'],
    ['Q4 sponsorship deck', 'IN_PROGRESS', 'HIGH', 'GENERAL', 'Ethan', null, 8, []],
    ['Onboard new door staff (3)', 'TO_DO', 'MEDIUM', 'OPS', 'Fiona', null, 5, []],
    ['Monthly payout reconciliation', 'IN_PROGRESS', 'HIGH', 'GENERAL', 'Nathan', null, 2, [['Nathan', 'October done, November in progress.', 3]]],
    ['Crew tee reorder', 'DONE', 'LOW', 'DESIGN', 'Imogen', null, -15, []],
    ['Update refund policy copy', 'REVIEW', 'LOW', 'LEGAL', 'Tomas', null, 6, []],
    ['Venue walk-through: Gower Street Theatre', 'TO_DO', 'LOW', 'OPS', 'Grace', null, 16, []],
    ['Instagram reels plan for December', 'TO_DO', 'MEDIUM', 'MARKETING', 'Hana', null, 10, []],
  ];
  const taskRows = TASKS.map(([title, status, priority, tag, who, ek, due, comments, file], i) => {
    const lastTouch = comments.length ? Math.min(...comments.map((c) => c[2])) : (status === 'DONE' ? 70 + i * 5 : 8 + i * 3);
    return { id: uuid(), organizationId: org.id, title, status, priority, tag, assigneeId: team[who].id, eventId: ek ? eventsByKey[ek].id : null,
      dueDate: due === 0 ? new Date(Math.max(now.getTime() + HOUR, todayStart.getTime() + 22 * HOUR)) : at(due, 17),
      description: comments[0]?.[1] ? `${title}. ${comments[0][1]}` : `${title}.`,
      attachments: file ? [{ url: `${ASSET_BASE}/${file}`, name: file, type: 'image/svg+xml' }] : undefined,
      createdAt: ago((lastTouch + 48 + (i % 7) * 24) * HOUR), updatedAt: ago(lastTouch * HOUR), _comments: comments };
  });
  await prisma.task.createMany({ data: taskRows.map(({ _comments, ...t }) => t) });
  const commentRows = taskRows.flatMap((t) => t._comments.map(([who, content, h]) => ({ id: uuid(), taskId: t.id, userId: team[who].id, content, createdAt: ago(h * HOUR), updatedAt: ago(h * HOUR) })));
  await prisma.taskComment.createMany({ data: commentRows });
  const taskCounts = taskRows.reduce((acc, t) => ({ ...acc, [t.status]: (acc[t.status] || 0) + 1 }), {});

  // ---- Notifications (owner feed, recent and today-heavy) ----
  const harbourSold = EVENTS.find((x) => x.key === 'harbour')._types.reduce((s, t) => s + t.sold, 0);
  const kitchenEv = EVENTS.find((x) => x.key === 'kitchen');
  const N = (type, subject, message, minutesAgo, read) => ({ id: uuid(), userId: owner.id, type, status: read ? 'READ' : 'SENT', subject, message, sentAt: ago(minutesAgo * MIN), readAt: read ? ago((minutesAgo - 5) * MIN) : null, createdAt: ago(minutesAgo * MIN), updatedAt: ago(minutesAgo * MIN) });
  const notes = [
    N('ANNOUNCEMENT', 'Doors open: Kitchen Party Social', `Two scanners are live at The Battery Club. ${kitchenEv._types.reduce((s, t) => s + t.sold, 0)} tickets sold.`, 6, false),
    N('TASK_MENTION', 'Owen mentioned you', '"Float counted, tablet 1 at the front" on Tonight: walk-up ticket float.', 58, false),
    N('ANNOUNCEMENT', 'Approval waiting: Harbour Lights main poster', 'Hana uploaded revision 3 for Lantern Static management.', 180, false),
    N('ANNOUNCEMENT', `Harbour Lights passed ${Math.floor(harbourSold / 100) * 100} tickets`, `Harbour Lights Festival is ${Math.round((harbourSold / 3560) * 100)}% sold. VIP Deck is moving fastest this week.`, 205, false),
    N('TASK_MENTION', 'Tomas mentioned you', '"5 of 8 signed. Chasing the last three today" on Food truck contracts.', 240, false),
    N('ANNOUNCEMENT', 'Approval updated: Winter Lanterns Gala invitation', 'Imogen added the charity number in revision 3.', 125, true),
    N('ORDER_CONFIRMATION', 'Table for Four sold', 'A Table for Four was booked for Aurora After Dark.', 310, true),
    N('ANNOUNCEMENT', 'Reviewer comment: Mara Vale meet & greet post', 'Mara Vale management asked for a wording change.', 480, true),
    N('ANNOUNCEMENT', 'Daily security report: all systems healthy', 'All 6 log sources scanned overnight reported healthy. No action needed.', 600, true),
    N('EVENT_REMINDER', 'Late Show Comedy Club is in 3 days', 'Sold out. 42 people on the waitlist.', 900, true),
    N('TASK_MENTION', 'Lucia mentioned you', '"Draft ready, header in Templates" on Weekly newsletter.', 1100, true),
    N('ANNOUNCEMENT', 'Settlement ready: Ember Choir', 'Sales and attendance reconciled for Ember Choir: Winter Songs.', 1500, true),
    N('ANNOUNCEMENT', 'Reviewer approved: Harbour Lights lineup card', 'Lantern Static management approved revision 2.', 1800, true),
    N('ANNOUNCEMENT', 'New team member invited', 'Tomas invited Ethan Clarke (Sponsorship Manager).', 2600, true),
    N('EVENT_REMINDER', 'Saltwater Sessions is in 6 days', 'Meet & Greet is sold out.', 2900, true),
    N('ANNOUNCEMENT', 'Weekly sales summary', 'Harbour Lights led sales this week, then New Year\'s Eve and Aurora After Dark.', 3800, true),
    N('ANNOUNCEMENT', 'Scanner revoked: Old iPad (lost)', 'Dev revoked the device. It can no longer scan tickets.', 8640, true),
    N('ANNOUNCEMENT', 'Reviewer declined: Blues Night poster', 'House band management declined this concept.', 8400, true),
    N('ANNOUNCEMENT', 'Settlement ready: Quiet Harbour Acoustic', 'Sales and attendance reconciled.', 11000, true),
    N('ORDER_CONFIRMATION', 'Patron table enquiry', 'A sponsor asked about two patron tables for the Gala.', 12500, true),
    N('ANNOUNCEMENT', 'Halloween Masquerade recap', '91% of ticket holders checked in. Costume prize paid.', 19000, true),
    N('EVENT_REMINDER', 'NYE on sale', "New Year's Eve at Harbourfront went on sale.", 24000, true),
    N('ANNOUNCEMENT', 'Weekly security report: all systems healthy', 'Every log source scanned this week reported healthy.', 10500, true),
    N('WELCOME', 'Welcome to Northlight Live on Tixmo', 'Your organization is set up. Invite your team to get started.', 60000, true),
  ];
  // Team members get a few of their own so their bells are not empty either.
  for (const who of ['Jordan', 'Hana', 'Priya', 'Dev', 'Sofia', 'Tomas']) {
    notes.push({ ...N('TASK_MENTION', 'Avery mentioned you', 'New comment on a task assigned to you.', 90 + who.length * 13, false), userId: team[who].id });
    notes.push({ ...N('ANNOUNCEMENT', 'Doors open: Kitchen Party Social', 'Two scanners are live at The Battery Club.', 6, false), userId: team[who].id });
  }
  await prisma.notification.createMany({ data: notes });

  const sum = await prisma.order.aggregate({ where: { event: { organizationId: org.id }, status: 'PAID' }, _sum: { totalAmount: true }, _count: true });
  const summary = { organizationId: org.id, slug: DEMO_SLUG, ownerUserId: owner.id, ownerAction: existingOwner ? 'updated' : 'created',
    teamMembers: TEAM.length + 1, pendingInvites: pendingInvites.length, customers: fans.length, venues: Object.keys(venues).length,
    eventsByStatus: EVENTS.reduce((acc, e) => ({ ...acc, [e.status]: (acc[e.status] || 0) + 1 }), {}),
    ...totals, paidOrders: sum._count, testRevenueCAD: Number(sum._sum.totalAmount || 0).toFixed(2), scanners: scannerRows.length, promoCodes: promoRows.length,
    assetFolders: Object.keys(folders).length, assets: assetRows.length, approvals: approvalDefs.length, approvalsByStatus: approvalCounts,
    tasks: taskRows.length, tasksByStatus: taskCounts, taskComments: commentRows.length, notifications: notes.length, ownerUnread: notes.filter((n) => n.userId === owner.id && !n.readAt).length };
  console.log('seed summary', JSON.stringify(summary));
  console.log('ga bands', JSON.stringify(ga));
}

main().catch((e) => { console.error('seed failed:', e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
