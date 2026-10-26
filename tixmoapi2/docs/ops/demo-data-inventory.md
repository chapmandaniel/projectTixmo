# Demo and seed inventory (read-only)

Use these statements to list demo and seed rows before the Nov 9 onsale. They are `SELECT` only. Do not add `INSERT`, `UPDATE`, `DELETE`, or a migration. Run them in a read-only session:

```sql
BEGIN TRANSACTION READ ONLY;
```

Column and table names match `tixmoapi2/prisma/schema.prisma` (`@@map`). `settings` and `metadata` are `jsonb`.

Scripts checked:

| Command | Script | What it writes |
| --- | --- | --- |
| `npm run demo:market` | `tixmoapi2/scripts/market-demo-data.ts` | One org, `settings.demoData = true`, fixed emails, `MKT-DEMO-%` orders, `pi_market_demo_%` payment intents |
| `npm run db:seed` | `tixmoapi2/prisma/seed-minimal.js` | Nothing. Current script is a no-op |
| `npm run db:reset` / `npm run db:populate` | `tixmoapi2/scripts/dev-data.ts`, `dev-data-populate.ts` | Named dev orgs and faker children. `db:reset` leaves `TixMo HQ` and `admin@tixmo.com` |
| `npm run db:seed:approvals` | `tixmoapi2/prisma/seed-approvals.ts` | Org slug `tixmo-approvals-dev` |
| `npx ts-node prisma/seed.ts` | `tixmoapi2/prisma/seed.ts` and `prisma/seeders/` | Six named orgs. Events, venues, and most users are faker output. Not wired to `db:seed` |
| manual | `tixmoapi2/scripts/generate-event-simulation.ts` | Org name `Simulation Entertainment Group`, event name `Neon Nights 2024`. No npm script |

No seed script inserts `payment_attempts`. Migration `20261005003000_payment_and_inventory_integrity` copies `orders.payment_intent_id` into `payment_attempts` for every order that has one. Demo payment attempts are the rows joined to the orders below.

## Which markers are reliable

Reliable means the script writes that exact value, so a match is that script's row:

- `organizations.settings->>'demoData' = 'true'`
- `organizations.settings->>'resetCommand' = 'npm --prefix tixmoapi2 run demo:market:reseed'`
- `organizations.slug = 'tixmo-market-demo'` and `organizations.name = 'Tixmo Market Demo'`
- event slugs `market-demo-harborlight-summer-session`, `market-demo-afterglow-warehouse`, `market-demo-founders-circle-showcase`, `market-demo-sponsor-preview-night`
- `events.metadata->>'demoData' = 'true'` and `venues.metadata->>'demoData' = 'true'` on rows that script creates
- `orders.order_number LIKE 'MKT-DEMO-%'`
- `orders.payment_intent_id LIKE 'pi_market_demo_%'`
- `orders.user_agent = 'Tixmo market demo seed'`
- `payment_webhook_events.id LIKE 'evt_market_demo_%'`
- `tickets.barcode LIKE 'MKT-_____-__'` (five digits, two digits) and `tickets.qr_code_url LIKE 'https://demo.tixmo.test/qr/%'`
- the fifteen `demo.*@tixmo.test` emails listed below
- `promo_codes.code = 'MARKETDEMO15'`
- `scanners.device_id IN ('market-demo-main-gate', 'market-demo-founders-checkin')`
- `organizations.slug = 'tixmo-approvals-dev'`, events `approvals-development-festival` and `approvals-development-summit`, user `approvals.admin@tixmo.test`

Heuristics are fixed names or patterns with no `demoData` flag. A real customer can share the name. Review the child rows before hiding anything matched only this way:

- Prisma seed org names: `Starlight Events`, `Underground Productions`, `Champions Sports Group`, `The Grand Theater`, `Metro Convention Center`, `TicketHub Resale`. Their events, orders, tickets, and most users are random faker values and are identifiable only through the org.
- Prisma seed promo codes `EARLYBIRD10`, `STUDENT15`, `GROUP20`, `FLASH25`, `WELCOME10`, `VIP50`, `NEWYEAR25`, `HOLIDAY20`. Real orgs can use the same code. Trust them only on those named orgs.
- `db:populate` org names `Neon Events Co`, `Metro Venues Inc`, `Ticket Hub Resellers`. Slugs add a random suffix. Event names are `Neon Nights 2025`, `Comedy Slam Fest`, `DevOps Summit 2025`, `Summer Beats Festival`, `Jazz Under the Stars`, `Tech Innovators Expo`, `Lakefront Rocktoberfest`, `Midnight Masquerade`, `Tiny Desk Sessions`, `Winter Gala 2026`, `Spring Comedy Tour`, `Rainy Day Acoustic Set`. Promo codes `EARLYBIRD20`, `SUMMER10`, `FLAT15OFF`, `VIP25`, `WELCOME5`, `FLASH50`, `GROUPDEAL`, `STAFF100`, `OLDCODE`, `DISABLED1` are the same kind of name collision.
- `generate-event-simulation.ts`: org name `Simulation Entertainment Group` (slug starts `simulation-entertainment-`), event name `Neon Nights 2024`, venue name `Grand Arena`. Orders are `faker` alphanumeric, not `MKT-DEMO-%`.
- `organizations.slug = 'tixmo-hq'` and `organizations.name = 'TixMo HQ'` from `db:reset`.
- `users.email = 'admin@tixmo.com'`. `prisma/seed.ts`, `dev-data.ts`, and older `seed-minimal.js` all create it, and migration `20261004234000_account_revocation_and_invitations` disables that address. Do not treat it as disposable demo data from the email alone.
- `orders.order_number LIKE 'ORD-%'`, `orders.payment_intent_id LIKE 'pi_%'`, and `tickets.barcode LIKE 'TIX-%'` are faker shapes. Live charges can use the same prefixes. Use them only inside an org already matched above.
- A `demo` tag on `events.tags` is written by the market demo, but tags are editable.

