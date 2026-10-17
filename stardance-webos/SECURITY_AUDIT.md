# Security Audit — OrbitOS

## Executive Summary

The current OrbitOS checkout was reviewed as a static React/TypeScript/Vite SPA. The audit covered the actual
source, deployment configuration, browser sinks, local persistence, browser-local authentication, Git history
signature scans, dependency audit, tests, and production build. No confirmed secret values, `.env` files, backend
services, databases, WebSockets, Electron/native components, or server-side URL fetchers were found.

The most important residual risk is architectural: browser-local accounts and `localStorage` are not enforceable
authorization boundaries. OrbitOS must add a server/database auth adapter before account data can be treated as
private across people, browsers, or devices. This report does not claim that OrbitOS is fully secure or production-ready.

The deployment boundary is explicit: web-only account/session code lives under `src/web/auth` and the web root;
shared shell code uses a platform-neutral identity context; desktop uses `src/desktop/main.tsx` and a local identity
profile. `npm run build:desktop` emits `dist-desktop`, and the desktop bundle contains no web authentication markers.
An Electron main/preload wrapper is not included yet.

Scope: the whole repository as of this commit. Method: manual review of every file that handles external input,
`grep` for injection sinks and secrets, a scan of the production build, `npm audit`, unit tests, and attack
attempts against the built app in headless Chromium.

## What this app is (and what that rules out)

A web static single-page app with a browser-local account and guest-session layer plus a separate desktop renderer
target. It has no server or database, so
account records and user data remain in the current browser's storage. Passwords are never stored; local account
verifiers use salted PBKDF2. This is suitable for a shared browser demo, not for production cross-device identity.
Production deployment still needs a server auth adapter with HttpOnly/SameSite cookies, server-side authorization,
rate limiting, and a database.

## Findings

