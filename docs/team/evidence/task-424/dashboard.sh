#!/bin/bash
set -u
for check in test guard build; do
 case "$check" in
 test) args=(test -- --run --reporter=default --reporter=json --outputFile.json=../docs/team/evidence/task-424/vitest.json);;
 guard) args=(run design:guard);;
 build) args=(run build);;
 esac
 env -i PATH=/home/daniel/.nvm/versions/node/v24.21.0/bin:/usr/bin:/bin HOME=/home/daniel NODE_OPTIONS="--require=$PWD/docs/team/evidence/task-424/network-guard.cjs" TASK424_BLOCK_LOG="$PWD/docs/team/evidence/task-424/dashboard-blocked-network.jsonl" timeout --signal=TERM --kill-after=5s 70s npm --prefix tdash "${args[@]}" > "docs/team/evidence/task-424/dashboard-$check.log" 2>&1
 echo "$?" > "docs/team/evidence/task-424/dashboard-$check.exit"
done
unlink tdash/node_modules
