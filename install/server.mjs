import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { desktopManifest, allowedOrigins, requestAllowed } from "./manifest.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const remoteConfig = join(root, "remote.json");
const remoteUrl = existsSync(remoteConfig) ? JSON.parse(readFileSync(remoteConfig, "utf8")).url : undefined;
const origins = allowedOrigins(remoteUrl);
const { middleware } = await import("./.output/server/index.mjs");
const server = createServer(async (req, res) => {
  if (!requestAllowed(req.headers, req.method ?? "GET", origins)) {
    res.writeHead(403, { "content-type": "text/plain" });
    res.end("This address is not enabled for JEV.");
    return;
  }
  const path = (req.url ?? "/").split("?")[0];
  if (req.method === "GET" && path === "/jev-health") {
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify({ app: "JEV", packageVersion: 1 }));
    return;
  }
  // Adapt the installed app's manifest while retaining the platform middleware,
  // branding, install tutorial and assets in the unchanged production handler.
  if (req.method === "GET" && ["/__grok/manifest.webmanifest", "/__grok/manifest.json"].includes(path)) {
    res.writeHead(200, { "content-type": "application/manifest+json", "cache-control": "no-cache" });
    res.end(JSON.stringify(desktopManifest));
    return;
  }
  try {
    await middleware(req, res);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
    res.end("JEV could not complete the request. Restart the app and try again.");
  }
});
server.on("error", (error) => { console.error(error); process.exitCode = 1; });
server.listen(8082, "127.0.0.1", () => console.log("JEV desktop service ready."));