`payment_attempts` have no seed marker of their own. Identify them through the order.

Do not select `scanners.api_key`. The market demo stores `sk_scanner_market_demo_main_gate` and `sk_scanner_market_demo_founders_checkin` there. Count those scanners by `device_id`.

## 1. Organizations

```sql
SELECT id, name, slug, type, status, settings, created_at,
       CASE
         WHEN settings->>'demoData' = 'true' THEN 'reliable: settings.demoData'
         WHEN slug = 'tixmo-market-demo' THEN 'reliable: slug'
         WHEN name = 'Tixmo Market Demo' THEN 'reliable: name'
         WHEN slug = 'tixmo-approvals-dev' THEN 'reliable: approvals slug'
         WHEN slug = 'tixmo-hq' OR name = 'TixMo HQ' THEN 'heuristic: db:reset org'
         WHEN name IN (
           'Starlight Events', 'Underground Productions', 'Champions Sports Group',
           'The Grand Theater', 'Metro Convention Center', 'TicketHub Resale'
         ) THEN 'heuristic: prisma/seed.ts org name'
         WHEN name IN ('Neon Events Co', 'Metro Venues Inc', 'Ticket Hub Resellers')
           THEN 'heuristic: db:populate org name'
         WHEN name = 'Simulation Entertainment Group'
           THEN 'heuristic: generate-event-simulation.ts org name'
       END AS marker
FROM organizations
WHERE settings->>'demoData' = 'true'
   OR slug IN ('tixmo-market-demo', 'tixmo-approvals-dev', 'tixmo-hq')
   OR name IN (
     'Tixmo Market Demo', 'TixMo HQ',
     'Starlight Events', 'Underground Productions', 'Champions Sports Group',
     'The Grand Theater', 'Metro Convention Center', 'TicketHub Resale',
     'Neon Events Co', 'Metro Venues Inc', 'Ticket Hub Resellers',
     'Simulation Entertainment Group'
   )
ORDER BY marker, name;
```

## 2. Events on those organizations

```sql
WITH demo_orgs AS (
  SELECT id, name AS organization_name, slug AS organization_slug
  FROM organizations
  WHERE settings->>'demoData' = 'true'
     OR slug IN ('tixmo-market-demo', 'tixmo-approvals-dev', 'tixmo-hq')
     OR name IN (
       'Tixmo Market Demo', 'TixMo HQ',
       'Starlight Events', 'Underground Productions', 'Champions Sports Group',
       'The Grand Theater', 'Metro Convention Center', 'TicketHub Resale',
       'Neon Events Co', 'Metro Venues Inc', 'Ticket Hub Resellers',
       'Simulation Entertainment Group'
     )
)
SELECT e.id, e.name, e.slug, e.status, e.start_datetime, e.end_datetime,
       o.organization_name, o.organization_slug,
       (e.metadata->>'demoData' = 'true') AS metadata_demo_data,
       (e.slug LIKE 'market-demo-%' OR e.slug LIKE 'approvals-development-%') AS reliable_slug
FROM events e
JOIN demo_orgs o ON o.id = e.organization_id
ORDER BY o.organization_name, e.start_datetime NULLS LAST, e.id;
```

## 3. Order counts per organization and per event

`pi_market_demo_%` and `MKT-DEMO-%` are counted even when the order's organization was renamed.

