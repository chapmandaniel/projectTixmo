// Actual browser -> Vite -> mounted API. Never fabricate an API/auth response.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const { api, frontendPort, fixture } =
  require("../wallet-browser-guard.cjs").validateWalletBrowser(process.env);
let stage = 0;
let startupPhase = 0;
const phase = (value) => {
  startupPhase = value;
  process.send?.({ diagnostic: { stage, category: "progress", startupPhase } });
};
const mark = (value) => {
  stage = value;
  startupPhase = 0;
  process.send?.({ diagnostic: { stage, category: "progress", startupPhase } });
};
const diagnose = (error) =>
  process.send?.({
    diagnostic: {
      stage,
      startupPhase,
      category:
        error instanceof assert.AssertionError
          ? "assertion"
          : error instanceof BrowserDeadline
            ? "deadline"
            : "other",
    },
  });
class BrowserDeadline extends Error {}
const deadline = (promise, ms) => {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new BrowserDeadline()), ms);
    }),
  ]).finally(() => clearTimeout(timer));
};
const profile = await mkdtemp(resolve(tmpdir(), "tixmo-wallet-browser-"));
const load = createRequire(resolve(root, "tdash/package.json"));
let vite, browser, ws, send, debugPort, csp;
let resetDocumentCsp = false;
let receiveResetLink;
const resetLink = new Promise((resolve) => {
  receiveResetLink = resolve;
});
process.on("message", (message) => {
  if (typeof message?.resetLink === "string" && message.resetLink.length < 4096)
    receiveResetLink(message.resetLink);
});
const pids = [],
  audit = [],
  rejected = [],
  cleanupProofs = [];
