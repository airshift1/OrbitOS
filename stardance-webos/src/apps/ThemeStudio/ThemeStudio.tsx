import { useEffect, useState } from "react";
import type { AppProps, ThemeName, WindowStyle } from "../../types";
import { useSystemStore, DEFAULT_ACCENT, type ThemeOverrides } from "../../stores/useSystemStore";
import { isHexColor } from "../../lib/security";
import { Button, Segmented } from "../../ui";
import "./ThemeStudio.css";

/**
 * Theme Studio edits the same design tokens the whole OS uses, so changes
 * apply live everywhere and persist with the rest of the settings.
 */

const THEMES: { value: ThemeName; label: string }[] = [
  { value: "orbit", label: "Ink" },
  { value: "dark", label: "Graphite" },
  { value: "midnight", label: "Black" },
  { value: "light", label: "Paper" },
];

const STYLES: { value: WindowStyle; label: string }[] = [
  { value: "classic", label: "Flat" },
  { value: "orbit", label: "Dots" },
  { value: "traffic", label: "Traffic" },
  { value: "linux", label: "Linux" },
  { value: "yk2000", label: "Y2K" },
  { value: "aero", label: "Aero" },
];

const ACCENTS = ["#e0653a", "#d9a441", "#86b98f", "#5fa8a0", "#8fa8d9", "#c98fb0", "#b5390f"];

function computedHex(cssVar: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  return isHexColor(v) ? v : fallback;
}

export function ThemeStudio(_props: AppProps) {
  const theme = useSystemStore((s) => s.theme);
  const accent = useSystemStore((s) => s.accentColor);
  const windowStyle = useSystemStore((s) => s.windowStyle);
  const overrides = useSystemStore((s) => s.themeOverrides);
  const setTheme = useSystemStore((s) => s.setTheme);
  const setAccentColor = useSystemStore((s) => s.setAccentColor);
  const setWindowStyle = useSystemStore((s) => s.setWindowStyle);
  const setThemeOverrides = useSystemStore((s) => s.setThemeOverrides);

  // Theme colours are read back from the live DOM once the theme attribute has been applied.
  const [base, setBase] = useState({ surface: "#191813", surface2: "#211f19" });
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setBase({ surface: computedHex("--color-surface", "#191813"), surface2: computedHex("--color-surface-2", "#211f19") });
    });
    return () => cancelAnimationFrame(raf);
  }, [theme, overrides.surface, overrides.surface2]);

  const patch = (o: Partial<ThemeOverrides>) => setThemeOverrides({ ...overrides, ...o });
  const dirty = accent !== DEFAULT_ACCENT || Object.values(overrides).some((v) => v !== undefined);

  return (
    <div className="ts">
      <div className="ts__controls">
        <section>
          <h3 className="eyebrow">Theme</h3>
          <Segmented label="Theme" value={theme} onChange={setTheme} options={THEMES} />
        </section>

        <section>
          <h3 className="eyebrow">Accent</h3>
          <div className="ts__accents">
            {ACCENTS.map((c) => (
              <button key={c} type="button" className="ts__accent" style={{ background: c }} aria-pressed={accent.toLowerCase() === c} aria-label={`Accent ${c}`} onClick={() => setAccentColor(c)} />
            ))}
            <label className="ts__custom">
              <span>Custom</span>
              <input type="color" value={isHexColor(accent) ? accent : DEFAULT_ACCENT} onChange={(e) => setAccentColor(e.target.value)} />
            </label>
          </div>
        </section>

        <section>
          <h3 className="eyebrow">Surfaces</h3>
          <div className="ts__row">
            <label>
              <span>Window</span>
              <input type="color" value={overrides.surface ?? base.surface} onChange={(e) => patch({ surface: e.target.value })} />
            </label>
            <label>
              <span>Panels</span>
              <input type="color" value={overrides.surface2 ?? base.surface2} onChange={(e) => patch({ surface2: e.target.value })} />
            </label>
            {(overrides.surface || overrides.surface2) && (
              <Button variant="quiet" size="sm" onClick={() => patch({ surface: undefined, surface2: undefined })}>
                Use theme colours
              </Button>
            )}
          </div>
        </section>

        <section>
          <h3 className="eyebrow">Corners</h3>
          <label className="ts__slider">
            <span>Windows</span>
            <input type="range" className="range" min={0} max={24} value={overrides.radiusWin ?? 4} onChange={(e) => patch({ radiusWin: Number(e.target.value) })} />
            <output>{overrides.radiusWin ?? 4}px</output>
          </label>
          <label className="ts__slider">
            <span>Controls</span>
            <input type="range" className="range" min={0} max={14} value={overrides.radiusSm ?? 2} onChange={(e) => patch({ radiusSm: Number(e.target.value) })} />
            <output>{overrides.radiusSm ?? 2}px</output>
          </label>
        </section>

        <section>
          <h3 className="eyebrow">Window style</h3>
          <Segmented label="Window style" value={windowStyle} onChange={setWindowStyle} options={STYLES} />
        </section>

        <Button
          disabled={!dirty}
          onClick={() => {
            setAccentColor(DEFAULT_ACCENT);
            setThemeOverrides({});
          }}
        >
          Reset accent and overrides
        </Button>
      </div>

      <div className="ts__preview" role="img" aria-label="Live preview of the current theme">
        <div className="eyebrow">Preview</div>
        <div className="ts__mock" aria-hidden="true">
          <div className="ts__mock-bar">Untitled note</div>
          <div className="ts__mock-body">
            <div className="ts__mock-side">
              <span className="ts__mock-nav ts__mock-nav--on" />
              <span className="ts__mock-nav" />
              <span className="ts__mock-nav" />
            </div>
            <div className="ts__mock-main">
              <strong className="display">Field notes</strong>
              <p>Every window, menu and control reads from the same tokens.</p>
              <div className="ts__mock-actions">
                <span className="btn btn--primary">Save</span>
                <span className="btn">Cancel</span>
              </div>
              <div className="ts__mock-rule" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
