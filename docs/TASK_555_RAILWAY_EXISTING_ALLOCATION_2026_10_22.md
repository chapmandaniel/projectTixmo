# Task555: existing-account allocation and release metadata receipt

2026-10-22; tixmo-release; isolated task-555 baseline dafe27e6; authority actual conditional BB231-20261022-SPLIT-73-74. **Financial prerequisite NOT ESTABLISHED.** This is read-only evidence, not a deployment/budget grant. Parent231 separately owns fresh TLS ledger gate; no DB/network/HTTP probe duplicated here.

## Method and bounds

Inspected existing `npx --no-install @railway/cli api --help`, `api search billing`, `api describe` relevant schema types, then public GraphQL introspection schema. No install/download command, mutation, config read/change, plan/scale, credential/payment identity read, namespace/storage/key probe or target HTTP/DB call. GraphQL data queries below explicitly select authorized nonsecret IDs, plan/numerics/timestamps and public domain relationships; stdout/stderr captured in-process and raw errors suppressed on nonzero/API errors. No variables map, arbitrary DeploymentMeta, fileManifest/property map, environment/config scalar, logs or process environment read. Introspection describes fields only, not customer data. One schema-formatting helper raised TypeError on a scalar type with fields:null; metadata discovery succeeded and this was not a target failure.

Existing-account data query:

```graphql
query {
  project(id: "c1c17660-3110-4fa8-a0bd-aca06d13a3ed") {
    id workspaceId subscriptionType
    workspace { id plan customer {
      currentUsage appliedCredits creditBalance remainingUsageCreditBalance
      isPrepaying isUsageSubscriber isTrialing state
      billingPeriod { start end }
      usageLimit { hardLimit softLimit isOverLimit }
      subscriptions { billingCycleAnchor status items { priceDollars quantity } }
    } }
  }
}
```

## Actual account receipt

- Actual target project `c1c17660-3110-4fa8-a0bd-aca06d13a3ed` maps workspace `dca7d601-b185-437e-ad35-d0b63169ae82` through both workspaceId and nested workspace.id.
- subscriptionType `hobby`; workspace.plan `HOBBY`; customer.state `ACTIVE`.
- Billing period start `2026-10-22T01:25:11.000Z`, end/reset `2026-11-22T01:25:11.000Z`.
- `currentUsage=0.19507444890629633`. Schema explicitly says this field is cached and may not be up to date: not an instantaneous reserved/headroom balance.
- `appliedCredits=0`, `creditBalance=0`, `remainingUsageCreditBalance=1`; report exact field/value, not invented unit/available reserved dollars or spending consent.
- isPrepaying false, isTrialing false, isUsageSubscriber true.
- `usageLimit=null`: NO customer hard/soft cap returned. This is not zero-spend enforcement.
- Subscription status active; billingCycleAnchor `2026-01-22T01:25:11.000Z`. Selected items `(priceDollars,quantity)` were `(5,1)`, `(0.000001,null)`, `(0.00000023148148,null)`, `(0.00000462962962,null)`, `(0.000000048828120000000004,null)`, `(0.00000347222221,null)`, `(0.000015,null)`. Item product/price identifiers were deliberately not selected, so do NOT assign units/product meanings to these unidentified metered numbers. The5-price quantity1 is consistent with public Hobby subscription, not extra-budget authorization.

One distinct workspace-wide `estimatedUsage` + `usage` query selecting CPU_USAGE, MEMORY_USAGE_GB, NETWORK_TX_GB, DISK_USAGE_GB returned nonzero and emitted only `query_failed_raw_errors_suppressed`; no projection/current uncached usage obtained, no raw message classified as financial state, no unchanged retry. Query timeout35s; unknown failure reason must remain unknown, not rewritten as zero usage or authorization denial.

## Public billing model and actual resource ceiling metadata

Official https://docs.railway.com/pricing/plans fetched2026-10-22 states: **“Service builds are free. Railway does not charge for build CPU, memory, base-image downloads, image exports, or image storage.”** Thus two builds plus a rollback BUILD do not themselves incur those build-resource charges. Normal deployed runtime and overlap are different: public tariff CPU$20/vCPU-month ($0.000463/vCPU-minute), memory$10/GB-month ($0.000231/GB-minute), network egress$0.05/GB and volume$0.15/GB-month. No new resources/subscription are approved here. Existing hosting expense is not a blanket unbudgeted-spend grant.

Schema-discovered explicit `serviceInstanceLimits(environmentId,serviceId)` read-only query was inspected before execution; scalar responses captured, recursively restricted to finite numeric/bool/null leaves and simple field names; all string leaves suppressed. Actual BOTH API and dashboard:

