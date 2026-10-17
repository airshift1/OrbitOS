import { useState } from "react";
import { Bluetooth as BluetoothIcon, Info, LayoutDashboard, Monitor, Network, Palette, PinOff, Search, Settings2, User, Volume2, Wrench, Image, Dock, Accessibility, RotateCcw, AppWindow, Shapes } from "lucide-react";
import type { AppProps, ThemeName, WindowStyle } from "../../types";
import { useSystemStore, DEFAULT_ACCENT } from "../../stores/useSystemStore";
import { useFileSystemStore } from "../../stores/useFileSystemStore";
import { appRegistry } from "../registry";
import { WALLPAPERS } from "../../lib/wallpapers";
import { launchApp } from "../../lib/launch";
import { playSound } from "../../lib/sound";
import { WORKSPACE_COUNT } from "../../lib/workspaces";
import { isHexColor, isSafeWallpaper } from "../../lib/security";
import { deleteWallpaperImage, saveWallpaperImage } from "../../lib/wallpaperStorage";
import { AppIcon } from "../../shell/AppIcon";
import { Button, Field, Segmented, Switch } from "../../ui";
import { cx, factoryReset } from "../../lib/helpers";
import { useBluetooth } from "../../platform/BluetoothContext";
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
  { id: "Wallpaper", icon: Image },
  { id: "Desktop", icon: LayoutDashboard },
  { id: "Dock & Taskbar", icon: Dock },
  { id: "Windows", icon: AppWindow },
  { id: "Icons", icon: Shapes },
  { id: "Accessibility", icon: Accessibility },
  { id: "Reset", icon: RotateCcw },
  { id: "Display", icon: Monitor },
  { id: "Sound", icon: Volume2 },
  { id: "Network", icon: Network },
  { id: "Account", icon: User },
  { id: "System", icon: Wrench },
  { id: "About", icon: Info },
] as const;
type Section = (typeof SECTIONS)[number]["id"];

const SECTION_DESCRIPTIONS: Record<Section, string> = {
  Appearance: "Personalize the desktop, colours and window surfaces.",
  Wallpaper: "Choose a built-in background or use your own image.",
  "Dock & Taskbar": "Position and size the app dock and clock.",
  Windows: "Adjust window shape, transparency, depth and motion.",
  Icons: "Tune desktop shortcuts and choose application symbols.",
  Accessibility: "Adjust scale, density and motion preferences.",
  Reset: "Restore system settings without deleting your files.",
  Display: "Adjust how OrbitOS looks on this screen.",
  Sound: "Manage system audio and notification behaviour.",
  Desktop: "Control sessions, pinned apps and virtual desktops.",
  Network: "Review browser connectivity and device radios.",
  Account: "Set the name shown across your OrbitOS session.",
  System: "Restore defaults or clear locally stored data.",
  About: "Version, runtime and device information.",
};

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

function BluetoothControl() {
  const bluetooth = useBluetooth();
  const canConnect = bluetooth.availability === "supported" && bluetooth.status !== "requesting";
  const connected = bluetooth.status === "connected";
  return (
    <div className="st-bluetooth">
      <BluetoothIcon size={15} aria-hidden="true" />
      <span className={cx("status-dot", `status-dot--${connected ? "ok" : bluetooth.availability === "unsupported" ? "muted" : "accent"}`)} aria-hidden="true" />
      <span className="st-bluetooth__state">{connected ? bluetooth.deviceName : bluetooth.availability === "unsupported" ? "Unsupported" : bluetooth.status === "requesting" ? "Waiting…" : "Not connected"}</span>
      <Button size="sm" variant={connected ? "quiet" : "primary"} disabled={!canConnect && !connected} onClick={connected ? bluetooth.disconnect : () => void bluetooth.connect()}>
        {connected ? "Disconnect" : bluetooth.status === "requesting" ? "Waiting…" : "Connect device"}
      </Button>
    </div>
  );
}

const WALLPAPER_ERROR = "Use a colour, a gradient, or an image from this site (a /path or a data: PNG, JPEG, WebP or GIF). Remote images aren't allowed.";

