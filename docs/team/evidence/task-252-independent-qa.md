# #252 — independent bounded QA

2026-10-21, tixmo-qa. Local source/mock checks only. Release **NO-GO** remains.

## #238: PASS for bounded sale-window implementation

- Exact reviewed SHA: `0b4e30dccbc77d1213ca4f14ff34982f17c1d42c`.
- Base: `317754edc7b43eb8e27b60c5374679330326c575`.
- Isolated review branch/worktree: `tixmo/task-252-sale-review`,
  `/home/daniel/projects/projectTixmo/worktrees/task-252-sale-review`.
- Inspected all four changed files, nullable Prisma timestamps, transaction
  clock placement, event/ticket half-open intersection, event lifecycle/start
  cutoff and unchanged aggregate-cap/tenant regressions. Product diff adds only
  two event-window guards; no independent blocking finding in this slice.
- Actual command from review `tixmoapi2`:

  ```sh
  env -i PATH=/home/daniel/.nvm/versions/node/v24.21.0/bin:/usr/bin:/bin NODE_ENV=test TZ=America/St_Johns node node_modules/jest/bin/jest.js --config jest.sale-windows.config.cjs --runInBand
  ```

  Exit 0: 3 suites / 58 tests passed (24 sale-window, 4 cap, 30 tenant).
  Dependencies reused via an untracked node_modules symlink to task-235;
  no install or normal database-mutating Jest bootstrap.
- `git diff 317754edc7b43eb8e27b60c5374679330326c575 HEAD --check`: exit 0.
- Limits: mocked persistence, not database locking/races/rollback, HTTP/auth
  middleware, timezone editor or browser clock/countdown behavior. Existing
  holds/confirmation and commit-time cutoff are explicitly outside this fix.
  This is not full W01 or candidate acceptance. Nonauthor lead contract review
  remains independently required.

## #243: PASS for LOCAL PREPARATION packet only

- Exact reviewed SHA: `f82b26c0e741c4ee8e051e4582fb08dbc1cbd324`.
- Exact parent/base: `317754edc7b43eb8e27b60c5374679330326c575`.
- Isolated review branch/worktree: `tixmo/task-252-packet-review`,
  `/home/daniel/projects/projectTixmo/worktrees/task-252-packet-review`.
- Actual Python assertions/Git queries: 17 relative links exist; parent and
  its two documented parents match; only the packet is added; 31 tracked
  migration.sql files, four added versus `0d193a6`; #236 commit is not an
  ancestor (expected merge-base exit 1). All assertions passed, exit 0.
- `git diff HEAD^ HEAD --check`: exit 0. Source spot checks confirm pinned
  Node/nonroot migration startup, DB/Redis `/ready` 503 behavior and documented
  account/session, transferred QR, currency and webhook generation hazards.
- Distinguishes source and historical evidence from current deployed identity,
  target configuration and migration state, all still unverified. No blocking
  finding for this local documentation checkpoint; not full W06 acceptance.
- Nonblocking next-revision improvement: include actual proxy identifier
  `BB250-20261021-LOCAL-ONSALE` directly. This review read that recorded decision:
  synthetic CAD is not actual charge/settlement/payout currency; tax, fees,
  payout responsibility and refund entitlement remain unresolved, not zero.
  No assisted recovery privilege or financial action is authorized. Preserve
  policy #73, #61 including later Railway factual corrections, missing named
  participants and independent exact-candidate QA/technical acceptance.

## Handoff and limits

Separate verdicts are on original tasks #238 and #243; neither author claim
was taken. #231 remains integration owner; #235/#236 acceptance is separate.
This report changes no product files. No environment/secret reads, services,
database/provider calls, HTTP/platform requests, full-market/build gates,
config changes, deployment, push, merge, publication or spend occurred.
Zero financial exposure. No full W01/W06 closure or commercial policy selection.
