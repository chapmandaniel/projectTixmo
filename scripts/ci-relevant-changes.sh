#!/usr/bin/env bash
# Decide whether a required GitHub Actions job should run its full suite.
# Always writes relevant=true|false to GITHUB_OUTPUT so the job itself can
# succeed quickly instead of being skipped at the workflow/job level.
set -euo pipefail

usage() {
  echo "usage: $0 <git-pathspec> [<git-pathspec> ...]" >&2
  exit 1
}

write_output() {
  local line="$1"
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    printf '%s\n' "$line" >> "$GITHUB_OUTPUT"
  fi
}

if (( $# < 1 )); then
  usage
fi

event="${GITHUB_EVENT_NAME:-}"
if [[ "$event" != "pull_request" ]]; then
  echo "Full coverage: event=${event:-unset} (not a pull_request)"
  write_output "relevant=true"
  exit 0
fi

if [[ -z "${BASE_SHA:-}" || -z "${HEAD_SHA:-}" ]]; then
  echo "pull_request requires BASE_SHA and HEAD_SHA" >&2
  exit 1
fi

ensure_commit() {
  local sha="$1"
  if git cat-file -e "${sha}^{commit}" 2>/dev/null; then
    return 0
  fi
  git fetch --no-tags --depth=1 origin "$sha" \
    || git fetch --no-tags origin "$sha"
}

ensure_commit "$BASE_SHA"
ensure_commit "$HEAD_SHA"

mapfile -t changed < <(git diff --name-only "$BASE_SHA" "$HEAD_SHA" -- "$@")

if ((${#changed[@]} > 0)); then
  echo "Relevant changes:"
  printf '  %s\n' "${changed[@]}"
  write_output "relevant=true"
else
  echo "skipped: no relevant changes"
  write_output "relevant=false"
fi
