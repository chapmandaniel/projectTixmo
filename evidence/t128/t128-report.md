# T128 — Promoter-focused Security tab (Labs presentation)

Draft PR https://github.com/chapmandaniel/projectTixmo/pull/218 (DEMO ONLY, do not merge).
Branch `demo/labs-presentation`. Fake data only. Mock-data chips and Labs banner left unchanged.

## Commits and deploy

- Deployed code: `12b4d8a106cf9cdb5f0954020fe83dee258bfdb2` (`DEMO T128: Suspected Attacks and Protection Layers on Security`), on top of `22cd1ae5c405a7ccf3db2ebcd38ddf0739f8006f` (promoter-focused Security tab + Team Account Health).
- labs-dash deploy **`94c93b99-a81a-43c0-a50e-568b9ba1c18d`** SUCCESS @ `12b4d8a1` at 11:20:57 NST (America/St_Johns), `VITE_APP_LABS_BRANCH=demo/labs-presentation`.
- labs-api unchanged `d3a657fe-4abf-4a56-9429-766f32ccda25` / `9f2c523bb3c37f852123668a007b34fa88e7d8f9`.
- Rollback: dash `b520a9d2-3109-48df-92a8-441749904920` @ `118e750b3b01093333c1f8ae814491f0e27a551e`. Original restore remains `1141fb05` @ `9c054d4a` + `VITE_APP_LABS_BRANCH=preview/social-analytics-combined`.

## What the Security tab now shows

The tab is about Northlight Live's own platforms, not Tixmo vendor/infrastructure security (no log pipelines, server scans, or database-backup SOC copy).

- Header: "Your platforms look safe", last checked, last 24 hours. Plain-language "What this means for you".
- KPIs: 19/19 event pages online (HTTPS valid); 19/19 active members on 2FA (3 invites pending); checkout screening all clear (0 chargeback-risk flags); door devices all in order (12 online, 1 paused, 1 revoked).
- Your platforms: Event websites & ticket pages, Dashboard account safety, Payment & checkout safety, Door devices — all green, each with a "what this means for you" note. Website/WAF detail points at the new sections rather than repeating it.
- Protection Layers: WAF, DDoS protection, Bot/scalper defense, Rate limiting, SSL/TLS, Fraud screening, Login protection/2FA, Breach monitoring, Encrypted backups — each Active / Healthy, with a last-checked time and a one-line note.
- Suspected Attacks: 14 stopped in the last 24 hours, 61 in 7 days, 214 in 30 days, 0 reached / 0 breached. Timeline includes credential stuffing, scalper bot bursts, card-testing, request floods, and SQL/script injection probes. Every row is Blocked or Mitigated and uses only documentation ranges `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`.
- Team Account Health: all 22 seeded members. 17 all clear (including 1 already-reset breach-list match for Marcus Bell). 2 weak passwords (Liam Byrne, Sean Power) with demo "Send reminder". 3 pending invites without 2FA (Chloe Dubois, Ethan Clarke, Ben Abbott) with demo "Resend invite". 2FA 19/19 agrees with the KPI. Passwords themselves are never shown; no breach API calls.
- Door device grid (14) and a recent activity feed in promoter language.

## Seed, tests, smoke

- No seed-script change (report is client-side fake data). Labs was re-seeded (idempotent, labs-only guard): 19 events, 6,565 orders, 13,030 tickets, 22 team / 3 pending, 14 scanners, orders today 121.
- Local on `12b4d8a1`: tdash vitest 70 files, 520 passed; design:guard passed (920 baseline, no regressions).
- Smoke 50/50 routes at 1440 and 375, console 0, failed requests 0. Screenshots in `evidence/t128/screens/`, including:
  - `desktop-security.png` / `mobile-security.png`
  - `desktop-security-team-health.png` / `mobile-security-team-health.png` (plus `-summary`)
  - `desktop-security-protection-layers.png` / `mobile-security-protection-layers.png`
  - `desktop-security-suspected-attacks.png` / `mobile-security-suspected-attacks.png`

## CI

- guard-and-build pass, configured-image-restore pass, Railway labs-dash pass (deploy 94c93b99). http-soak skipped by design.
- local-gates on `12b4d8a1` pass (run 43889826552). All required PR checks green.

## Deferred

- Nothing material from this brief. Security remains a Labs preview report (not wired to live logs or a real breach service), which is intended.
