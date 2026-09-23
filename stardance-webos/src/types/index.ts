import type React from "react";

// ---------- File System ----------
export type NodeType = "file" | "folder";

export interface FsNode {
  id: string;
  name: string;
  type: NodeType;
  parentId: string | null;
  content?: string;
  createdAt: number;
  updatedAt: number;
}

// ---------- Apps ----------
export type AppId =
  | "welcome"
  | "file-explorer"
  | "text-editor"
  | "notes"
  | "terminal"
  | "calculator"
  | "settings"
  | "theme-studio"
  | "browser"
  | "about-me"
  | "paint"
  | "clock"
  | "task-manager"
  | "launcher"
  | "workspaces";

export type AppCategory = "System" | "Productivity" | "Internet" | "Media" | "Tools";

export interface AppDefinition {
  id: AppId;
  name: string;
  /** lucide-react icon name */
  icon: string;
  description: string;
  category: AppCategory;
  /** Accent used to tint the app's icon tile (any CSS colour). */
  component: React.ComponentType<AppProps>;
  defaultWidth: number;
  defaultHeight: number;
  minWidth?: number;
  minHeight?: number;
  singleInstance?: boolean;
  /** Can this app be hosted inside a tiling Workspace panel? */
  panelSafe?: boolean;
}

export interface AppProps {
  windowId: string;
  launchProps?: Record<string, unknown>;
}

// ---------- Windows ----------
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type SnapZoneName =
  | "left"
  | "right"
  | "topLeft"
  | "topRight"
  | "bottomLeft"
  | "bottomRight"
  | "maximize";

export interface WindowState extends Rect {
  id: string;
  appId: AppId;
  title: string;
  icon: string;
  zIndex: number;
  /** Owning virtual desktop (0..WORKSPACE_COUNT-1). */
  workspace: number;
  isMinimized: boolean;
  isMaximized: boolean;
  /** Set while the window is tiled into a snap zone (half / quarter). */
  snapZone?: SnapZoneName;
  /** Geometry to return to when un-maximizing / un-snapping. */
  prevBounds?: Rect;
  launchProps?: Record<string, unknown>;
}

// ---------- System / Settings ----------
export type ThemeName = "orbit" | "dark" | "light" | "midnight";

/** Window chrome styles. "orbit" & "classic" are native; the rest come from @maomaolabs/core. */
export type WindowStyle = "orbit" | "classic" | "traffic" | "linux" | "yk2000" | "aero";

export interface SystemSettings {
  theme: ThemeName;
  wallpaper: string;
  username: string;
  accentColor: string;
  soundEnabled: boolean;
  windowStyle: WindowStyle;
  /** Master volume for UI sounds, 0–100. */
  volume: number;
  /** Screen brightness overlay, 20–100. */
  brightness: number;
  nightMode: boolean;
  doNotDisturb: boolean;
  startupSound: boolean;
  /** Re-open windows after a reload. */
  restoreSession: boolean;
  wifi: boolean;
  bluetooth: boolean;
}

// ---------- Context menu ----------
export interface ContextMenuItem {
  label: string;
  icon?: string;
  onClick: () => void;
  danger?: boolean;
  separatorBefore?: boolean;
}
