export const desktopManifest = {
  name: "Bunny-A",
  short_name: "Bunny-A",
  description: "Route tasks to your computer's AI agents and review their results.",
  id: "/",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#0b101b",
  theme_color: "#0b101b",
  prefer_related_applications: false,
  icons: [
    { src: "/bunny-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
    { src: "/bunny-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
  ],
};

export function allowedOrigins(remoteUrl, port = 8082) {
  const origins = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`]);
  if (remoteUrl) {
    const url = new URL(remoteUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      throw new Error("Remote address must be an HTTPS origin without credentials, path, or query.");
    }
    origins.add(url.origin);
  }
  return origins;
}

export function requestAllowed(headers, method, origins) {
  const hosts = new Set([...origins].map((origin) => new URL(origin).host));
  if (!hosts.has(headers.host)) return false;
  if (headers["x-forwarded-host"] && !hosts.has(headers["x-forwarded-host"])) return false;
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && headers.origin && !origins.has(headers.origin)) return false;
  if (headers["sec-fetch-site"] === "cross-site") return false;
  return true;
}
