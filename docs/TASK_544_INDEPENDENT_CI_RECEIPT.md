# Task 544 independent CI receipt

Observed 2026-10-22 04:47-04:48 UTC by tixmo-qa, independently of release task 543. This supersedes the earlier pending-only board receipt for terminal attempts below. Read-only GitHub API and `gh run view --attempt N --log` were used. No CI reruns, source repairs, runtime execution, dependency installation, or integration changes were made.

## PR 73: product failure, not accepted

- Exact head: `dd15dc14369e54c67bd8f4d6a81e7ae0e7d4fb6c`.
- Run `39710697267`, actual recovered attempt **3**, job [119643497196](https://github.com/chapmandaniel/projectTixmo/actions/runs/39710697267/job/119643497196).
- Terminal run conclusion: **failure**.
- Both dependency audit stages reported `found 0 vulnerabilities`.
- Actual terminal log at `2026-10-22T04:47:50.7223141Z`: `[verify:api] API tests failed (child output suppressed). Failed tests: 1; suites: order-double-cancel.race.test.ts.`
- API verification exited 1; full-market gate exited 1. Downstream dashboard stages did not establish acceptance.
- Exact failed assertion and total API test counts are unavailable: the workflow explicitly suppresses child output. No assertion is inferred from source or historical logs.
- Product failure immediately reported to PM; no retry, workaround, or repair attempted.

## PR 74: terminal hosted full-market success

- Exact head: `c9c9e7f354a72c49f6885e4df31b8713d34065fe`.
- Run `39712411270`, actual recovered attempt **2**, job [119643502358](https://github.com/chapmandaniel/projectTixmo/actions/runs/39712411270/job/119643502358).
- Terminal run/job conclusion: **success**; all actual job steps including Stop containers and Complete job succeeded.
- Both actual dependency audit stages reported `found 0 vulnerabilities`.
- Tooling safety tests: 2 passed; development safety tests: 4 passed; root verification safety tests: 47 passed; zero failures in these summaries.
- API build and verification succeeded; actual log: `[verify:api] API verification passed.` API child assertion counts are not exposed, so no total API count is invented.
- API lint, dashboard tests, design guard, dashboard build, and root/status/external helper syntax stages completed before actual terminal `[verify:market] Market readiness local gates passed.` at `2026-10-22T04:47:09.2899000Z`.
- Dashboard: **38 files / 287 tests passed**. Design guard: **924 tracked baseline violations, no regressions**.
- Actual cleanup log removes both PostgreSQL and Redis service containers and the job container network; Stop containers step succeeded.
- This is scoped hosted CI evidence, not browser/live-environment, launch, merge, or deployment approval.

## PR 75: terminal populated-upgrade and full-market success

- Exact head: `a5da21936f4e0c730cab448610d9ecc75d2ef398`.
- Run `39712412966`, actual recovered attempt **2**, job [119643506073](https://github.com/chapmandaniel/projectTixmo/actions/runs/39712412966/job/119643506073).
- Final single reconciliation: run/job **completed success**, full-market and Stop containers steps succeeded.
- Actual upgrade log at `2026-10-22T04:44:20.2750640Z`: `Populated upgrade passed: transfer revocation, tier limits, ambiguous-history gate, historical currency, receipt safety, legacy webhook generation and additive unpaused event/audit upgrade.`
- This completed execution of the exact-head verifier includes its uncaught `assert.deepEqual(upgradedEvent, { ...existingEvent, salesPaused: false })` and `assert.equal(await prisma.eventSalesControl.count(), 0, 'Upgrade must not fabricate pause audit history')` assertions (lines 67-68). The log is the actual completion evidence; source mapping identifies what ran, not a substitute pass. Individual SQL assertion counts are not separately printed.
- Both actual dependency audit stages reported zero vulnerabilities; API build, API verification and lint passed. Dashboard **40 files / 296 tests passed**; design guard **924 tracked baseline violations, no regressions**. Dashboard build and root/status/external helper syntax completed.
- Actual terminal `[verify:market] Market readiness local gates passed.` at `2026-10-22T04:48:00.9698700Z`.
- Actual cleanup log removes PostgreSQL and Redis service containers and the job network; Stop containers succeeded. No live/browser or launch approval is inferred.

## Disposition

Overall **not accepted**: PR 73 has a current product failure. PR 74 and PR 75 have scoped terminal hosted-CI success. Existing source approvals do not substitute for runtime evidence; no definitive failure cause is inferred from suppressed PR 73 output. PM retains task closure and integration ownership; default-branch merge remains prohibited.
