import { lazy, Suspense } from "react";
import type { AppDefinition, AppId, AppProps } from "../types";
import { Calculator } from "./Calculator/Calculator";
import { TextEditor } from "./TextEditor/TextEditor";
import { FileExplorer } from "./FileExplorer/FileExplorer";
import { Terminal } from "./Terminal/Terminal";
import { Settings } from "./Settings/Settings";
import { MiniBrowser } from "./MiniBrowser/MiniBrowser";
import { AboutMe } from "./AboutMe/AboutMe";
import { Paint } from "./Paint/Paint";
import { Clock } from "./Clock/Clock";
import { TaskManager } from "./TaskManager/TaskManager";
import { Welcome } from "./Welcome/Welcome";
import { Notes } from "./Notes/Notes";
import { Launcher } from "./Launcher/Launcher";
import { ThemeStudio } from "./ThemeStudio/ThemeStudio";

// The tiling engine (react-workspaces + emotion + Font Awesome) is the heaviest
// dependency, so it is split into its own chunk and loaded on first launch.
const WorkspacesLazy = lazy(() => import("./Workspaces/Workspaces"));

function WorkspacesApp(props: AppProps) {
  return (
    <Suspense fallback={<div className="app-loading">Loading Workspaces…</div>}>
      <WorkspacesLazy {...props} />
    </Suspense>
  );
}

/**
 * Every OrbitOS app. `accent` tints its icon tile, `category` drives the App
 * Launcher chips, and `panelSafe` lets the Workspaces app host it in a panel.
 */
export const appRegistry: Record<AppId, AppDefinition> = {
  welcome: {
    id: "welcome",
    name: "Welcome",
    icon: "Sparkles",
    description: "A quick tour of OrbitOS",
    category: "System",
    component: Welcome,
    defaultWidth: 640,
    defaultHeight: 560,
    minWidth: 400,
    minHeight: 360,
    singleInstance: true,
    panelSafe: true,
  },
  "file-explorer": {
    id: "file-explorer",
    name: "File Explorer",
    icon: "Folder",
    description: "Browse and manage your files",
    category: "System",
    component: FileExplorer,
    defaultWidth: 720,
    defaultHeight: 480,
    minWidth: 480,
    minHeight: 320,
    panelSafe: true,
  },
  notes: {
    id: "notes",
    name: "Notes",
    icon: "StickyNote",
    description: "Notes that persist across sessions",
    category: "Productivity",
    component: Notes,
    defaultWidth: 680,
    defaultHeight: 480,
    minWidth: 440,
    minHeight: 300,
    singleInstance: true,
    panelSafe: true,
  },
  "text-editor": {
    id: "text-editor",
    name: "Text Editor",
    icon: "FileText",
    description: "Edit plain-text files",
    category: "Productivity",
    component: TextEditor,
    defaultWidth: 640,
    defaultHeight: 460,
    minWidth: 380,
    minHeight: 260,
    panelSafe: true,
  },
  terminal: {
    id: "terminal",
    name: "Terminal",
    icon: "TerminalSquare",
    description: "Command line for OrbitOS",
    category: "System",
    component: Terminal,
    defaultWidth: 640,
    defaultHeight: 400,
    minWidth: 380,
    minHeight: 240,
    panelSafe: true,
  },
  calculator: {
    id: "calculator",
    name: "Calculator",
    icon: "Calculator",
    description: "Arithmetic and expressions",
    category: "Tools",
    component: Calculator,
    defaultWidth: 320,
    defaultHeight: 500,
    minWidth: 280,
    minHeight: 440,
    singleInstance: true,
    panelSafe: true,
  },
  clock: {
    id: "clock",
    name: "Clock",
    icon: "Clock",
    description: "World clock, stopwatch and timer",
    category: "Tools",
    component: Clock,
    defaultWidth: 380,
    defaultHeight: 540,
    minWidth: 320,
    minHeight: 420,
    singleInstance: true,
    panelSafe: true,
  },
  paint: {
    id: "paint",
    name: "Paint",
    icon: "Paintbrush",
    description: "Sketch and save pictures",
    category: "Media",
    component: Paint,
    defaultWidth: 860,
    defaultHeight: 580,
    minWidth: 520,
    minHeight: 400,
    panelSafe: true,
  },
  browser: {
    id: "browser",
    name: "Browser",
    icon: "Globe",
    description: "Browse the web",
    category: "Internet",
    component: MiniBrowser,
    defaultWidth: 900,
    defaultHeight: 600,
    minWidth: 520,
    minHeight: 360,
    panelSafe: true,
  },
  workspaces: {
    id: "workspaces",
    name: "Workspaces",
    icon: "PanelsTopLeft",
    description: "Tiling layout with tabs, trays and floating panels",
    category: "Productivity",
    component: WorkspacesApp,
    defaultWidth: 1040,
    defaultHeight: 640,
    minWidth: 560,
    minHeight: 380,
    singleInstance: true,
  },
  "task-manager": {
    id: "task-manager",
    name: "System Monitor",
    icon: "Activity",
    description: "Live performance graphs and running tasks",
    category: "System",
    component: TaskManager,
    defaultWidth: 600,
    defaultHeight: 500,
    minWidth: 440,
    minHeight: 340,
    singleInstance: true,
    panelSafe: true,
  },
  launcher: {
    id: "launcher",
    name: "App Launcher",
    icon: "LayoutGrid",
    description: "Browse every installed app",
    category: "System",
    component: Launcher,
    defaultWidth: 640,
    defaultHeight: 500,
    minWidth: 380,
    minHeight: 320,
    singleInstance: true,
    panelSafe: true,
  },
  "theme-studio": {
    id: "theme-studio",
    name: "Theme Studio",
    icon: "Palette",
    description: "Theme, accent colour, surfaces and corners",
    category: "Media",
    component: ThemeStudio,
    defaultWidth: 760,
    defaultHeight: 520,
    minWidth: 520,
    minHeight: 380,
    singleInstance: true,
    panelSafe: true,
  },
  settings: {
    id: "settings",
    name: "Settings",
    icon: "Settings",
    description: "Appearance, display, sound and system",
    category: "System",
    component: Settings,
    defaultWidth: 720,
    defaultHeight: 520,
    minWidth: 480,
    minHeight: 360,
    singleInstance: true,
    panelSafe: true,
  },
  "about-me": {
    id: "about-me",
    name: "About Me",
    icon: "User",
    description: "Who built this",
    category: "Productivity",
    component: AboutMe,
    defaultWidth: 560,
    defaultHeight: 520,
    minWidth: 380,
    minHeight: 320,
    singleInstance: true,
    panelSafe: true,
  },
};

/** All apps, in launcher order. */
export const appList: AppDefinition[] = Object.values(appRegistry);

export const getApp = (id: AppId): AppDefinition => appRegistry[id];
