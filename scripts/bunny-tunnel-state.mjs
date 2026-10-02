// Parse cloudflared's successful address announcement, never API/error URLs.
// Publishing waits for a registered edge connection as well as the announcement.
export function announcedQuickTunnel(output) {
  const announcement = output.lastIndexOf("Your quick Tunnel has been created!");
  if (announcement < 0) return null;
  const section = output.slice(announcement, announcement + 2000);
  const address = section.match(/\|\s*(https:\/\/([a-z0-9-]+)\.trycloudflare\.com)\s*\|/);
  if (!address || address[2] === "api") return null;
  return address[1];
}

export function readyTunnelAddress(output, namedUrl = null) {
  if (!/\bRegistered tunnel connection\b/.test(output)) return null;
  return namedUrl ?? announcedQuickTunnel(output);
}

// The tunnel remains outbound-only. A candidate may use a separate loopback
// listener without repointing or replacing the installed dashboard gateway.
export function loopbackTunnelOrigin(value = "http://127.0.0.1:8084") {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    !url.port ||
    url.username || url.password ||
    url.pathname !== "/" || url.search || url.hash
  ) throw new Error("Tunnel target must be an HTTP loopback origin with an explicit port.");
  return url.origin;
}