```sql
WITH demo_orgs AS (
  SELECT id FROM organizations
  WHERE settings->>'demoData' = 'true'
     OR slug IN ('tixmo-market-demo', 'tixmo-approvals-dev', 'tixmo-hq')
     OR name IN (
       'Tixmo Market Demo', 'TixMo HQ',
       'Starlight Events', 'Underground Productions', 'Champions Sports Group',
       'The Grand Theater', 'Metro Convention Center', 'TicketHub Resale',
       'Neon Events Co', 'Metro Venues Inc', 'Ticket Hub Resellers',
       'Simulation Entertainment Group'
     )
),
demo_orders AS (
  SELECT o.id, o.order_number, o.payment_intent_id, o.status, o.payment_status,
         o.event_id, e.organization_id, e.name AS event_name
  FROM orders o
  JOIN events e ON e.id = o.event_id
  WHERE e.organization_id IN (SELECT id FROM demo_orgs)
     OR o.order_number LIKE 'MKT-DEMO-%'
     OR o.payment_intent_id LIKE 'pi_market_demo_%'
     OR o.user_agent = 'Tixmo market demo seed'
)
SELECT organization_id, NULL::text AS event_id, NULL::text AS event_name,
       count(*) AS orders,
       count(*) FILTER (WHERE order_number LIKE 'MKT-DEMO-%') AS mkt_demo_orders,
       count(*) FILTER (WHERE payment_intent_id LIKE 'pi_market_demo_%') AS pi_market_demo_orders
FROM demo_orders
GROUP BY organization_id
UNION ALL
SELECT organization_id, event_id, event_name,
       count(*) AS orders,
       count(*) FILTER (WHERE order_number LIKE 'MKT-DEMO-%') AS mkt_demo_orders,
       count(*) FILTER (WHERE payment_intent_id LIKE 'pi_market_demo_%') AS pi_market_demo_orders
FROM demo_orders
GROUP BY organization_id, event_id, event_name
ORDER BY organization_id, event_id NULLS FIRST;
```

## 4. Tickets, payment attempts, and users

```sql
WITH demo_orgs AS (
  SELECT id FROM organizations
  WHERE settings->>'demoData' = 'true'
     OR slug IN ('tixmo-market-demo', 'tixmo-approvals-dev', 'tixmo-hq')
     OR name IN (
       'Tixmo Market Demo', 'TixMo HQ',
       'Starlight Events', 'Underground Productions', 'Champions Sports Group',
       'The Grand Theater', 'Metro Convention Center', 'TicketHub Resale',
       'Neon Events Co', 'Metro Venues Inc', 'Ticket Hub Resellers',
       'Simulation Entertainment Group'
     )
),
demo_orders AS (
  SELECT o.id, o.user_id, o.payment_intent_id, o.event_id
  FROM orders o
  JOIN events e ON e.id = o.event_id
  WHERE e.organization_id IN (SELECT id FROM demo_orgs)
     OR o.order_number LIKE 'MKT-DEMO-%'
     OR o.payment_intent_id LIKE 'pi_market_demo_%'
     OR o.user_agent = 'Tixmo market demo seed'
)
SELECT 'ticket' AS kind, t.id, t.order_id, t.event_id, t.user_id,
       t.barcode, t.inventory_state, t.status, NULL::text AS email
FROM tickets t
WHERE t.order_id IN (SELECT id FROM demo_orders)
   OR t.barcode ~ '^MKT-[0-9]{5}-[0-9]{2}$'
   OR t.qr_code_url LIKE 'https://demo.tixmo.test/qr/%'
UNION ALL
SELECT 'payment_attempt', pa.id, pa.order_id, NULL, NULL,
       pa.payment_intent_id, pa.currency, NULL, NULL
FROM payment_attempts pa
WHERE pa.order_id IN (SELECT id FROM demo_orders)
   OR pa.payment_intent_id LIKE 'pi_market_demo_%'
UNION ALL
SELECT 'user', u.id, NULL, NULL, u.id,
       NULL, u.role::text, CASE WHEN u.disabled_at IS NULL THEN 'enabled' ELSE 'disabled' END,
       u.email
FROM users u
WHERE u.organization_id IN (SELECT id FROM demo_orgs)
   OR u.id IN (SELECT user_id FROM demo_orders)
   OR u.email IN (
     'demo.admin@tixmo.test', 'demo.manager@tixmo.test', 'demo.ops@tixmo.test',
     'demo.scanner@tixmo.test', 'demo.customer+maya@tixmo.test',
     'demo.customer+eli@tixmo.test', 'demo.customer+nia@tixmo.test',
     'demo.customer+omar@tixmo.test', 'demo.customer+jules@tixmo.test',
     'demo.customer+sam@tixmo.test', 'demo.customer+alex@tixmo.test',
     'demo.customer+ren@tixmo.test', 'demo.customer+taylor@tixmo.test',
     'demo.customer+casey@tixmo.test', 'demo.customer+morgan@tixmo.test',
     'demo.customer+riley@tixmo.test', 'approvals.admin@tixmo.test'
   )
   OR lower(u.email) = 'admin@tixmo.com'
ORDER BY kind, email NULLS LAST, id;
```

