import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellOff, Battery, BatteryCharging, Volume2, VolumeX, Wifi, WifiOff } from "lucide-react";
import type { AppId, ContextMenuItem, WindowState } from "../../types";
import { appRegistry } from "../../apps/registry";
import { TASKBAR_FOLDERS } from "../../apps/taskbarFolders";
import { useWindowStore } from "../../stores/useWindowStore";
import { useSystemStore } from "../../stores/useSystemStore";
import { useNotificationStore } from "../../stores/useNotificationStore";
import { launchApp } from "../../lib/launch";
import { formatClock, cx } from "../../lib/helpers";
import { useIsMobile } from "../../lib/useIsMobile";
import { WORKSPACE_INDICES } from "../../lib/workspaces";
import { ContextMenu } from "../ContextMenu/ContextMenu";
import { AppIcon } from "../AppIcon";
import { WindowPreview } from "./WindowPreview";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { TaskbarFolder } from "./TaskbarFolder";
import { useBattery } from "./useBattery";
import "./Taskbar.css";

interface TaskbarProps {
  onToggleStart: () => void;
  startOpen: boolean;
  onToggleQuick: () => void;
  quickOpen: boolean;
}

/** OrbitOS four-point star mark. */
function OrbitMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M32 6 L37.5 26.5 L58 32 L37.5 37.5 L32 58 L26.5 37.5 L6 32 L26.5 26.5 Z"
        fill="currentColor"
      />
    </svg>
  );
}

interface WinButtonProps {
  win: WindowState;
  appId: AppId;
  icon: string;
  label?: string;
  active: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  previews: boolean;
  running: boolean;
}

/** One taskbar button bound to a window — with a hover thumbnail on desktop. */
function WinButton({ win, icon, label, active, onClick, onContextMenu, previews, running }: WinButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  const clear = () => {
    window.clearTimeout(timer.current);
    setAnchor(null);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <>
      <button
        ref={ref}
        type="button"
        className={cx(
          "tb-btn",
          label ? "tb-btn--labeled" : "tb-btn--icon",
          active && "tb-btn--active",
          running && "tb-btn--running",
          win.isMinimized && "tb-btn--minimized",
        )}
        title={previews ? undefined : win.title}
        aria-label={win.title}
        onClick={() => {
          clear();
          onClick();
        }}
        onContextMenu={(e) => {
          clear();
          onContextMenu(e);
        }}
        onMouseEnter={() => {
          if (!previews) return;
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => {
            if (ref.current) setAnchor(ref.current.getBoundingClientRect());
          }, 350);
        }}
        onMouseLeave={clear}
      >
        <AppIcon icon={icon} size={26} />
        {label && <span className="tb-btn__label">{label}</span>}
      </button>
      {anchor && <WindowPreview win={win} anchor={anchor} />}
    </>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  const { time, dateStr } = formatClock(now);
  return (
    <div className="tb-clock" aria-label={`${time}, ${dateStr}`}>
      <span className="tb-clock__time">{time}</span>
      <span className="tb-clock__date">{dateStr}</span>
    </div>
  );
}