export function Settings(_props: AppProps) {
  const s = useSystemStore();
  const [section, setSection] = useState<Section>("Appearance");
  const [sectionQuery, setSectionQuery] = useState("");
  const [custom, setCustom] = useState("");
  const [customError, setCustomError] = useState<string | undefined>();
  const [wallpaperError, setWallpaperError] = useState<string | undefined>();
  const [iconApp, setIconApp] = useState("settings");
  const customization = s.customization;
  const updateCustomization = s.setCustomization;

  function applyCustomWallpaper() {
    if (!isSafeWallpaper(custom)) {
      setCustomError(WALLPAPER_ERROR);
      return;
    }
    selectWallpaper(custom);
    setCustom("");
    setCustomError(undefined);
  }
  function selectWallpaper(value: string) {
    const previousImage = useSystemStore.getState().customization.wallpaperImageId;
    updateCustomization({ wallpaperImageId: "" });
    s.setWallpaper(value);
    if (previousImage) void deleteWallpaperImage(previousImage).catch((error: unknown) => setWallpaperError(error instanceof Error ? error.message : "Could not remove the previous wallpaper image."));
  }

  function resetSettings() {
    if (window.confirm("Reset all settings to their defaults? Files, notes, and saved documents will be kept.")) {
      const oldImageId = s.customization.wallpaperImageId;
      s.resetSettings();
      void deleteWallpaperImage(oldImageId).catch((error: unknown) => setWallpaperError(error instanceof Error ? error.message : "Could not remove stored wallpaper image."));
    }
  }
  async function uploadWallpaper(file?: File) {
    if (!file) return;
    setWallpaperError(undefined);
    try {
      const imageId = await saveWallpaperImage(file);
      const oldImageId = useSystemStore.getState().customization.wallpaperImageId;
      updateCustomization({ wallpaperImageId: imageId });
      if (oldImageId) void deleteWallpaperImage(oldImageId).catch((error: unknown) => setWallpaperError(error instanceof Error ? error.message : "Could not remove the previous wallpaper."));
    } catch (error) {
      setWallpaperError(error instanceof Error ? error.message : "Could not save this wallpaper.");
    }
  }
  function clearWallpaperImage() {
    const oldImageId = customization.wallpaperImageId;
    updateCustomization({ wallpaperImageId: "" });
    void deleteWallpaperImage(oldImageId).catch((error: unknown) => setWallpaperError(error instanceof Error ? error.message : "Could not remove the stored wallpaper."));
  }
  function setAppIcon(icon: string) {
    updateCustomization({ iconOverrides: { ...customization.iconOverrides, [iconApp]: icon } });
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
  const filteredSections = SECTIONS.filter(({ id }) => id.toLowerCase().includes(sectionQuery.trim().toLowerCase()));

  return (
    <div className="settings">
      <nav className="settings__nav" aria-label="Settings sections">
        <div className="settings__sidebar-head">
          <div className="settings__brand">
            <span className="settings__brand-mark"><Settings2 size={17} aria-hidden="true" /></span>
            <span><small>ORBITOS</small><strong>System settings</strong></span>
          </div>
          <label className="settings__search">
            <Search size={14} aria-hidden="true" />
            <input
              type="search"
              value={sectionQuery}
              onChange={(event) => {
                const query = event.target.value;
                setSectionQuery(query);
                const match = SECTIONS.find(({ id }) => id.toLowerCase().includes(query.trim().toLowerCase()));
                if (match) setSection(match.id);
              }}
              placeholder="Find a setting"
              aria-label="Find a settings section"
            />
          </label>
        </div>

        <div className="settings__nav-group">
          <span className="settings__nav-label">SYSTEM</span>
          {filteredSections.map(({ id, icon: Icon }) => (
            <button key={id} type="button" className={cx(section === id && "active")} aria-current={section === id ? "page" : undefined} onClick={() => setSection(id)}>
              <Icon size={15} aria-hidden="true" />
              <span>{id}</span>
              {section === id && <span className="settings__nav-indicator" aria-hidden="true" />}
            </button>
          ))}
          {filteredSections.length === 0 && <p className="settings__empty">No sections found</p>}
        </div>

        <div className="settings__profile">
          <span className="settings__profile-avatar">{s.username.trim().charAt(0).toUpperCase() || "U"}</span>
          <span><strong>{s.username || "Local user"}</strong><small>Local profile</small></span>
          <User size={15} aria-hidden="true" />
        </div>
      </nav>

      <div className="settings__content">
        <header className="settings__header">
          <div className="settings__breadcrumb"><span>System</span><span aria-hidden="true">/</span><strong>{section}</strong></div>
          <div className="settings__heading-row">
            <div>
              <h2 className="settings__section-title display">{section}</h2>
              <p className="settings__section-description">{SECTION_DESCRIPTIONS[section]}</p>
            </div>
            <span className="settings__device"><Monitor size={14} aria-hidden="true" /> This device</span>
          </div>
        </header>

        {section === "Appearance" && (
          <>
            <section className="st-block">
              <h3 className="eyebrow">Theme</h3>
              <Segmented label="Theme" value={s.theme} onChange={s.setTheme} options={THEMES} />
            </section>

            <section className="st-block">
              <h3 className="eyebrow">Window and desktop colours</h3>
              <div className="st-color-pickers">
                <label>Desktop colour<input type="color" value={isHexColor(s.wallpaper) ? s.wallpaper : "#12110e"} onChange={(e) => selectWallpaper(e.target.value)} /></label>
                <label>Window surface<input type="color" value={s.themeOverrides.surface ?? "#191813"} onChange={(e) => s.setThemeOverrides({ ...s.themeOverrides, surface: e.target.value })} /></label>
                <label>Panel surface<input type="color" value={s.themeOverrides.surface2 ?? "#211f19"} onChange={(e) => s.setThemeOverrides({ ...s.themeOverrides, surface2: e.target.value })} /></label>
              </div>
              <div className="st-live-preview" aria-label="Live appearance preview">
                <strong>Live preview</strong><span>Window surface</span><button type="button">Accent button</button>
              </div>
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

        {section === "Wallpaper" && (
          <>
            <section className="st-block">
              <h3 className="eyebrow">Background gallery</h3>
              <ul className="st-wallpapers">
                {WALLPAPERS.map((w) => (
                  <li key={w.id}>
                    <button type="button" className="st-wallpaper" aria-pressed={!customization.wallpaperImageId && s.wallpaper === w.css} onClick={() => selectWallpaper(w.css)}>
                      <span className="st-wallpaper__chip" style={{ background: w.css }} /><span>{w.name}</span>
                    </button>
                  </li>
                ))}
                {["linear-gradient(135deg, #274060, #6b8f71)", "radial-gradient(circle at 20% 20%, #e9a6a6, #7558a6 65%, #23204a)", "linear-gradient(45deg, #f4d35e, #ee964b 50%, #f95738)"].map((background, i) => (
                  <li key={background}><button type="button" className="st-wallpaper" aria-pressed={s.wallpaper === background && !customization.wallpaperImageId} onClick={() => selectWallpaper(background)}><span className="st-wallpaper__chip" style={{ background }} /><span>{["Meadow", "Dreamscape", "Sunset"][i]}</span></button></li>
                ))}
              </ul>
            </section>
            <Row title="Upload image" hint="PNG, JPEG, WebP or GIF · stored privately in this browser · max 8 MB">
              <label className="btn st-file-upload">Choose image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => { void uploadWallpaper(e.currentTarget.files?.[0]); e.currentTarget.value = ""; }} /></label>
            </Row>
            {customization.wallpaperImageId && <Row title="Personal wallpaper"><Button variant="quiet" onClick={clearWallpaperImage}>Remove image</Button></Row>}
            {wallpaperError && <p className="st-error" role="alert">{wallpaperError}</p>}
            <Row title="Image fitting" hint="How your uploaded image fills the desktop">
              <Segmented label="Wallpaper fit" value={customization.wallpaperFit} onChange={(wallpaperFit) => updateCustomization({ wallpaperFit })} options={[{ value: "cover", label: "Fill" }, { value: "contain", label: "Fit" }, { value: "fill", label: "Stretch" }, { value: "center", label: "Center" }]} />
            </Row>
            <Row title="Custom background" hint="Solid CSS colour or gradient; remote image URLs are blocked">
              <div className="st-custom">
                <Field label="Colour or gradient" error={customError}>
                  {(control) => <input {...control} className="input" value={custom} onChange={(e) => { setCustom(e.target.value); setCustomError(undefined); }} placeholder="linear-gradient(135deg, #273c75, #6c5ce7)" spellCheck={false} />}
                </Field>
                <Button onClick={applyCustomWallpaper} disabled={!custom.trim()}>Apply</Button>
              </div>
            </Row>
          </>
        )}

        {section === "Desktop" && (
          <>
            <Row title="Desktop scaling" hint="Scales desktop shortcuts and dock contents">
              <label className="st-slider"><input type="range" className="range" min={80} max={125} value={customization.desktopScale} onChange={(e) => updateCustomization({ desktopScale: Number(e.target.value) })} aria-label="Desktop scaling" /><output>{customization.desktopScale}%</output></label>
            </Row>
            <Row title="Desktop shortcuts" hint="Show or hide all desktop icons"><Switch checked={customization.desktopShortcutsVisible} onChange={(desktopShortcutsVisible) => updateCustomization({ desktopShortcutsVisible })} label="Show desktop shortcuts" /></Row>
            <Row title="Icon labels"><Switch checked={customization.desktopIconLabels} onChange={(desktopIconLabels) => updateCustomization({ desktopIconLabels })} label="Show desktop icon labels" /></Row>
            <Row title="Icon size"><label className="st-slider"><input type="range" className="range" min={28} max={72} value={customization.desktopIconSize} onChange={(e) => updateCustomization({ desktopIconSize: Number(e.target.value) })} aria-label="Desktop icon size" /><output>{customization.desktopIconSize}px</output></label></Row>
            <Row title="Icon spacing"><label className="st-slider"><input type="range" className="range" min={72} max={150} value={customization.desktopIconSpacing} onChange={(e) => updateCustomization({ desktopIconSpacing: Number(e.target.value) })} aria-label="Desktop icon spacing" /><output>{customization.desktopIconSpacing}px</output></label></Row>
            <Row title="Restore windows on reload" hint="Reopen your windows, positions and desktops"><Switch checked={s.restoreSession} onChange={s.setRestoreSession} label="Restore windows on reload" /></Row>
            <section className="st-block">
              <h3 className="eyebrow">Pinned to the taskbar</h3>
              {s.pinnedApps.length === 0 && <p className="muted">Nothing pinned. Use the pin button in the App Launcher.</p>}
              <ul className="rows">{s.pinnedApps.map((id) => { const app = appRegistry[id]; if (!app) return null; return <li key={id} className="st-pin"><AppIcon icon={customization.iconOverrides[id] ?? app.icon} size={28} /><span>{app.name}</span><Button variant="quiet" size="sm" iconOnly onClick={() => s.unpinApp(id)} aria-label={`Unpin ${app.name}`}><PinOff size={14} /></Button></li>; })}</ul>
            </section>
            <section className="st-block"><h3 className="eyebrow">Virtual desktops</h3><p className="muted st-prose">{WORKSPACE_COUNT} desktops. <kbd className="kbd">Ctrl Alt 1–{WORKSPACE_COUNT}</kbd> switches; add <kbd className="kbd">Shift</kbd> to carry the focused window.</p></section>
          </>
        )}

        {section === "Dock & Taskbar" && (
          <>
            <Row title="Dock position"><Segmented label="Dock position" value={customization.dockPosition} onChange={(dockPosition) => updateCustomization({ dockPosition })} options={[{ value: "left", label: "Left" }, { value: "bottom", label: "Bottom" }, { value: "right", label: "Right" }]} /></Row>
            <Row title="Dock size"><label className="st-slider"><input type="range" className="range" min={36} max={64} value={customization.dockSize} onChange={(e) => updateCustomization({ dockSize: Number(e.target.value) })} aria-label="Dock size" /><output>{customization.dockSize}px</output></label></Row>
            <Row title="Dock icon spacing"><label className="st-slider"><input type="range" className="range" min={0} max={14} value={customization.dockSpacing} onChange={(e) => updateCustomization({ dockSpacing: Number(e.target.value) })} aria-label="Dock icon spacing" /><output>{customization.dockSpacing}px</output></label></Row>
            <Row title="Show clock"><Switch checked={customization.showClock} onChange={(showClock) => updateCustomization({ showClock })} label="Show clock" /></Row>
            <Row title="Show date"><Switch checked={customization.showClockDate} onChange={(showClockDate) => updateCustomization({ showClockDate })} label="Show date" /></Row>
            <Row title="24-hour clock"><Switch checked={customization.use24HourClock} onChange={(use24HourClock) => updateCustomization({ use24HourClock })} label="Use 24-hour clock" /></Row>
          </>
        )}

        {section === "Windows" && (
          <>
            <Row title="Corner radius"><label className="st-slider"><input type="range" className="range" min={0} max={24} value={customization.windowRadius} onChange={(e) => { const windowRadius = Number(e.target.value); updateCustomization({ windowRadius }); s.setThemeOverrides({ ...s.themeOverrides, radiusWin: windowRadius }); }} aria-label="Window corner radius" /><output>{customization.windowRadius}px</output></label></Row>
            <Row title="Window borders"><Switch checked={customization.windowBorder} onChange={(windowBorder) => updateCustomization({ windowBorder })} label="Show window borders" /></Row>
            <Row title="Window shadows"><Switch checked={customization.windowShadow} onChange={(windowShadow) => updateCustomization({ windowShadow })} label="Show window shadows" /></Row>
            <Row title="Transparency"><label className="st-slider"><input type="range" className="range" min={0} max={40} value={customization.transparency} onChange={(e) => updateCustomization({ transparency: Number(e.target.value) })} aria-label="Window transparency" /><output>{customization.transparency}%</output></label></Row>
            <Row title="Background blur"><label className="st-slider"><input type="range" className="range" min={0} max={24} value={customization.blur} onChange={(e) => updateCustomization({ blur: Number(e.target.value) })} aria-label="Window background blur" /><output>{customization.blur}px</output></label></Row>
            <Row title="Window animations"><Switch checked={customization.windowAnimations} onChange={(windowAnimations) => updateCustomization({ windowAnimations })} label="Enable window animations" /></Row>
          </>
        )}

        {section === "Icons" && (
          <>
            <Row title="Icon appearance"><Segmented label="Icon appearance" value={customization.iconStyle} onChange={(iconStyle) => updateCustomization({ iconStyle })} options={[{ value: "default", label: "Default" }, { value: "soft", label: "Soft" }, { value: "monochrome", label: "Mono" }]} /></Row>
            <Row title="Application"><select className="select" value={iconApp} onChange={(e) => setIconApp(e.target.value)}>{Object.entries(appRegistry).map(([id, app]) => <option key={id} value={id}>{app.name}</option>)}</select></Row>
            <Row title="Custom application icon" hint="Choose a built-in symbol for the selected app">
              <select className="select" value={customization.iconOverrides[iconApp] ?? appRegistry[iconApp as keyof typeof appRegistry]?.icon ?? "AppWindow"} onChange={(e) => setAppIcon(e.target.value)}>
                {["AppWindow", "Palette", "Star", "Rocket", "Gamepad2", "Folder", "TerminalSquare", "Globe", "Music", "Camera", "BookOpen", "Heart", "Zap", "Coffee", "Cat", "Sparkles", "Monitor", "Settings"].map((icon) => <option key={icon} value={icon}>{icon}</option>)}
              </select>
            </Row>
            <p className="muted st-prose">Icon choices are saved per app and follow it through the desktop, taskbar, and app lists.</p>
          </>
        )}

        {section === "Accessibility" && (
          <>
            <Row title="Density"><Segmented label="Interface density" value={customization.density} onChange={(density) => updateCustomization({ density })} options={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]} /></Row>
            <Row title="Reduce motion" hint="Disable decorative interface transitions"><Switch checked={customization.reduceMotion} onChange={(reduceMotion) => updateCustomization({ reduceMotion })} label="Reduce motion" /></Row>
            <Row title="System motion effects"><Switch checked={customization.windowAnimations} onChange={(windowAnimations) => updateCustomization({ windowAnimations })} label="Allow window animations" /></Row>
            <p className="muted st-prose">OrbitOS also respects your device's reduced-motion preference.</p>
          </>
        )}

        {section === "Reset" && (
          <div className="st-danger">
            <p className="muted st-prose">Restore appearance, desktop, window, dock, and accessibility preferences. Your files, notes, accounts, and saved app data are not deleted.</p>
            <Button variant="danger" onClick={resetSettings}>Reset settings to defaults</Button>
            {wallpaperError && <p className="st-error" role="alert">{wallpaperError}</p>}
          </div>
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

        {section === "Network" && (
          <>
            <Row title="Wi-Fi" hint="Simulated. Doesn't change your real connection.">
              <Switch checked={s.wifi} onChange={s.setWifi} label="Wi-Fi" />
            </Row>
            <Row title="Bluetooth" hint="Browser Bluetooth Low Energy only">
              <BluetoothControl />
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
