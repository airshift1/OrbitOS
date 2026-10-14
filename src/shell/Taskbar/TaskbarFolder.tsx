import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { TaskbarFolderDef } from "../../apps/taskbarFolders";
import { appRegistry } from "../../apps/registry";
import { launchApp } from "../../lib/launch";
import { getIcon } from "../../lib/icons";
import { TASKBAR_HEIGHT } from "../../lib/geometry";
import { AppIcon } from "../AppIcon";
import { cx } from "../../lib/helpers";

/** A taskbar button that opens a flyout of grouped apps (hover or click). */
export function TaskbarFolder({ folder }: { folder: TaskbarFolderDef }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const Icon = getIcon(folder.icon);

  const show = () => {
    window.clearTimeout(closeTimer.current);
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    setOpen(true);
  };
  const hideSoon = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 180);
  };

  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener("webos:close-menus", close);
    return () => {
      window.removeEventListener("webos:close-menus", close);
      window.clearTimeout(closeTimer.current);
    };
  }, []);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={cx("tb-btn tb-btn--icon", open && "tb-btn--active")}
        aria-haspopup="menu"
        aria-expanded={open}
        title={folder.title}
        onMouseEnter={show}
        onMouseLeave={hideSoon}
        onClick={() => (open ? setOpen(false) : show())}
      >
        <Icon size={20} strokeWidth={1.8} />
      </button>
      {open &&
        rect &&
        createPortal(
          <div
            className="tb-folder"
            role="menu"
            style={{
              left: Math.min(Math.max(8, rect.left + rect.width / 2 - 110), window.innerWidth - 228),
              bottom: TASKBAR_HEIGHT + 10,
            }}
            onMouseEnter={show}
            onMouseLeave={hideSoon}
          >
            <div className="tb-folder__title">{folder.title}</div>
            <div className="tb-folder__grid">
              {folder.apps.map((id) => {
                const app = appRegistry[id];
                return (
                  <button
                    key={id}
                    type="button"
                    role="menuitem"
                    className="tb-folder__item"
                    onClick={() => {
                      setOpen(false);
                      launchApp(id);
                    }}
                  >
                    <AppIcon icon={app.icon} size={38} />
                    <span>{app.name}</span>
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
