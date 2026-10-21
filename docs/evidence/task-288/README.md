# Task 288 — private font/runtime qualification

Scope: extend reviewed task283 `68eb4db523c4054001104c27cb2a0725bfc84906`
for the actual280 `e842c775` Skia FontConfigInterface.cpp:163 crash. No product
changes; this is **NOT actual App or task280 acceptance**. Independent exact-SHA
review remains required before using the new launcher for task280.

## Runtime and provenance

Private disk runtime `/home/daniel/projects/projectTixmo/runtime/task-288`
(mode0700). Original task283 runtime/evidence left untouched. `packages.json`
preserves all13 reviewed package pins and adds five packages: DejaVu core+mono
2.37-8build1, fontconfig/config/libfontconfig1 2.17.1-3ubuntu1. Official Ubuntu
HTTPS URLs, package/version/architecture/dependencies, SHA256 and apt-index
SHA512 are pinned. Initial metadata read using local `apt-cache show`; download
bytes checked against both hashes and exact `dpkg-deb -f` metadata before
`dpkg-deb -x`; no maintainer scripts, install, sudo or system configuration.
The private config deliberately lists only extracted DejaVu fonts and private
cache, and supplies sans/serif/monospace aliases. Packaged system configs are
retained for provenance but not included (their absolute host paths are not
appropriate). `fonts.json` records every TTF SHA256, actual fc-match selections,
config and unchanged cached Chromium SHA256. `ldd.txt` records ELF closure, not
full optional desktop/Mesa dependency closure or portable-host support.

## Exact checks

From isolated worktree task288:

```
python3 scripts/runtime/task-288-prepare.py
node scripts/runtime/task-288-qualify.mjs
sh -n scripts/runtime/task-288-chromium
python3 -m py_compile scripts/runtime/task-288-prepare.py
node --check scripts/runtime/task-288-qualify.mjs
git diff --check
```

All exit0. Real headless JS/CDP qualification made four loopback navigations,
measured canvas `iiii`=28 vs `WWWW`=96, rasterized2899 nontransparent pixels,
rendered real sans/serif/Unicode text, focused an unavailable-family fallback
email input using Input.insertText and verified its value, closed a real dialog,
updated session-expiry text, and captured four legible PNGs. `result.json`
records session counter0..3, blocked reserved .invalid fetches and cleanup.
`browser-stderr.txt` has no Fontconfig error, fatal assertion or SIGTRAP;
nonfatal GPU sandbox warning is retained, not suppressed. Browser is terminated
intentionally after assertions (exit143), not claimed normal page-exit0.
Owned PID absent, live owned process-group members empty, loopback listener
refused, profile removed. Canvas/content screenshot inspected visually: text
is legible, not blank glyph replacement. This does not establish every Unicode
script, emoji, font platform or actual React/401/account/return flow.

## Boundary and review handoff

No DB/API/provider/email/customer data, env secrets, paid service, host install,
Gateway/global configuration, push/merge/deploy. Application-level dead proxy,
exact127.0.0.1 bypass and wildcard DNS failure only; **not kernel isolation**.
Use only trusted callers which do not override network flags. Port9 is checked
closed before qualifying. DevTools and synthetic server bind loopback only.
Reviewers should use their own checkout/output and independent runtime copy or
fresh extraction; do not replay prepare into the author's runtime or overwrite
its evidence. The launcher explicitly sets LD_LIBRARY_PATH, FONTCONFIG_FILE,
FONTCONFIG_PATH and XDG_CACHE_HOME for its own process tree.

After independent review, frontend can use this absolute launcher:
`/home/daniel/projects/projectTixmo/worktrees/task-288/scripts/runtime/task-288-chromium`.
The original actual280 acceptance remains open and must run separately.
