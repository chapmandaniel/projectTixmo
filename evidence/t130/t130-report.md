# T130 — Moose chat on the Security tab (Labs presentation)

Draft PR https://github.com/chapmandaniel/projectTixmo/pull/218 (DEMO ONLY, do not merge).
Branch `demo/labs-presentation`. Fake Northlight data only. No LLM, no API keys, no network calls for answers. Mock-data chips and Labs banner left unchanged.

## Commits and deploy

- Deployed code: `8646ae92015bac1b0f4eda812295eaa8a2ce1e9b` (`DEMO T130: Moose chat on the Security tab`).
- labs-dash deploy **`e7b2483d-a257-48ba-92eb-54372aeed540`** SUCCESS @ `8646ae92` at 11:48:36 NST (America/St_Johns), `VITE_APP_LABS_BRANCH=demo/labs-presentation`.
- labs-api unchanged `d3a657fe-4abf-4a56-9429-766f32ccda25` / `9f2c523bb3c37f852123668a007b34fa88e7d8f9`.
- Rollback (T129): dash `fcb2408e-3cac-4e23-a2fa-9418c4113697` @ `a6bb6b591e683384e943e71da971eaa121fa772f`. Original restore remains `1141fb05` @ `9c054d4a` + `VITE_APP_LABS_BRANCH=preview/social-analytics-combined`.

## What /security now shows

- A shared Moose chat card sits beside the Security summary/hero on desktop (`lg:h-[460px]`, same pattern as Analytics) and stacks after the summary on mobile 375.
- Four suggested-question chips: "Is my account safe right now?", "What attacks did we stop this week?", "Who on my team needs to fix their password or 2FA?", "What protects my event pages?"
- Answers are generated on the client by `securityMooseAnswers.js`, a rule/template engine over the loaded `buildSecurityReport` data. Every cited number is derived from the report (not hardcoded). Unmatched questions get a helpful fallback that still cites the visible totals.
- Sample chip answers from the live Labs smoke (desktop and mobile matched):
  - Safe right now: 19/19 event pages online with HTTPS valid; 19/19 active members use 2FA; checkout 0 chargeback-risk flags; door devices 12 online, 1 paused, 1 revoked; last 24 hours 14 suspected attacks stopped, 0 reached, 0 breached; 1 earlier breach-list match already reset (Marcus Bell).
  - Attacks this week: 61 stopped in the last 7 days, 14 in 24 hours, 214 in 30 days; 0 reached, 0 breached.
  - Team follow-ups: of 22 on the roster, Liam Byrne and Sean Power have a weak password; Chloe Dubois, Ethan Clarke, and Ben Abbott have not set up 2FA yet (invites still pending); Marcus Bell's earlier leak is already reset; 0 current breach-list matches.
  - Protection: 9 layers, all active / healthy; 19/19 event pages online, 100% uptime, HTTPS valid.
- Free-text smoke question "Are there any breached accounts?" was routed to the team-health rule (same names and 0 current matches as the chip above).

## Tests, CI, smoke

- Local: tdash vitest 72 files, 534 passed (includes `securityMooseAnswers` unit tests plus SecurityView UI coverage for the chat); design:guard passed (920 baseline, no regressions).
- CI on `8646ae92` (PR #218): local-gates run 43894639604 pass, configured-image-restore pass, guard-and-build run 43894639664 pass, Railway labs-dash pass (deploy e7b2483d). http-soak skipped.
- T129 local-gates run 43892430149 on `a6bb6b59` concluded **success** at 11:48:13 NST (America/St_Johns).
- Smoke 50/50 routes at 1440 and 375, console 0, failed requests 0. Each Security chip plus one free-text question was asked on both viewports.
- Screenshots in `evidence/t130/screens/`, including:
  - `desktop-security-hero.png` / `mobile-security-hero.png` (summary + Moose layouts)
  - `desktop-security-moose-q1.png` … `q4.png` and `-free-text.png` (and mobile equivalents)
  - existing Security sections (`team-health`, `protection-layers`, `suspected-attacks`) and all other routes

## Deferred

- Moose is deliberately not a real LLM. It only answers from the Security report already on the page.
