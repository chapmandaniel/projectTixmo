# Repo Cleanup Follow-Ups

This file tracks ideas from deleted stale branches that may be worth re-implementing intentionally later. It is not a list of deleted branches; it only keeps items where the branch cleanup surfaced a real future product or engineering decision.

## Rebuild Later

- [ ] Rebuild QuantMo from a fresh product spec instead of reviving old `codex/quantmo` iterations.
- [ ] Rebuild any creative/social AI composer work from current Tixmo product goals instead of reviving `codex/rebuild-creative-composer`.

## Conditional

- [ ] If public event detail caching is reintroduced, add explicit invalidation for event update/delete/publish/cancel paths. Current V1 checkout keeps public event detail uncached for freshness, so the deleted `pr-43` cache-invalidation branch is not needed now.
- [x] Cover Stripe signature failures, including non-`Error` thrown values, with focused tests and defensive webhook catch handling (October 2026 consolidation).
- [ ] Add a regression test that importing API environment config does not write sensitive startup/debug values to `console.log`.
