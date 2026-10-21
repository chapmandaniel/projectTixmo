# Independent review #290 — PASS scoped runtime qualification

Candidate: `ed0b8eba4418579c7c701153ee79f2e4054ef430` (#288), base
`68eb4db523c4054001104c27cb2a0725bfc84906`. Reviewer: tixmo-lead.
Isolated branch `tixmo/review-290`, worktree `worktrees/review-290`.

## Source/provenance verdict

PASS: inspected prepare, launcher, qualification and imported CDP/cleanup helpers before execution.
Only archive extraction (`dpkg-deb -x`), no installation or maintainer script execution.
Verified every one of 18 cached package SHA256/SHA512 and exact dpkg Package,
Version, Architecture and Depends metadata before copying to private task290 cache
and fresh extraction. All13 original manifest entries equal reviewed base pins.
New5 official Ubuntu package digests also equal local apt-cache index values.
Verified unchanged Chromium SHA256 and all8 extracted TTF SHA256 values against
candidate evidence. Four fc-match selections equal candidate results. The private
config has only own extracted fonts/cache and aliases, no global config includes.
Runtime mode0700; FONTCONFIG_FILE/PATH, XDG_CACHE_HOME and LD_LIBRARY_PATH task-local.

## Independent runtime

Own copied scripts substitute only task-288/task288 path/label strings with task290;
no assertion or behavior edits. Candidate source/evidence/runtime left read-only.
Own runtime: `/home/daniel/projects/projectTixmo/runtime/task-290`.

Commands (all exit0):

```sh
python3 scripts/runtime/task-290-prepare.py
node scripts/runtime/task-290-qualify.mjs
sh -n scripts/runtime/task-290-chromium
node --check scripts/runtime/task-290-qualify.mjs
python3 -m py_compile scripts/runtime/task-290-prepare.py
git diff --check
```

Four actual headless Chromium/CDP navigations, session counters0..3, canvas
ink2899 and measured widths28/96/240; Unicode canvas plus serif/sans text, focused
email input with unavailable-family fallback, dialog close and session-expiry
heading repaint. Reserved .invalid fetch blocked each time. Captured four own PNGs;
reviewer visually inspected render-3.png: legible café, £, €, Ω, Ж; no blank glyphs.
No fatal Skia/Fontconfig/SIGTRAP. Nonfatal GPU sandbox warning preserved.
Result records owned browser PID2675915 stopped/absent, no live process-group
members, loopback port39527 closed and profile removed. Exit143 was intentional
SIGTERM cleanup, not claimed natural exit0. No runtime errors.

## Limits and handoff

PASS only scoped #288 runtime qualification; #280 actual App flows remain unpassed.
Synthetic refresh/dialog/input is not React, real401/auth/wallet/transfer acceptance,
all Unicode scripts, portability or complete optional desktop/Mesa closure.
Proxy/DNS controls are application-level, NOT kernel isolation; trusted callers
must not override launcher flags. No DB/API/real provider/email, secret reads,
host/global installation/configuration, network target changes, spend, push,
merge or deployment. Author launcher can now be used for separate actual App
qualification subject to existing authority. PM owns closure; review not done.
