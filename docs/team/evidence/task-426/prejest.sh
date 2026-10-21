#!/bin/bash
# Source/offline checkpoint only. No services, application imports or Jest.
# No caller-controlled scrubbed marker: every invocation discards ambient env.
set -eu
entry_dir=$(CDPATH= cd -- "${0%/*}" && pwd -P)
preload=0
if test -n "${NODE_OPTIONS:-}${NODE_PATH:-}${LD_PRELOAD:-}"; then preload=1; fi
exec /usr/bin/env -i \
  HOME=/home/daniel PATH=/home/daniel/.nvm/versions/node/v24.21.0/bin:/usr/bin:/bin \
  TASK426_PM_RUNTIME_GRANT="${TASK426_PM_RUNTIME_GRANT:-}" \
  TASK426_REJECT_PRELOAD="$preload" \
  TASK426_EXPECTED_SHA="${TASK426_EXPECTED_SHA:-}" \
  TASK426_DEPENDENCY_ROOT="${TASK426_DEPENDENCY_ROOT:-}" \
  TASK426_ARTIFACT_DIR="${TASK426_ARTIFACT_DIR:-}" \
  TASK379_ALLOWED_PORTS="${TASK379_ALLOWED_PORTS:-}" \
  /home/daniel/.nvm/versions/node/v24.21.0/bin/node "$entry_dir/prejest.cjs"
