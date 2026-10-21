#!/usr/bin/env bash
set -euo pipefail
# Run from this worktree's repository root. No inherited credentials or DB URL.
evidence="$PWD/docs/team/evidence/task-321"
if test -e "$evidence/blocked-network.jsonl"; then
  echo 'Prior network denial exists; inspect it before another run.' >&2
  exit 1
fi
env -i HOME=/home/daniel PATH=/home/daniel/.nvm/versions/node/v24.21.0/bin:/usr/bin:/bin \
  NODE_ENV=test TASK321_BLOCK_LOG="$evidence/blocked-network.jsonl" \
  NODE_OPTIONS="--require=$evidence/network-guard.cjs" \
  node tixmoapi2/node_modules/jest/bin/jest.js \
  --config docs/team/evidence/task-321/jest.config.cjs --runInBand \
  --runTestsByPath tixmoapi2/tests/benchmark/event_cache.benchmark.test.ts \
  tixmoapi2/tests/unit/api/events-public.service.test.ts \
  --json --outputFile=docs/team/evidence/task-321/jest-result.json \
  > docs/team/evidence/task-321/jest.log 2>&1
# A caught network denial is still a failed verification lane.
test ! -e "$evidence/blocked-network.jsonl"
