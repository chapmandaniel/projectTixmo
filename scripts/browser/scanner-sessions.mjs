// Two real headless Chrome processes/profiles; manual QR input, never optical/device proof.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, lstat, readdir, readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const { guard } = require("../scanner-browser-guard.cjs");
const {
  discoverDevTools,
  clearDevToolsActivePort,
} = require("./devtools-discovery.cjs");
const { api, frontendPort, fixture } = guard(process.env);
const load = createRequire(resolve(root, "tdash/package.json"));
let stage = 1,
  failed = false,
  cleanup = false,
  vite,
  result;
const browsers = [],
  handlers = new Set();
let rejected = 0,
  cleaning = false,
  cancel;
const cancellation = new Promise((_, reject) => {
  cancel = () => reject(new Deadline());
});
void cancellation.catch(() => {});
process.once("SIGTERM", () => cancel());
const watchdog = setTimeout(() => cancel(), 150000);
const workspace = await mkdtemp(resolve(tmpdir(), "tixmo-scanner-browser-"));
const identity = await lstat(workspace);
const origin = `http://127.0.0.1:${frontendPort}`;
class Deadline extends Error {}
async function bounded(promise, ms = 10000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      ...(!cleaning ? [cancellation] : []),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Deadline()), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
const mark = (value) => {
  stage = value;
  process.send?.({ diagnostic: { stage, category: "progress" } });
};
let revoked;
const revocation = new Promise((resolve) => {
  revoked = resolve;
});
process.on("message", (message) => {
  if (message?.revoked === true) revoked();
});
async function sendIpc(value) {
  await bounded(
    new Promise((resolve, reject) =>
      process.send(value, (error) =>
        error ? reject(Error("IPC rejected")) : resolve(),
      ),
    ),
    5000,
  );
}
async function stopped(record) {
  record.ws?.close();
  if (!record.child) return;
  const exists = () => {
    try {
      process.kill(-record.child.pid, 0);
      return true;
    } catch (error) {
      assert.equal(error.code, "ESRCH");
      return false;
    }
  };
  for (const signal of ["SIGTERM", "SIGKILL"]) {
    if (!exists()) break;
    try {
      process.kill(-record.child.pid, signal);
    } catch (error) {
      assert.equal(error.code, "ESRCH");
    }
    for (let i = 0; i < 30 && exists(); i++)
      await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(exists(), false);
  await bounded(record.closed, 5000);
  await bounded(Promise.allSettled([...handlers]), 5000);
  if (record.debugOrigin)
    await assert.rejects(
      fetch(record.debugOrigin + "/json/list", {
        signal: AbortSignal.timeout(1000),
      }),
    );
}
async function keyAbsent(profile) {
  let entries = 0,
    bytes = 0;
  async function visit(name, depth = 0) {
    assert.ok(depth <= 20 && ++entries <= 10000);
    const stat = await lstat(name);
    assert.equal(stat.isSymbolicLink(), false);
    if (stat.isDirectory()) {
      for (const item of await readdir(name))
        await visit(join(name, item), depth + 1);
    } else {
      assert.ok(stat.isFile());
      bytes += stat.size;
      assert.ok(bytes <= 268435456);
      const content = await readFile(name);
      for (const key of fixture.keys) {
        assert.equal(content.includes(Buffer.from(key)), false);
        assert.equal(content.includes(Buffer.from(key, "utf16le")), false);
      }
    }
  }
  await visit(profile);
}
async function open(index) {
  const profile = join(workspace, "profile" + index);
  await mkdir(profile, { mode: 0o700 });
  clearDevToolsActivePort(profile);
  const record = { profile };
  browsers.push(record);
  record.child = spawn(
    process.env.TIXMO_BROWSER_PATH,
    [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-breakpad",
      "--disable-crash-reporter",
      "--no-first-run",
      "--disable-sync",
      "--disable-extensions",
      "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
      "--remote-debugging-address=127.0.0.1",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    {
      detached: true,
      stdio: ["ignore", "ignore", "pipe"],
      env: { PATH: process.env.PATH, HOME: process.env.HOME },
    },
  );
  record.closed = new Promise((resolve, reject) => {
    record.child.once("close", resolve);
    record.child.once("error", reject);
  });
  // Attach rejection handling immediately, including a spawn failure during discovery.
  void record.closed.catch(() => {});
  const debug = new URL(
    await discoverDevTools(record.child, profile, () => new Deadline()),
  );
  assert.equal(debug.protocol, "ws:");
  assert.equal(debug.hostname, "127.0.0.1");
  record.debugOrigin = "http://" + debug.host;
  const targets = await fetch(record.debugOrigin + "/json/list", {
    signal: AbortSignal.timeout(5000),
  }).then((r) => r.json());
  const target = new URL(
    targets.find((row) => row.type === "page").webSocketDebuggerUrl,
  );
  assert.equal(target.host, debug.host);
  assert.equal(target.protocol, "ws:");
  const ws = (record.ws = new WebSocket(target));
  await bounded(
    new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    }),
    5000,
  );
  let sequence = 0;
  const commands = new Map();
  const rejectAll = () => {
    for (const row of commands.values()) row.reject(Error("CDP closed"));
    commands.clear();
  };
  ws.addEventListener("close", rejectAll);
  ws.addEventListener("error", rejectAll);
  const send = (method, params = {}) => {
    const id = ++sequence;
    return bounded(
      new Promise((resolve, reject) => {
        commands.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      }),
      5000,
    ).finally(() => commands.delete(id));
  };
  ws.addEventListener("message", (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      rejected++;
      return;
    }
    if (message.id) {
      const row = commands.get(message.id);
      if (row)
        message.error
          ? row.reject(Error("CDP rejected"))
          : row.resolve(message.result);
      return;
    }
    if (message.method !== "Fetch.requestPaused") return;
    const work = (async () => {
      const p = message.params,
        url = new URL(p.request.url);
      const apiAllowed =
        p.request.method === "POST" &&
        ["/api/v1/scanners/auth", "/api/v1/scanners/scan"].includes(
          url.pathname,
        );
      const allowed =
        url.origin === origin &&
        (!url.pathname.startsWith("/api/")
          ? p.request.method === "GET"
          : apiAllowed);
      if (!allowed) {
        if (url.origin === origin) rejected++;
        await send("Fetch.failRequest", {
          requestId: p.requestId,
          errorReason: "BlockedByClient",
        });
      } else await send("Fetch.continueRequest", { requestId: p.requestId });
    })();
    handlers.add(work);
    void work.then(
      () => handlers.delete(work),
      () => {
        rejected++;
        handlers.delete(work);
      },
    );
  });
  for (const method of ["Page.enable", "Runtime.enable", "Network.enable"])
    await send(method);
  await send("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `window.__TIXMO_CONFIG__={apiUrl:'/api/v1',stripePublishableKey:''};`,
  });
  const evaluate = async (expression) => {
    const value = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    assert.equal(value.exceptionDetails, undefined);
    return value.result.value;
  };
  const wait = async (expression) => {
    for (let i = 0; i < 120; i++) {
      if (await evaluate(expression)) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Deadline();
  };
  const fill = (selector, value) =>
    evaluate(
      `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Control missing');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
  const click = (label) =>
    evaluate(
      `(()=>{const e=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!e)throw Error('Control missing');e.click();})()`,
    );
  await send("Page.navigate", { url: origin + "/scan" });
  await wait(`!!document.querySelector('#scanner-key')`);
  await fill("#scanner-key", fixture.keys[index]);
  await click("Connect scanner");
  await wait(`!!document.querySelector('#ticket-input')`);
  assert.equal(
    await evaluate(
      `location.pathname==='/scan'&&!location.search&&!location.hash`,
    ),
    true,
  );
  assert.equal(
    await evaluate(`document.querySelector('#scanner-key')===null`),
    true,
  );
  return { record, evaluate, wait, fill, click, send };
}
try {
  mark(1);
  const { build, preview } = await import(load.resolve("vite"));
  const react = (await import(load.resolve("@vitejs/plugin-react"))).default;
  const csp = readFileSync(
    resolve(root, "tdash/nginx.security-headers.conf"),
    "utf8",
  ).match(/add_header Content-Security-Policy "([^"]+)" always;/)[1];
  const config = {
    configFile: false,
    envFile: false,
    envDir: workspace,
    root: resolve(root, "tdash"),
    plugins: [react()],
    logLevel: "silent",
    build: {
      outDir: join(workspace, "dist"),
      emptyOutDir: true,
      assetsDir: "app-assets",
    },
  };
  await build(config);
  mark(2);
  vite = await preview({
    ...config,
    preview: {
      host: "127.0.0.1",
      port: frontendPort,
      strictPort: true,
      headers: { "Content-Security-Policy": csp },
      proxy: { "/api": { target: api.origin, changeOrigin: true } },
    },
  });
  const a = await open(0),
    b = await open(1);
  mark(3);
  assert.notEqual(a.record.child.pid, b.record.child.pid);
  assert.notEqual(a.record.profile, b.record.profile);
  const storageSafe = async (client) => {
    assert.equal(
      await client.evaluate(
        `JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage)]).includes('sk_scanner_')`,
      ),
      false,
    );
    assert.equal(
      await client.evaluate(
        `location.pathname==='/scan'&&!location.search&&!location.hash`,
      ),
      true,
    );
  };
  await storageSafe(a);
  await storageSafe(b);
  await a.fill("#ticket-input", fixture.qr);
  await b.fill("#ticket-input", fixture.qr);
  mark(4);
  await Promise.all([
    a.click("Check ticket for entry"),
    b.click("Check ticket for entry"),
  ]);
  const ready = `['Admitted','Not admitted'].includes(document.querySelector('[role="status"] strong')?.textContent)`;
  await Promise.all([a.wait(ready), b.wait(ready)]);
  const labels = await Promise.all([
    a.evaluate(`document.querySelector('[role="status"] strong').textContent`),
    b.evaluate(`document.querySelector('[role="status"] strong').textContent`),
  ]);
  assert.deepEqual([...labels].sort(), ["Admitted", "Not admitted"]);
  mark(5);
  // Explicitly retry on A: either prior outcome must now be duplicate denial.
  await a.click("Check ticket for entry");
  await a.wait(
    `document.querySelector('[role="status"] strong')?.textContent==='Not admitted'`,
  );
  mark(6);
  await sendIpc({ revoke: true });
  await bounded(revocation, 10000);
  await b.fill("#ticket-input", fixture.freshQr);
  await b.click("Check ticket for entry");
  await b.wait(
    `document.querySelector('[role="status"]')?.textContent.includes('Scanner key rejected')`,
  );
  assert.equal(
    await b.evaluate(
      `document.querySelector('[role="status"] strong')?.textContent==='Admitted'`,
    ),
    false,
  );
  await storageSafe(a);
  await storageSafe(b);
  mark(7);
  // End A cannot end B, whose memory session remains connected even though revoked remotely.
  await a.click("End scanner session");
  await a.wait(`!!document.querySelector('#scanner-key')`);
  assert.equal(
    await b.evaluate(`!!document.querySelector('#ticket-input')`),
    true,
  );
  await b.send("Page.reload");
  await b.wait(`!!document.querySelector('#scanner-key')`);
  await storageSafe(a);
  await storageSafe(b);
  assert.equal(
    await a.evaluate(`document.querySelector('#scanner-key').value`),
    "",
  );
  assert.equal(
    await b.evaluate(`document.querySelector('#scanner-key').value`),
    "",
  );
  // Leaving/reloading also starts an empty key session; no browser storage fallback.
  await a.send("Page.reload");
  await a.wait(`!!document.querySelector('#scanner-key')`);
  assert.equal(
    await a.evaluate(`document.querySelector('#scanner-key').value`),
    "",
  );
  mark(8);
  for (const record of browsers) await stopped(record);
  for (const record of browsers) await keyAbsent(record.profile);
  assert.equal(rejected, 0);
  result = {
    ok: true,
    browserProcesses: 2,
    raceDom: true,
    duplicateDenied: true,
    revokedDenied: true,
    storageEmpty: true,
    profileKeysAbsent: true,
    sessionsIsolated: true,
  };
} catch (error) {
  failed = true;
  process.send?.({
    diagnostic: {
      stage,
      category:
        error instanceof assert.AssertionError
          ? "assertion"
          : error instanceof Deadline
            ? "deadline"
            : "other",
    },
  });
} finally {
  cleaning = true;
  clearTimeout(watchdog);
  mark(9);
  try {
    for (const record of browsers) await stopped(record);
    if (vite) await bounded(vite.close(), 5000);
    await assert.rejects(fetch(origin, { signal: AbortSignal.timeout(1000) }));
    const current = await lstat(workspace);
    assert.equal(current.dev, identity.dev);
    assert.equal(current.ino, identity.ino);
    assert.equal(current.isSymbolicLink(), false);
    await rm(workspace, { recursive: true, force: true });
    cleanup = true;
  } catch {
    failed = true;
  }
  await sendIpc({
    ...(result || {}),
    ok: !failed && result?.ok === true,
    cleanup,
  });
  process.exitCode = failed ? 1 : 0;
  process.disconnect?.();
}
