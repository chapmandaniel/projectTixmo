/* eslint-disable no-console */
/**
 * Labs presentation demo seed (T123). FAKE data only: fictional org "Northlight Live", fictional people
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

// Deterministic PRNG so every reseed has the same shape.
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

const TEAM = [
  ['Priya', 'Raman', 'ADMIN', 'Director of Finance & Operations'],
  ['Jordan', 'Okafor', 'MANAGER', 'Marketing Lead'],
  ['Sofia', 'Marchetti', 'MANAGER', 'Production Manager'],
  ['Liam', 'Byrne', 'TEAM_MEMBER', 'Box Office Coordinator'],
  ['Hana', 'Sato', 'TEAM_MEMBER', 'Social & Content Producer'],
  ['Marcus', 'Bell', 'TEAM_MEMBER', 'Ticketing Operations'],
  ['Dev', 'Kapoor', 'SCANNER', 'Door & Access Lead'],
  ['Chloe', 'Dubois', 'TEAM_MEMBER', 'Partnerships Associate'], // pending invite
];
const FIRST = ['Maya', 'Eli', 'Nia', 'Omar', 'Jules', 'Sam', 'Alex', 'Ren', 'Taylor', 'Casey', 'Morgan', 'Riley', 'Aisha', 'Ben', 'Clara', 'Diego', 'Erin', 'Felix', 'Grace', 'Hugo', 'Ines', 'Jamal', 'Kira', 'Leo', 'Mina', 'Noah', 'Olive', 'Pablo', 'Quinn', 'Rosa', 'Seth', 'Tara', 'Uma', 'Victor', 'Wren', 'Yara', 'Zane', 'Ada', 'Brody', 'Celine'];
const LAST = ['Lopez', 'Grant', 'Brooks', 'Kim', 'Carter', 'Nguyen', 'Patel', 'Morgan', 'West', 'Lane', 'Drew', 'Cole', 'Walsh', 'Power', 'Murphy', 'Ryan', 'Hayes', 'Fitzgerald', 'Abbott', 'Tremblay', 'Gagnon', 'Roy', 'Singh', 'Chen', 'Haddad', 'Silva', 'Novak', 'Kowalski', 'Osei', 'Andersen'];

function ev(key, name, o) { return { key, name, ...o }; }
const EVENTS = [
  ev('harbour', 'Harbour Lights Festival', { venue: 'commons', start: 26, hour: 17, hours: 7, status: 'ON_SALE', category: 'FESTIVAL', salesOpen: -58, tags: ['festival', 'outdoor', 'all-ages'],
    desc: 'Two stages on the waterfront: twelve acts, local food trucks and a lantern walk at sunset.',
    types: [['Early Bird GA', 59, 600, 'sold'], ['General Admission', 69, 2200], ['VIP Deck', 189, 260, 'tiers'], ['Weekend Pass', 159, 500]], target: 2350 }),
  ev('aurora', 'Aurora After Dark', { venue: 'lantern', start: 12, hour: 21, hours: 5, status: 'ON_SALE', category: 'CONCERT', salesOpen: -40, tags: ['electronic', 'late-night', '19+'],
    desc: 'A late-night electronic showcase with a full light installation by the Northlight visuals crew.',
    types: [['General Admission', 35, 700], ['Balcony', 55, 160], ['Table for Four', 220, 12]], target: 720 }),
  ev('fog', 'Fog City Strobe', { venue: 'foundry', start: 40, hour: 20, hours: 4, status: 'ON_SALE', category: 'CONCERT', salesOpen: -21, tags: ['indie', 'dance'],
    desc: 'Indie-dance double bill with a support set from Lantern Static.',
    types: [['General Admission', 45, 1500], ['VIP Mezzanine', 95, 180]], target: 640 }),
  ev('quiet', 'Quiet Harbour Acoustic', { venue: 'chapel', start: -9, hour: 19, hours: 3, status: 'COMPLETED', category: 'CONCERT', salesOpen: -55, tags: ['acoustic', 'seated'],
    desc: 'An intimate seated evening of songwriters in the round.',
    types: [['Seated', 42, 260], ['Front Row', 65, 40]], target: 296 }),
  ev('static', 'Northern Static Live', { venue: 'foundry', start: -31, hour: 20, hours: 4, status: 'COMPLETED', category: 'CONCERT', salesOpen: -80, tags: ['rock', 'all-ages'],
    desc: 'Sold-out homecoming show for Northern Static.',
    types: [['General Admission', 39, 1600], ['VIP Mezzanine', 85, 180]], target: 1760 }),
  ev('gala', 'Winter Lanterns Gala', { venue: 'commons', start: 75, hour: 18, hours: 5, status: 'PUBLISHED', category: 'SPECIAL_EVENT', salesOpen: 10, tags: ['gala', 'fundraiser'],
    desc: 'Black-tie fundraiser for the Harbourfront Arts Trust. On sale in ten days.',
    types: [['Gala Ticket', 150, 400], ['Patron Table (8)', 1400, 20]], target: 0 }),
  ev('spring', 'Spring Tide Sessions', { venue: 'lantern', start: 128, hour: 20, hours: 4, status: 'DRAFT', category: 'CONCERT', salesOpen: 30, tags: ['series'],
    desc: 'Monthly emerging-artist series. Lineup in progress.',
    types: [['General Admission', 25, 400]], target: 0 }),
];
const VENUES = {
  commons: ['Harbourfront Commons', '1 Harbour Drive', 4200],
  lantern: ['The Lantern Room', '214 Water Street', 900],
  foundry: ['Foundry Hall', '88 Duckworth Street', 1800],
  chapel: ['Chapel Street Studio', '12 Chapel Street', 320],
};

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

  const ownerData = { passwordHash: ownerHash, firstName: 'Avery', lastName: 'Quinlan', title: 'Head of Live Operations', role: 'OWNER', organizationId: org.id,
    emailVerified: true, disabledAt: null, phone: '709-555-0100', lastLogin: new Date(now.getTime() - 3600000) };
  const existingOwner = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
  const owner = existingOwner
    ? await prisma.user.update({ where: { email: ownerEmail }, data: ownerData })
    : await prisma.user.create({ data: { email: ownerEmail, ...ownerData } });

  const team = {};
  for (const [i, [f, l, role, title]] of TEAM.entries()) {
    const pending = f === 'Chloe';
    team[f] = await prisma.user.create({ data: { email: `${f}.${l}${TEAM_DOMAIN}`.toLowerCase(), passwordHash: lockedHash, firstName: f, lastName: l, title, role, organizationId: org.id,
      emailVerified: !pending, phone: `709-555-01${String(i + 1).padStart(2, '0')}`, lastLogin: pending ? null : new Date(now.getTime() - (i + 2) * 5 * 3600000),
      permissions: role === 'TEAM_MEMBER' ? { canManageEvents: true, canManageOrders: true, canViewAnalytics: true } : undefined } });
  }
  await prisma.staffInvitation.create({ data: { userId: team.Chloe.id, issuerId: owner.id, tokenHash: crypto.createHash('sha256').update(uuid()).digest('hex'),
    sessionVersion: team.Chloe.sessionVersion, expiresAt: at(5) } });

  const fans = [];
  const fanRows = [];
  for (let i = 0; i < 180; i += 1) {
    const f = FIRST[i % FIRST.length]; const l = LAST[(i * 7 + Math.floor(i / FIRST.length)) % LAST.length];
    const id = uuid();
    fanRows.push({ id, email: `${f}.${l}.${i}${FAN_SUFFIX}`.toLowerCase(), passwordHash: lockedHash, firstName: f, lastName: l, role: 'CUSTOMER', emailVerified: true, createdAt: at(-90 + (i % 80), 12) });
    fans.push(id);
  }
  await prisma.user.createMany({ data: fanRows });

  const venues = {};
  for (const [k, [name, street, capacity]] of Object.entries(VENUES)) {
    venues[k] = await prisma.venue.create({ data: { organizationId: org.id, name, capacity, timezone: 'America/St_Johns',
      address: { street, city: "St. John's", state: 'NL', zip: 'A1C 1A1', country: 'Canada' }, metadata: { demoData: true } } });
  }

  const scannerDefs = [['Main Gate A', 'harbour'], ['VIP Lane', 'harbour'], ['Lantern Room Door', 'aurora'], ['Foundry North', 'static'], ['Chapel Street Door', 'quiet'], ['Box Office Tablet', null]];
  const totals = { events: 0, ticketTypes: 0, orders: 0, tickets: 0, scans: 0 };
  const eventsByKey = {};
  let orderNo = 1;
  const scanners = {};

  for (const e of EVENTS) {
    const start = at(e.start, e.hour);
    const salesStart = at(e.salesOpen, 10);
    const minP = Math.min(...e.types.map((t) => t[1])); const maxP = Math.max(...e.types.map((t) => t[1]));
    const capacity = e.types.reduce((s, t) => s + t[2], 0);
    const event = await prisma.event.create({ data: { organizationId: org.id, venueId: venues[e.venue].id, name: e.name, slug: `${DEMO_SLUG}-${e.key}`, description: e.desc,
      category: e.category, tags: e.tags, startDatetime: start, endDatetime: new Date(start.getTime() + e.hours * 3600000), timezone: 'America/St_Johns', status: e.status,
      images: { hero: `${ASSET_BASE}/${e.key}-poster.svg`, poster: `${ASSET_BASE}/${e.key}-poster.svg` }, metadata: { demoData: true },
      salesStart, salesEnd: new Date(start.getTime() - 3600000), capacity, minTicketPrice: minP, maxTicketPrice: maxP, currency: 'CAD',
      createdAt: new Date(salesStart.getTime() - 9 * DAY) } });
    eventsByKey[e.key] = event; totals.events += 1;
    const types = [];
    for (const [i, [name, price, qty, flag]] of e.types.entries()) {
      const tt = await prisma.ticketType.create({ data: { eventId: event.id, name, price, quantityTotal: qty, quantityAvailable: qty, sortOrder: i, maxPerOrder: price > 500 ? 1 : 8,
        salesStart, salesEnd: flag === 'sold' ? at(Math.min(e.start, e.salesOpen + 14), 23) : new Date(start.getTime() - 3600000),
        description: `${name} admission for ${e.name}.` } });
      let tiers = [];
      if (flag === 'tiers') {
        tiers = [await prisma.ticketTier.create({ data: { ticketTypeId: tt.id, name: 'Founders Release', price: price - 30, quantityLimit: 80, sortOrder: 0, endsAt: at(e.salesOpen + 20) } }),
          await prisma.ticketTier.create({ data: { ticketTypeId: tt.id, name: 'Standard Release', price, quantityLimit: 180, sortOrder: 1 } })];
      }
      types.push({ tt, price, qty, flag, tiers, sold: 0 });
      totals.ticketTypes += 1;
    }
    for (const d of scannerDefs.filter((s) => s[1] === e.key)) {
      scanners[d[0]] = await prisma.scanner.create({ data: { name: d[0], deviceId: `nld-${d[0].toLowerCase().replace(/[^a-z]+/g, '-')}`, apiKey: `sk_demo_${crypto.randomBytes(18).toString('hex')}`,
        organizationId: org.id, eventId: event.id, createdBy: team.Dev.id, status: 'ACTIVE', lastUsedAt: e.start < 0 ? new Date(start.getTime() + 2 * 3600000) : at(-1, 15) } });
    }
    if (!e.target) continue;

    // Sales curve: launch spike, steady middle, late surge, plus today's sales for live events.
    const salesEndMs = Math.min(now.getTime() - 20 * 60000, start.getTime() - 3600000);
    const spanDays = Math.max(1, (salesEndMs - salesStart.getTime()) / DAY);
    let sold = 0; const orders = []; const tickets = [];
    while (sold < e.target) {
      const r = rnd();
      const x = r < 0.18 ? rnd() * 0.06 : r < 0.75 ? rnd() : 0.8 + rnd() * 0.2; // fraction of span
      const createdAt = new Date(Math.min(salesEndMs, salesStart.getTime() + x * spanDays * DAY + rnd() * 3600000));
      const avail = types.filter((t) => t.sold < t.qty && !(t.flag === 'sold' && x > 0.35));
      if (!avail.length) break;
      const t = avail[Math.floor(Math.pow(rnd(), 1.6) * avail.length)];
      const qty = Math.min(t.qty - t.sold, t.price > 500 ? 1 : pick([1, 2, 2, 2, 3, 4, 2, 1, 6]), e.target - sold);
      const status = rnd() < 0.025 ? 'REFUNDED' : 'PAID';
      const tier = t.tiers.length ? (createdAt < t.tiers[0].endsAt && t.sold < 80 ? t.tiers[0] : t.tiers[1]) : null;
      const unit = tier ? Number(tier.price) : t.price;
      const subtotal = unit * qty; const fees = subtotal * 0.085; const tax = (subtotal + fees) * 0.15;
      const id = uuid();
      const no = String(orderNo++).padStart(6, '0');
      const userId = pick(fans);
      orders.push({ id, orderNumber: `NL-${no}`, userId, eventId: event.id, status, totalAmount: money(subtotal + fees + tax), feesAmount: money(fees), taxAmount: money(tax),
        paymentStatus: status === 'PAID' ? 'SUCCEEDED' : 'REFUNDED', paymentIntentId: `pi_labsdemo_${no}`, paymentMethod: 'card', currency: 'cad',
        refundStatus: status === 'REFUNDED' ? 'REFUNDED' : 'NONE', receiptStatus: 'SENT', receiptSentAt: createdAt, paymentClosedAt: createdAt,
        ipAddress: `198.51.100.${(orderNo % 250) + 1}`, userAgent: 'Labs demo seed (test order, no payment)', createdAt, updatedAt: createdAt });
      for (let k = 0; k < qty; k += 1) {
        tickets.push({ id: uuid(), orderId: id, eventId: event.id, ticketTypeId: t.tt.id, tierId: tier?.id || null, userId, barcode: `NL${no}${String(k + 1).padStart(2, '0')}${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
          status: status === 'PAID' ? 'VALID' : 'CANCELLED', inventoryState: status === 'PAID' ? 'SOLD' : 'RELEASED', pricePaid: money(unit), createdAt, updatedAt: createdAt });
      }
      if (status === 'PAID') { t.sold += qty; sold += qty; if (tier) tier._sold = (tier._sold || 0) + qty; }
    }
    for (let i = 0; i < orders.length; i += 500) await prisma.order.createMany({ data: orders.slice(i, i + 500) });
    for (let i = 0; i < tickets.length; i += 1000) await prisma.ticket.createMany({ data: tickets.slice(i, i + 1000) });
    for (const t of types) {
      await prisma.ticketType.update({ where: { id: t.tt.id }, data: { quantitySold: t.sold, quantityAvailable: t.qty - t.sold, status: t.sold >= t.qty ? 'SOLD_OUT' : 'ACTIVE' } });
      for (const tier of t.tiers) await prisma.ticketTier.update({ where: { id: tier.id }, data: { quantitySold: tier._sold || 0, isActive: tier.sortOrder === 1 || e.start < 0 ? true : tier.endsAt > now } });
    }
    totals.orders += orders.length; totals.tickets += tickets.length;

    // Door scans for completed events (~91% attendance) and a few rejected scans.
    if (e.start < 0) {
      const scanner = Object.values(scanners).find((s) => s.eventId === event.id);
      const valid = tickets.filter((t) => t.status === 'VALID');
      const used = valid.filter(() => rnd() < 0.91);
      const logs = [];
      for (const t of used) {
        const scannedAt = new Date(start.getTime() - 50 * 60000 + Math.floor(Math.pow(rnd(), 0.8) * 140) * 60000);
        t.checkedInAt = scannedAt; logs.push({ id: uuid(), scannerId: scanner.id, ticketId: t.id, eventId: event.id, scanType: 'ENTRY', success: true, metadata: { lane: rnd() < 0.8 ? 'main' : 'vip' }, scannedAt });
      }
      for (let k = 0; k < Math.ceil(used.length * 0.012); k += 1) {
        const t = pick(used);
        logs.push({ id: uuid(), scannerId: scanner.id, ticketId: t.id, eventId: event.id, scanType: 'ENTRY', success: false, failureReason: 'ALREADY_USED', metadata: { lane: 'main' }, scannedAt: new Date(t.checkedInAt.getTime() + 25 * 60000) });
      }
      const usedIds = used.map((t) => t.id);
      for (let i = 0; i < usedIds.length; i += 1000) {
        await prisma.$executeRaw`UPDATE tickets SET status = 'USED', checked_in_by = ${scanner.id}, checked_in_at = (SELECT MIN(scanned_at) FROM scan_logs s WHERE s.ticket_id = tickets.id) WHERE id = ANY(${usedIds.slice(i, i + 1000)}::text[])`;
      }
      for (let i = 0; i < logs.length; i += 1000) await prisma.scanLog.createMany({ data: logs.slice(i, i + 1000) });
      await prisma.$executeRaw`UPDATE tickets t SET checked_in_at = s.first FROM (SELECT ticket_id, MIN(scanned_at) AS first FROM scan_logs WHERE event_id = ${event.id} AND success GROUP BY ticket_id) s WHERE t.id = s.ticket_id`;
      totals.scans += logs.length;
    }
  }
  const boxOffice = await prisma.scanner.create({ data: { name: 'Box Office Tablet', deviceId: 'nld-box-office-tablet', apiKey: `sk_demo_${crypto.randomBytes(18).toString('hex')}`, organizationId: org.id, createdBy: team.Dev.id, status: 'ACTIVE', lastUsedAt: at(-2, 13) } });
  void boxOffice;

  await prisma.promoCode.createMany({ data: [
    { organizationId: org.id, code: 'NLHARBOUR15', description: 'Newsletter subscribers: 15% off Harbour Lights.', discountType: 'PERCENTAGE', discountValue: 15, maxUses: 400, usesCount: 137, validFrom: at(-50), validUntil: at(20), applicableEvents: [eventsByKey.harbour.id], status: 'ACTIVE' },
    { organizationId: org.id, code: 'AURORACREW', description: 'Crew and artist guest allocation.', discountType: 'FIXED_AMOUNT', discountValue: 10, maxUses: 60, usesCount: 41, validFrom: at(-30), validUntil: at(11), applicableEvents: [eventsByKey.aurora.id], status: 'ACTIVE' },
    { organizationId: org.id, code: 'STATICHOME', description: 'Homecoming presale (ended).', discountType: 'PERCENTAGE', discountValue: 10, maxUses: 200, usesCount: 200, validFrom: at(-80), validUntil: at(-60), applicableEvents: [eventsByKey.static.id], status: 'EXPIRED' },
  ] });

  // Asset library: brand kit + per-event folders, files served by labs-dash /demo-assets.
  const brand = await prisma.assetLibraryFolder.create({ data: { organizationId: org.id, createdById: team.Jordan.id, name: 'Northlight Brand Kit', category: 'Brand', usageType: 'BRAND' } });
  const folders = { brand };
  for (const k of ['harbour', 'aurora', 'fog']) {
    folders[k] = await prisma.assetLibraryFolder.create({ data: { organizationId: org.id, eventId: eventsByKey[k].id, createdById: team.Hana.id, name: `${eventsByKey[k].name} campaign`, category: 'Event Marketing', usageType: 'EVENT' } });
  }
  const assetRows = [
    ['brand', null, 'northlight-logo.svg', 'Northlight Live logo.svg', 'Logo', 18400],
    ['brand', null, 'northlight-wordmark.svg', 'Northlight wordmark (light).svg', 'Logo', 15200],
    ['brand', null, 'brand-palette.svg', 'Brand palette 2026.svg', 'Guidelines', 9800],
    ['harbour', 'harbour', 'harbour-poster.svg', 'Harbour Lights poster v4.svg', 'Poster', 412000],
    ['harbour', 'harbour', 'harbour-story.svg', 'Harbour Lights story 1080x1920.svg', 'Social', 286000],
    ['harbour', 'harbour', 'harbour-lineup.svg', 'Harbour Lights lineup card.svg', 'Social', 198000],
    ['aurora', 'aurora', 'aurora-poster.svg', 'Aurora After Dark poster.svg', 'Poster', 367000],
    ['aurora', 'aurora', 'aurora-story.svg', 'Aurora story teaser.svg', 'Social', 214000],
    ['fog', 'fog', 'fog-poster.svg', 'Fog City Strobe poster.svg', 'Poster', 389000],
    ['fog', 'fog', 'fog-banner.svg', 'Fog City Strobe web banner.svg', 'Web', 122000],
  ];
  await prisma.assetLibraryAsset.createMany({ data: assetRows.map(([fk, ek, file, orig, category, size], i) => ({ organizationId: org.id, folderId: folders[fk].id, eventId: ek ? eventsByKey[ek].id : null,
    uploadedById: i % 2 ? team.Hana.id : team.Jordan.id, filename: file, originalName: orig, mimeType: 'image/svg+xml', size, s3Key: `labs-demo/${file}`, s3Url: `${ASSET_BASE}/${file}`,
    category, usageType: fk === 'brand' ? 'BRAND' : 'EVENT', createdAt: at(-20 + i, 11) })) });

  // Approvals (external artist/sponsor review).
  const approvalDefs = [
    ['harbour', 'Harbour Lights main poster', 'PENDING_REVIEW', 3, 'harbour-poster.svg', 'Lantern Static management', 'MANAGEMENT', null],
    ['harbour', 'Sponsor wall: Harbourfront Credit Union', 'CHANGES_REQUESTED', 2, 'harbour-lineup.svg', 'Sponsor brand team', 'OTHER', 'Logo needs 20% more clear space on the right.'],
    ['aurora', 'Aurora After Dark story teaser', 'APPROVED', 1, 'aurora-story.svg', 'Aurora visuals crew', 'ARTIST', 'Looks great, approved for Friday.'],
    ['fog', 'Fog City Strobe announce poster', 'PENDING_REVIEW', 1, 'fog-poster.svg', 'Fog City Strobe agent', 'AGENT', null],
    ['aurora', 'Aurora table-service menu card', 'UPDATED', 2, 'aurora-poster.svg', 'Lantern Room venue', 'OTHER', null],
  ];
  for (const [i, [ek, title, status, rev, file, rname, assoc, comment]] of approvalDefs.entries()) {
    const a = await prisma.approvalRequest.create({ data: { organizationId: org.id, eventId: eventsByKey[ek].id, createdById: team.Jordan.id, title, description: `Review ${title.toLowerCase()} before it goes live.`,
      status, deadline: at(2 + i * 2, 17), latestRevisionNumber: rev, submittedAt: at(-6 + i), completedAt: status === 'APPROVED' ? at(-1) : null, lastCommentAt: comment ? at(-1, 15) : null } });
    const revision = await prisma.approvalRevision.create({ data: { approvalRequestId: a.id, revisionNumber: rev, summary: rev > 1 ? 'Updated per reviewer notes.' : 'First draft for review.', uploadedById: team.Hana.id, createdAt: at(-3 + i) } });
    await prisma.approvalAsset.create({ data: { approvalRevisionId: revision.id, filename: file, originalName: file, mimeType: 'image/svg+xml', size: 300000, s3Key: `labs-demo/${file}`, s3Url: `${ASSET_BASE}/${file}` } });
    const reviewer = await prisma.approvalReviewer.create({ data: { approvalRequestId: a.id, email: `review.${i + 1}@example.com`, name: rname, reviewerType: 'EXTERNAL', association: assoc,
      token: crypto.randomBytes(24).toString('hex'), tokenExpiresAt: at(14), firstViewedAt: at(-2), lastViewedAt: at(-1) } });
    if (comment) {
      await prisma.approvalComment.create({ data: { approvalRequestId: a.id, approvalRevisionId: revision.id, reviewerId: reviewer.id, content: comment, createdAt: at(-1, 15) } });
      await prisma.approvalReviewDecision.create({ data: { approvalRequestId: a.id, approvalRevisionId: revision.id, reviewerId: reviewer.id, decision: status === 'APPROVED' ? 'APPROVED' : 'CHANGES_REQUESTED', note: comment } });
    }
  }

  // Tasks.
  const T = (title, status, priority, tag, who, ek, due, description) => ({ organizationId: org.id, title, status, priority, tag, assigneeId: team[who]?.id || owner.id, eventId: ek ? eventsByKey[ek].id : null, dueDate: at(due, 17), description });
  const taskRows = [
    T('Confirm stage-two power and generator backup', 'IN_PROGRESS', 'HIGH', 'OPS', 'Sofia', 'harbour', 4, 'Generator vendor confirmed; need sign-off on the fuel plan.'),
    T('Finalize VIP Deck catering headcount', 'TO_DO', 'MEDIUM', 'OPS', 'Priya', 'harbour', 9, 'Use VIP Deck sales on the Monday before the show.'),
    T('Schedule lineup announcement posts', 'REVIEW', 'HIGH', 'MARKETING', 'Hana', 'harbour', 2, 'Three posts + stories; assets are in the Harbour Lights folder.'),
    T('Door staffing plan: 6 lanes', 'TO_DO', 'HIGH', 'OPS', 'Dev', 'harbour', 12, 'Two VIP lanes, four GA lanes, one box office tablet.'),
    T('Light installation load-in schedule', 'IN_PROGRESS', 'MEDIUM', 'OPS', 'Sofia', 'aurora', 3, null),
    T('Send Aurora set times to artists', 'DONE', 'MEDIUM', 'GENERAL', 'Liam', 'aurora', -2, null),
    T('Balcony seating chart review', 'REVIEW', 'LOW', 'DESIGN', 'Marcus', 'aurora', 5, null),
    T('Announce support act for Fog City Strobe', 'TO_DO', 'MEDIUM', 'MARKETING', 'Jordan', 'fog', 7, null),
    T('Settlement report: Quiet Harbour Acoustic', 'IN_PROGRESS', 'HIGH', 'GENERAL', 'Priya', 'quiet', 1, 'Reconcile box office and online sales.'),
    T('Post-show survey to attendees', 'DONE', 'LOW', 'MARKETING', 'Hana', 'static', -20, null),
    T('Gala sponsor contract countersign', 'TO_DO', 'HIGH', 'LEGAL', 'Avery', 'gala', 6, null),
    T('Draft Spring Tide Sessions lineup', 'TO_DO', 'LOW', 'GENERAL', 'Jordan', 'spring', 30, null),
    T('Accessibility page review', 'DONE', 'MEDIUM', 'LEGAL', 'Priya', null, -4, null),
    T('Refresh brand kit for winter season', 'IN_PROGRESS', 'LOW', 'DESIGN', 'Hana', null, 14, null),
  ];
  await prisma.task.createMany({ data: taskRows });
  const firstTask = await prisma.task.findFirst({ where: { organizationId: org.id, title: { startsWith: 'Confirm stage-two' } } });
  await prisma.taskComment.createMany({ data: [
    { taskId: firstTask.id, userId: team.Sofia.id, content: 'Vendor sent the load calc; waiting on the fuel plan.', createdAt: at(-1, 10) },
    { taskId: firstTask.id, userId: owner.id, content: 'Thanks Sofia, let\'s lock it by Thursday.', createdAt: at(-1, 14) },
  ] });

  // Notifications for the demo owner.
  const N = (type, subject, message, hoursAgo, read) => ({ userId: owner.id, type, status: read ? 'READ' : 'SENT', subject, message, sentAt: new Date(now.getTime() - hoursAgo * 3600000), readAt: read ? new Date(now.getTime() - (hoursAgo - 1) * 3600000) : null, createdAt: new Date(now.getTime() - hoursAgo * 3600000) });
  await prisma.notification.createMany({ data: [
    N('ANNOUNCEMENT', 'Harbour Lights passed 2,000 tickets', 'Harbour Lights Festival is 80% sold. VIP Deck is close to selling out.', 1, false),
    N('TASK_MENTION', 'Sofia mentioned you', '"Thanks, let\'s lock it by Thursday" on Confirm stage-two power.', 3, false),
    N('ANNOUNCEMENT', 'Approval waiting: Harbour Lights main poster', 'Lantern Static management opened revision 3.', 5, false),
    N('ORDER_CONFIRMATION', 'Table for Four sold', 'A Table for Four was booked for Aurora After Dark.', 9, true),
    N('ANNOUNCEMENT', 'Weekly security report: all systems healthy', 'Every log source scanned this week reported healthy.', 20, true),
    N('EVENT_REMINDER', 'Aurora After Dark is in 12 days', 'Door plan and scanner assignments are ready.', 26, true),
    N('ANNOUNCEMENT', 'Settlement ready: Quiet Harbour Acoustic', 'Sales and attendance are reconciled.', 48, true),
  ] });

  const sum = await prisma.order.aggregate({ where: { event: { organizationId: org.id }, status: 'PAID' }, _sum: { totalAmount: true }, _count: true });
  const summary = { organizationId: org.id, slug: DEMO_SLUG, ownerUserId: owner.id, ownerAction: existingOwner ? 'updated' : 'created', teamMembers: TEAM.length + 1, customers: fans.length,
    venues: Object.keys(venues).length, ...totals, paidOrders: sum._count, testRevenueCAD: Number(sum._sum.totalAmount || 0).toFixed(2), scanners: Object.keys(scanners).length + 1, promoCodes: 3,
    assetFolders: Object.keys(folders).length, assets: assetRows.length, approvals: approvalDefs.length, tasks: taskRows.length, notifications: 7 };
  console.log('seed summary', JSON.stringify(summary));
}

main().catch((e) => { console.error('seed failed:', e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
