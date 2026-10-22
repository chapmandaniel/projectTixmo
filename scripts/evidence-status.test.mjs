import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const checker = fileURLToPath(
  new URL("./evidence-status.mjs", import.meta.url),
);
const local = [
  "external-smoke-runs/local-external-smoke-2026-06-09.json",
  "public-route-screenshots/public-route-evidence.json",
  "checkout-config-evidence/local-runtime-config-2026-06-09.json",
  "dependency-audit/production-dependency-audit.json",
];
const target = [
  "external-smoke-runs/staging-test.json",
  "checkout-config-evidence/staging-test.json",
  "public-route-screenshots/staging-test/public-route-evidence.json",
  ...[
    "scanner-field-test",
    "backup-rollback",
    "external-review-share",
    "policy-approval",
    "uptime-status",
  ].map((gate) => `${gate}-evidence/staging-test.json`),
];
const valid = {
  result: "pass",
  environment: "staging",
  capturedAt: "2026-10-19T12:00:00Z",
  releaseSha: "f".repeat(40),
  owner: "Synthetic test",
  evidence: { summary: "Fixture only" },
};
function fixture(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "tixmo-evidence-test-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const write = (file, body) => {
    const dest = path.join(cwd, "docs", file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(
      dest,
      typeof body === "string" ? body : JSON.stringify(body),
    );
  };
  [...local, ...target].forEach((file) => write(file, valid));
  const run = async () => {
    const outputFile = path.join(cwd, "cli-stdout");
    const errorFile = path.join(cwd, "cli-stderr");
    const outputFd = fs.openSync(outputFile, "w", 0o600);
    const errorFd = fs.openSync(errorFile, "w", 0o600);
    const child = spawn(process.execPath, [checker, "--strict", "--json"], {
      cwd,
      env: {},
      stdio: ["ignore", outputFd, errorFd],
      detached: true,
    });
    let exceeded = false;
    const stop = () => {
      exceeded = true;
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {}
    };
    const sizeGuard = setInterval(() => {
      if (
        fs.statSync(outputFile).size > 262144 ||
        fs.statSync(errorFile).size > 4096
      )
        stop();
    }, 25);
    const timer = setTimeout(stop, 5000);
    let result;
    try {
      result = await new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("close", (status, signal) => resolve({ status, signal }));
      });
    } finally {
      clearTimeout(timer);
      clearInterval(sizeGuard);
      fs.closeSync(outputFd);
      fs.closeSync(errorFd);
    }
    assert.equal(exceeded, false);
    assert.equal(result.signal, null);
    assert.ok(fs.statSync(outputFile).size <= 262144);
    assert.ok(fs.statSync(errorFile).size <= 4096);
    assert.equal(fs.readFileSync(errorFile, "utf8"), "");
    assert.ok([0, 1].includes(result.status));
    return {
      exit: result.status,
      ...JSON.parse(fs.readFileSync(outputFile, "utf8")),
    };
  };
  return { cwd, write, run };
}

test("all eight valid target/manual artifacts can reach zero gaps; local provenance remains visible", async (t) => {
  const { run } = fixture(t);
  const result = await run();
  assert.equal(result.exit, 0);
  assert.equal(result.summary.openEvidenceGaps, 0);
  assert.equal(result.summary.readyForGoNoGo, true);
  assert.deepEqual(result.sections[0].items[2].warnings, [
    "local non-launch evidence only",
  ]);
});

test("local pass never substitutes for any missing target/manual artifact", async (t) => {
  const { cwd, run } = fixture(t);
  target.forEach((file) => fs.unlinkSync(path.join(cwd, "docs", file)));
  const result = await run();
  assert.equal(result.exit, 1);
  assert.equal(result.summary.openEvidenceGaps, 8);
  assert.ok(result.blockers.every((item) => item.status === "missing"));
});

for (const file of target) {
  for (const [label, body] of [
    ["failed", { ...valid, result: "fail" }],
    ["pending", { ...valid, result: "pending" }],
    ["unknown result", { ...valid, result: "unknown" }],
    ["missing result", { ...valid, result: undefined }],
    ["malformed", "{invalid"],
  ]) {
    test(`${file}: ${label} stays blocking`, async (t) => {
      const { write, run } = fixture(t);
      write(file, body);
      const result = await run();
      assert.equal(result.exit, 1);
      assert.equal(result.summary.openEvidenceGaps, 1);
      assert.equal(result.summary.readyForGoNoGo, false);
    });
  }
}
for (const field of [
  "environment",
  "capturedAt",
  "releaseSha",
  "owner",
  "evidence.summary",
]) {
  test(`manual required field ${field} stays enforced`, async (t) => {
    const { write, run } = fixture(t);
    const body = structuredClone(valid);
    if (field === "evidence.summary") delete body.evidence.summary;
    else delete body[field];
    target.slice(3).forEach((file) => write(file, body));
    const result = await run();
    assert.equal(result.exit, 1);
    assert.equal(result.summary.openEvidenceGaps, 5);
    assert.ok(
      result.blockers.every((item) =>
        item.warnings.some((warning) => warning.includes(field)),
      ),
    );
  });
}

test("local config validation failure is not suppressed with provenance", async (t) => {
  const { write, run } = fixture(t);
  write(local[2], "{bad json");
  const result = await run();
  assert.equal(result.exit, 1);
  assert.equal(result.summary.openEvidenceGaps, 1);
  assert.ok(result.blockers[0].warnings.includes("artifact is not valid JSON"));
});

// Preserve the existing current compound regression in addition to all48 historical cases.
test("a local informational warning does not veto complete target evidence, while pending/invalid evidence still fails", async (t) => {
  const { cwd, write, run } = fixture(t);
  const ready = await run();
  assert.equal(ready.exit, 0);
  assert.equal(ready.summary.readyForGoNoGo, true);
  assert.deepEqual(ready.sections[0].items[2].warnings, [
    "local non-launch evidence only",
  ]);
  write(target[3], { ...valid, result: "pending" });
  assert.equal((await run()).exit, 1);
  write(target[3], { ...valid, owner: "" });
  assert.equal((await run()).exit, 1);
  fs.rmSync(path.join(cwd, "docs", target[3]));
  assert.equal((await run()).exit, 1);
  const verifier = fs.readFileSync(
    new URL("./verify-market-local.mjs", import.meta.url),
    "utf8",
  );
  const rootSafety = verifier.match(
    /name: 'Root verification safety checks',[\s\S]*?args: \[([^\]]+)\]/,
  )?.[1];
  assert.ok(rootSafety?.includes("'scripts/evidence-status.test.mjs'"));
});
