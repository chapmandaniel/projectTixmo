# Task 57: approved user-owned native runtime route

2026-10-19; owner `tixmo-release`; candidate/base
`8a07603ce10a4768b7cffea7027846ca53c2b520`; task branch
`tixmo/task-57-owned-runtime`. Human approval on #57 covered the owned
local disposable route. No system install, service configuration, elevation,
Docker group/socket change, shared volume, remote endpoint or production used.

## Actual evidence

Explicit `docker --host unix:///var/run/docker.sock info` still exits 1,
permission denied; socket 0660 root:docker, daniel is not in docker group.
No standard native database binaries or known user rootless sockets existed.

Existing-solution preflight selected Ubuntu's maintained/free native packages,
not a custom database/emulator. `apt-get download` fetched packages using
configured package indexes; `dpkg-deb -x` extracted user-only files without
executing package install scripts. Package family available on this host:
PostgreSQL **18.6** and Redis **8.0.5**. These differ from CI PostgreSQL14/Redis7:
this establishes local execution/access, NOT version-parity or API correctness.
`ldd` resolved both executables' dependencies with a scoped `LD_LIBRARY_PATH`.

One bounded provisioning attempt succeeded, then shut down both services:

- Owned temporary directory: `/tmp/tixmo57.InSiWz` (mode0700).
- PostgreSQL: PID725343; `127.0.0.1:35175`; user `tixmo57`;
  database `tixmo_disposable_57`. SQL returned that database/user/address/port.
- Redis: PID725354; `127.0.0.1:55758`; persistence disabled;
  database `/1`; TCP PING returned PONG.
- `ss -ltnp` confirmed only loopback listeners on the two selected random ports.
- Candidate `validateVerificationTargets` accepted explicit targets with
  `TIXMO_ALLOW_DESTRUCTIVE_TESTS=1` before any schema operation.
- EXIT cleanup used this exact cluster's `pg_ctl -D ... -m fast -w -t 10 stop`
  and this exact unique Redis Unix socket's `shutdown nosave`.
- Post-cleanup checks: no cluster PID file, no Redis socket, no listener on
  either prior port. Data/package files preserved for inspection, not shared.

No Prisma schema push, API/Jest integration suite or market gate ran.
No result here should be recorded as an integration pass. Only the named
release owner may recreate/mutate the disposable cluster until PM handoff.

## Reproducible route

Run in task57's isolated worktree; never source inherited application `.env`.
The existing extraction is `.local-runtime-57/root` (untracked local artifact).
To reproduce extraction in a fresh user-owned mode0700 directory:

```bash
apt-get download postgresql-18 postgresql-client-18 redis-server redis-tools \
  libpq5 libjemalloc2 liblzf1 libnuma1 liburing2
for archive in *.deb; do dpkg-deb -x "$archive" root; done
```

Versions above are the actual observed run; recheck package versions if indexes
change. Do not install packages system-wide or execute their maintainer scripts.

The successful lifecycle below uses random candidates directly, never a
check-then-bind free-port probe. A bind collision must fail closed, not attach
to an existing service or retry blindly. Services are unauthenticated disposable
local-only test services, not a production deployment.

```bash
set -euo pipefail
runtime_root="$PWD/.local-runtime-57/root"
export LD_LIBRARY_PATH="$runtime_root/usr/lib/x86_64-linux-gnu"
pgbin="$runtime_root/usr/lib/postgresql/18/bin"
owned_run=$(mktemp -d /tmp/tixmo57.XXXXXX)
pgport=$(shuf -i 20000-39999 -n 1)
redisport=$(shuf -i 40000-59999 -n 1)
cleanup() {
  if test -f "$owned_run/pg/postmaster.pid"; then
    "$pgbin/pg_ctl" -D "$owned_run/pg" -m fast -w -t 10 stop
  fi
  if test -S "$owned_run/redis.sock"; then
    "$runtime_root/usr/bin/redis-cli" -s "$owned_run/redis.sock" shutdown nosave
  fi
}
trap cleanup EXIT
"$pgbin/initdb" -D "$owned_run/pg" \
  -L "$runtime_root/usr/share/postgresql/18" --auth=trust \
  --username=tixmo57 --encoding=UTF8 --no-locale > "$owned_run/initdb.log"
"$pgbin/pg_ctl" -D "$owned_run/pg" -l "$owned_run/postgres.log" \
  -o "-h 127.0.0.1 -p $pgport -k $owned_run" -w -t 10 start
"$runtime_root/usr/bin/redis-server" --bind 127.0.0.1 --port "$redisport" \
  --save '' --appendonly no --daemonize yes --dir "$owned_run" \
  --pidfile "$owned_run/redis.pid" --logfile "$owned_run/redis.log" \
  --unixsocket "$owned_run/redis.sock" --unixsocketperm 700
"$pgbin/createdb" -h 127.0.0.1 -p "$pgport" -U tixmo57 tixmo_disposable_57
"$pgbin/psql" -h 127.0.0.1 -p "$pgport" -U tixmo57 \
  -d tixmo_disposable_57 -Atc \
  'select current_database(), current_user, inet_server_addr(), inet_server_port();'
"$runtime_root/usr/bin/redis-cli" -h 127.0.0.1 -p "$redisport" -n 1 ping
DATABASE_URL="postgresql://tixmo57@127.0.0.1:$pgport/tixmo_disposable_57" \
REDIS_URL="redis://127.0.0.1:$redisport/1" TIXMO_ALLOW_DESTRUCTIVE_TESTS=1 \
node -e 'require("./scripts/verification-safety.cjs").validateVerificationTargets(process.env)'
# Only after ownership/listeners/guard checks and PM coordination may the
# single assigned DB owner run an explicitly approved integration command here.
# Leaving this shell block triggers exact-instance cleanup above.
```

Retain the run path/ports during any future gate, revalidate the exact service
ownership and listener addresses, and check teardown as above. Do not reuse
this run's now-stopped URLs, connect to any inherited URLs, or delete unknown
data directories. Native version parity with CI remains unverified; PM must
sequence actual integration separately, without assuming parity from access.
