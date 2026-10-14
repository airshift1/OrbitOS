import type { AppId } from "../types";

/**
 * Taskbar folders (from @maomaolabs/core's toolbar folders): one taskbar
 * button that fans out a small flyout of apps on hover / click.
 */
export interface TaskbarFolderDef {
  id: string;
  title: string;
  /** lucide-react icon name */
  icon: string;
  apps: AppId[];
}

export const TASKBAR_FOLDERS: TaskbarFolderDef[] = [
  {
    id: "utilities",
    title: "Utilities",
    icon: "Wrench",
    apps: ["calculator", "clock", "paint", "theme-studio", "workspaces"],
  },
];
