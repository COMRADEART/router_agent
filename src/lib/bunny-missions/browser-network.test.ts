import test from "node:test";
import assert from "node:assert/strict";
import { createServer, request } from "node:http";
import { connect } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { blockedAddress, checkingProxy, resolvePublic } from "./capabilities/browser-network.server.ts";
import { BrowserCapability, safeUrl } from "./capabilities/browser.server.ts";
import { startHost } from "../bunny-host/http.server.ts";
import type { ExecutionContext } from "./capabilities/bus.server.ts";

test("MA0R: browser refuses local/special IPv4 and IPv6, including mapped/tunneled loopback", () => {
  for (const address of ["0.0.0.0", "10.1.2.3", "127.0.0.1", "169.254.1.2", "172.16.3.4", "192.168.1.2", "100.64.0.1", "198.18.0.1", "224.0.0.1", "255.255.255.255", "::", "::1", "fc00::1", "fd00::2", "fe80::1", "ff02::1", "::ffff:127.0.0.1", "64:ff9b::7f00:1", "2002:7f00:1::", "2001:db8::1"]) assert.ok(blockedAddress(address), address);
  for (const address of ["8.8.8.8", "93.184.216.34", "2606:4700:4700::1111"]) assert.ok(!blockedAddress(address), address);
  for (const raw of ["http://localhost/", "http://localhost./", "http://127.0.0.1/", "http://[::1]/", "http://[fd00::1]/", "http://2130706433/"]) assert.throws(() => safeUrl(raw));
});

test("MA0R: all DNS answers are checked; public names resolving to private addresses are denied", async () => {
  for (const address of ["127.0.0.1", "10.1.2.3", "172.16.1.1", "192.168.2.1", "::1", "fd12::1", "fe80::1"]) {
    await assert.rejects(resolvePublic(new URL("https://public.example"), { lookup: async () => [{ address: "8.8.8.8", family: 4 }, { address, family: address.includes(":") ? 6 : 4 }] }), /DNS destination refused/);
  }
  assert.equal(await resolvePublic(new URL("https://public.example"), { lookup: async () => [{ address: "8.8.8.8", family: 4 }] }), "8.8.8.8");
  await assert.rejects(resolvePublic(new URL("https://public.example"), { lookup: async () => [] }), /No DNS/);
});

function viaProxy(proxy: string, url: string, method = "GET"): Promise<{ status: number; body: string }> {
  return new Promise((done, reject) => {
    const destination = new URL(proxy);
    const req = request({ hostname: destination.hostname, port: destination.port, path: url, method, agent: false }, (res) => {
      let body = ""; res.on("data", (chunk) => { body += String(chunk); }); res.on("end", () => done({ status: res.statusCode!, body }));
    });
    req.on("connect", (res, socket) => { socket.destroy(); done({ status: res.statusCode!, body: "" }); });
    req.setTimeout(5000, () => req.destroy(new Error("Test proxy timeout"))); req.on("error", reject); req.end();
  });
}
test("MA0R: proxy pins the checked public IP, preserves Host, and denies a later DNS rebind and TLS CONNECT", async () => {
  let privateAnswer = false; const connections: string[] = [];
  const fixture = createServer((req, res) => { res.end(`HOST=${req.headers.host}`); });
  await new Promise<void>((done) => fixture.listen(0, "127.0.0.1", done));
  const port = (fixture.address() as { port: number }).port;
  const proxy = await checkingProxy({ lookup: async () => [{ address: privateAnswer ? "127.0.0.1" : "93.184.216.34", family: 4 }], connect: (address) => { connections.push(address); return connect({ host: "127.0.0.1", port }); } });
  try {
    const first = await viaProxy(proxy.url, "http://public.example/");
    assert.equal(first.status, 200); assert.equal(first.body, "HOST=public.example");
    assert.deepEqual(connections, ["93.184.216.34"], "only the checked literal address reaches the connector");
    privateAnswer = true;
    assert.equal((await viaProxy(proxy.url, "http://public.example/second")).status, 403);
    assert.equal((await viaProxy(proxy.url, "public.example:443", "CONNECT")).status, 403);
    assert.deepEqual(connections, ["93.184.216.34"], "blocked answers never open a socket");
  } finally { await proxy.close(); await new Promise<void>((done) => fixture.close(() => done())); }
});

test("MA0R: isolated Chromium cannot reach Bunny Host via private DNS, redirects, subresources or rebinding", { timeout: 120_000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), "bunny-ma0r-network-"));
  const host = await startHost({ dataDirectory: join(directory, "host"), root: directory, port: 0 });
  const hostPort = (host.server.address() as { port: number }).port;
  let hostHits = 0; host.server.on("request", () => { hostHits++; });
  let rebind = false; const connected: string[] = [];
  const fixture = createServer((req, res) => {
    if (req.url === "/redirect-private") { res.writeHead(302, { location: `http://private.example:${hostPort}/state` }); res.end(); return; }
    if (req.url === "/redirect-loopback") { res.writeHead(302, { location: `http://127.0.0.1:${hostPort}/state` }); res.end(); return; }
    res.writeHead(200, { "content-type": "text/html" });
    res.end(`<!doctype html><title>Public fixture</title><h1>Public content</h1><iframe src="http://private.example:${hostPort}/state"></iframe><script>fetch('http://private.example:${hostPort}/state').catch(()=>{});new WebSocket('ws://private.example:${hostPort}/')</script>`);
  });
  await new Promise<void>((done) => fixture.listen(0, "127.0.0.1", done));
  const port = (fixture.address() as { port: number }).port;
  const browser = new BrowserCapability(join(directory, "browser"), { network: {
    lookup: async (hostname) => [{ address: hostname === "public.example" && !rebind ? "93.184.216.34" : "127.0.0.1", family: 4 }],
    connect: (address) => { connected.push(address); assert.equal(address, "93.184.216.34", "private destination cannot reach the dial seam"); return connect({ host: "127.0.0.1", port }); },
  } });
  const context: ExecutionContext = { missionId: null, stepId: null, cwd: directory, roots: [directory], dataDirectory: directory, signal: new AbortController().signal, timeoutMs: 15_000 };
  try {
    const publicPage = await browser.execute("browser.navigate", { url: "http://public.example/" }, context);
    assert.equal(publicPage.ok, true);
    const read = await browser.execute("browser.read", {}, context);
    assert.match((read.output as { text: string }).text, /Public content/);
    for (const url of [`http://private.example:${hostPort}/state`, "http://public.example/redirect-private", "http://public.example/redirect-loopback", `http://localhost:${hostPort}/state`, `http://[::1]:${hostPort}/state`, "http://10.1.2.3/"]) await assert.rejects(browser.execute("browser.navigate", { url }, context));
    rebind = true;
    await assert.rejects(browser.execute("browser.navigate", { url: "http://public.example/rebind" }, context), /blocked/);
    assert.ok(connected.length > 0, "legitimate public fixture was connected");
    assert.equal(hostHits, 0, "no request reached the real Bunny Host, even before bearer authorization");
  } finally {
    await browser.close(); await host.close(); await new Promise<void>((done) => fixture.close(() => done())); rmSync(directory, { recursive: true, force: true });
  }
});
