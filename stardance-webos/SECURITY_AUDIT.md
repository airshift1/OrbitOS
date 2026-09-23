# Security audit — OrbitOS (Stardance WebOS)

Scope: the whole repository as of this commit. Method: manual review of every file that handles external input,
`grep` for injection sinks and secrets, a scan of the production build, `npm audit`, unit tests, and attack
attempts against the built app in headless Chromium.

## What this app is (and what that rules out)

A static single-page app. It has **no server, database, accounts, cookies or network calls of its own**. Everything
the user creates lives in `localStorage` in their own browser. So these categories do not apply and nothing was
"fixed" for them: authentication, authorization, IDOR, CSRF, SQL/command injection, server-side path traversal,
CORS, cookie flags, server error pages.

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

### Checked, no issue found
- Secrets/tokens/keys: none in source; none matched in `dist/`; no source maps shipped.
- `eval`, `new Function`, `dangerouslySetInnerHTML`, `innerHTML`, `document.write`: none in app code. The calculator is a hand-written parser (tests confirm code-like input returns no result).
- User text (notes, file contents, username, terminal output) is rendered through React text nodes. A username of `<img src=x onerror=alert(1)>` was stored and displayed as text; nothing executed.
- Session restore (`lib/session.ts`) and Workspaces layout restore validate app ids and geometry and are wrapped in `try/catch`.
- `npm audit`: 0 vulnerabilities. Outdated: `@types/node` and `typescript` (major versions only). No dependency was upgraded.
- Dependencies added: `@fontsource-variable/newsreader`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono` (fonts), `vitest` (dev). `@emotion/*` and `@fortawesome/*` are required by `react-workspaces`.

## Remaining risks / limitations
- **Headers depend on the host.** They are applied by Vercel (`vercel.json`) and `vite preview`. Another host must set the same headers.
- **`style-src 'unsafe-inline'`** is required because emotion (react-workspaces) and Font Awesome inject `<style>` tags at runtime. Scripts remain locked to `'self'`.
- **The Browser app frames arbitrary https sites** (that is its purpose). They are sandboxed and get no permissions, but they are third-party content. Text that isn't a URL is sent to Wikipedia search.
- **`localStorage` is not a security boundary.** Anything with script access to this origin can read/edit the user's data; the fixes above make the app robust to that, not immune.
- **Rejected file names give no on-screen explanation** (the operation is refused silently).
- Placeholder profile links (`github.com/yourname`, …) are demo defaults in `useProfileStore.ts`.

## Reproducing
```bash
npm test                     # 71 unit tests (URL/CSS/colour validation, tampered storage, file names, header sync)
npm run build && npm run preview
```
