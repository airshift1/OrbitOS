import { useEffect, useMemo, useRef, useState } from "react";
import { Lock, Power, RotateCcw, Search, Settings as SettingsIcon } from "lucide-react";
import type { AppId, ContextMenuItem } from "../../types";
import { appList, appRegistry } from "../../apps/registry";
import { useSystemStore } from "../../stores/useSystemStore";
import { launchApp } from "../../lib/launch";
import { searchAll, type SearchItem } from "../../lib/search";
import { lockOS, restartOS } from "../../lib/power";
import { AppIcon } from "../AppIcon";
import { ContextMenu } from "../ContextMenu/ContextMenu";
import { SearchResults } from "../Spotlight/SearchResults";
import "../Spotlight/Spotlight.css";
import "./StartMenu.css";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function StartMenu({ open, onClose }: Props) {
  const username = useSystemStore((s) => s.username);
  const pinnedApps = useSystemStore((s) => s.pinnedApps);
  const recentApps = useSystemStore((s) => s.recentApps);
  const pinApp = useSystemStore((s) => s.pinApp);
  const unpinApp = useSystemStore((s) => s.unpinApp);

  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [menu, setMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => (open && query.trim() ? searchAll(query) : []), [open, query]);
  const searching = query.trim().length > 0;

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      setMenu(null);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setIndex(0), [query]);

  if (!open) return null;

  function run(fn: () => void) {
    onClose();
    setTimeout(fn, 0);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!searching) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = results[index];
      if (it) run(it.run);
    }
  }

  function appMenu(e: React.MouseEvent, id: AppId) {
    e.preventDefault();
    const app = appRegistry[id];
    const pinned = pinnedApps.includes(id);
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: `Open ${app.name}`, icon: app.icon, onClick: () => run(() => launchApp(id)) },
        pinned
          ? { label: "Unpin from Taskbar", icon: "PinOff", onClick: () => unpinApp(id) }
          : { label: "Pin to Taskbar", icon: "Pin", onClick: () => pinApp(id) },
      ],
    });
  }

  const pinned = pinnedApps.filter((id) => appRegistry[id]);
  const others = appList.filter((a) => !pinnedApps.includes(a.id));
  const recents = recentApps.filter((id) => appRegistry[id]).slice(0, 4);

  const renderTile = (id: AppId) => {
    const app = appRegistry[id];
    return (
      <button
        key={id}
        type="button"
        className="startmenu__tile"
        onClick={() => run(() => launchApp(id))}
        onContextMenu={(e) => appMenu(e, id)}
        title={app.description}
      >
        <AppIcon icon={app.icon} size={40} />
        <span>{app.name}</span>
      </button>
    );
  };

  return (
    <>
      <div className="startmenu-scrim" onMouseDown={onClose} />
      <div className="startmenu" role="dialog" aria-label="Start menu" onKeyDown={onKeyDown}>
        <div className="startmenu__search">
          <Search size={15} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search apps, files and settings…"
            spellCheck={false}
            autoComplete="off"
            aria-label="Search"
          />
        </div>

        <div className="startmenu__body">
          {searching ? (
            <SearchResults
              items={results}
              activeIndex={index}
              onHover={setIndex}
              onRun={(it: SearchItem) => run(it.run)}
              emptyText={`Nothing matches “${query}”`}
            />
          ) : (
            <>
              {pinned.length > 0 && (
                <section>
                  <h3 className="startmenu__heading">Pinned</h3>
                  <div className="startmenu__grid">{pinned.map(renderTile)}</div>
                </section>
              )}
              <section>
                <h3 className="startmenu__heading">{pinned.length > 0 ? "All apps" : "Apps"}</h3>
                <div className="startmenu__grid">{others.map((a) => renderTile(a.id))}</div>
              </section>
              {recents.length > 0 && (
                <section>
                  <h3 className="startmenu__heading">Recent</h3>
                  <div className="startmenu__recent">
                    {recents.map((id) => {
                      const app = appRegistry[id];
                      return (
                        <button
                          key={id}
                          type="button"
                          className="startmenu__recent-item"
                          onClick={() => run(() => launchApp(id))}
                          onContextMenu={(e) => appMenu(e, id)}
                        >
                          <AppIcon icon={app.icon} size={26} />
                          <span>{app.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        <div className="startmenu__footer">
          <div className="startmenu__user">
            <span className="startmenu__avatar">{username.charAt(0).toUpperCase() || "A"}</span>
            <span className="startmenu__user-text">
              <strong>{username}</strong>
              <small>OrbitOS · Stardance</small>
            </span>
          </div>
          <div className="startmenu__power">
            <button type="button" title="Settings" aria-label="Settings" onClick={() => run(() => launchApp("settings"))}>
              <SettingsIcon size={16} />
            </button>
            <button type="button" title="Lock" aria-label="Lock screen" onClick={() => run(lockOS)}>
              <Lock size={16} />
            </button>
            <button type="button" title="Restart" aria-label="Restart" onClick={() => run(restartOS)}>
              <RotateCcw size={16} />
            </button>
            <button type="button" title="Power off (lock)" aria-label="Power off" onClick={() => run(lockOS)}>
              <Power size={16} />
            </button>
          </div>
        </div>
      </div>
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
    </>
  );
}