```json
{"containers":{"cpu":8,"memoryBytes":8000000000,"pidLimit":1000}}
```

These are per-container ceilings, NOT actual usage, reserved allocation or whole-release cap. `numReplicas=null` returned for each service. Do not treat null as one replica or zero. No actual rollout overlap count, build/runtime timeout cap, concurrent workload reservation, egress ceiling, rollback peak, protected remaining credit allocation or reliable complete-period projected usage established. Parent's20min terminal deployment deadline and15min observation are operator deadlines, not provider enforced billing/resource caps. Even free builds do not demonstrate all runtime consequences fit existing included credit without new/unbudgeted spend.

**Precise remaining financial input:** accountable existing workspace allocation/reservation and units proving incremental runtime/rollout-overlap/observation/at-most-one rollback, API+dashboard replicas and egress (including competing workspace consumption until reset) fit already-paid authorized headroom. Need actual bounded concurrency/replicas/overlap and accepted abort/resource envelope; `usageLimit=null`, cached usage and remainingUsageCreditBalance1 alone cannot supply that proof. No numerical budget/permission invented. Route through existing231/61/proxy, not duplicate human question or paid provisioning.

## Actual current deployment and public origin mapping

Queried `serviceInstance` for exact environment `dd8e0541-0e1d-478d-bec1-1f6bb7be1e2d` and exact API/dashboard IDs. Selected serviceId/environmentId/numReplicas, latestDeployment id/status/projectId/serviceId/environmentId/canRedeploy/canRollback; resolvedFileConfig commitHash/deploymentId/configFile/repo; domains customDomains/serviceDomains id/domain/serviceId/environmentId. No HTTP call or DNS probe.

API service `13efc131-9ae3-4305-9628-55c783286990`:

- latestDeployment `9dc4d60a-9d95-4508-8c58-8c73e37334ef`, SUCCESS, exact project/environment/service; canRedeploy true, canRollback true.
- resolved commit **`ebfbce7dc697effa8e359006c7e71bfe61ff2c6a`**, resolved deploymentId matches latest, repo chapmandaniel/projectTixmo, configFile `/tixmoapi2/railway.toml`.
- serviceDomain `c0de3bd1-ca58-4fd6-b513-5de111852c0b`: **https://backend-api-production-cbfa.up.railway.app**; exact API service/environment. customDomains empty.

Dashboard service `275c6d17-fb2a-4768-aa6a-489fa95bacc1`:

- latestDeployment `874f8350-9374-40ae-b6ff-83729cbdd860`, SUCCESS, exact project/environment/service; canRedeploy true, canRollback true.
- resolved commit **`ebfbce7dc697effa8e359006c7e71bfe61ff2c6a`**, resolved deploymentId matches latest, same repo, configFile null.
- customDomain `bab546eb-96a5-4160-983f-941f9bd12011`: **https://mightyquinton.tixmo.co**, exact dashboard service/environment.
- serviceDomain `2b41f9d6-3ce5-4617-86c8-5264816f3cf7`: **https://dash-production-589d.up.railway.app**, exact dashboard service/environment.

Mapping establishes platform-selected public origins -> exact service, not response/readiness, delivered dashboard build content, configured dashboard API-origin equality, successful code rollback or artifact retention. **Immutable deployment image digest and effective running start-command origin were NOT selected:** accessible arbitrary DeploymentMeta/fileManifest are secret-sensitive and no independently reviewed redactor for them was provided for this lane. Existing231 source/config precedence receipt remains source evidence only. Deployment ID+resolved immutable Git SHA and canRollback true are useful, not a fabricated image digest or guaranteed rollback outcome.

WAITING_ROOM_MAX_CONCURRENT_REQUESTS absent-or-valid boolean NOT checked: no independently reviewed narrow scalar-environment redactor provided; no raw environment map fetched. Parent can extend/review existing safe helper before any such read. No new env setting permitted.

## Handoff and checks

Existing original231 operator acknowledgement/15min observation/20min terminal deadline and proxy's conditional code-only approval are on231. This specialist acknowledges preparation availability only, not delegated merging authority. PR75/recovery/full launch remain separate holds; financial, environment-value validity, image/effective-start and parent's fresh ledger preconditions must not be relabelled pass by this receipt. No merge/deploy/rollback executed. No recurring expense/new resources introduced.

Actual checks: CLI schema-first inspection, one explicit billing data query exit0, one explicit deployment/domain query exit0, numeric resource-limits query successful, public pricing fetch; combined usage/projection query failed closed once. Documentation git diff --check PASS; docs-only no application/fixture tests needed. Independent review must reference exact resulting commit. Command-local hooksPath=/dev/null for docs-only commit; no hook test pass claimed.
