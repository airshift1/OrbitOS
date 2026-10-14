import { useState } from "react";
import { Info, LayoutDashboard, Monitor, Network, Palette, PinOff, User, Volume2, Wrench } from "lucide-react";
import type { AppProps, ThemeName, WindowStyle } from "../../types";
import { useSystemStore, DEFAULT_ACCENT } from "../../stores/useSystemStore";
import { useFileSystemStore } from "../../stores/useFileSystemStore";
import { appRegistry } from "../registry";
import { WALLPAPERS } from "../../lib/wallpapers";
import { launchApp } from "../../lib/launch";
import { playSound } from "../../lib/sound";
import { WORKSPACE_COUNT } from "../../lib/workspaces";
import { isHexColor, isSafeWallpaper } from "../../lib/security";
import { AppIcon } from "../../shell/AppIcon";
import { Button, Field, Segmented, Switch } from "../../ui";
import { cx, factoryReset } from "../../lib/helpers";
import "./Settings.css";

const THEMES: { value: ThemeName; label: string }[] = [
  { value: "orbit", label: "Ink" },
  { value: "dark", label: "Graphite" },
  { value: "midnight", label: "Black" },
  { value: "light", label: "Paper" },
];

const WINDOW_STYLES: { value: WindowStyle; label: string }[] = [
  { value: "classic", label: "Flat" },
  { value: "orbit", label: "Dots" },
  { value: "traffic", label: "Traffic" },
  { value: "linux", label: "Linux" },
  { value: "yk2000", label: "Y2K" },
  { value: "aero", label: "Aero" },
];

const ACCENTS = ["#e0653a", "#d9a441", "#86b98f", "#5fa8a0", "#8fa8d9", "#c98fb0", "#b5390f"];

const SECTIONS = [
  { id: "Appearance", icon: Palette },
  { id: "Display", icon: Monitor },
  { id: "Sound", icon: Volume2 },
  { id: "Desktop", icon: LayoutDashboard },
  { id: "Network", icon: Network },
  { id: "Account", icon: User },
  { id: "System", icon: Wrench },
  { id: "About", icon: Info },
] as const;
type Section = (typeof SECTIONS)[number]["id"];

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="st-row">
      <div className="st-row__text">
        <strong>{title}</strong>
        {hint && <small>{hint}</small>}
      </div>
      <div className="st-row__control">{children}</div>
    </div>
  );
}

const WALLPAPER_ERROR = "Use a colour, a gradient, or an image from this site (a /path or a data: PNG, JPEG, WebP or GIF). Remote images aren't allowed.";

