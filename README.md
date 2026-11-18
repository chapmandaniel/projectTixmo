# projectTixmo

Tixmo is an event ticketing platform. This repository is a monorepo:

- `tixmoapi2/` — Express/TypeScript API (Prisma, PostgreSQL, Redis, Jest)
- `tdash/` — React/Vite dashboard (Vitest and the design-system guard)

The API is a package in this repo, not a separate Git repository. Start from the checkout root.

## Requirements

- Node.js `>=24.21.0 <25` (`.nvmrc` and `engines`). CI uses `24.21.0`.
- npm 9 or later. Use `npm ci` so lockfiles stay intact.
- PostgreSQL 14 and Redis 7, either from Docker Compose or an equivalent local install.

npm 11 may warn that install scripts for Prisma, esbuild, and a few other packages are not covered by `allowScripts`. Skipping those scripts is expected here. The API build still runs `prisma generate`. See `docs/vendor-import-local.md`.

## Install

```bash
npm ci --prefix tixmoapi2
npm ci --prefix tdash
```

## Local development services

The Compose stack is a shared development database. It is not a test target.

```bash
cp tixmoapi2/.env.example tixmoapi2/.env
cp tdash/.env.example tdash/.env
```

Generate `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET`, and `VENDOR_CREDENTIAL_KEY` as described in `docs/vendor-import-local.md`. Do not commit those values.

```bash
npm run dev:services
npm --prefix tixmoapi2 run migrate
npm run dev
```

`npm run dev:services` starts `tixmoapi2/docker-compose.yml`: PostgreSQL 14 (`tixmoapi` on port 5432) and Redis 7 (port 6379). If Docker is not available, install PostgreSQL 14 and Redis 7 locally and point `tixmoapi2/.env` at them.

## Verification gates

API tests require an already running disposable Postgres and Redis. They do not start Compose, apply `prisma migrate`, or load application `.env` files. `npm run dev:services` is not a valid test target.

Required environment:

- `TIXMO_ALLOW_DESTRUCTIVE_TESTS=1`
- a loopback `DATABASE_URL` whose database name matches `tixmo_disposable_<name>`
- a loopback `REDIS_URL` on database `/1` through `/15`

`npm run verify:api` then runs `prisma db push` and the API Jest suite. See `docs/LOCAL_MARKET_READINESS_GATES.md` and `scripts/verification-safety.cjs`.

Documented gates, from this root unless noted:

```bash
npm ci --prefix tixmoapi2
npm ci --prefix tdash
npm --prefix tixmoapi2 run typecheck
npm --prefix tixmoapi2 run lint
npm run verify:api
npm --prefix tdash test -- --run
npm --prefix tdash run design:guard
npm --prefix tixmoapi2 run build
npm --prefix tdash run build
```

`npm --prefix tixmoapi2 run lint` reports warnings and exits 0 when there are no errors. The market gate does not run `typecheck` by itself.

One-command local market gate (audits, API tests, lint, dashboard tests, design guard, and builds):

```bash
npm run verify:market
```

## Further documentation

- Team workflow: `docs/team/README.md` and `AGENTS.md`
- API: `tixmoapi2/README.md` and `tixmoapi2/MASTER_DOCUMENTATION.md`
- Dashboard design system: `tdash/docs/dashboard-design-system.md`
- Local vendor/Showpass fixture setup: `docs/vendor-import-local.md`
