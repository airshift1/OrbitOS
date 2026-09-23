import type { AppId, AppProps } from "../../types";
import { appRegistry } from "../registry";
import { launchApp } from "../../lib/launch";
import "./Welcome.css";

const START_HERE: { app: AppId; text: string }[] = [
  { app: "workspaces", text: "Split the screen into columns, tabs and floating panels, each running a real app." },
  { app: "notes", text: "Plain notes, saved as you type." },
  { app: "file-explorer", text: "Files and folders stored in this browser. Drag to move, right-click for more." },
  { app: "terminal", text: "Type help for commands. It can switch themes, list windows and send notifications." },
  { app: "theme-studio", text: "Change the theme, accent colour, surfaces and corner radius." },
  { app: "task-manager", text: "Frame rate, main-thread load and memory, read from the browser." },
];

const SHORTCUTS: [string, string][] = [
  ["Ctrl K", "Search apps, files and actions"],
  ["Ctrl Alt 1–4", "Switch desktop (add Shift to carry the window)"],
  ["Drag to an edge", "Snap a window to half or a quarter"],
  ["Right-click a title", "Move a window to another desktop"],
  ["Arrows, Shift+Arrows", "Move or resize the focused window"],
  ["Ctrl W", "Close the focused window"],
];

export function Welcome(_props: AppProps) {
  return (
    <div className="welcome">
      <header className="welcome__lead">
        <div className="eyebrow">OrbitOS</div>
        <h1 className="welcome__title display">Start here</h1>
        <p>
          A desktop that runs in your browser. Open apps from the taskbar or the Start menu. Everything you make is
          stored on this device.
        </p>

        <h2 className="eyebrow welcome__label">Shortcuts</h2>
        <dl className="welcome__keys">
          {SHORTCUTS.map(([keys, text]) => (
            <div key={keys}>
              <dt>
                <kbd className="kbd">{keys}</kbd>
              </dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
      </header>

      <section className="welcome__index" aria-labelledby="welcome-apps">
        <h2 className="eyebrow" id="welcome-apps">
          Worth opening first
        </h2>
        <ol className="rows">
          {START_HERE.map((item, i) => {
            const app = appRegistry[item.app];
            return (
              <li key={item.app}>
                <button type="button" className="welcome__row" onClick={() => launchApp(item.app)}>
                  <span className="welcome__num" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="welcome__row-text">
                    <strong>{app.name}</strong>
                    <span>{item.text}</span>
                  </span>
                  <span className="welcome__open" aria-hidden="true">
                    Open →
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
