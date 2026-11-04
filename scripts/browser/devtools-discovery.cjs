"use strict";
// Only the already-owned Chrome profile is inspected. Never expose raw stderr/paths.
const fs = require("node:fs");
const path = require("node:path");
function discoveryFile(profile) {
  if (typeof profile !== "string" || !path.isAbsolute(profile))
    throw new Error("Browser discovery rejected");
  const directory = fs.lstatSync(profile);
  if (!directory.isDirectory() || directory.isSymbolicLink())
    throw new Error("Browser discovery rejected");
  return path.join(profile, "DevToolsActivePort");
}
function clearDevToolsActivePort(profile) {
  const file = discoveryFile(profile);
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new Error("Browser discovery rejected");
    fs.unlinkSync(file);
  } catch (error) {
    if (error.code !== "ENOENT") throw new Error("Browser discovery rejected");
  }
}
function endpoint(port, browserPath) {
  if (
    !/^[1-9][0-9]{3,4}$/.test(port) ||
    Number(port) < 1024 ||
    Number(port) > 65535 ||
    !/^\/devtools\/browser\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
      browserPath,
    )
  )
    throw new Error("Browser discovery rejected");
  return `ws://127.0.0.1:${port}${browserPath}`;
}
function parseActivePort(content) {
  if (typeof content !== "string" || Buffer.byteLength(content) > 512)
    throw new Error("Browser discovery rejected");
  if (content === "" || /^[0-9]{1,5}\n?$/.test(content)) return null; // A write may be incomplete.
  const parts = content.split("\n");
  if (parts.length === 3 && parts[2] === "") parts.pop();
  if (parts.length !== 2) throw new Error("Browser discovery rejected");
  return endpoint(parts[0], parts[1]);
}
function readActivePort(profile) {
  const file = discoveryFile(profile);
  let fd;
  try {
    fd = fs.openSync(
      file,
      fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK,
    );
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > 512)
      throw new Error("Browser discovery rejected");
    const buffer = Buffer.alloc(513);
    const size = fs.readSync(fd, buffer, 0, buffer.length, 0);
    if (size > 512) throw new Error("Browser discovery rejected");
    return parseActivePort(buffer.subarray(0, size).toString("utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw new Error("Browser discovery rejected");
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}
function parseAnnouncement(value) {
  const url = new URL(value);
  if (
    url.protocol !== "ws:" ||
    url.hostname !== "127.0.0.1" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Browser discovery rejected");
  const result = endpoint(url.port, url.pathname);
  if (result !== value) throw new Error("Browser discovery rejected");
  return result;
}
function loopbackHttpOrigin(origin) {
  const match = /^http:\/\/127\.0\.0\.1:([1-9][0-9]{3,4})$/.exec(origin);
  if (!match) return false;
  const port = Number(match[1]);
  return port >= 1024 && port <= 65535;
}

// Chrome can announce the browser socket before /json/list accepts connections.
// Retry only that loopback list; do not follow redirects or widen the host.
async function listDevToolsPages(origin, options = {}) {
  if (!loopbackHttpOrigin(origin)) throw new Error("Browser discovery rejected");
  const fetchImpl = options.fetchImpl || fetch;
  const sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const budgetMs = options.timeoutMs ?? 15000;
  const started = Date.now();
  let last = new Error("Browser discovery rejected");
  while (Date.now() - started <= budgetMs) {
    const remaining = budgetMs - (Date.now() - started);
    try {
      const response = await fetchImpl(origin + "/json/list", {
        redirect: "error",
        signal: AbortSignal.timeout(Math.min(2000, Math.max(1, remaining))),
      });
      if (!response || response.ok !== true || typeof response.json !== "function")
        throw new Error("Browser discovery rejected");
      const targets = await response.json();
      if (
        Array.isArray(targets) &&
        targets.some(
          (row) =>
            row &&
            row.type === "page" &&
            typeof row.webSocketDebuggerUrl === "string" &&
            row.webSocketDebuggerUrl.startsWith("ws://127.0.0.1:"),
        )
      )
        return targets;
      last = new Error("Browser discovery rejected");
    } catch (error) {
      last = error instanceof Error ? error : new Error("Browser discovery rejected");
    }
    if (Date.now() - started >= budgetMs) break;
    await sleep(Math.min(200, Math.max(0, budgetMs - (Date.now() - started))));
  }
  throw last;
}

function discoverDevTools(browser, profile, timeoutError, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let timer;
    let poll;
    let settled = false;
    let output = "";
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(poll);
      browser.stderr.off("data", data);
      browser.off("error", failed);
      browser.off("exit", failed);
      if (error) reject(error);
      else resolve(value);
    };
    const failed = () => finish(new Error("Browser discovery rejected"));
    const data = (chunk) => {
      output = (output + chunk.toString()).slice(-16000);
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        try {
          finish(null, parseAnnouncement(match[1]));
        } catch {
          failed();
        }
      }
    };
    const inspect = () => {
      if (settled) return;
      try {
        const value = readActivePort(profile);
        if (value) {
          finish(null, value);
          return;
        }
      } catch {
        failed();
        return;
      }
      poll = setTimeout(inspect, 25);
    };
    browser.stderr.on("data", data);
    browser.stderr.resume(); // Continue draining after discovery without printing anything.
    browser.once("error", failed);
    browser.once("exit", failed);
    timer = setTimeout(() => finish(timeoutError()), timeoutMs);
    if (browser.exitCode != null || browser.signalCode != null) {
      failed();
      return;
    }
    inspect();
  });
}
module.exports = {
  clearDevToolsActivePort,
  parseActivePort,
  readActivePort,
  discoverDevTools,
  listDevToolsPages,
};
