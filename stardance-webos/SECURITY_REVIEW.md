# OrbitOS Security Review

Date: 2026-09-23
Scope: current `stardance-webos` checkout in the active OrbitOS repository.
Method: source and configuration review, safe secret-location scan, Git-history signature scan, dependency audit, existing tests, and production build review. No secret values were printed or stored.

## Architecture and Trust Boundaries

- **Framework:** React 19 with TypeScript, Vite, Zustand, Lucide, and ProjectStorm workspaces.
- **Frontend:** static single-page browser application. `src/main.tsx` mounts `App`; `App.tsx` gates boot, authentication, lock state, desktop, windows, taskbar, and shell overlays.
- **Deployment split:** shared shell and apps live in `OrbitShell.tsx`; web uses `App.tsx` and `src/web/auth/webSession.ts`, while desktop uses `src/desktop/main.tsx`, `DesktopApp.tsx`, and `DesktopIdentity.tsx`. The desktop bundle is emitted to `dist-desktop` and excludes web authentication modules.
- **Backend/database:** none present. No server routes, API handlers, database client, or server-side authorization were found.
- **Authentication:** web-only browser-local account records in `localStorage`, with salted PBKDF2-SHA-256 verifiers in `src/stores/useAuthStore.ts`. Guest sessions are supported. Desktop uses a local identity profile and no web account flow.
- **Sessions:** web `orbitos-session` is isolated in `src/web/auth/webSession.ts`; shared data keys are deployment-aware (`orbitos-web:<id>:<store>` or `orbitos-desktop:desktop-local:<store>`). There are no HttpOnly cookies or server sessions.
- **Storage:** Zustand `persist` stores for system, filesystem, notes, profile, notifications, window sessions, and workspace layouts. The virtual filesystem is an in-browser data structure, not the host filesystem.
- **Network/browser:** the Mini Browser embeds arbitrary HTTPS pages in a sandboxed iframe and can open validated HTTPS links in a new tab. The application itself has no server-side URL fetcher.
- **Native/WebSocket:** no Electron, native IPC, child-process, WebSocket, or server-side filesystem surface found.
- **Deployment:** Vercel configuration supplies CSP, HSTS, frame protections, referrer policy, permissions policy, and COOP. `vite preview` uses the same source headers.
- **Environment variables:** no `.env` files or environment-variable usage found in the application.
- **Dependency manager/build:** npm with `package-lock.json`; `npm run test`, `npm run lint`, and `npm run build` are available.

## Initial Findings

### SEC-001 — Browser-local authentication is not enforceable authorization

**Severity:** High for a shared/public installation; Medium for a local demo.

**Affected path:** `useAuthStore.ts`, `src/web/auth/webSession.ts`, and all user-scoped Zustand stores.

**Evidence:** account records, password verifiers, the active session ID, and private data all live in browser `localStorage`. A person with access to the same browser origin can inspect or edit `orbitos-session` and `orbitos-user:*` keys without passing the password. No backend exists to enforce ownership or authorization.

**Impact:** user isolation is a UI/storage convention, not a security boundary. A malicious or technically capable local user can read or modify another local account's notes, files, profile, settings, and session data.

**Status:** documented limitation; cannot be fixed in a static SPA without a server/database auth adapter. Production deployment must add server-side identity, authorization checks, secure cookie sessions, rate limiting, and database ownership enforcement before treating accounts as private.

### SEC-002 — Persistent browser session has no expiry or server revocation

**Severity:** Medium.

**Affected path:** `src/web/auth/webSession.ts`, `useAuthStore.ts`, `main.tsx`.

**Evidence:** a valid `orbitos-session` is restored on every load with no maximum age, idle timeout, device/session list, or remote revocation mechanism.

**Impact:** anyone who later gains access to the browser profile can reopen the last account without signing in. This is amplified by SEC-001 and is not equivalent to a secure server session.

**Status:** remediated for the browser demo with a 12-hour local session expiry. Production still requires server-controlled expiry, rotation, and revocation.

### SEC-003 — Account existence is disclosed within the local account store

**Severity:** Low in the local-only threat model.

**Affected path:** `useAuthStore.ts:createAccount`.

**Evidence:** account creation returns a distinct “display name is already in use” message.

**Impact:** it reveals whether a display name exists to another person using the same browser. It is not a network enumeration issue because there is no backend.

**Status:** remediated in the local UI with a generic account-creation failure message. Production enumeration resistance must be enforced by the server API as well.

### SEC-004 — Filesystem integrity depended on UI-only guards

**Severity:** Medium.

**Affected path:** `src/stores/useFileSystemStore.ts` and virtual filesystem callers.

**Evidence:** store mutations previously allowed direct deletion of protected folders, moves into files or descendant folders, updates to protected app shortcuts, and unbounded content. Tampered persisted graphs could contain cyclic ancestry.

**Impact:** a caller or tampered local state could corrupt the virtual filesystem, cause traversal loops, or remove system data. This is client-side integrity, not server-side authorization, because no backend exists.

**Status:** remediated at the store boundary. Protected-node checks, destination/type checks, descendant-cycle prevention, content limits, cycle-safe traversal, and persisted-state sanitization are now enforced. Regression tests cover these cases.

## Remediation Verification

- `src/web/auth/webSession.ts` now requires a finite session issue time and removes sessions older than 12 hours.
- `useAuthStore.ts` validates persisted account IDs, names, salts, and verifiers before use.
- Password inputs are bounded at 128 characters in both the form and store.
- Duplicate-name account creation returns a generic failure message.
- `src/tests/userScope.test.ts` covers stale-session removal.
- The focused test/build run passed: 73 tests passed and the production build completed successfully.

## Verified Safe Areas

- No `.env` files or confirmed credential values were found in the current source/configuration tree.
- Git-history scans found no private-key markers, GitHub token prefixes, or common live-secret signatures.
- `npm audit --audit-level=moderate` reported zero vulnerabilities.
- No `innerHTML`, `dangerouslySetInnerHTML`, `document.write`, `eval`, `new Function`, server command execution, SQL, or WebSocket code was found.
- React text rendering is used for notes, file contents, usernames, and terminal output.
- URL handling rejects non-HTTP(S) schemes and credentials; external links use `noopener,noreferrer`.
- Browser iframe content is sandboxed and same-origin frames are rejected.
- Virtual filesystem names reject traversal separators, control characters, dot paths, oversized names, and user-created `.app` shortcuts.
- Persisted settings, session windows, and workspace layouts are validated before use.
- Vercel CSP forbids inline/remote scripts and app framing; `frame-src https:` is intentionally broad for the Mini Browser.

## Not Applicable

- Server-side IDOR/BOLA, SQL/NoSQL injection, CSRF cookies, CORS policy, SSRF, database authorization, WebSocket authorization, Electron IPC, native filesystem access, and server error responses do not apply because this checkout has no backend or native runtime.
- Client-side browser access to an HTTPS iframe is not server-side SSRF; it remains untrusted third-party content and a browser privacy consideration.
- The desktop target is currently a separate renderer build, not an Electron wrapper. Before packaging it, add a secure main/preload boundary with context isolation, sandboxing, navigation restrictions, and validated IPC; do not reuse web auth.

## Verification Run During Initial Audit

- Secret-location scan: no `.env` files; no confirmed secret locations.
- Git history signature scan: no private-key or common token signature commits.
- Dependency audit: zero reported vulnerabilities.
- Existing code review: completed for auth, storage, URL/iframe, filesystem, error boundaries, deployment headers, and browser sinks.

This document is an initial review, not a claim that OrbitOS is fully secure or production-ready.
