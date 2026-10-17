import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { getIcon, type IconComponent } from "../../lib/icons";
import { AppIcon as AppTile } from "../AppIcon";
import { useNotesStore } from "../../stores/useNotesStore";
import { useSystemStore } from "../../stores/useSystemStore";
import { useFileSystemStore } from "../../stores/useFileSystemStore";
import { appRegistry } from "../../apps/registry";
import { launchApp } from "../../lib/launch";
import { openFsNode, isImageFile } from "../../lib/openNode";
import {
  startNodeDrag, startIconDrag, isNodeDrag, isIconDrag,
  getDraggedNodeId, getIconDrag, allowNodeDrop, dropNodeInto,
} from "../../lib/dragDrop";
import { cx, clamp } from "../../lib/helpers";
import { isProtectedNode } from "../../lib/fsGuards";
import { loadWallpaperImage } from "../../lib/wallpaperStorage";
import { notify } from "../../stores/useNotificationStore";
import { ContextMenu } from "../ContextMenu/ContextMenu";
import { RenameDialog, ConfirmDeleteDialog, MoveDialog } from "../FileDialogs/FileDialogs";
import type { AppId, ContextMenuItem, FsNode } from "../../types";
import "./Desktop.css";

const APP_SHORTCUTS: AppId[] = ["about-orbitos", "file-explorer", "notes", "terminal", "browser", "settings"];

const desktopMenuItems: ContextMenuItem[] = [
  { label: "Spotlight Search", icon: "Search", onClick: () => window.dispatchEvent(new CustomEvent("webos:toggle-spotlight")) },
  {
    label: "New",
    icon: "Plus",
    submenu: [
      { label: "Folder", icon: "FolderPlus", onClick: () => { const state = useFileSystemStore.getState(); const desktop = findDesktopFolderId(state.nodes, state.rootId); if (desktop) state.createNode(desktop, "New Folder", "folder"); } },
      { label: "Text Document", icon: "FileText", onClick: () => { const state = useFileSystemStore.getState(); const desktop = findDesktopFolderId(state.nodes, state.rootId); if (desktop) state.createNode(desktop, "New Document.txt", "file", ""); } },
      { label: "Note", icon: "StickyNote", onClick: () => { useNotesStore.getState().addNote(); launchApp("notes"); } },
    ],
  },
  {
    label: "Sort By",
    icon: "ArrowDownAZ",
    submenu: [
      { label: "Name", icon: "CaseSensitive", disabled: true },
      { label: "Date modified", icon: "CalendarClock", disabled: true },
      { label: "Type", icon: "ListFilter", disabled: true },
    ],
  },
  {
    label: "View",
    icon: "LayoutGrid",
    submenu: [
      { label: "Large icons", icon: "Grid2X2", disabled: true },
      { label: "Small icons", icon: "List", disabled: true },
    ],
  },
  { label: "Personalize", icon: "Paintbrush", separatorBefore: true, onClick: () => launchApp("theme-studio") },
  { label: "Display Settings", icon: "MonitorCog", onClick: () => launchApp("settings") },
  { label: "System Settings", icon: "Settings", onClick: () => launchApp("settings") },
  { label: "Open Terminal", icon: "TerminalSquare", onClick: () => launchApp("terminal") },
  { label: "Theme Studio", icon: "Palette", onClick: () => launchApp("theme-studio") },
  { label: "Refresh", icon: "RefreshCw", separatorBefore: true, onClick: () => location.reload() },
];

// Icon grid geometry for default (auto-flow) positions
const PAD = 16;

function defaultIconPos(index: number, size: number, spacing: number, leftInset: number): { x: number; y: number } {
  const usable = window.innerHeight - 64 - PAD * 2; // leave room for the taskbar
  const cellSpacing = Math.max(size + 48, spacing);
  const rows = Math.max(1, Math.floor(usable / cellSpacing));
  return {
    x: leftInset + PAD + Math.floor(index / rows) * cellSpacing,
    y: PAD + (index % rows) * cellSpacing,
  };
}