export function Settings(_props: AppProps) {
  const s = useSystemStore();
  const [section, setSection] = useState<Section>("Appearance");
  const [custom, setCustom] = useState("");
  const [customError, setCustomError] = useState<string | undefined>();

  function applyCustomWallpaper() {
    if (!isSafeWallpaper(custom)) {
      setCustomError(WALLPAPER_ERROR);
      return;
    }
    s.setWallpaper(custom);
    setCustom("");
    setCustomError(undefined);
  }

  function resetSettings() {
    if (window.confirm("Reset all settings to their defaults?")) s.resetSettings();
  }
  function resetFs() {
    if (window.confirm("Reset the file system? Every file and folder you created will be deleted.")) {
      useFileSystemStore.getState().resetFileSystem();
      location.reload();
    }
  }
  function factory() {
    if (window.confirm("Erase everything OrbitOS has stored in this browser (settings, files, notes, profile)?")) factoryReset();
  }

  const nav2 = navigator as Navigator & { deviceMemory?: number };

  return (
    <div className="settings">
      <nav className="settings__nav" aria-label="Settings sections">
        {SECTIONS.map(({ id, icon: Icon }) => (
          <button key={id} type="button" className={cx(section === id && "active")} aria-current={section === id ? "page" : undefined} onClick={() => setSection(id)}>
            <Icon size={15} aria-hidden="true" />
            <span>{id}</span>
          </button>
        ))}
      </nav>

      <div className="settings__content">
        <h2 className="settings__section-title display">{section}</h2>

        {section === "Appearance" && (
          <>
            <section className="st-block" aria-labelledby="st-wall">
              <h3 className="eyebrow" id="st-wall">Wallpaper</h3>
              <ul className="st-wallpapers">
                {WALLPAPERS.map((w) => (
                  <li key={w.id}>
                    <button type="button" className="st-wallpaper" aria-pressed={s.wallpaper === w.css} onClick={() => s.setWallpaper(w.css)}>
                      <span className="st-wallpaper__chip" style={{ background: w.css }} />
                      <span>{w.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="st-custom">
                <Field label="Custom wallpaper (CSS)" error={customError}>
                  {(control) => (
                    <input
                      {...control}
                      className="input"
                      value={custom}
                      onChange={(e) => {
                        setCustom(e.target.value);
                        setCustomError(undefined);
                      }}
                      onKeyDown={(e) => e.key === "Enter" && applyCustomWallpaper()}
                      placeholder="linear-gradient(#1b1a17, #0f0e0c)"
                      spellCheck={false}
                    />
                  )}
                </Field>
                <Button onClick={applyCustomWallpaper} disabled={!custom.trim()}>Apply</Button>
              </div>
            </section>

            <section className="st-block">
              <h3 className="eyebrow">Theme</h3>
              <Segmented label="Theme" value={s.theme} onChange={s.setTheme} options={THEMES} />
            </section>

            <section className="st-block">
              <h3 className="eyebrow">Accent colour</h3>
              <div className="st-swatches">
                {ACCENTS.map((c) => (
                  <button key={c} type="button" className="st-swatch" style={{ background: c }} aria-pressed={s.accentColor.toLowerCase() === c} aria-label={`Accent ${c}`} onClick={() => s.setAccentColor(c)} />
                ))}
                <label className="st-custom-accent">
                  <span>Custom</span>
                  <input type="color" value={isHexColor(s.accentColor) ? s.accentColor : DEFAULT_ACCENT} onChange={(e) => s.setAccentColor(e.target.value)} />
                </label>
              </div>
            </section>

            <section className="st-block">
              <h3 className="eyebrow">Window style</h3>
              <Segmented label="Window style" value={s.windowStyle} onChange={s.setWindowStyle} options={WINDOW_STYLES} />
            </section>

            <Button variant="quiet" onClick={() => launchApp("theme-studio")}>Open Theme Studio for surfaces and corner radius →</Button>
          </>
        )}

        {section === "Display" && (
          <>
            <Row title="Brightness" hint="Dims the whole desktop">
              <label className="st-slider">
                <input type="range" className="range" min={20} max={100} value={s.brightness} onChange={(e) => s.setBrightness(Number(e.target.value))} aria-label="Brightness" />
                <output>{s.brightness}%</output>
              </label>
            </Row>
            <Row title="Night light" hint="Warmer colours for the evening">
              <Switch checked={s.nightMode} onChange={s.setNightMode} label="Night light" />
            </Row>
            <Row title="Screen" hint="As reported by the browser">
              <span className="muted st-num">{window.innerWidth} × {window.innerHeight} px · {window.devicePixelRatio}×</span>
            </Row>
          </>
        )}

        {section === "Sound" && (
          <>
            <Row title="System sounds" hint="Windows, clicks and notifications">
              <Switch checked={s.soundEnabled} onChange={() => s.toggleSound()} label="System sounds" />
            </Row>
            <Row title="Volume">
              <label className="st-slider">
                <input type="range" className="range" min={0} max={100} value={s.volume} onChange={(e) => s.setVolume(Number(e.target.value))} onPointerUp={() => playSound("chime")} aria-label="Volume" />
                <output>{s.volume}</output>
              </label>
            </Row>
            <Row title="Startup sound" hint="Play a tone when OrbitOS starts">
              <Switch checked={s.startupSound} onChange={s.setStartupSound} label="Startup sound" />
            </Row>
            <Row title="Do not disturb" hint="No pop-ups or alert sounds. Notifications are still kept.">
              <Switch checked={s.doNotDisturb} onChange={s.setDoNotDisturb} label="Do not disturb" />
            </Row>
          </>
        )}

        {section === "Desktop" && (
          <>
            <Row title="Restore windows on reload" hint="Reopen your windows, positions and desktops">
              <Switch checked={s.restoreSession} onChange={s.setRestoreSession} label="Restore windows on reload" />
            </Row>
            <section className="st-block">
              <h3 className="eyebrow">Pinned to the taskbar</h3>
              {s.pinnedApps.length === 0 && <p className="muted">Nothing pinned. Use the pin button in the App Launcher.</p>}
              <ul className="rows">
                {s.pinnedApps.map((id) => {
                  const app = appRegistry[id];
                  if (!app) return null;
                  return (
                    <li key={id} className="st-pin">
                      <AppIcon icon={app.icon} size={28} />
                      <span>{app.name}</span>
                      <Button variant="quiet" size="sm" iconOnly onClick={() => s.unpinApp(id)} aria-label={`Unpin ${app.name}`}>
                        <PinOff size={14} />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </section>
            <section className="st-block">
              <h3 className="eyebrow">Virtual desktops</h3>
              <p className="muted st-prose">
                {WORKSPACE_COUNT} desktops. <kbd className="kbd">Ctrl Alt 1–{WORKSPACE_COUNT}</kbd> switches; add <kbd className="kbd">Shift</kbd> to carry the focused window. You can also right-click a title bar.
              </p>
            </section>
          </>
        )}

        {section === "Network" && (
          <>
            <Row title="Wi-Fi" hint="Simulated. Doesn't change your real connection.">
              <Switch checked={s.wifi} onChange={s.setWifi} label="Wi-Fi" />
            </Row>
            <Row title="Bluetooth" hint="Simulated. No hardware is touched.">
              <Switch checked={s.bluetooth} onChange={s.setBluetooth} label="Bluetooth" />
            </Row>
            <Row title="Browser connection" hint="From navigator.onLine">
              <span className={cx("status", navigator.onLine ? "status--ok" : "status--bad")}>{navigator.onLine ? "Online" : "Offline"}</span>
            </Row>
          </>
        )}

        {section === "Account" && (
          <div className="st-account">
            <Field label="Display name" hint="Shown in the Start menu and on the lock screen. 32 characters max.">
              {(control) => <input {...control} className="input" value={s.username} maxLength={32} onChange={(e) => s.setUsername(e.target.value)} />}
            </Field>
          </div>
        )}

        {section === "System" && (
          <div className="st-danger">
            <p className="muted st-prose">These can't be undone. Everything is stored in this browser only.</p>
            <Button variant="danger" onClick={resetSettings}>Reset settings</Button>
            <Button variant="danger" onClick={resetFs}>Reset file system</Button>
            <Button variant="danger" onClick={factory}>Erase all OrbitOS data</Button>
          </div>
        )}

        {section === "About" && (
          <div className="st-about">
            <p className="display st-about__name">OrbitOS <span className="muted">1.0</span></p>
            <p className="muted st-prose">Built for the Hack Club Stardance WebOS 1 project from several open-source WebOS codebases.</p>
            <dl>
              <dt>Stack</dt><dd>React 19, TypeScript, Vite, Zustand</dd>
              <dt>Tiling</dt><dd>react-workspaces (@projectstorm)</dd>
              <dt>Browser</dt><dd>{navigator.userAgent.split(") ").pop()}</dd>
              <dt>CPU threads</dt><dd>{navigator.hardwareConcurrency ?? "n/a"}</dd>
              <dt>Device memory</dt><dd>{nav2.deviceMemory ? `${nav2.deviceMemory} GB` : "n/a"}</dd>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
