import test from "node:test";
import assert from "node:assert/strict";
import { announcedQuickTunnel, readyTunnelAddress, loopbackTunnelOrigin } from "./bunny-tunnel-state.mjs";

const announcement = [
  "2026-10-02T13:20:00Z INF | Your quick Tunnel has been created! Visit it at (it may take some time to be reachable): |",
  "2026-10-02T13:20:00Z INF | https://verified-bunny-candidate.trycloudflare.com |",
].join("\n");
const registered = "2026-10-02T13:20:01Z INF Registered tunnel connection connIndex=0 protocol=http2";

test("Cloudflare API errors and documentation are never public companion URLs", () => {
  const failure = 'failed to request quick Tunnel: Post "https://api.trycloudflare.com/tunnel": socket access forbidden';
  assert.equal(announcedQuickTunnel(failure), null);
  assert.equal(readyTunnelAddress(`${failure}\n${registered}`), null);
  assert.equal(announcedQuickTunnel("Visit https://other.trycloudflare.com in the docs"), null);
});

test("quick tunnel publishing requires both actual announcement and registered connection", () => {
  assert.equal(announcedQuickTunnel(announcement), "https://verified-bunny-candidate.trycloudflare.com");
  assert.equal(readyTunnelAddress(announcement), null);
  assert.equal(readyTunnelAddress(`${announcement}\n${registered}`), "https://verified-bunny-candidate.trycloudflare.com");
  assert.equal(readyTunnelAddress(registered), null);
});

test("chunked cloudflared output stays unavailable until the full hostname and connection arrive", () => {
  let buffered = "";
  const chunks = [announcement.slice(0, 90), announcement.slice(90, -24), announcement.slice(-24), `\n${registered}`];
  chunks.forEach((chunk, index) => {
    buffered += chunk;
    assert.equal(readyTunnelAddress(buffered), index === 3 ? "https://verified-bunny-candidate.trycloudflare.com" : null);
  });
});

test("an announced API service address is rejected even after connection text", () => {
  assert.equal(readyTunnelAddress(`${announcement.replace("verified-bunny-candidate", "api")}\n${registered}`), null);
});

test("named tunnels retain their configured origin and wait for registration", () => {
  assert.equal(readyTunnelAddress("Starting named tunnel", "https://bunny.example.com"), null);
  assert.equal(readyTunnelAddress(registered, "https://bunny.example.com"), "https://bunny.example.com");
});

test("candidate tunnel target is loopback-only without changing the installed default", () => {
  assert.equal(loopbackTunnelOrigin(), "http://127.0.0.1:8084");
  assert.equal(loopbackTunnelOrigin("http://127.0.0.1:8085/"), "http://127.0.0.1:8085");
  for (const address of ["https://127.0.0.1:8085", "http://0.0.0.0:8085", "http://example.com:8085", "http://127.0.0.1", "http://user@127.0.0.1:8085", "http://127.0.0.1:8085/path", "http://127.0.0.1:8085/?a=1"]) {
    assert.throws(() => loopbackTunnelOrigin(address));
  }
});