export function Taskbar({ onToggleStart, startOpen, onToggleQuick, quickOpen }: TaskbarProps) {
  const windows = useWindowStore((s) => s.windows);
  const focusedId = useWindowStore((s) => s.focusedId);
  const activeWorkspace = useWindowStore((s) => s.activeWorkspace);
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const moveWindowToWorkspace = useWindowStore((s) => s.moveWindowToWorkspace);

  const pinnedApps = useSystemStore((s) => s.pinnedApps);
  const pinApp = useSystemStore((s) => s.pinApp);
  const unpinApp = useSystemStore((s) => s.unpinApp);
  const wifi = useSystemStore((s) => s.wifi);
  const soundEnabled = useSystemStore((s) => s.soundEnabled);
  const volume = useSystemStore((s) => s.volume);
  const dnd = useSystemStore((s) => s.doNotDisturb);
  const unread = useNotificationStore((s) => s.items.filter((i) => !i.read).length);

  const isMobile = useIsMobile();
  const battery = useBattery();
  const [menu, setMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);

  const visible = useMemo(() => windows.filter((w) => w.workspace === activeWorkspace), [windows, activeWorkspace]);

  // Pinned tile → first window of that app on this desktop; extra windows fall through to "running".
  const pinnedTileWindow = useMemo(() => {
    const map = new Map<AppId, WindowState>();
    for (const id of pinnedApps) {
      const first = visible.find((w) => w.appId === id);
      if (first) map.set(id, first);
    }
    return map;
  }, [pinnedApps, visible]);

  const running = visible.filter((w) => !Array.from(pinnedTileWindow.values()).some((p) => p.id === w.id));

  function toggleWindow(w: WindowState) {
    if (focusedId === w.id && !w.isMinimized) minimizeWindow(w.id);
    else focusWindow(w.id);
  }

  function windowMenu(e: React.MouseEvent, w: WindowState) {
    e.preventDefault();
    const pinned = pinnedApps.includes(w.appId);
    const items: ContextMenuItem[] = [
      { label: w.isMinimized ? "Restore" : "Minimize", icon: w.isMinimized ? "Maximize2" : "Minus", onClick: () => (w.isMinimized ? focusWindow(w.id) : minimizeWindow(w.id)) },
      pinned
        ? { label: "Unpin from Taskbar", icon: "PinOff", onClick: () => unpinApp(w.appId) }
        : { label: "Pin to Taskbar", icon: "Pin", onClick: () => pinApp(w.appId) },
      ...WORKSPACE_INDICES.filter((i) => i !== w.workspace).map((i, n) => ({
        label: `Move to Desktop ${i + 1}`,
        icon: "Layers",
        separatorBefore: n === 0,
        onClick: () => moveWindowToWorkspace(w.id, i),
      })),
      { label: "Close window", icon: "X", danger: true, separatorBefore: true, onClick: () => closeWindow(w.id) },
    ];
    setMenu({ x: e.clientX, y: e.clientY - 8 - items.length * 34, items });
  }

  function pinnedMenu(e: React.MouseEvent, appId: AppId) {
    e.preventDefault();
    const app = appRegistry[appId];
    const items: ContextMenuItem[] = [
      { label: `Open ${app.name}`, icon: app.icon, onClick: () => launchApp(appId) },
      { label: "Unpin from Taskbar", icon: "PinOff", onClick: () => unpinApp(appId) },
    ];
    setMenu({ x: e.clientX, y: e.clientY - 8 - items.length * 34, items });
  }

  const VolIcon = !soundEnabled || volume === 0 ? VolumeX : Volume2;
  const BatIcon = battery?.charging ? BatteryCharging : Battery;
  const sleepy = windows.length === 0;

  return (
    <div className="taskbar" role="toolbar" aria-label="Taskbar">
      <button
        type="button"
        className={cx("tb-start", startOpen && "tb-start--open", isMobile && "tb-start--cat")}
        onClick={onToggleStart}
        aria-label="Start menu"
        aria-expanded={startOpen}
        title="Start"
      >
        {isMobile ? <span className="tb-cat">{sleepy ? "=-.-=" : "=^.^="}</span> : <OrbitMark />}
      </button>

      <div className="tb-sep" />

      <div className="tb-apps">
        {pinnedApps.map((id) => {
          const app = appRegistry[id];
          if (!app) return null;
          const w = pinnedTileWindow.get(id);
          if (!w) {
            return (
              <button
                key={`pin-${id}`}
                type="button"
                className="tb-btn tb-btn--icon tb-btn--pinned"
                title={app.name}
                aria-label={`Open ${app.name}`}
                onClick={() => launchApp(id)}
                onContextMenu={(e) => pinnedMenu(e, id)}
              >
                <AppIcon icon={app.icon} size={26} />
              </button>
            );
          }
          return (
            <WinButton
              key={`pin-${id}`}
              win={w}
              appId={id}
              icon={app.icon}
              active={focusedId === w.id && !w.isMinimized}
              running
              previews={!isMobile}
              onClick={() => toggleWindow(w)}
              onContextMenu={(e) => windowMenu(e, w)}
            />
          );
        })}

        {!isMobile && TASKBAR_FOLDERS.map((f) => <TaskbarFolder key={f.id} folder={f} />)}

        {running.length > 0 && <div className="tb-sep tb-sep--thin" />}

        {running.map((w) => {
          const app = appRegistry[w.appId];
          return (
            <WinButton
              key={w.id}
              win={w}
              appId={w.appId}
              icon={w.icon || app?.icon || "AppWindow"}
              label={isMobile ? undefined : w.title}
              active={focusedId === w.id && !w.isMinimized}
              running
              previews={!isMobile}
              onClick={() => toggleWindow(w)}
              onContextMenu={(e) => windowMenu(e, w)}
            />
          );
        })}
      </div>

      <div className="tb-tray">
        {!isMobile && <WorkspaceSwitcher />}

        <button type="button" className={cx("tb-tray__btn", quickOpen && "tb-tray__btn--active")} onClick={onToggleQuick} aria-label="Quick settings" title="Quick settings">
          {!isMobile && (wifi ? <Wifi size={15} /> : <WifiOff size={15} />)}
          {!isMobile && <VolIcon size={15} />}
          {!isMobile && battery && (
            <span className="tb-tray__battery">
              <BatIcon size={15} />
              {Math.round(battery.level * 100)}%
            </span>
          )}
        </button>

        <button
          type="button"
          className={cx("tb-tray__btn", "tb-tray__bell", quickOpen && "tb-tray__btn--active")}
          onClick={onToggleQuick}
          aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
          title="Notifications"
        >
          {dnd ? <BellOff size={16} /> : <Bell size={16} />}
          {unread > 0 && !dnd && <span className="tb-tray__badge">{unread > 9 ? "9+" : unread}</span>}
        </button>

        <Clock />
      </div>

      {menu && <ContextMenu x={menu.x} y={Math.max(4, menu.y)} items={menu.items} onClose={() => setMenu(null)} />}
    </div>
  );
}

