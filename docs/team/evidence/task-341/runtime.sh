# PREPARATION ONLY. PM must explicitly grant sole DB ownership before this marker is supplied.
if test "${TASK341_SOLE_DB_GRANTED:-}" != 1; then
  echo 'No explicit sole DB grant supplied; no services started' >&2
  exit 64
fi
# Always discard inherited credentials before importing tools or application code.
if test "${TASK341_SCRUBBED:-}" != 1; then
  exec env -i HOME=/home/daniel PATH="/home/daniel/.nvm/versions/node/v24.21.0/bin:/usr/bin:/bin" TASK341_SCRUBBED=1 TASK341_SOLE_DB_GRANTED=1 bash "$0"
fi
set -euo pipefail
umask 077
runtime_root="/home/daniel/projects/projectTixmo/worktrees/task-57/.local-runtime-57/root"
export LD_LIBRARY_PATH="$runtime_root/usr/lib/x86_64-linux-gnu"
pgbin="$runtime_root/usr/lib/postgresql/18/bin"
task_root=/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task341
mkdir -p -m 700 "$task_root"
chmod 700 "$task_root"
owned_run=$(mktemp -d "$task_root/run.XXXXXX")
pgport=$(shuf -i 20000-39999 -n 1)
redisport=$(shuf -i 40000-59999 -n 1)
redis_pid=''
pg_pid=''
alive() {
  test -r "/proc/$1/stat" || return 1
  # A zombie is stopped and cannot retain listeners; its parent reaps it.
  case "$(ps -o stat= -p "$1")" in Z*|'') return 1;; esac
  kill -0 "$1" 2>/dev/null
}
owned_identity() {
  kind=$1; pid=$2
  test "$(stat -c %u "/proc/$pid" 2>/dev/null)" = "$(id -u)" || return 1
  if test "$kind" = pg; then
    test "$(head -n 1 "$owned_run/pg/postmaster.pid" 2>/dev/null)" = "$pid" || return 1
    test "$(readlink -f "/proc/$pid/exe")" = "$(readlink -f "$pgbin/postgres")" || return 1
    tr '\0' '\n' < "/proc/$pid/cmdline" | grep -Fxq -- "$owned_run/pg"
  else
    # Unreaped direct child PID cannot be recycled before wait.
    test "$pid" = "$redis_pid" || return 1
    test "$(ps -o ppid= -p "$pid" | tr -d ' ')" = "$$" || return 1
    test "$(readlink -f "/proc/$pid/exe")" = \
      "$(readlink -f "$runtime_root/usr/bin/redis-server")"
  fi
}
stop_exact() {
  kind=$1; pid=$2
  test -n "$pid" || return 0
  alive "$pid" || return 0
  for signal in TERM KILL; do
    owned_identity "$kind" "$pid" || return 1
    kill -"$signal" "$pid" 2>/dev/null || return 1
    for poll in {1..20}; do
      alive "$pid" || return 0
      sleep 0.1
    done
  done
  return 1 # bounded deadline expired; report leftovers, never hang in wait
}
cleanup() {
  original_status=$?
  trap - EXIT INT TERM
  set +e # All failures are collected; neither service may skip the other.
  cleanup_failed=0
  if test -z "$pg_pid" && test -f "$owned_run/pg/postmaster.pid"; then
    pg_pid=$(head -n 1 "$owned_run/pg/postmaster.pid")
  fi
  if test -n "$pg_pid" && alive "$pg_pid"; then
    if owned_identity pg "$pg_pid"; then
      "$pgbin/pg_ctl" -D "$owned_run/pg" -m fast -w -t 5 stop || cleanup_failed=1
      stop_exact pg "$pg_pid" || cleanup_failed=1
    else cleanup_failed=1; fi
  fi
  stop_exact redis "$redis_pid" || cleanup_failed=1
  # wait only after observed stopped/zombie; never wait for a live process.
  if test -n "$redis_pid" && ! alive "$redis_pid"; then
    wait "$redis_pid" >/dev/null 2>&1
  fi
  if test "$cleanup_failed" -ne 0; then
    echo "Owned-runtime cleanup FAILED; inspect $owned_run; do not run another gate" >&2
    exit 1
  fi
  echo "TASK341_CLEANUP pg_pid=$pg_pid redis_pid=$redis_pid pgport=$pgport redisport=$redisport"
  ss -H -ltnp "sport = :$pgport or sport = :$redisport"
  if { test -n "$pg_pid" && alive "$pg_pid"; } || { test -n "$redis_pid" && alive "$redis_pid"; }; then exit 1; fi
  exit "$original_status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
"$pgbin/initdb" -D "$owned_run/pg" \
  -L "$runtime_root/usr/share/postgresql/18" --auth=trust \
  --username=tixmo341 --encoding=UTF8 --no-locale > "$owned_run/initdb.log"
"$pgbin/pg_ctl" -D "$owned_run/pg" -l "$owned_run/postgres.log" \
  -o "-h 127.0.0.1 -p $pgport -k $owned_run" -w -t 10 start
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
"$pgbin/createdb" -h 127.0.0.1 -p "$pgport" -U tixmo341 tixmo_disposable_341
"$pgbin/psql" -h 127.0.0.1 -p "$pgport" -U tixmo341 \
  -d tixmo_disposable_341 -Atc \
  'select current_database(), current_user, inet_server_addr(), inet_server_port();'
"$runtime_root/usr/bin/redis-cli" -h 127.0.0.1 -p "$redisport" -n 1 ping
DATABASE_URL="postgresql://tixmo341@127.0.0.1:$pgport/tixmo_disposable_341" \
REDIS_URL="redis://127.0.0.1:$redisport/1" TIXMO_ALLOW_DESTRUCTIVE_TESTS=1 \
node -e 'require("./scripts/verification-safety.cjs").validateVerificationTargets(process.env)'
export DATABASE_URL="postgresql://tixmo341@127.0.0.1:$pgport/tixmo_disposable_341" REDIS_URL="redis://127.0.0.1:$redisport/1" TIXMO_ALLOW_DESTRUCTIVE_TESTS=1 REDIS_DB=1 NODE_ENV=test
export STRIPE_SECRET_KEY=sk_test_verify_api STRIPE_PUBLISHABLE_KEY=pk_test_verify_api STRIPE_WEBHOOK_SECRET=whsec_verify_api
export JWT_EXPIRES_IN=7d JWT_REFRESH_EXPIRES_IN=30d
export JWT_SECRET=task341-synthetic-jwt-fixture-not-a-real-credential JWT_REFRESH_SECRET=task341-synthetic-refresh-fixture-not-a-real-credential SESSION_SECRET=task341-synthetic-session-fixture-not-a-real-credential
echo "TASK341_RUNTIME path=$owned_run pg_pid=$pg_pid redis_pid=$redis_pid pgport=$pgport redisport=$redisport"
artifact_dir="$PWD/docs/team/evidence/task-341"
export TMPDIR="$owned_run" NODE_OPTIONS="--require=$artifact_dir/network-guard.cjs" TASK341_BLOCK_LOG="$artifact_dir/blocked-network.jsonl"
export PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 CHECKPOINT_DISABLE=1
node -v
npm -v
sha256sum tixmoapi2/package-lock.json tixmoapi2/prisma/schema.prisma tixmoapi2/node_modules/.prisma/client/libquery_engine* > "$artifact_dir/provenance.sha256"
timeout --signal=TERM --kill-after=5s 180s node tixmoapi2/node_modules/jest/bin/jest.js --config tixmoapi2/jest.config.js --runInBand --runTestsByPath tixmoapi2/tests/integration/event-cancel-reentry.race.test.ts --json --outputFile="$artifact_dir/jest-result.json" > "$artifact_dir/jest.log" 2>&1
if test -s "$TASK341_BLOCK_LOG"; then echo 'Blocked network attempt: FAIL'; exit 1; fi
