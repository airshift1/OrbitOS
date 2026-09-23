/**
 * Small, dependency-free helpers for handling values that cross a trust
 * boundary: URLs typed by the user, CSS strings, colours and anything read
 * back from localStorage (which the user, an extension, or another script on
 * the same origin can edit).
 */

const MAX_URL = 2048;

/** Returns a normalised http(s) URL, or null. Credentials in the URL are rejected. */
export function safeHttpUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || s.length > MAX_URL) return null;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password) return null;
  return u.href;
}

/** True when `url` points at this page's own origin. */
export function isSameOrigin(url: string, base: string = window.location.href): boolean {
  try {
    return new URL(url, base).origin === new URL(base).origin;
  } catch {
    return false;
  }
}

const EMAIL = /^[^\s@?&#<>"'\\,;()[\]]{1,64}@[^\s@?&#<>"'\\,;()[\]]{1,255}\.[^\s@?&#<>"'\\,;()[\]]{2,}$/;

/** A `mailto:` link for a plain address, or null (no headers/extra recipients can be smuggled in). */
export function safeMailto(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const s = email.trim();
  return EMAIL.test(s) ? `mailto:${s}` : null;
}

/** Open a link in a new tab without leaking `window.opener` or the referrer. */
export function openExternal(raw: string): boolean {
  const safe = safeHttpUrl(raw);
  if (!safe) return false;
  window.open(safe, "_blank", "noopener,noreferrer");
  return true;
}

export function isHexColor(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
}

const ALLOWED_CSS_FUNCTIONS = new Set([
  "linear-gradient",
  "radial-gradient",
  "conic-gradient",
  "repeating-linear-gradient",
  "repeating-radial-gradient",
  "rgb",
  "rgba",
  "hsl",
  "hsla",
  "color-mix",
  "url",
]);

const LOCAL_IMAGE = /^\/(?!\/)[\w./-]*$/;
const DATA_IMAGE = /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;

/**
 * Wallpapers are free-form CSS `background` values. Only gradients, colours
 * and images that are local or embedded (data:) are accepted, so a custom
 * value can't trigger requests to third-party hosts.
 */
export function isSafeWallpaper(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const s = v.trim();
  if (!s || s.length > 200_000) return false;
  if (/[;{}<>\\@]/.test(s.replace(/url\(\s*(["']?)data:image\/[^)]*\1\s*\)/gi, ""))) return false;

  // every function used must be on the allow-list
  const withoutUrls = s.replace(/url\(\s*(["']?)[^)]*\1\s*\)/gi, "url()");
  for (const m of withoutUrls.matchAll(/([a-z][a-z0-9-]*)\s*\(/gi)) {
    if (!ALLOWED_CSS_FUNCTIONS.has(m[1].toLowerCase())) return false;
  }

  // every url() must be local or an embedded image
  const urls = [...s.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)];
  const urlCount = (s.match(/url\s*\(/gi) ?? []).length;
  if (urls.length !== urlCount) return false;
  for (const [, , target] of urls) {
    if (!LOCAL_IMAGE.test(target) && !DATA_IMAGE.test(target)) return false;
  }

  if (typeof CSS !== "undefined" && typeof CSS.supports === "function") {
    return CSS.supports("background", s);
  }
  return true;
}

export function sanitizeWallpaper(v: unknown, fallback: string): string {
  return isSafeWallpaper(v) ? v.trim() : fallback;
}
