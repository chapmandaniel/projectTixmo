# Task143 admission acceptance checkpoint

2026-10-20 tixmo-backend. Test/evidence ONLY over bf7770c904b22ccdcb28bd0a5a122588857d9e66, existing isolated branch tixmo/task-143-fenced-processing-recovery / worktrees/task-143. Recovery remains DISABLED;143 OPEN;release NO-GO. Exact new-SHA independent lead AND QA required. Existing-row migration-preservation observation remains outstanding, so this is NOT full139 closure.

## Changed tests

New sequential private admission fixture replays one genuine PostgreSQL clock sample across two successful FAILED admissions, fixture-restoring eligible status between them. Tokens must match actual stored generations and durable generation must strictly increase (8 then9). Not signed public contention. Existing four-case private contender test now logs full successor/after-loser rows and affected counts, asserting counts and row equality BEFORE returned loser token. Both reversed winners for FAILED and expired PROCESSING retained. No new after-protected-read schedule.

## Actual commands and outcomes

`bash .task143-admission-outer.sh > .task143-admission-runtime.log 2>&1`, exit0. Fresh full141 guarded disk runtime, target validation, new27 migrations (migrate deploy exit0). Temporary activation only; outer trap byte-restores disabled source and builds it even on failure.

- Controls `npm --prefix tixmoapi2 test -- --cacheDirectory "$owned_run/jest-cache" --runInBand --runTestsByPath tests/integration/payment-expired-candidate.test.ts tests/integration/payment-sequential-generation.test.ts tests/integration/payment-competing-claims.test.ts`:3suites7/7. Actual `.task143-admission-controls.log`.
- (a) same command with only expired-candidate fixture:1failed1passed; signed ancient durable attempt generation Expected1 Received0, full target/otherbuyer/tickets/inventory/event snapshots retained in `.task143-admission-mutant-a.log`. Fresh control remains no-op. No skip/timeout/compile failure accepted.
- (d) only sequential fixture:1failed. Returned tokens AND durable generations both7 then7, identical actual clock sample, strict-increase assertion Expectedtrue Receivedfalse; `.task143-admission-mutant-d.log`.
- Initial (e) four failures hit returned token before durable assertions: explicitly EXCLUDED as qualifying evidence. `.task143-admission-mutant-e.log`. Test was strengthened, not weakened, before final consolidated gate.
- Restored consolidated command is retained literally in `.task143-admission-runtime.sh` (18 prior relevant paths plus sequential fixture);19suites82/82,30.720s, `.task143-admission-regression.log`. Includes ownership/distinctfailure/prelock/cutoff/ABA/competing/failedsuccessor/ancient/successor/fenced/failedretry/distinctsuccess/signature/recovery/tenant/three order races. Enabled build0, disabled byte-restoration/build0; actual enabled/disabled-build logs.

`bash .task143-admission-e-outer.sh > .task143-admission-e-runtime.log 2>&1`, exit0. Separate fresh full141 runtime and27 migrations; no concurrent source mutation/regression.

- Qualifying (e), only competing fixture:4durable failures; `.task143-admission-mutant-e-durable.log`. Each real affected count[1,1] instead of[1,0]/[0,1]; full after-loser row generation9 vs successor8; SAME genuine sampled processingStartedAt. Captured JSON in `task-143-admission-cas-mutant-snapshots.json`. Each failure reaches count assertion BEFORE token assertion, no timeout/compile/skip.
- Candidate bytes restored; focused competing4/4,4.330s `.task143-admission-e-restored.log`. Final disabled-source cmp0, source diff empty, final disabled build0. Source matches original committed HEAD bytes. Both helpers bound test subprocesses60s, kill-after5s; migrate30s/build40s. Runtime drain/cleanup guards unchanged.

Initial attempt (a) false&& expression caused TS18047 and0tests: NOT mutation evidence. `.task143-admission-initial-compile-only.log` and initial-runtime.log preserved; full cleanup/restoration succeeded. One bounded repair replaced the flag itself, avoiding unreachable-expression narrowing. Final qualifying logs above supersede that excluded attempt.

## Runtime ownership and cleanup

All new bulky dirs mode0700 disk-backed under `/home/daniel/.openclaw/workspace/tixmo-pm/runtime/`. Full141 UID/executable/datadir/direct-child/loopback/listener/readiness/target/deadline/bounded-stop guards preserved. Never used inherited DB/services. Initial `task143admission.UnOQOC`: PG1200467 Redis1200480 ports26748/42612. Successful bundle `task143admission.qk2nq6`: PG1201727 Redis1201740 ports27417/58855. Qualifying e `task143admission.3A8Bkv`: PG1205253 Redis1205266 ports30337/44520. Every helper reported cleanup success; final `ps -p` six PIDs empty and `ss -H -ltnp` all six ports empty. Existing artifacts/logs preserved. No production/default merge/config/scheduler/spend/secrets/external actions.

## Exact temporary mutant diffs

### a

```diff
--- .task143-admission-enabled-source	2026-10-20 05:54:09.312174862 -0230
+++ tixmoapi2/src/api/payments/service.ts	2026-10-20 05:54:09.334630040 -0230
@@ -11,7 +11,7 @@
 class WebhookOwnershipLost extends Error {}
 class PaymentIntentMismatch extends Error {}
 // Deliberately disabled until task143 deterministic recovery acceptance is complete.
-const EXPIRED_WEBHOOK_RECOVERY_ENABLED = true;
+const EXPIRED_WEBHOOK_RECOVERY_ENABLED = false;
 
 const getPaymentIntentContext = (event: Stripe.Event) => {
   const value = event.data.object as Partial<Stripe.PaymentIntent>;
```

### d

```diff
--- .task143-admission-enabled-source	2026-10-20 05:54:09.312174862 -0230
+++ tixmoapi2/src/api/payments/service.ts	2026-10-20 05:54:14.430474764 -0230
@@ -178,10 +178,10 @@
             OR: [{ status: 'FAILED' }, ...(EXPIRED_WEBHOOK_RECOVERY_ENABLED
               ? [{ status: 'PROCESSING', processingStartedAt: { lte: cutoff } }] : [])],
           },
-          data: { status: 'PROCESSING', attemptGeneration: { increment: 1 },
+          data: { status: 'PROCESSING', attemptGeneration: { increment: 0 },
             processingStartedAt: now, processedAt: null, errorMessage: null },
         });
-        return admitted.count === 1 ? { eventId: event.id, generation: existing.attemptGeneration + 1n } : null;
+        return admitted.count === 1 ? { eventId: event.id, generation: existing.attemptGeneration } : null;
       }
       await prisma.paymentWebhookEvent.create({ data: {
         id: event.id, type: event.type, paymentIntentId: context.paymentIntentId || null,
```

### e

```diff
--- .task143-admission-enabled-source	2026-10-20 05:54:09.312174862 -0230
+++ tixmoapi2/src/api/payments/service.ts	2026-10-20 05:54:19.298124342 -0230
@@ -174,9 +174,7 @@
         if (existing.attemptGeneration === 9223372036854775807n) return null;
         const admitted = await prisma.paymentWebhookEvent.updateMany({
           where: {
-            id: event.id, attemptGeneration: existing.attemptGeneration,
-            OR: [{ status: 'FAILED' }, ...(EXPIRED_WEBHOOK_RECOVERY_ENABLED
-              ? [{ status: 'PROCESSING', processingStartedAt: { lte: cutoff } }] : [])],
+            id: event.id,
           },
           data: { status: 'PROCESSING', attemptGeneration: { increment: 1 },
             processingStartedAt: now, processedAt: null, errorMessage: null },
```
