export type DeploymentTarget = "web" | "desktop";

export const DEPLOYMENT_TARGET: DeploymentTarget = import.meta.env.VITE_ORBITOS_TARGET === "desktop" ? "desktop" : "web";
const WEB_SESSION_KEY = "orbitos-session";
const DESKTOP_SCOPE = "desktop-local";

function readWebScope(): string {
  try {
    const raw = localStorage.getItem(WEB_SESSION_KEY);
    if (!raw) return "guest";
    const parsed = JSON.parse(raw) as { userId?: unknown; issuedAt?: unknown };
    if (typeof parsed.userId !== "string" || !/^[a-z0-9-]{1,80}$/i.test(parsed.userId)) return "guest";
    if (typeof parsed.issuedAt !== "number" || !Number.isFinite(parsed.issuedAt)) return "guest";
    return Date.now() - parsed.issuedAt <= 12 * 60 * 60 * 1000 ? parsed.userId : "guest";
  } catch {
    return "guest";
  }
}

export function getStorageScope(): string {
  return DEPLOYMENT_TARGET === "desktop" ? DESKTOP_SCOPE : readWebScope();
}

export function scopedStorageKey(name: string): string {
  const prefix = DEPLOYMENT_TARGET === "desktop" ? "orbitos-desktop" : "orbitos-web";
  return `${prefix}:${getStorageScope()}:${name}`;
}
