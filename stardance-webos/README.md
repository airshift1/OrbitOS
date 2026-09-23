# OrbitOS — Stardance WebOS

A browser-based desktop operating system built with **React 19 + TypeScript + Vite + Zustand**.
This is "webos 1" rebuilt as a working project by merging the features of five WebOS-style
codebases plus the OrbitOS design into one app.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm test           # unit tests (security helpers, colour maths, file system)
npm run preview    # serve dist/ with the production security headers
```

## What's in it

**Shell**
- Draggable / 8-way resizable windows, minimize / maximize, per-window error boundary (a crashing app never takes down the OS)
- **Snap tiling** — drag a title bar to an edge or corner (halves, quarters, maximize) with a live preview
- **4 virtual desktops** — `Ctrl+Alt+1‥4` to switch, add `Shift` to carry the focused window; also via title-bar menu
- **Spotlight** (`Ctrl+K`) — search apps, files in the virtual file system, and system actions
- Taskbar with pinned apps, running windows, live **hover thumbnails**, an app-folder flyout, virtual-desktop pills, real battery status (where the browser exposes it), clock
- Start menu (search / pinned / all apps / recent / power), Quick Settings + notification centre, toast notifications with Do Not Disturb
- Boot screen, lock screen, flat wallpapers (Ink, Graphite, Bone, ruled/grid patterns or your own CSS), mobile layout (one full-screen window at a time)
- 6 window styles: Flat (default), Dots, Traffic, Linux, Y2K, Aero
- Optional **session restore** (Settings → Desktop)

**Apps** (14) — Welcome, File Explorer (grid/list, filter, drag & drop), Notes, Text Editor, Terminal (`theme`, `style`, `ws`, `ps`, `kill`, `notify`, `lock`, …), Calculator, Clock, Paint, Browser, **Workspaces**, System Monitor, App Launcher, Theme Studio, Settings, About Me.

**Workspaces** hosts real OrbitOS apps in a tiling layout powered by
[`@projectstorm/react-workspaces`](https://github.com/projectstorm/react-workspaces): drag panels to split, tab or tray them,
resize dividers, float apps in windows, save the layout. It is code-split into its own chunk.

**System Monitor** shows measured values only: main-thread load (Long Tasks API), frame rate (rAF),
JS heap (Chromium's `performance.memory`), and storage (`navigator.storage.estimate()` + virtual disk size).
Where the browser doesn't expose a metric it says "n/a" instead of inventing a number.

Wi-Fi / Bluetooth toggles are simulated UI state and are labelled as such.

## Layout

```
src/
  shell/      Desktop, Window, Taskbar, StartMenu, Spotlight, QuickPanel, Boot/Lock screens
  apps/       one folder per app + registry.tsx (single source of truth for every app)
  stores/     zustand stores: system, windows, file system, notes, notifications, profile
  lib/        snap, geometry, search, session, sound, appearance, shortcuts …
  ui/         shared components: Button, Switch, Segmented, Field, EmptyState
  styles/     tokens.css (colours, type, radii — the only place they are defined), ui.css, global.css, window-styles.css
  tests/      vitest unit tests
security-headers.ts   CSP + headers, shared by vercel.json and `vite preview`
```

## Design

Two primary tones (ink and paper) and one accent (signal orange). Headings are set in Newsreader, the interface in
IBM Plex Sans, code in IBM Plex Mono — all bundled, none fetched from a CDN. Themes: Ink (default), Paper, Graphite,
Black. All text/background pairs meet WCAG AA (measured on the rendered app in every theme). Motion is short and
respects `prefers-reduced-motion`. Colours and radii live in `src/styles/tokens.css`; shared controls in `src/ui/`.

## Security

See `SECURITY_AUDIT.md`. It is a client-only app with no backend; the audit covers input handling, storage, the
Browser app's iframe, and a strict Content-Security-Policy.

Adding an app = a component + one entry in `src/apps/registry.tsx`.

## Credits & licenses

Built by merging / porting from:

| Source | License | Used for |
| --- | --- | --- |
| WebOS (Martin-R-D) | MIT | base window manager, virtual file system, original apps |
| @maomaolabs/core (MaoMao Labs) | MIT | window chrome styles (traffic / linux / yk2000 / aero), taskbar folders, window previews, mobile toolbar idea |
| @projectstorm/react-workspaces (Storm) | MIT | the tiling engine (installed from npm) |
| webos-master | **no license file found** | snap zones, virtual desktops, Spotlight, Theme Studio, Notes — re-implemented here |
| OrbitOS design mock-up | **no license file found** | visual design & UX of the shell |

> ⚠️ `webos-master` and the OrbitOS design mock-up shipped without a license. Their ideas and
> visuals were re-implemented rather than copied verbatim, but confirm you have the right to
> publish derivatives of them before releasing this project.

This project is MIT-licensed (see `LICENSE`).
