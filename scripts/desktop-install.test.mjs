import assert from "node:assert/strict";
import test from "node:test";
import { allowedOrigins, requestAllowed, desktopManifest } from "../install/manifest.mjs";

test("desktop runtime refuses unknown hosts and cross-site writes", () => {
  const origins = allowedOrigins();
  assert.equal(requestAllowed({ host: "127.0.0.1:8082" }, "GET", origins), true);
  assert.equal(requestAllowed({ host: "attacker.example" }, "GET", origins), false);
  assert.equal(requestAllowed({ host: "127.0.0.1:8082", origin: "https://attacker.example" }, "POST", origins), false);
  assert.equal(requestAllowed({ host: "127.0.0.1:8082", "sec-fetch-site": "cross-site" }, "POST", origins), false);
});
test("remote runtime accepts only an explicitly configured HTTPS origin", () => {
  const origins = allowedOrigins("https://jev.example/");
  assert.equal(requestAllowed({ host: "jev.example", origin: "https://jev.example" }, "POST", origins), true);
  assert.equal(requestAllowed({ host: "localhost:8082", "x-forwarded-host": "jev.example", origin: "https://jev.example" }, "POST", origins), true);
  assert.equal(requestAllowed({ host: "localhost:8082", "x-forwarded-host": "unknown.example" }, "GET", origins), false);
  for (const url of ["http://jev.example", "https://a:b@jev.example", "https://jev.example/path", "https://jev.example/?key=secret"]) {
    assert.throws(() => allowedOrigins(url));
  }
});
test("Android manifest supplies standalone display and both required icon sizes", () => {
  assert.equal(desktopManifest.display, "standalone");
  assert.deepEqual(desktopManifest.icons.map((icon) => icon.sizes), ["192x192", "512x512"]);
});
