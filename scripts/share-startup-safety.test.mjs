import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const toml = readFileSync(join(root, "tixmoapi2/railway.toml"), "utf8");
const command = JSON.parse(toml.match(/^startCommand = (".*")$/m)[1]);
const preDeploy = JSON.parse(toml.match(/^preDeployCommand = (\[.*\])$/m)[1]);
assert.equal(preDeploy.length, 1);
async function run(change = {}, stage = "startup") {
  const directory = mkdtempSync(join(tmpdir(), "tixmo-share-startup-"));
  try {
    // These executable stubs load only pure argument guards. No SDK, app or DB client.
    const stub = `#!${process.execPath}
const path = require('node:path');
const tool = path.basename(process.argv[1]);
const args = process.argv.slice(2);
const script = args[0];
let phase;
if (tool === 'npm') { if (JSON.stringify(args) !== JSON.stringify(['run','migrate'])) process.exit(90); phase = 'migrate'; }
else if (script === 'prisma/rekey-asset-shares.js') {
 const apply = args.includes('--apply');
 phase = apply ? 'apply' : args.includes('--preserve-hash-only') ? 'preserve-audit' : 'strict-audit';
 if (apply && (process.env.HARNESS_STAGE !== 'predeploy' || JSON.stringify(args.slice(1)) !== JSON.stringify(['--preserve-hash-only','--apply']))) process.exit(91);
 try { const plan = require(process.env.REKEY_GUARD).options(args.slice(1), process.env); if (plan.apply !== apply || plan.url !== process.env.DATABASE_URL) process.exit(92); } catch { process.exit(93); }
}
else if (script === 'prisma/check-asset-share-links.js') {
 phase = 'links';
 try { require(process.env.LINK_GUARD).guard(args.slice(1), process.env); } catch { process.exit(94); }
}
else if (script === 'scripts/stripe-read-probe.cjs' && args.length === 1) phase = 'stripe';
else if (script === 'scripts/runtime-version-probe.cjs' && args.length === 1) {
 phase = 'versions';
 try { require(process.env.VERSION_GUARD).guard([], process.env); } catch { process.exit(96); }
}
else if (script === 'dist/index.js' && args.length === 1) phase = 'api';
else process.exit(95);
require('node:fs').appendFileSync(process.env.PHASE_FILE, phase + '\\n');
if (process.env.FAIL_PHASE === phase) process.exit(7);
`;
    for (const name of ["npm", "node"])
      writeFileSync(join(directory, name), stub, { mode: 0o700 });
    writeFileSync(join(directory, "phases"), "");
    const child = spawn(
      "/bin/sh",
      ["-c", stage === "predeploy" ? preDeploy[0] : command],
      {
        cwd: join(root, "tixmoapi2"),
        env: {
          PATH: directory,
          PHASE_FILE: join(directory, "phases"),
          NODE_ENV: "production",
          DATABASE_URL:
            "postgresql://synthetic:synthetic@db.test/owned?schema=public&synthetic=space value",
          ASSET_SHARE_ENCRYPTION_KEY: "12".repeat(32),
          REKEY_GUARD: join(root, "tixmoapi2/prisma/rekey-asset-shares.js"),
          LINK_GUARD: join(root, "tixmoapi2/prisma/check-asset-share-links.js"),
          VERSION_GUARD: join(
            root,
            "tixmoapi2/scripts/runtime-version-probe.cjs",
          ),
          REDIS_URL: "redis://synthetic:synthetic@redis.test:6379/0",
          ...change,
          HARNESS_STAGE: stage,
        },
        stdio: ["ignore", "pipe", "pipe"],
        detached: true,
      },
    );
    let stdout = "";
    let stderr = "";
    let boundedFailure = false;
    const kill = () => {
      boundedFailure = true;
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {}
    };
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.length > 4096) kill();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      if (stderr.length > 4096) kill();
    });
    const timer = setTimeout(kill, 5000);
    let status;
    try {
      status = await new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("close", (code) => resolve(code));
      });
    } finally {
      clearTimeout(timer);
    }
    assert.equal(boundedFailure, false);
    assert.equal(stderr, "");
    return {
      status,
      phases: readFileSync(join(directory, "phases"), "utf8")
        .trim()
        .split("\n")
        .filter(Boolean),
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
const audit = { TIXMO_ASSET_SHARE_AUDIT_ON_START: "true" };
const preserve = {
  ...audit,
  TIXMO_ASSET_SHARE_AUDIT_PRESERVE_HASH_ONLY_ON_START: "true",
  TIXMO_ALLOW_HASH_ONLY_SHARE_PRESERVATION: "true",
};
const links = {
  TIXMO_ASSET_LINK_CHECK_ON_START: "true",
  TIXMO_ASSET_LINK_CHECK: "true",
};
test("normal command migrates then executes API without diagnostics", async () =>
  assert.deepEqual(await run(), { status: 0, phases: ["migrate", "api"] }));
test("parent audit defaults to strict CLI even with policy permission alone", async () =>
  assert.deepEqual(
    await run({ ...audit, TIXMO_ALLOW_HASH_ONLY_SHARE_PRESERVATION: "true" }),
    { status: 0, phases: ["migrate", "strict-audit", "api"] },
  ));
test("preservation requires explicit nested flag and real CLI opt-in", async () => {
  assert.deepEqual(await run(preserve), {
    status: 0,
    phases: ["migrate", "preserve-audit", "api"],
  });
  for (const permission of ["", "false", "TRUE", " true"]) {
    const result = await run({
      ...preserve,
      TIXMO_ALLOW_HASH_ONLY_SHARE_PRESERVATION: permission,
    });
    assert.notEqual(result.status, 0);
    assert.deepEqual(result.phases, ["migrate"]);
  }
});
test("nested preservation and CLI permission alone cannot start audit", async () =>
  assert.deepEqual(
    await run({ ...preserve, TIXMO_ASSET_SHARE_AUDIT_ON_START: "false" }),
    { status: 0, phases: ["migrate", "api"] },
  ));
test("link startup requires separate observer permission", async () => {
  assert.deepEqual(await run(links), {
    status: 0,
    phases: ["migrate", "links", "api"],
  });
  const result = await run({ ...links, TIXMO_ASSET_LINK_CHECK: "false" });
  assert.notEqual(result.status, 0);
  assert.deepEqual(result.phases, ["migrate"]);
  assert.deepEqual(await run({ TIXMO_ASSET_LINK_CHECK: "true" }), {
    status: 0,
    phases: ["migrate", "api"],
  });
});
test("all diagnostics run after migration in preserved Stripe order", async () =>
  assert.deepEqual(
    await run({ ...preserve, ...links, TIXMO_STRIPE_READ_PROBE: "true" }),
    {
      status: 0,
      phases: ["migrate", "preserve-audit", "stripe", "links", "api"],
    },
  ));
for (const phase of ["migrate", "preserve-audit", "stripe", "links"])
  test(`failure at ${phase} stops every later command`, async () => {
    const expected = ["migrate", "preserve-audit", "stripe", "links"];
    const result = await run({
      ...preserve,
      ...links,
      TIXMO_STRIPE_READ_PROBE: "true",
      FAIL_PHASE: phase,
    });
    assert.equal(result.status, 7);
    assert.deepEqual(
      result.phases,
      expected.slice(0, expected.indexOf(phase) + 1),
    );
  });
test("strict audit failure also stops API", async () =>
  assert.deepEqual(await run({ ...audit, FAIL_PHASE: "strict-audit" }), {
    status: 7,
    phases: ["migrate", "strict-audit"],
  }));
test("nonexact startup flags never enable diagnostic commands", async () => {
  for (const value of ["TRUE", "1", " true", "true "])
    assert.deepEqual(
      await run({
        TIXMO_ASSET_SHARE_AUDIT_ON_START: value,
        TIXMO_ASSET_LINK_CHECK_ON_START: value,
        TIXMO_STRIPE_READ_PROBE: value,
      }),
      { status: 0, phases: ["migrate", "api"] },
    );
});
test("nonexact nested selector retains strict audit and apply permission never enables writes", async () => {
  for (const value of ["false", "TRUE", " true"]) {
    assert.deepEqual(
      await run({
        ...preserve,
        TIXMO_ASSET_SHARE_AUDIT_PRESERVE_HASH_ONLY_ON_START: value,
        TIXMO_ALLOW_ASSET_SHARE_REKEY: "true",
      }),
      { status: 0, phases: ["migrate", "strict-audit", "api"] },
    );
  }
});

const applyPermissions = {
  TIXMO_ASSET_SHARE_REKEY_ONCE: "true",
  TIXMO_ALLOW_HASH_ONLY_SHARE_PRESERVATION: "true",
  TIXMO_ALLOW_ASSET_SHARE_REKEY: "true",
};
test("predeploy default is a no-op even with both CLI permissions", async () => {
  assert.deepEqual(await run({}, "predeploy"), { status: 0, phases: [] });
  assert.deepEqual(
    await run(
      { ...applyPermissions, TIXMO_ASSET_SHARE_REKEY_ONCE: "false" },
      "predeploy",
    ),
    { status: 0, phases: [] },
  );
});
test("nonexact predeploy selector never invokes apply", async () => {
  for (const flag of ["", "TRUE", "1", " true", "true "])
    assert.deepEqual(
      await run(
        { ...applyPermissions, TIXMO_ASSET_SHARE_REKEY_ONCE: flag },
        "predeploy",
      ),
      { status: 0, phases: [] },
    );
});
test("predeploy invokes exactly one apply with three explicit permissions and quoted database URL", async () => {
  assert.deepEqual(await run(applyPermissions, "predeploy"), {
    status: 0,
    phases: ["apply"],
  });
});
test("predeploy rejects either missing CLI permission without invoking any later operation", async () => {
  for (const name of [
    "TIXMO_ALLOW_HASH_ONLY_SHARE_PRESERVATION",
    "TIXMO_ALLOW_ASSET_SHARE_REKEY",
  ])
    for (const value of ["", "false", "TRUE", " true"]) {
      const result = await run(
        { ...applyPermissions, [name]: value },
        "predeploy",
      );
      assert.notEqual(result.status, 0);
      assert.deepEqual(result.phases, []);
    }
});
test("failed predeploy apply returns failure after one attempt without retry or API startup", async () => {
  assert.deepEqual(
    await run({ ...applyPermissions, FAIL_PHASE: "apply" }, "predeploy"),
    { status: 7, phases: ["apply"] },
  );
});
test("predeploy permissions never introduce startup apply", async () => {
  assert.deepEqual(await run({ ...applyPermissions, ...preserve }), {
    status: 0,
    phases: ["migrate", "preserve-audit", "api"],
  });
});

test("version observer runs last after all diagnostics before API", async () => {
  assert.deepEqual(
    await run({
      ...preserve,
      ...links,
      TIXMO_STRIPE_READ_PROBE: "true",
      TIXMO_RUNTIME_VERSION_PROBE: "true",
      DATABASE_URL:
        "postgresql://synthetic:synthetic@db.test/owned?synthetic=space%20value&x=1",
    }),
    {
      status: 0,
      phases: [
        "migrate",
        "preserve-audit",
        "stripe",
        "links",
        "versions",
        "api",
      ],
    },
  );
});
test("nonexact version opt-in is a no-op", async () => {
  for (const flag of ["", "false", "TRUE", "1", "true "])
    assert.deepEqual(await run({ TIXMO_RUNTIME_VERSION_PROBE: flag }), {
      status: 0,
      phases: ["migrate", "api"],
    });
});
test("version failure stops API and guard remains production-only", async () => {
  assert.deepEqual(
    await run({
      TIXMO_RUNTIME_VERSION_PROBE: "true",
      DATABASE_URL:
        "postgresql://synthetic:synthetic@db.test/owned?synthetic=space%20value&x=1",
      FAIL_PHASE: "versions",
    }),
    { status: 7, phases: ["migrate", "versions"] },
  );
  const rejected = await run({
    TIXMO_RUNTIME_VERSION_PROBE: "true",
    DATABASE_URL:
      "postgresql://synthetic:synthetic@db.test/owned?synthetic=space%20value&x=1",
    NODE_ENV: "test",
  });
  assert.notEqual(rejected.status, 0);
  assert.deepEqual(rejected.phases, ["migrate"]);
});
