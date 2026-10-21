#!/usr/bin/env bash
# Inert definitions only; sourced by runtime.sh after its existing preflight.
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
  if test "$jest_attempted" = 1; then
    node "$PWD/docs/team/evidence/task-393/process-cleanup.cjs" "$owned_run" || cleanup_failed=1
  fi
  if test "$cleanup_failed" -ne 0; then
    echo "Owned-runtime cleanup FAILED; inspect $owned_run; do not run another gate" >&2
    exit 1
  fi
  listeners=$(ss -H -ltnp "sport = :$pgport or sport = :$redisport")
  observer_status=$?
  if test "$observer_status" -ne 0; then
    echo "Owned-runtime cleanup listener observation FAILED status=$observer_status; inspect $owned_run" >&2
    exit 1
  fi
  printf '%s\n' "$listeners"
  test -z "$listeners" || exit 1
  test ! -e "$owned_run/pg/postmaster.pid" || exit 1
  test ! -S "$owned_run/.s.PGSQL.$pgport" || exit 1
  if { test -n "$pg_pid" && alive "$pg_pid"; } || { test -n "$redis_pid" && alive "$redis_pid"; }; then exit 1; fi
  echo "TASK379_CLEANUP pg_pid=$pg_pid redis_pid=$redis_pid pgport=$pgport redisport=$redisport"
  exit "$original_status"
}
