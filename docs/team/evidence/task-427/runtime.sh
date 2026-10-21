#!/usr/bin/env bash
# NOT EXECUTED. Requires a fresh sole-owner PM grant; not an authorization token.
if test "${TASK427_PM_RUNTIME_GRANT:-}" != source-reviewed-sole-owner; then
  echo 'STOP: source-only handoff; obtain a fresh explicit PM sole-owner runtime grant' >&2
  exit 2
fi
# Always discard inherited credentials before importing tools or application code.
if test "${TASK427_SCRUBBED:-}" != 1; then
  exec env -i HOME=/home/daniel PATH="/home/daniel/.nvm/versions/node/v24.21.0/bin:/usr/bin:/bin" TASK427_PM_RUNTIME_GRANT=source-reviewed-sole-owner TASK427_SCRUBBED=1 bash "$0"
fi
set -euo pipefail
# Defense in depth: environment.ts skips dotenv in test; reject ambient files anyway.
for ambient in .env tixmoapi2/.env; do
  test ! -e "$ambient" || { echo 'Refusing ambient dotenv file' >&2; exit 2; }
done
umask 077
# Capture clean candidate BEFORE runtime directory preparation or provisioning.
# This source check is not native egress admission or an execution grant.
task432_identity=$(node --input-type=module -e '
  import { snapshot } from "./scripts/market-composition.mjs";
  process.stdout.write(JSON.stringify(snapshot(process.cwd())));
')
runtime_root="/home/daniel/projects/projectTixmo/worktrees/task-57/.local-runtime-57/root"
export LD_LIBRARY_PATH="$runtime_root/usr/lib/x86_64-linux-gnu"
pgbin="$runtime_root/usr/lib/postgresql/18/bin"
task_root=/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task-379
node "$PWD/docs/team/evidence/task-379/runtime-path.cjs" "$task_root" --prepare
owned_run=$(mktemp -d "$task_root/run.XXXXXX")
node "$PWD/docs/team/evidence/task-379/runtime-path.cjs" "$owned_run"
# Bind artifacts only after validating this invocation-owned path, before publication.
export TASK379_ARTIFACT_DIR="$owned_run"
# Fresh per-invocation challenge, retained in this shell rather than trusted from receipts.
export TASK379_RUN_ID=$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")
pgport=$(shuf -i 20000-39999 -n 1)
redisport=$(shuf -i 40000-59999 -n 1)
redis_pid=''
pg_pid=''
jest_attempted=0
source "$PWD/docs/team/evidence/task-427/owned-lifecycle.sh"
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# Bind the reviewed CLI transport to this exact clean candidate before children.
# Exclusive publication refuses reuse; source identity is consistency, not admission.
export TASK432_API_RECEIPTS="$owned_run"
TASK432_SOURCE_IDENTITY="$task432_identity" node --input-type=module -e '
  import fs from "node:fs";
  import { snapshot } from "./scripts/market-composition.mjs";
  const identity = JSON.parse(process.env.TASK432_SOURCE_IDENTITY);
  if (JSON.stringify(snapshot(process.cwd())) !== JSON.stringify(identity)) throw Error("Source changed before provisioning");
  const fd = fs.openSync(process.env.TASK379_ARTIFACT_DIR + "/api-identity.json", "wx", 0o400);
  try { fs.writeFileSync(fd, JSON.stringify(identity) + "\n"); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
'

"$pgbin/initdb" -D "$owned_run/pg" \
  -L "$runtime_root/usr/share/postgresql/18" --auth=trust \
  --username=tixmo379 --encoding=UTF8 --no-locale > "$owned_run/initdb.log"
"$pgbin/pg_ctl" -D "$owned_run/pg" -l "$owned_run/postgres.log" \
  -o "-h 127.0.0.1 -p $pgport -k $owned_run -c max_connections=130 -c statement_timeout=5000 -c lock_timeout=5000" -w -t 10 start
pg_pid=$(head -n 1 "$owned_run/pg/postmaster.pid")
test "$(readlink -f "/proc/$pg_pid/exe")" = "$(readlink -f "$pgbin/postgres")"
# Foreground mode gives the shell an exact unreaped child PID. No daemonize race.
"$runtime_root/usr/bin/redis-server" --bind 127.0.0.1 --port "$redisport" \
  --save '' --appendonly no --daemonize no --dir "$owned_run" \
  --pidfile "$owned_run/redis.pid" --logfile "$owned_run/redis.log" \
  --unixsocket "$owned_run/redis.sock" --unixsocketperm 700 &
redis_pid=$!
redis_ready=0
for attempt in {1..30}; do
  kill -0 "$redis_pid" 2>/dev/null || break
  if test -S "$owned_run/redis.sock" &&
    test "$("$runtime_root/usr/bin/redis-cli" -s "$owned_run/redis.sock" ping)" = PONG; then
    redis_ready=1
    break
  fi
  sleep 0.1
done
test "$redis_ready" = 1
info_pid=$("$runtime_root/usr/bin/redis-cli" -s "$owned_run/redis.sock" info server |
  tr -d '\r' | sed -n 's/^process_id://p')
test "$info_pid" = "$redis_pid"
test "$(readlink -f "/proc/$redis_pid/exe")" = \
  "$(readlink -f "$runtime_root/usr/bin/redis-server")"
# Fail closed unless each exact PID owns its requested loopback TCP listener.
# No TCP probe or database access is allowed before these assertions.
for pair in "$pgport:$pg_pid" "$redisport:$redis_pid"; do
  port=${pair%:*}; pid=${pair#*:}
  listener=$(ss -H -ltnp "sport = :$port")
  test "$(printf '%s\n' "$listener" | wc -l)" = 1
  printf '%s\n' "$listener" | rg -q "127\.0\.0\.1:$port .*pid=$pid,"
done
"$pgbin/createdb" -h 127.0.0.1 -p "$pgport" -U tixmo379 tixmo_disposable_379
"$pgbin/psql" -h 127.0.0.1 -p "$pgport" -U tixmo379 \
  -d tixmo_disposable_379 -Atc \
  'select current_database(), current_user, inet_server_addr(), inet_server_port();'
"$runtime_root/usr/bin/redis-cli" -h 127.0.0.1 -p "$redisport" -n 1 ping
DATABASE_URL="postgresql://tixmo379@127.0.0.1:$pgport/tixmo_disposable_379" \
REDIS_URL="redis://127.0.0.1:$redisport/1" TIXMO_ALLOW_DESTRUCTIVE_TESTS=1 \
node -e 'require("./scripts/verification-safety.cjs").validateVerificationTargets(process.env)'
export DATABASE_URL="postgresql://tixmo379@127.0.0.1:$pgport/tixmo_disposable_379" REDIS_URL="redis://127.0.0.1:$redisport/1" TIXMO_ALLOW_DESTRUCTIVE_TESTS=1 NODE_ENV=test
export STRIPE_SECRET_KEY=sk_test_verify_api STRIPE_PUBLISHABLE_KEY=pk_test_verify_api STRIPE_WEBHOOK_SECRET=whsec_verify_api
export JWT_SECRET=task379-synthetic-jwt-fixture-not-a-real-credential JWT_REFRESH_SECRET=task379-synthetic-refresh-fixture-not-a-real-credential SESSION_SECRET=task379-synthetic-session-fixture-not-a-real-credential
echo "TASK379_RUNTIME path=$owned_run pg_pid=$pg_pid redis_pid=$redis_pid pgport=$pgport redisport=$redisport"
artifact_dir="$owned_run"
export PAYMENT_CURRENCY=cad REDIS_DB=1 npm_config_offline=true npm_config_yes=false
export TASK379_ALLOWED_PORTS="$pgport,$redisport"
export TASK427_BLOCK_LOG="$owned_run/blocked-network.jsonl"
export NODE_OPTIONS="--require=$PWD/docs/team/evidence/task-427/network-guard.cjs"
test -x tixmoapi2/node_modules/.bin/prisma
test -x tixmoapi2/node_modules/.bin/jest
export TMPDIR="$owned_run"
# Full unfiltered verifyApi build/migrate/schema/Jest sequence. No path filters.
export JWT_EXPIRES_IN=7d JWT_REFRESH_EXPIRES_IN=30d CHECKPOINT_DISABLE=1 PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
jest_attempted=1
timeout --signal=TERM --kill-after=5s 360s node "$PWD/docs/team/evidence/task-427/run-gate.mjs" > "$artifact_dir/acceptance.log" 2>&1
