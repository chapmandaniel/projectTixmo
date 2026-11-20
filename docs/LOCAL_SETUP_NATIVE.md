# Local setup without Docker, demo data, and test hygiene

Companion to `tixmoapi2/README.md` (and the root `README.md`, once present). Use it when Docker is not available, when you want the seeded market demo, or when API tests fail on a machine where you have also run the API.

All values below are local-only development values that already appear in `tixmoapi2/docker-compose.yml` and `tixmoapi2/.env.example`. Never reuse them anywhere shared. Do not commit `.env` files.

## 1. PostgreSQL 14 on Ubuntu 24.04 (PGDG)

Ubuntu 24.04 ships PostgreSQL 16 in its default apt sources. This repo targets PostgreSQL 14 (the Compose image is `postgres:14-alpine` and CI runs 14). Install 14 from the PostgreSQL project apt repository (PGDG):

```bash
sudo apt-get install -y postgresql-common
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh   # adds the noble-pgdg repo
sudo apt-get install -y postgresql-14 redis-server
```

Check that the 14 cluster is online and which port it uses:

```bash
pg_lsclusters
```

- If PostgreSQL 16 is also installed, the 14 cluster takes port 5433, not 5432. Either stop or remove the 16 cluster, or change the port in `DATABASE_URL`.
- If the cluster is down: `sudo pg_ctlcluster 14 main start`.
- Redis 7 from the Ubuntu 24.04 apt sources is fine: `redis-cli ping` should print `PONG`.

## 2. Create the development role and database

These match `tixmoapi2/docker-compose.yml` and the `DATABASE_URL` in `tixmoapi2/.env.example`:

```bash
sudo -u postgres psql <<'SQL'
CREATE USER tixmo WITH PASSWORD 'tixmo_dev_password' CREATEDB;
CREATE DATABASE tixmoapi OWNER tixmo;
SQL
```

Then, from the repo root:

```bash
cp tixmoapi2/.env.example tixmoapi2/.env
cp tdash/.env.example tdash/.env
```

Fill in the generated secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET`, `VENDOR_CREDENTIAL_KEY`) as described in `docs/vendor-import-local.md`. The API will not boot without `SESSION_SECRET`.

Apply migrations with the deploy command, not `prisma migrate dev` (which asks for a migration name and hangs in a script):

```bash
npm --prefix tixmoapi2 run migrate
```

## 3. Seed the market demo and log in

`npm run db:seed` is a no-op. The seed that gives you a usable organization is the market demo (fake data only; see `docs/MARKET_DEMO_DATA.md` for the full contents and safety guard):

```bash
npm run demo:market          # resets and reseeds only the demo organization
npm run demo:market:verify   # optional read-only check
```

It reads `DATABASE_URL` from `tixmoapi2/.env` and refuses `NODE_ENV=production` or a non-local database.

Then start both apps and sign in:

```bash
npm run dev -- --no-services # API on http://localhost:3000, dashboard on http://localhost:5173
```

`--no-services` skips the Docker startup that plain `npm run dev` attempts. Use plain `npm run dev` only when Docker is installed.

- Open `http://localhost:5173` and sign in as the seeded owner `demo.admin@tixmo.test`.
- The shared demo password is listed under "Seeded Login" in `docs/MARKET_DEMO_DATA.md`. It is a fixed fake value for seeded local users only.
- Quick API check: `curl http://localhost:3000/health` returns HTTP 200.

## 4. Disposable database for API tests

Tests never run against `tixmoapi`. Create a separate database and use a Redis database number from `/1` to `/15`:

```bash
sudo -u postgres psql -c "CREATE DATABASE tixmo_disposable_local OWNER tixmo;"
```

```bash
TIXMO_ALLOW_DESTRUCTIVE_TESTS=1 \
DATABASE_URL=postgresql://tixmo:tixmo_dev_password@127.0.0.1:5432/tixmo_disposable_local \
REDIS_URL=redis://127.0.0.1:6379/1 \
npm run verify:api
```

Adjust the port if `pg_lsclusters` shows something other than 5432. `verify:api` pushes the schema and runs Jest in band. It is destructive to the target database, which is why the safety guard insists on the `tixmo_disposable_` name.

## 5. Warning: a local `.env` can break Jest

Setting up the API for development means having `tixmoapi2/.env`, copied from `.env.example`. That file sets `AUTH_RATE_LIMIT_MAX=20` and a localhost `CORS_ORIGIN`. Jest runs with `NODE_ENV=test`, which skips `dotenv`, but a few suites deliberately switch `NODE_ENV` to `development` or `production` and reload the config, and that loads `tixmoapi2/.env`. With the example file present, a full run can fail on:

- auth tests with `429 Too many authentication attempts`, and
- `environment.config.test.ts`, because `corsOrigin` comes from `.env.example` instead of being empty.

If you see those failures, move the file aside for the test run and put it back afterwards:

```bash
mv tixmoapi2/.env tixmoapi2/.env.dev-hold
# run npm run verify:api as in section 4
mv tixmoapi2/.env.dev-hold tixmoapi2/.env
```

The failing files re-pass with `.env` absent. Do not edit `.env.example` to work around this.

## 6. Dashboard (`tdash/`)

See `tdash/README.md` for the dashboard commands.
