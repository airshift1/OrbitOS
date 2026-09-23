import { useEffect, useState } from "react";
import { library } from "@fortawesome/fontawesome-svg-core";
import {
  faCalculator,
  faChartLine,
  faClock,
  faFileLines,
  faFolder,
  faGear,
  faGlobe,
  faGrip,
  faNoteSticky,
  faPaintbrush,
  faPalette,
  faStar,
  faTerminal,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import { WorkspaceWidget } from "@projectstorm/react-workspaces-core";
import type { AppProps } from "../../types";
import { appList } from "../registry";
import { notify } from "../../stores/useNotificationStore";
import { Button } from "../../ui";
import { AppPanelModel } from "./AppPanel";
import { addFloatingApp, createDefaultLayout, createEngine, restoreLayout } from "./engine";
import "./Workspaces.css";

library.add(
  faCalculator,
  faChartLine,
  faClock,
  faFileLines,
  faFolder,
  faGear,
  faGlobe,
  faGrip,
  faNoteSticky,
  faPaintbrush,
  faPalette,
  faStar,
  faTerminal,
  faUser,
);

const LAYOUT_KEY = "webos-workspace-layout";

/**
 * Tiling Workspace — react-workspaces (@projectstorm) hosting real OrbitOS
 * apps in dockable panels: drag a title bar to split, tab or tray a panel,
 * drag dividers to resize, or pop an app out into a floating window.
 */
export default function Workspaces(_props: AppProps) {
  const [engine] = useState(createEngine);
  const [model, setModel] = useState(() => restoreLayout(engine, safeGet(LAYOUT_KEY)));
  const [locked, setLocked] = useState(false);
  const [floating, setFloating] = useState(false);
  const [floatCount, setFloatCount] = useState(0);

  useEffect(() => () => model.dispose(), [model]);
  useEffect(() => {
    engine.setLocked(locked);
  }, [engine, locked]);

  const panelApps = appList.filter((a) => a.panelSafe);

  function add(appId: (typeof panelApps)[number]["id"]) {
    if (floating) {
      addFloatingApp(model, appId, (floatCount % 6) * 26);
      setFloatCount((n) => n + 1);
    } else {
      model.addModel(new AppPanelModel(appId));
    }
    engine.normalize();
    engine.invalidateLayout();
  }

  function save() {
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(model.toArray()));
      notify({ title: "Layout saved", body: "Workspaces will reopen with this layout.", kind: "success", appId: "workspaces" });
    } catch {
      notify({ title: "Couldn't save the layout", body: "Browser storage may be full or blocked.", kind: "error" });
    }
  }

  function reset() {
    try {
      localStorage.removeItem(LAYOUT_KEY);
    } catch {
      /* ignore */
    }
    setModel(createDefaultLayout(engine));
  }

  return (
    <div className="wsapp">
      <div className="wsapp__bar">
        <div className="wsapp__add" role="group" aria-label="Add an app to the layout">
          <span className="eyebrow">Add</span>
          {panelApps.map((a) => (
            <Button key={a.id} variant="quiet" size="sm" onClick={() => add(a.id)} title={`Add ${a.name} ${floating ? "as a floating window" : "as a panel"}`}>
              {a.name}
            </Button>
          ))}
        </div>

        <div className="wsapp__actions">
          <Button size="sm" aria-pressed={floating} onClick={() => setFloating((v) => !v)} title="Add new apps as floating windows">
            {floating ? "Floating" : "Docked"}
          </Button>
          <Button size="sm" aria-pressed={locked} onClick={() => setLocked((v) => !v)} title="Lock the layout so panels can't be dragged">
            {locked ? "Locked" : "Unlocked"}
          </Button>
          <Button size="sm" onClick={save}>Save</Button>
          <Button size="sm" onClick={reset}>Reset</Button>
        </div>
      </div>

      <div className="wsapp__stage">
        <div className="wsapp__inner">
          <WorkspaceWidget key={model.id} engine={engine} model={model} />
        </div>
      </div>
    </div>
  );
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
