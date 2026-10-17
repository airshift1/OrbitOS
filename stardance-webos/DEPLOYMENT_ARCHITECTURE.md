# OrbitOS Deployment Architecture

OrbitOS has two composition roots over one shared shell.

## Shared

`OrbitShell`, window management, apps, filesystem store, settings, themes, context menus, and UI primitives are reusable across targets. Shared persistence uses `src/platform/storageScope.ts` and receives a deployment namespace.

## Web

The web entrypoint is `src/main.tsx` -> `src/App.tsx`.

Web-only modules:

- `src/shell/AuthScreen.tsx`
- `src/stores/useAuthStore.ts`
- `src/web/auth/webSession.ts`
- browser guest/account/session behavior
- future server/API authorization adapter

Web data keys use the `orbitos-web:<user>:<store>` namespace. This is browser-local today and is not enforceable server authorization.

## Desktop

The desktop renderer entrypoint is `src/desktop/main.tsx` -> `src/desktop/DesktopApp.tsx`.

Desktop-only modules:

- `src/desktop/DesktopIdentity.tsx`
- local profile identity
- desktop-local storage namespace
- future Electron main/preload integration

The desktop composition does not import the web auth store or web session module. Build it with:

```bash
npm run build:desktop
```

Desktop output is written to `dist-desktop`. An Electron wrapper is not included yet; when added, it must use context isolation, sandboxing, restricted navigation, and narrowly validated IPC. It must not reuse web accounts or web sessions.