| # | Finding | Severity | Files | Fix | Verified by |
|---|---|---|---|---|---|
| 1 | No CSP or other security headers | Medium | `vercel.json`, new `security-headers.ts`, `vite.config.ts` | Strict CSP (`script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, …), HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP. One source file feeds both `vercel.json` and `vite preview`. | Headers served by `vite preview`; app boots and runs Workspaces/Paint/Settings/System Monitor with **0 CSP violations and 0 external requests**; an injected inline script was blocked (`script-src-elem`); unit test keeps `vercel.json` and the module in sync. |
| 2 | Startup error handler deleted **all** `webos-*` localStorage keys (silent data loss, one error away from wiping a user's files) | Medium | `src/main.tsx` | Removed. Errors are logged; a non-destructive fallback screen (built with DOM APIs, no `innerHTML`) is shown. | Code review. |
| 3 | Browser app: `window.open(url, "_blank")` leaked `window.opener` (reverse tabnabbing) and the referrer | Low–Medium | `MiniBrowser.tsx`, new `lib/security.ts` | `openExternal()` validates http(s) and opens with `noopener,noreferrer`. | Browser test: call arguments are `["https://example.com/", "_blank", "noopener,noreferrer"]`. |
| 4 | Browser app could frame its own origin with `allow-scripts allow-same-origin` (sandbox is ineffective for same-origin content) | Low | `MiniBrowser.tsx` | Only http(s) is framed, same-origin URLs are refused, iframe gets `referrerpolicy="no-referrer"` and an empty `allow`. | Browser test: `javascript:`, `data:` and same-origin input never produce an iframe `src` of that kind. |
| 5 | About Me links (`href={url}`) and `mailto:` came from an editable, persisted profile with no validation (`javascript:` URLs, header injection via `?cc=`) | Low | `AboutMe.tsx`, `lib/security.ts` | `safeHttpUrl()` / `safeMailto()`; links that fail validation are not rendered. | Unit tests only (URL and mailto cases in `security.test.ts`); **not** exercised in the browser. |
| 6 | Custom wallpaper accepted arbitrary CSS incl. remote `url()`/`image-set()` (tracking pixels, third-party requests) | Low | `Settings.tsx`, `useSystemStore.ts`, `lib/security.ts` | Allowlist: colours, gradients, local `/path` images and `data:` PNG/JPEG/WebP/GIF only. Enforced in the UI, the store setter and on load. | Unit tests; browser test: remote URL rejected with a visible error, valid gradient accepted. |
| 7 | Persisted settings were trusted on load | Low | `useSystemStore.ts` | `sanitizePersisted()` validates every field (enums, hex colours, ranges, app-id shape, icon positions). | Unit tests; browser test: with hostile + corrupt `localStorage` the app boots, values are cleaned, no script runs, no request leaves the origin. |
| 8 | File/folder names were not validated (empty, `/`, control characters, 1 MB names, and `*.app` names that turn a file into a protected app shortcut) | Low | `lib/fsGuards.ts`, `useFileSystemStore.ts` | `cleanNodeName()` used by `createNode` and `renameNode`; parent must be an existing folder; protected nodes can't be renamed. | 11 store tests. |
| 9 | Error boundary rendered the raw `error.message` | Low | `AppErrorBoundary.tsx` | Generic message; details go to the console only. | Code review. |
| 10 | Fonts loaded from Google Fonts (third-party request, extra CSP allowance) | Info | `index.html`, `styles/fonts.css` | Self-hosted via `@fontsource*`. | 0 external requests in the browser run. |
| 11 | Right-click inside a window or on the taskbar also opened the desktop context menu (two stacked menus) | Bug (found while testing keyboard access) | `Desktop.tsx` | Desktop menu ignores events from windows, taskbar and open menus. | Browser test. |
| 12 | No user/session boundary existed; persisted stores used global keys | Medium | `lib/userScope.ts`, `stores/useAuthStore.ts`, persisted stores | Added guest and local account entry, salted PBKDF2 verifiers, generic auth errors, failed-attempt cooldown, and user-scoped persistence. | Build and unit suite; production server adapter remains required for real multi-device auth. |
| 13 | Browser sessions had no expiry | Medium | `src/lib/userScope.ts`, `src/stores/useAuthStore.ts` | Sessions now require a finite issue time and expire after 12 hours. | `src/tests/userScope.test.ts`, 73 passing tests, production build. |
| 14 | Persisted account records and password input were weakly bounded | Low | `src/stores/useAuthStore.ts`, `src/shell/AuthScreen.tsx` | Validate account IDs, names, salts, verifiers; cap passwords at 128 characters. | 73 passing tests and production build. |
| 15 | Local account creation disclosed duplicate display names | Low | `src/stores/useAuthStore.ts` | Return a generic account-creation error. | Source review and production build. |
| 16 | Filesystem integrity depended on UI-only guards | Medium | `src/stores/useFileSystemStore.ts` | Enforce protected-node checks, valid folder destinations, cycle prevention, content limits, cycle-safe traversal, and persisted-state sanitization in the store. | Filesystem regression tests; 75 tests and production build pass. |

### Checked, no issue found
- Secrets/tokens/keys: none in source; none matched in `dist/`; no source maps shipped.
- `eval`, `new Function`, `dangerouslySetInnerHTML`, `innerHTML`, `document.write`: none in app code. The calculator is a hand-written parser (tests confirm code-like input returns no result).
- User text (notes, file contents, username, terminal output) is rendered through React text nodes. A username of `<img src=x onerror=alert(1)>` was stored and displayed as text; nothing executed.
- Session restore (`lib/session.ts`) and Workspaces layout restore validate app ids and geometry and are wrapped in `try/catch`.
- `npm audit --audit-level=moderate`: 0 vulnerabilities. No dependency was upgraded during this audit.
- Dependencies added: `@fontsource-variable/newsreader`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono` (fonts), `vitest` (dev). `@emotion/*` and `@fortawesome/*` are required by `react-workspaces`.

## Remaining risks / limitations
- **Headers depend on the host.** They are applied by Vercel (`vercel.json`) and `vite preview`. Another host must set the same headers.
- **`style-src 'unsafe-inline'`** is required because emotion (react-workspaces) and Font Awesome inject `<style>` tags at runtime. Scripts remain locked to `'self'`.
- **The Browser app frames arbitrary https sites** (that is its purpose). They are sandboxed and get no permissions, but they are third-party content. Text that isn't a URL is sent to Wikipedia search.
- **`localStorage` is not a security boundary.** Anything with script access to this origin can read/edit the user's data; the fixes above make the app robust to that, not immune.
- **Rejected file names give no on-screen explanation** (the operation is refused silently).
- Browser-local authentication is not a server security boundary. Users can inspect or clear their own storage, and accounts do not sync between browsers or devices.
- Sessions are local and expire after 12 hours, but there is no server revocation, idle timeout, device/session management, or cross-device sign-out.
- The legacy `useProfileStore` remains as a user-scoped compatibility store; the public app is now `About OrbitOS`, while `Profile` owns the active user's display preferences.

## Dependency Findings

`npm audit --audit-level=moderate` reported zero vulnerabilities. The dependency tree includes the ProjectStorm
workspace packages, React, Zustand, Lucide, Font Awesome, Emotion, Vite, TypeScript, Vitest, and Oxlint. No major
upgrade was attempted because no vulnerable dependency required remediation.

## Secrets

No `.env` files or confirmed API keys, access tokens, passwords, JWT secrets, database URLs, private keys, OAuth
secrets, cloud credentials, or webhook secrets were found in the current source/configuration tree. Git history
signature scans found no private-key markers or common GitHub/live-token prefixes. Values were not printed.

## Production Checklist

- Add a server-side identity/database layer before treating accounts as private.
- Store only password hashes/verifiers server-side; use a memory-hard password KDF where supported.
- Use Secure, HttpOnly, SameSite cookies, session rotation, expiry, revocation, CSRF protection, and rate limits.
- Configure HTTPS, DNS, exact production origins, and deployment headers on the actual host.
- Review CSP `frame-src https:` against the intended Mini Browser policy.
- Add server-side ownership checks for every user resource and database backup/restore controls.
- Keep secrets in the deployment secret manager; rotate any credential if a future scan confirms exposure.
- Add monitoring that excludes passwords, tokens, session identifiers, and private user content.
- Perform browser/device isolation tests against the real deployment, since localStorage behavior cannot establish server authorization.

## Reproducing
```bash
npm test                     # 71 unit tests (URL/CSS/colour validation, tampered storage, file names, header sync)
npm run build && npm run preview
```