`admin@tixmo.com` is included so the disabled bootstrap account is visible. It is a heuristic, not a market-demo user.

## 5. One count per category

```sql
WITH demo_orgs AS (
  SELECT id FROM organizations
  WHERE settings->>'demoData' = 'true'
     OR slug IN ('tixmo-market-demo', 'tixmo-approvals-dev', 'tixmo-hq')
     OR name IN (
       'Tixmo Market Demo', 'TixMo HQ',
       'Starlight Events', 'Underground Productions', 'Champions Sports Group',
       'The Grand Theater', 'Metro Convention Center', 'TicketHub Resale',
       'Neon Events Co', 'Metro Venues Inc', 'Ticket Hub Resellers',
       'Simulation Entertainment Group'
     )
),
demo_orders AS (
  SELECT o.id
  FROM orders o
  JOIN events e ON e.id = o.event_id
  WHERE e.organization_id IN (SELECT id FROM demo_orgs)
     OR o.order_number LIKE 'MKT-DEMO-%'
     OR o.payment_intent_id LIKE 'pi_market_demo_%'
     OR o.user_agent = 'Tixmo market demo seed'
)
SELECT category, row_count
FROM (
  SELECT 'organizations_demo_flag' AS category, count(*) AS row_count
  FROM organizations WHERE settings->>'demoData' = 'true'
  UNION ALL
  SELECT 'organizations_named_or_slugged', count(*) FROM demo_orgs
  UNION ALL
  SELECT 'events', count(*) FROM events WHERE organization_id IN (SELECT id FROM demo_orgs)
  UNION ALL
  SELECT 'orders', count(*) FROM demo_orders
  UNION ALL
  SELECT 'orders_mkt_demo_number', count(*) FROM orders WHERE order_number LIKE 'MKT-DEMO-%'
  UNION ALL
  SELECT 'orders_pi_market_demo', count(*)
  FROM orders WHERE payment_intent_id LIKE 'pi_market_demo_%'
  UNION ALL
  SELECT 'tickets', count(*) FROM tickets
  WHERE order_id IN (SELECT id FROM demo_orders)
     OR barcode ~ '^MKT-[0-9]{5}-[0-9]{2}$'
     OR qr_code_url LIKE 'https://demo.tixmo.test/qr/%'
  UNION ALL
  SELECT 'payment_attempts', count(*) FROM payment_attempts
  WHERE order_id IN (SELECT id FROM demo_orders)
     OR payment_intent_id LIKE 'pi_market_demo_%'
  UNION ALL
  SELECT 'payment_webhook_events_market_demo', count(*)
  FROM payment_webhook_events WHERE id LIKE 'evt_market_demo_%'
  UNION ALL
  SELECT 'users_reliable_demo_emails', count(*) FROM users
  WHERE email IN (
    'demo.admin@tixmo.test', 'demo.manager@tixmo.test', 'demo.ops@tixmo.test',
    'demo.scanner@tixmo.test', 'demo.customer+maya@tixmo.test',
    'demo.customer+eli@tixmo.test', 'demo.customer+nia@tixmo.test',
    'demo.customer+omar@tixmo.test', 'demo.customer+jules@tixmo.test',
    'demo.customer+sam@tixmo.test', 'demo.customer+alex@tixmo.test',
    'demo.customer+ren@tixmo.test', 'demo.customer+taylor@tixmo.test',
    'demo.customer+casey@tixmo.test', 'demo.customer+morgan@tixmo.test',
    'demo.customer+riley@tixmo.test', 'approvals.admin@tixmo.test'
  )
  UNION ALL
  SELECT 'users_on_named_orgs_or_orders', count(*) FROM users
  WHERE organization_id IN (SELECT id FROM demo_orgs)
     OR id IN (SELECT user_id FROM orders WHERE id IN (SELECT id FROM demo_orders))
  UNION ALL
  SELECT 'users_admin_tixmo_com_heuristic', count(*) FROM users
  WHERE lower(email) = 'admin@tixmo.com'
) counts
ORDER BY category;
```

## 6. Stale ON_SALE and PUBLISHED events

Separate from the demo inventory. This is the review list for events that are still on sale or published after their end, or after their start when they have no end. It does not change rows. A null start and null end is listed on its own so an undated event is not treated as ended.

```sql
SELECT e.id, e.name, e.slug, e.status, e.start_datetime, e.end_datetime,
       COALESCE(e.end_datetime, e.start_datetime) AS boundary,
       o.id AS organization_id, o.name AS organization_name
FROM events e
JOIN organizations o ON o.id = e.organization_id
WHERE e.status IN ('ON_SALE', 'PUBLISHED')
  AND e.deleted_at IS NULL
  AND COALESCE(e.end_datetime, e.start_datetime) <= now()
ORDER BY boundary, e.id;
```