const requestHandlers = new Set();
process.once("SIGTERM", () => {
  ws?.close();
});
async function stopped(child) {
  if (!child) return;
  const closed = new Promise((resolve) => child.once("close", resolve));
  if (child.exitCode === null && child.signalCode === null) {
    try {
      await deadline(closed, 3000);
    } catch {
      child.kill("SIGTERM");
      try {
        await deadline(closed, 2000);
      } catch {
        process.kill(-child.pid, "SIGKILL");
        await deadline(closed, 3000);
      }
    }
  }
  const groupExists = () => {
    try {
      process.kill(-child.pid, 0);
      return true;
    } catch (error) {
      assert.equal(error.code, "ESRCH");
      return false;
    }
  };
  // Chrome owns a fresh detached process group; reap descendants even if its leader exited.
  for (const signal of ["SIGTERM", "SIGKILL"]) {
    if (!groupExists()) break;
    process.kill(-child.pid, signal);
    for (let poll = 0; poll < 30 && groupExists(); poll++)
      await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(groupExists(), false, "Owned browser group remains");
  assert.notEqual(child.exitCode === null && child.signalCode === null, true);
  try {
    process.kill(child.pid, 0);
    assert.fail("Owned browser still exists");
  } catch (error) {
    assert.equal(error.code, "ESRCH");
  }
}
async function closeBrowser() {
  if (!browser) return;
  try {
    if (send && browser.exitCode === null && browser.signalCode === null)
      await send("Browser.close");
  } catch {
    /* closed CDP is expected */
  }
  if (ws) ws.close();
  const pid = browser.pid;
  await stopped(browser);
  browser = undefined;
  ws = undefined;
  send = undefined;
  await deadline(Promise.all([...requestHandlers]), 5000);
  if (debugPort) {
    await assert.rejects(
      fetch(`http://127.0.0.1:${debugPort}/json/list`, {
        signal: AbortSignal.timeout(1000),
      }),
    );
  }
  cleanupProofs.push({ pid, groupStopped: true, debugListenerClosed: true });
}
const evaluate = async (expression) => {
  const value = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  assert.equal(value.exceptionDetails, undefined);
  return value.result.value;
};
async function wait(expression) {
  for (let i = 0; i < 100; i++) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new BrowserDeadline();
}
const text = (expression) =>
  `(document.body?.textContent||'').includes(${JSON.stringify(expression)})`;
const click = (label) =>
  evaluate(
    `(()=>{const e=[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!e)throw Error('Missing control');e.click();})()`,
  );
const fill = (label, value) =>
  evaluate(
    `(()=>{const e=document.querySelector('[aria-label="${label}"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
const login = async (name, password = fixture.password) => {
  await click("Sign in");
  await fill("Email address", fixture[name]);
  await fill("Password", password);
  await click("Sign in for checkout");
};
const decode = () =>
  evaluate(
    `(()=>{const t=localStorage.getItem('access_token');const p=JSON.parse(atob(t.split('.')[1]));return{iat:p.iat,exp:p.exp,userId:p.userId};})()`,
  );
let origin;
async function openBrowser() {
  phase(1); // spawn
  browser = spawn(
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
  pids.push(browser.pid);
  phase(2); // DevTools announcement
  const browserWs = await deadline(
    new Promise((resolve, reject) => {
      let output = "";
      browser.stderr.on("data", (chunk) => {
        output = (output + chunk).slice(-16000);
        const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (match) resolve(match[1]);
      });
      browser.once("error", () => reject(Error("Browser start failed")));
      browser.once("exit", () =>
        reject(Error("Browser exited during startup")),
      );
    }),
    15000,
  );
  const debug = new URL(browserWs);
  assert.equal(debug.hostname, "127.0.0.1");
  debugPort = Number(debug.port);
  phase(3); // target discovery transport and JSON
  const targets = await fetch(`http://${debug.host}/json/list`, {
    signal: AbortSignal.timeout(5000),
  }).then((r) => r.json());
  phase(4); // page target selection
  const target = new URL(
    targets.find((t) => t.type === "page").webSocketDebuggerUrl,
  );
  assert.equal(target.host, debug.host);
  phase(5); // debugger connection
  ws = new WebSocket(target);
  await deadline(
    new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    }),
    5000,
  );
  let seq = 0;
  const pending = new Map();
  const rejectAll = () => {
    for (const p of pending.values()) p.reject(Error("CDP closed"));
    pending.clear();
  };
  ws.addEventListener("close", rejectAll);
  ws.addEventListener("error", rejectAll);
  send = (method, params = {}) => {
    const id = ++seq;
    return deadline(
      new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      }),
      5000,
    ).finally(() => pending.delete(id));
  };
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const p = pending.get(message.id);
      if (p) {
        message.error
          ? p.reject(Error("CDP rejected command"))
          : p.resolve(message.result);
      }
      return;
    }
    if (
      message.method === "Network.responseReceived" &&
      message.params.response.url.startsWith(origin + "/api/")
    )
      audit.push({
        responsePath: new URL(message.params.response.url).pathname,
        status: message.params.response.status,
      });
    if (
      message.method === "Network.responseReceived" &&
      new URL(message.params.response.url).pathname === "/reset-password"
    ) {
      const headers = message.params.response.headers;
      resetDocumentCsp ||= Object.entries(headers).some(
        ([name, value]) =>
          name.toLowerCase() === "content-security-policy" && value === csp,
      );
    }
    if (message.method !== "Fetch.requestPaused") return;
    const work = (async () => {
      const p = message.params,
        url = new URL(p.request.url);
      if (url.origin !== origin) {
        await send("Fetch.failRequest", {
          requestId: p.requestId,
          errorReason: "BlockedByClient",
        });
        return;
      }
      if (url.pathname.startsWith("/api/")) {
        const method = p.request.method,
          path = url.pathname;
        const allowed =
          (method === "GET" &&
            (path.startsWith("/api/v1/tickets/") ||
              path.startsWith("/api/v1/orders/") ||
              path.startsWith("/api/v1/events/public/"))) ||
          (method === "POST" &&
            [
              "/api/v1/auth/login",
              "/api/v1/auth/refresh",
              "/api/v1/auth/forgot-password",
              "/api/v1/auth/reset-password",
            ].includes(path));
        audit.push({ method, path });
        if (!allowed) {
          rejected.push({ method, path });
          await send("Fetch.failRequest", {
            requestId: p.requestId,
            errorReason: "BlockedByClient",
          });
          return;
        }
      }
      await send("Fetch.continueRequest", { requestId: p.requestId });
    })();
    requestHandlers.add(work);
    void work.then(
      () => requestHandlers.delete(work),
      () => {
        rejected.push({ protocolFailure: true });
        requestHandlers.delete(work);
      },
    );
  });
  phase(6); // protocol domains and interception
  for (const method of ["Page.enable", "Runtime.enable", "Network.enable"])
    await send(method);
  await send("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
  phase(7); // document bootstrap installation
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `window.__TIXMO_CONFIG__={apiUrl:'/api/v1',stripePublishableKey:''};
      window.__TIXMO_RESET_CAPTURE_EARLY__=false;
      const replace=history.replaceState.bind(history);
      history.replaceState=(...args)=>{if(location.pathname==='/reset-password'&&location.hash.startsWith('#token=')){window.__TIXMO_RESET_CAPTURE_EARLY__=!document.querySelector('script[type="module"]');}return replace(...args);};`,
  });
}
try {
  mark(1);
  const { build, preview } = await import(load.resolve("vite"));
  const react = (await import(load.resolve("@vitejs/plugin-react"))).default;
  csp = readFileSync(
    resolve(root, "tdash/nginx.security-headers.conf"),
    "utf8",
  ).match(/add_header Content-Security-Policy "([^"]+)" always;/)[1];
  assert.ok(!csp.match(/script-src[^;]*unsafe-inline/));
  const buildConfig = {
    configFile: false,
    envFile: false,
    envDir: profile,
    root: resolve(root, "tdash"),
    plugins: [react()],
    logLevel: "silent",
    build: {
      outDir: resolve(profile, "dist"),
      emptyOutDir: true,
      assetsDir: "app-assets",
    },
  };
  mark(2);
  await build(buildConfig);
  mark(3);
  vite = await preview({
    ...buildConfig,
    preview: {
      host: "127.0.0.1",
      port: frontendPort,
      strictPort: true,
      headers: { "Content-Security-Policy": csp },
      proxy: { "/api": { target: api.origin, changeOrigin: true } },
    },
  });
  origin = `http://127.0.0.1:${frontendPort}`;
  mark(4);
  await openBrowser();
  phase(8); // first navigation
  await send("Page.navigate", { url: origin + "/wallet" });
  phase(9); // first document lookup
  await wait(`!!document.querySelector('[aria-label="Email address"]')`);
  mark(5);
  await login("a");
  await wait(text(fixture.orderNumber));
  await click("Show ticket");
  await wait(`!!document.querySelector('img[alt="Ticket admission QR code"]')`);
  assert.match(
    await evaluate(
      `document.querySelector('img[alt="Ticket admission QR code"]').src`,
    ),
    /^data:image\/png;base64,/,
  );
  mark(6);
  const owner = (await decode()).userId;
  await closeBrowser();
  await openBrowser();
  await send("Page.navigate", { url: origin + "/wallet" });
  await wait(text(fixture.orderNumber));
  assert.equal((await decode()).userId, owner);
  mark(7);
  const confirmed = `${origin}/checkout/${fixture.slug}?orderId=${fixture.orderId}&redirect_status=succeeded`;
  await send("Page.navigate", { url: confirmed });
  await wait(text("Order confirmed. Payment succeeded."));
  await closeBrowser();
  await openBrowser();
  await send("Page.navigate", { url: confirmed });
  await wait(text("Order confirmed. Payment succeeded."));
  await wait(text("View my tickets and orders"));
  await send("Page.navigate", { url: origin + "/wallet" });
  await wait(text(fixture.orderNumber));
  mark(8);
  const issued = await decode(),
    wallStart = Date.now(),
    monotonicStart = performance.now();
  assert.equal(issued.exp - issued.iat, 10);
  assert.ok(wallStart < issued.exp * 1000);
  const delay = Math.max(0, issued.exp * 1000 - Date.now() + 1200);
  assert.ok(delay <= 11200);
  await new Promise((resolve) => setTimeout(resolve, delay));
  assert.ok(Date.now() > issued.exp * 1000);
  const auditStart = audit.length;
  mark(9);
  await click("Refresh");
  await wait(
    `${text(fixture.orderNumber)}&&JSON.parse(atob(localStorage.getItem('access_token').split('.')[1])).iat>${issued.iat}`,
  );
  const renewed = await decode();
  assert.equal(renewed.userId, owner);
  assert.ok(renewed.exp > issued.exp);
  assert.ok(audit.slice(auditStart).some((e) => e.status === 401));
  assert.ok(
    audit
      .slice(auditStart)
      .some(
        (e) => e.responsePath === "/api/v1/auth/refresh" && e.status === 200,
      ),
  );
  const elapsed = {
    wallStart,
    wallEnd: Date.now(),
    wallMs: Date.now() - wallStart,
    monotonicMs: performance.now() - monotonicStart,
  };
  assert.ok(Math.abs(elapsed.wallMs - elapsed.monotonicMs) < 1000);
  await evaluate("localStorage.clear()");
  await send("Page.navigate", { url: origin + "/wallet" });
  await wait(`!!document.querySelector('[aria-label="Email address"]')`);
  mark(10);
  await login("b");
  await wait(text("No tickets yet."));
  await wait(text("No orders yet."));
  assert.equal(await evaluate(text(fixture.orderNumber)), false);
  for (const path of [
    `/tickets/${fixture.ticketId}/qr`,
    `/orders/${fixture.orderId}/recovery`,
  ]) {
    const status = await evaluate(
      `fetch('/api/v1'+${JSON.stringify(path)},{headers:{Authorization:'Bearer '+localStorage.getItem('access_token')}}).then(r=>r.status)`,
    );
    assert.ok([403, 404].includes(status));
  }
  await evaluate("localStorage.clear()");
  await send("Page.navigate", { url: origin + "/wallet" });
  await wait(`!!document.querySelector('[aria-label="Email address"]')`);
  await login("a");
  await wait(text(fixture.orderNumber));
  assert.equal((await decode()).userId, owner);
  // Forgotten credentials: use actual UI, transport-captured link, first-document bootstrap and normal sign-in.
  await evaluate("localStorage.clear()");
  await send("Page.navigate", { url: origin + "/wallet" });
  await wait(`!!document.querySelector('[aria-label="Email address"]')`);
  await click("Sign in");
  mark(11);
  await click("Forgot your password?");
  await wait(`!!document.querySelector('[aria-label="Buyer email"]')`);
  await fill("Buyer email", fixture.a);
  await click("Email reset link");
  await wait(text("If this email belongs to an eligible buyer"));
  mark(12);
  const capturedLink = new URL(await deadline(resetLink, 10000));
  assert.equal(capturedLink.origin, origin);
  assert.equal(capturedLink.pathname, "/reset-password");
  assert.equal(capturedLink.search, "");
  assert.match(capturedLink.hash, /^#token=[a-f0-9]{64}$/);
  mark(13);
  const raw = capturedLink.hash.slice("#token=".length);
  // Mail clients can reuse the request-form tab: prove the same-document path too.
  const sameDocumentNavigation = await send("Page.navigate", {
    url: capturedLink.href,
  });
  assert.equal(sameDocumentNavigation.loaderId, undefined);
  await wait(`!!document.querySelector('[aria-label="New password"]')`);
  assert.equal(await evaluate("location.hash"), "");
  assert.equal(
    await evaluate(
      `JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage)]).includes(${JSON.stringify(raw)})`,
    ),
    false,
  );
  const sameDocumentRecovered = true;
  // The request form already uses /reset-password. A fragment-only navigation
  // would keep that document and cannot exercise the external-email bootstrap.
  await send("Page.navigate", { url: origin + "/wallet" });
  await wait(`!!document.querySelector('[aria-label="Email address"]')`);
  const resetNavigation = await send("Page.navigate", {
    url: capturedLink.href,
  });
  // CDP omits loaderId for same-document navigation; require a real new document.
  assert.equal(typeof resetNavigation.loaderId, "string");
  assert.ok(resetNavigation.loaderId.length > 0);
  await wait(`!!document.querySelector('[aria-label="New password"]')`);
  assert.equal(await evaluate("location.hash"), "");
  assert.equal(await evaluate("window.__TIXMO_RESET_CAPTURE_EARLY__"), true);
  assert.equal(await evaluate("location.search"), "");
  assert.equal(
    await evaluate("window.__TIXMO_BUYER_RESET_INTENT__ === undefined"),
    true,
  );
  assert.equal(
    await evaluate(
      `JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage)]).includes(${JSON.stringify(raw)})`,
    ),
    false,
  );
  assert.equal(resetDocumentCsp, true);
  await fill("New password", fixture.newPassword);
  await fill("Confirm new password", fixture.newPassword);
  mark(14);
  await click("Change password");
  await wait(text("Password changed. Sign in with your new password."));
  assert.equal(await evaluate("localStorage.getItem('access_token')"), null);
  await click("Return to wallet sign-in");
  await wait(`!!document.querySelector('[aria-label="Email address"]')`);
  mark(15);
  await login("a", fixture.newPassword);
  await wait(text(fixture.orderNumber));
  assert.equal((await decode()).userId, owner);
  await click("Show ticket");
  await wait(`!!document.querySelector('img[alt="Ticket admission QR code"]')`);
  assert.match(
    await evaluate(
      `document.querySelector('img[alt="Ticket admission QR code"]').src`,
    ),
    /^data:image\/png;base64,/,
  );
  mark(16);
  for (const path of [
    "/api/v1/auth/forgot-password",
    "/api/v1/auth/reset-password",
  ])
    assert.equal(
      audit.filter((item) => item.method === "POST" && item.path === path)
        .length,
      1,
    );
  assert.equal(new Set(pids).size, 3);
  assert.equal(rejected.length, 0);
  assert.equal(
    audit.filter(
      (e) =>
        e.method === "POST" &&
        ![
          "/api/v1/auth/login",
          "/api/v1/auth/refresh",
          "/api/v1/auth/forgot-password",
          "/api/v1/auth/reset-password",
        ].includes(e.path),
    ).length,
    0,
  );
  await closeBrowser();
  mark(17);
  await vite.close();
  await assert.rejects(fetch(origin, { signal: AbortSignal.timeout(1000) }));
  vite = undefined;
  await rm(profile, { recursive: true, force: true });
  process.send?.({
    ok: true,
    browserProcesses: 3,
    pids,
    cleanupProofs,
    reopenedOwner: true,
    nativeExpiry: true,
    foreignDenied: true,
    ownerReauthenticated: true,
    lostPasswordRecovered: true,
    sameDocumentRecovered,
    fragmentCleared: true,
    earlyFragmentCapture: true,
    resetDocumentCsp: true,
    newPasswordSignedIn: true,
    elapsed,
    issued: { iat: issued.iat, exp: issued.exp },
    renewed: { iat: renewed.iat, exp: renewed.exp },
  });
} catch (error) {
  diagnose(error);
  process.exitCode = 1;
} finally {
  mark(18);
  try {
    await closeBrowser();
    if (vite) await deadline(vite.close(), 5000);
    await rm(profile, { recursive: true, force: true });
    process.send?.({
      cleanup: true,
      profileRemoved: true,
      browserStopped: true,
      frontendStopped: true,
    });
  } catch (error) {
    diagnose(error);
    process.exitCode = 1;
  } finally {
    process.disconnect?.();
  }
}
