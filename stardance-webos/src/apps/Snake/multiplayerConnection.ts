export function getSnakeWebSocketUrl(configuredUrl: string): string | null {
  if (!configuredUrl) return null;
  try {
    const url = new URL(configuredUrl);
    if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "/ws")) return null;
    if (url.protocol === "https:") url.protocol = "wss:";
    else if (url.protocol === "http:") url.protocol = "ws:";
    else if (url.protocol !== "wss:" && url.protocol !== "ws:") return null;
    url.pathname = "/ws";
    return url.toString();
  } catch {
    return null;
  }
}
