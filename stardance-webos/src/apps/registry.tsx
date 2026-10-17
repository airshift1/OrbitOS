import { lazy, Suspense, type ComponentType } from "react";
import type { AppDefinition, AppId, AppProps } from "../types";
import { Calculator } from "./Calculator/Calculator";
import { TextEditor } from "./TextEditor/TextEditor";
import { FileExplorer } from "./FileExplorer/FileExplorer";
import { Terminal } from "./Terminal/Terminal";
import { Settings } from "./Settings/Settings";
import { MiniBrowser } from "./MiniBrowser/MiniBrowser";
import { AboutMe } from "./AboutMe/AboutMe";
import { AboutOrbitOS } from "./AboutOrbitOS";
import { Profile } from "./Profile";
import { Paint } from "./Paint/Paint";
import { Clock } from "./Clock/Clock";
import { TaskManager } from "./TaskManager/TaskManager";
import { Welcome } from "./Welcome/Welcome";
import { Notes } from "./Notes/Notes";
import { Launcher } from "./Launcher/Launcher";
import { ThemeStudio } from "./ThemeStudio/ThemeStudio";
import { Snake } from "./Snake/Snake";

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

function lazyApp(load: () => Promise<{ default: ComponentType<AppProps> }>) {
  const Component = lazy(load);
  return function LazyApp(props: AppProps) {
    return (
      <Suspense fallback={<div className="app-loading">Loading game…</div>}>
        <Component {...props} />
      </Suspense>
    );
  };
}

const DinoRunApp = lazyApp(() => import("./DinoRun/DinoRun").then(({ DinoRun }) => ({ default: DinoRun })));
const OrbitBlastApp = lazyApp(() => import("./OrbitBlast/OrbitBlast").then(({ OrbitBlast }) => ({ default: OrbitBlast })));
const OrbitDepthsApp = lazyApp(() => import("./OrbitDepths/OrbitDepthsGame").then(({ OrbitDepths }) => ({ default: OrbitDepths })));
const MortalKombatMobileApp = lazyApp(() => import("./MortalKombatMobile/MortalKombatMobile").then(({ MortalKombatMobile }) => ({ default: MortalKombatMobile })));
const Number2048App = lazyApp(() => import("./Number2048/Number2048").then(({ Number2048 }) => ({ default: Number2048 })));
const SandtrixApp = lazyApp(() => import("./Sandtrix/Sandtrix").then(({ Sandtrix }) => ({ default: Sandtrix })));

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
  snake: {
    id: "snake",
    name: "Snake",
    icon: "Gamepad2",
    description: "Classic Snake or a magical Unicorn Dreams adventure",
    category: "Tools",
    component: Snake,
    defaultWidth: 1120,
    defaultHeight: 820,
    minWidth: 320,
    minHeight: 360,
    singleInstance: true,
    panelSafe: true,
  },
  "orbit-blast": {
    id: "orbit-blast",
    name: "Orbit Blast",
    icon: "Orbit",
    description: "Clear matching blocks and build your score",
    category: "Tools",
    component: OrbitBlastApp,
    defaultWidth: 900,
    defaultHeight: 760,
    minWidth: 360,
    minHeight: 360,
    singleInstance: true,
    panelSafe: true,
  },
  "dino-run": {
    id: "dino-run",
    name: "Dino Run",
    icon: "Activity",
    description: "Jump over obstacles and chase a new high score",
    category: "Tools",
    component: DinoRunApp,
    defaultWidth: 1000,
    defaultHeight: 680,
    minWidth: 360,
    minHeight: 320,
    singleInstance: true,
    panelSafe: true,
  },
  "2048": {
    id: "2048",
    name: "2048",
    icon: "LayoutGrid",
    description: "Slide tiles, merge numbers, and reach 2048",
    category: "Tools",
    component: Number2048App,
    defaultWidth: 740,
    defaultHeight: 780,
    minWidth: 360,
    minHeight: 380,
    singleInstance: true,
    panelSafe: true,
  },
  sandtrix: {
    id: "sandtrix",
    name: "Sandtrix",
    icon: "Layers",
    description: "Drop colored grains and clear solid rows",
    category: "Tools",
    component: SandtrixApp,
    defaultWidth: 740,
    defaultHeight: 780,
    minWidth: 360,
    minHeight: 380,
    singleInstance: true,
    panelSafe: true,
  },
  "orbit-depths": {
    id: "orbit-depths",
    name: "Orbit Depths",
    icon: "Focus",
    description: "Explore a maze and clear the glowing targets",
    category: "Tools",
    component: OrbitDepthsApp,
    defaultWidth: 1120,
    defaultHeight: 780,
    minWidth: 400,
    minHeight: 360,
    singleInstance: true,
    panelSafe: true,
  },
  "mortal-kombat-mobile": {
    id: "mortal-kombat-mobile",
    name: "Mortal Kombat Mobile",
    icon: "Globe",
    description: "Open the game listing you shared",
    category: "Internet",
    component: MortalKombatMobileApp,
    defaultWidth: 800,
    defaultHeight: 600,
    minWidth: 360,
    minHeight: 320,
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
  "about-orbitos": {
    id: "about-orbitos",
    name: "About OrbitOS",
    icon: "User",
    description: "System information, credits and version",
    category: "System",
    component: AboutOrbitOS,
    defaultWidth: 560,
    defaultHeight: 520,
    minWidth: 380,
    minHeight: 320,
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
  profile: {
    id: "profile",
    name: "Profile",
    icon: "UserRound",
    description: "Your account and personal preferences",
    category: "System",
    component: Profile,
    defaultWidth: 480,
    defaultHeight: 420,
    minWidth: 360,
    minHeight: 320,
    singleInstance: true,
    panelSafe: true,
  },
};

/** All apps, in launcher order. */
export const appList: AppDefinition[] = Object.values(appRegistry);

export const getApp = (id: AppId): AppDefinition => appRegistry[id];
