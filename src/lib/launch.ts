import type { AppId } from "../types";
import { appRegistry } from "../apps/registry";
import { useWindowStore } from "../stores/useWindowStore";
import { useSystemStore } from "../stores/useSystemStore";
import { playSound } from "./sound";

/**
 * Launch an app. Single-instance apps are focused instead of re-opened
 * (focusing also follows the window to its virtual desktop).
 */
export function launchApp(appId: AppId, launchProps?: Record<string, unknown>) {
  const app = appRegistry[appId];
  if (!app) return;

  const { windows, openWindow, focusWindow } = useWindowStore.getState();
  useSystemStore.getState().pushRecent(app.id);

  if (app.singleInstance) {
    const existing = windows.find((w) => w.appId === app.id);
    if (existing) {
      focusWindow(existing.id);
      return;
    }
  }

  openWindow({
    appId: app.id,
    title: app.name,
    icon: app.icon,
    width: app.defaultWidth,
    height: app.defaultHeight,
    launchProps,
  });
  playSound("open");
}