function clampIconPos(x: number, y: number, width: number, leftInset: number, rightInset: number): { x: number; y: number } {
  return {
    x: clamp(x, leftInset, window.innerWidth - width - rightInset),
    y: clamp(y, 0, window.innerHeight - 150),
  };
}

function findDesktopFolderId(nodes: Record<string, FsNode>, rootId: string): string | null {
  for (const node of Object.values(nodes)) {
    if (node.parentId === rootId && node.type === "folder" && node.name === "Desktop") {
      return node.id;
    }
  }
  return null;
}

export function Desktop({ children }: { children?: ReactNode }) {
  const wallpaper = useSystemStore((s) => s.wallpaper);
  const customization = useSystemStore((s) => s.customization);
  const pinnedApps = useSystemStore((s) => s.pinnedApps);
  const uninstalledApps = useSystemStore((s) => s.uninstalledApps);
  const pinApp = useSystemStore((s) => s.pinApp);
  const unpinApp = useSystemStore((s) => s.unpinApp);
  const desktopIconPos = useSystemStore((s) => s.desktopIconPos);
  const setDesktopIconPos = useSystemStore((s) => s.setDesktopIconPos);
  const nodes = useFileSystemStore((s) => s.nodes);
  const rootId = useFileSystemStore((s) => s.rootId);
  const getChildren = useFileSystemStore((s) => s.getChildren);
  const renameNode = useFileSystemStore((s) => s.renameNode);
  const deleteNode = useFileSystemStore((s) => s.deleteNode);
  const moveNode = useFileSystemStore((s) => s.moveNode);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const [renameTarget, setRenameTarget] = useState<FsNode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FsNode | null>(null);
  const [moveTarget, setMoveTarget] = useState<FsNode | null>(null);
  const [wallpaperImage, setWallpaperImage] = useState("");

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    if (!customization.wallpaperImageId) {
      setWallpaperImage("");
      return;
    }
    void loadWallpaperImage(customization.wallpaperImageId).then((blob) => {
      if (!blob) throw new Error("The saved wallpaper image is no longer available.");
      objectUrl = URL.createObjectURL(blob);
      if (active) setWallpaperImage(objectUrl);
      else URL.revokeObjectURL(objectUrl);
    }).catch((error: unknown) => {
      if (!active) return;
      setWallpaperImage("");
      notify({ title: "Wallpaper unavailable", body: error instanceof Error ? error.message : "Could not load the saved image.", kind: "warning", appId: "settings" });
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [customization.wallpaperImageId]);

  const desktopFolderId = findDesktopFolderId(nodes, rootId);
  const desktopFiles = desktopFolderId ? getChildren(desktopFolderId) : [];
  const iconSize = Math.round(customization.desktopIconSize * customization.desktopScale / 100);

  // Resolve every icon's position: saved position wins, the rest auto-flow
  // down the default column layout.
  const iconPositions: Record<string, { x: number; y: number }> = {};
  {
    let flowIndex = 0;
    const keys = [
      ...APP_SHORTCUTS.filter((id) => !uninstalledApps.includes(id)).map((id) => `app-${id}`),
      ...desktopFiles.map((n) => n.id),
    ];
    for (const key of keys) {
      const index = flowIndex++;
      const iconSpacing = Math.round(customization.desktopIconSpacing * customization.desktopScale / 100);
      const leftInset = customization.dockPosition === "left" ? customization.dockSize + 16 : 0;
      const rightInset = customization.dockPosition === "right" ? customization.dockSize + 16 : 0;
      const saved = desktopIconPos[key] ?? defaultIconPos(index, iconSize, iconSpacing, leftInset);
      iconPositions[key] = {
        x: clamp(saved.x, leftInset, window.innerWidth - iconSize - 44 - rightInset),
        y: clamp(saved.y, 0, window.innerHeight - 150),
      };
    }
  }

  function handleDesktopClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest(".desktop__icon")) return;
    setSelectedId(null);
  }

  // Dropping onto the wallpaper moves the node into the Desktop folder.
  // Drops landing on a window, the taskbar, or the start menu are ignored
  // (those areas handle — or deliberately reject — their own drops).
  function isShellDrop(e: React.DragEvent): boolean {
    return !!(e.target as HTMLElement).closest(".window, .taskbar, .startmenu, .quickpanel, .spotlight");
  }

  function handleDesktopDragOver(e: React.DragEvent) {
    if (isShellDrop(e)) return;
    if (isIconDrag(e) || isNodeDrag(e)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }
  }

  function handleDesktopDrop(e: React.DragEvent) {
    if (isShellDrop(e)) return;
    e.preventDefault();
    setDragOverId(null);

    // Repositioning an icon that already lives on the desktop
    const icon = getIconDrag(e);
    if (icon) {
      setDesktopIconPos(icon.key, clampIconPos(e.clientX - icon.dx, e.clientY - icon.dy, iconSize + 44, customization.dockPosition === "left" ? customization.dockSize + 16 : 0, customization.dockPosition === "right" ? customization.dockSize + 16 : 0));
      return;
    }

    // A file dragged in from elsewhere (e.g. File Explorer) → move it to the
    // Desktop folder and place its icon right where it was dropped.
    if (desktopFolderId) {
      const nodeId = getDraggedNodeId(e);
      if (dropNodeInto(e, desktopFolderId) && nodeId) {
        setDesktopIconPos(nodeId, clampIconPos(e.clientX - iconSize / 2, e.clientY - 40, iconSize + 44, customization.dockPosition === "left" ? customization.dockSize + 16 : 0, customization.dockPosition === "right" ? customization.dockSize + 16 : 0));
      }
    }
  }

  function handleDesktopContext(e: React.MouseEvent) {
    // Right-clicks inside windows, the taskbar or open menus bubble up here through the React tree;
    // they belong to those elements (or to the browser's own menu), not to the desktop.
    if ((e.target as HTMLElement).closest(".window, .taskbar, .startmenu, .quickpanel, .toasts, .ctx-overlay, .spotlight-scrim")) return;
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, items: desktopMenuItems });
  }

  function handleAppContext(e: React.MouseEvent, appId: AppId) {
    e.preventDefault();
    e.stopPropagation();
    const app = appRegistry[appId];
    const isPinned = pinnedApps.includes(appId);
    const items: ContextMenuItem[] = [
      { label: "Open", icon: app.icon, onClick: () => launchApp(appId) },
      isPinned
        ? { label: "Unpin from Taskbar", icon: "PinOff", onClick: () => unpinApp(appId) }
        : { label: "Add to Taskbar", icon: "Pin", onClick: () => pinApp(appId) },
    ];
    setMenu({ x: e.clientX, y: e.clientY, items });
  }

  function handleNodeContext(e: React.MouseEvent, node: FsNode) {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(`fs-${node.id}`);

    const items: ContextMenuItem[] = [
      {
        label: "Open",
        icon: node.type === "folder" ? "Folder" : "FileText",
        onClick: () => openFsNode(node),
      },
    ];

    if (!isProtectedNode(node, rootId)) {
      items.push(
        { label: "Rename", icon: "Pencil", onClick: () => setRenameTarget(node) },
        { label: "Move to…", icon: "FolderInput", onClick: () => setMoveTarget(node) },
        { label: "Delete", icon: "Trash2", danger: true, separatorBefore: true, onClick: () => setDeleteTarget(node) },
      );
    }

    setMenu({ x: e.clientX, y: e.clientY, items });
  }

  return (
    <div
      className="desktop"
      style={{
        background: wallpaper,
        ...(wallpaperImage ? { backgroundImage: `url("${wallpaperImage}")`, backgroundRepeat: "no-repeat" } : {}),
        backgroundSize: wallpaperImage ? customization.wallpaperFit === "fill" ? "100% 100%" : customization.wallpaperFit === "center" ? "auto" : customization.wallpaperFit : undefined,
        backgroundPosition: wallpaperImage ? "center" : undefined,
      } as CSSProperties}
      onClick={handleDesktopClick}
      onContextMenu={handleDesktopContext}
      onDragOver={handleDesktopDragOver}
      onDrop={handleDesktopDrop}
    >
      {customization.desktopShortcutsVisible && <div className="desktop__icons" data-icon-style={customization.iconStyle}>
        {APP_SHORTCUTS.filter((appId) => !uninstalledApps.includes(appId)).map((appId) => {
          const app = appRegistry[appId];
          const pos = iconPositions[`app-${app.id}`];
          return (
            <button
              key={`app-${app.id}`}
              className={cx("desktop__icon", selectedId === `app-${app.id}` && "desktop__icon--selected")}
              style={{ left: pos.x, top: pos.y, "--desktop-icon-size": `${iconSize}px` } as CSSProperties}
              onClick={(e) => { e.stopPropagation(); setSelectedId(`app-${app.id}`); }}
              onDoubleClick={() => launchApp(app.id)}
              onContextMenu={(e) => handleAppContext(e, appId)}
              draggable
              onDragStart={(e) => startIconDrag(e, `app-${app.id}`)}
            >
              <AppTile icon={customization.iconOverrides[app.id] ?? app.icon} appId={app.id} size={iconSize} />
              {customization.desktopIconLabels && <span>{app.name}</span>}
            </button>
          );
        })}

        {desktopFiles.map((node) => {
          let Icon: IconComponent = getIcon(node.type === "folder" ? "Folder" : "FileText");
          let label = node.name;
          if (node.name.endsWith(".app") && node.content && node.content in appRegistry) {
            const appDef = appRegistry[node.content as AppId];
            Icon = getIcon(customization.iconOverrides[node.content] ?? appDef.icon, getIcon("FileText"));
            label = node.name.replace(/\.app$/, "");
          } else if (isImageFile(node.name)) {
            Icon = getIcon("Image");
          }
          const isFolder = node.type === "folder";
          const pos = iconPositions[node.id];
          return (
            <button
              key={`fs-${node.id}`}
              className={cx(
                "desktop__icon",
                selectedId === `fs-${node.id}` && "desktop__icon--selected",
                dragOverId === node.id && "desktop__icon--dragover",
              )}
              style={{ left: pos.x, top: pos.y, "--desktop-icon-size": `${iconSize}px` } as CSSProperties}
              onClick={(e) => { e.stopPropagation(); setSelectedId(`fs-${node.id}`); }}
              onDoubleClick={() => openFsNode(node)}
              onContextMenu={(e) => handleNodeContext(e, node)}
              draggable
              onDragStart={(e) => {
                // icon payload → repositioning on the desktop;
                // node payload → moving the file somewhere else
                startIconDrag(e, node.id);
                if (!isProtectedNode(node, rootId)) startNodeDrag(e, node.id);
              }}
              onDragOver={isFolder ? (e) => { e.stopPropagation(); if (allowNodeDrop(e)) setDragOverId(node.id); } : undefined}
              onDragLeave={isFolder ? () => setDragOverId((cur) => (cur === node.id ? null : cur)) : undefined}
              onDrop={isFolder ? (e) => { e.preventDefault(); e.stopPropagation(); setDragOverId(null); dropNodeInto(e, node.id); } : undefined}
            >
              <Icon size={iconSize - 8} strokeWidth={1.6} />
              {customization.desktopIconLabels && <span>{label}</span>}
            </button>
          );
        })}
      </div>}
      {children}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menu.items}
          onClose={() => setMenu(null)}
        />
      )}
      {renameTarget && (
        <RenameDialog
          node={renameTarget}
          onRename={(name) => { renameNode(renameTarget.id, name); setRenameTarget(null); }}
          onCancel={() => setRenameTarget(null)}
        />
      )}
      {deleteTarget && (
        <ConfirmDeleteDialog
          node={deleteTarget}
          onConfirm={() => { deleteNode(deleteTarget.id); setDeleteTarget(null); }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {moveTarget && (
        <MoveDialog
          node={moveTarget}
          onMove={(destId) => { moveNode(moveTarget.id, destId); setMoveTarget(null); }}
          onCancel={() => setMoveTarget(null)}
        />
      )}
    </div>
  );
}
