/**
 * Response headers for the production build. vercel.json mirrors these for
 * deployment (keep the two in sync — `npm test` checks that they match).
 *
 * The CSP is written for what the app really does:
 *  - all scripts, fonts and images are bundled, so 'self' is enough
 *  - `style-src 'unsafe-inline'`: emotion (react-workspaces) and Font Awesome inject <style> tags at runtime
 *  - `frame-src https:`: the Browser app embeds arbitrary https pages (sandboxed, see MiniBrowser)
 *  - no network calls are made by the app itself, so connect-src is 'self'
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CSP,
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};
