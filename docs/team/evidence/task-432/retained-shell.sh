#!/usr/bin/env bash
# Inert, unconnected SOURCE/OFFLINE checkpoint. No acquisition or admission.
# Caller supplies the existing427 owned variables; definitions stay in a subshell.
# A future real caller must admit native enforcement/provenance BEFORE provisioning.
retain_owned_shell() (
  source "$PWD/docs/team/evidence/task-427/owned-lifecycle.sh"
  trap cleanup EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  # Install cleanup before validating even partial startup; never signal foreigners.
  test -n "$pg_pid" && test -n "$redis_pid" || exit 72
  for pair in "pg:$pg_pid" "redis:$redis_pid"; do
    kind=${pair%%:*}; pid=${pair#*:}
    alive "$pid" && owned_identity "$kind" "$pid" || exit 72
  done
  # This is shell/service identity, NOT native admission or a runtime grant.
  for pair in "$pgport:$pg_pid" "$redisport:$redis_pid"; do
    port=${pair%:*}; pid=${pair#*:}
    listener=$(ss -H -ltnp "sport = :$port") || exit 72
    test "$(printf '%s\n' "$listener" | wc -l)" = 1 || exit 72
    printf '%s\n' "$listener" | rg -q "127\.0\.0\.1:$port .*pid=$pid," || exit 72
  done
  printf 'TASK432_SHELL_HELD\n'
  # Keep the owning shell and its traps alive. No command evaluation or children.
  # EOF/unknown input fails closed. Exactly one close is consumed; EXIT cleans once.
  IFS= read -r request || exit 74
  test "$request" = close || exit 74
  exit 0
)
