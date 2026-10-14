import type { AppId, WindowStyle } from "../types";
import { appList } from "../apps/registry";
import { useFileSystemStore } from "../stores/useFileSystemStore";
import { useSystemStore } from "../stores/useSystemStore";
import { useWindowStore } from "../stores/useWindowStore";
import { useNotificationStore } from "../stores/useNotificationStore";
import { WORKSPACE_INDICES } from "./workspaces";
import { launchApp } from "./launch";
import { openFsNode } from "./openNode";
import { lockOS, restartOS } from "./power";

export type SearchGroup = "Apps" | "Files" | "Actions";

export interface SearchItem {
  key: string;
  group: SearchGroup;
  title: string;
  subtitle?: string;
  /** lucide-react icon name */
  icon: string;
  appId?: AppId;
  run: () => void;
}

const STYLES: WindowStyle[] = ["orbit", "classic", "traffic", "linux", "yk2000", "aero"];

function matches(query: string, ...fields: (string | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => f?.toLowerCase().includes(q));
}

function actionItems(): (SearchItem & { keywords: string })[] {
  const sys = useSystemStore.getState();
  const items: (SearchItem & { keywords: string })[] = [
    {
      key: "act-lock",
      group: "Actions",
      title: "Lock screen",
      subtitle: "Lock OrbitOS",
      icon: "Lock",
      keywords: "lock screen sleep",
      run: lockOS,
    },
    {
      key: "act-restart",
      group: "Actions",
      title: "Restart",
      subtitle: "Close all windows and reboot",
      icon: "RotateCcw",
      keywords: "restart reboot",
      run: restartOS,
    },
    {
      key: "act-theme",
      group: "Actions",
      title: sys.theme === "light" ? "Switch to dark mode" : "Switch to light mode",
      subtitle: "Toggle the colour theme",
      icon: sys.theme === "light" ? "Moon" : "Sun",
      keywords: "theme dark light mode appearance",
      run: () => useSystemStore.getState().setTheme(useSystemStore.getState().theme === "light" ? "orbit" : "light"),
    },
    {
      key: "act-dnd",
      group: "Actions",
      title: sys.doNotDisturb ? "Turn off Do Not Disturb" : "Turn on Do Not Disturb",
      subtitle: "Silence notification pop-ups",
      icon: sys.doNotDisturb ? "Bell" : "BellOff",
      keywords: "do not disturb dnd notifications silence focus",
      run: () => useSystemStore.getState().setDoNotDisturb(!useSystemStore.getState().doNotDisturb),
    },
    {
      key: "act-style",
      group: "Actions",
      title: "Cycle window style",
      subtitle: `Currently “${sys.windowStyle}”`,
      icon: "AppWindow",
      keywords: "window style chrome traffic aero linux classic yk2000",
      run: () => {
        const s = useSystemStore.getState();
        s.setWindowStyle(STYLES[(STYLES.indexOf(s.windowStyle) + 1) % STYLES.length]);
      },
    },
    {
      key: "act-clear-notifs",
      group: "Actions",
      title: "Clear notifications",
      icon: "BellRing",
      keywords: "clear notifications dismiss",
      run: () => useNotificationStore.getState().clear(),
    },
    {
      key: "act-close-all",
      group: "Actions",
      title: "Close all windows",
      subtitle: "On every desktop",
      icon: "X",
      keywords: "close all windows end tasks",
      run: () => {
        const ws = useWindowStore.getState();
        ws.windows.forEach((w) => ws.closeWindow(w.id));
      },
    },
    ...WORKSPACE_INDICES.map((i) => ({
      key: `act-ws-${i}`,
      group: "Actions" as const,
      title: `Switch to Desktop ${i + 1}`,
      subtitle: "Virtual desktop",
      icon: "Layers",
      keywords: `desktop workspace ${i + 1} virtual switch`,
      run: () => useWindowStore.getState().switchWorkspace(i),
    })),
  ];
  return items;
}

/** Unified search used by both Spotlight and the Start menu. */
export function searchAll(query: string): SearchItem[] {
  const q = query.trim();
  const out: SearchItem[] = [];

  for (const app of appList) {
    if (matches(q, app.name, app.description, app.category)) {
      out.push({
        key: `app-${app.id}`,
        group: "Apps",
        title: app.name,
        subtitle: app.category,
        icon: app.icon,
        appId: app.id,
        run: () => launchApp(app.id),
      });
    }
  }

  if (q) {
    const fs = useFileSystemStore.getState();
    let count = 0;
    for (const node of Object.values(fs.nodes)) {
      if (count >= 6) break;
      if (node.id === fs.rootId || node.name.endsWith(".app")) continue;
      if (node.name.toLowerCase().includes(q.toLowerCase())) {
        out.push({
          key: `file-${node.id}`,
          group: "Files",
          title: node.name,
          subtitle: fs.getPath(node.id),
          icon: node.type === "folder" ? "Folder" : "FileText",
          run: () => openFsNode(node),
        });
        count++;
      }
    }
  }

  for (const a of actionItems()) {
    if (q === "" ? false : matches(q, a.title, a.subtitle, a.keywords)) out.push(a);
  }

  return out;
}
