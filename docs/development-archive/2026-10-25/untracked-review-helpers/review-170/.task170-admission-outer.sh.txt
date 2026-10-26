set -euo pipefail
cp tixmoapi2/src/api/payments/service.ts .task170-admission-disabled-source
restore() {
  rc=$?
  trap - EXIT
  cp .task170-admission-disabled-source tixmoapi2/src/api/payments/service.ts
  cmp .task170-admission-disabled-source tixmoapi2/src/api/payments/service.ts || exit 99
  timeout --signal=TERM --kill-after=5s 40s npm --prefix tixmoapi2 run build > .task170-admission-disabled-build.log 2>&1 || exit 98
  echo "SOURCE_RESTORED status=$rc"
  exit "$rc"
}
trap restore EXIT
python3 - <<'ACTIVATE'
from pathlib import Path
p=Path('tixmoapi2/src/api/payments/service.ts');s=p.read_text()
a='const EXPIRED_WEBHOOK_RECOVERY_ENABLED = false;'
assert s.count(a)==1
p.write_text(s.replace(a,'const EXPIRED_WEBHOOK_RECOVERY_ENABLED = true;'))
ACTIVATE
export TIXMO_EXPERIMENTAL_RECOVERY=1
bash .task170-admission-runtime.sh
