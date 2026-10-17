import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getIcon } from "../../lib/icons";
import type { ContextMenuItem } from "../../types";
import { cx } from "../../lib/helpers";
import "./ContextMenu.css";

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

/** Right-click menu. Fully keyboard-operable: ↑/↓/Home/End move, Enter/Space choose, Esc closes. */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const [openSubmenu, setOpenSubmenu] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth) left = window.innerWidth - rect.width - 4;
    if (top + rect.height > window.innerHeight) top = window.innerHeight - rect.height - 4;
    setPos({ left: Math.max(4, left), top: Math.max(4, top) });
  }, [x, y]);

  // Move focus into the menu, and hand it back to whatever had it when the menu closes.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => previous?.focus?.({ preventScroll: true });
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const i = buttons.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => buttons[(n + buttons.length) % buttons.length]?.focus();
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        go(i + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        go(i - 1);
        break;
      case "Home":
        e.preventDefault();
        go(0);
        break;
      case "End":
        e.preventDefault();
        go(buttons.length - 1);
        break;
      case "Escape":
      case "Tab":
        e.preventDefault();
        e.stopPropagation();
        onClose();
        break;
    }
  }

  return createPortal(
    <div
      className="ctx-overlay"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        ref={menuRef}
        role="menu"
        className="ctx-menu"
        style={{ left: pos.left, top: pos.top }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {items.map((item, i) => {
          const ItemIcon = item.icon ? getIcon(item.icon) : null;
          const hasSubmenu = !!item.submenu?.length;
          return (
            <div key={i} className="ctx-item-wrap" role="none" onMouseEnter={() => setOpenSubmenu(hasSubmenu ? i : null)}>
              {item.separatorBefore && <div className="ctx-sep" role="separator" />}
              <button
                type="button"
                role="menuitem"
                aria-haspopup={hasSubmenu ? "menu" : undefined}
                aria-expanded={hasSubmenu ? openSubmenu === i : undefined}
                disabled={item.disabled}
                className={cx("ctx-item", item.danger && "ctx-item--danger")}
                onClick={() => {
                  if (hasSubmenu) return setOpenSubmenu(openSubmenu === i ? null : i);
                  item.onClick?.();
                  onClose();
                }}
              >
                {ItemIcon && <ItemIcon size={15} />}
                <span>{item.label}</span>
                {hasSubmenu && <span className="ctx-arrow" aria-hidden="true">›</span>}
              </button>
              {hasSubmenu && openSubmenu === i && (
                <div className="ctx-submenu" role="menu">
                  {item.submenu!.map((child, childIndex) => {
                    const ChildIcon = child.icon ? getIcon(child.icon) : null;
                    return (
                      <div key={childIndex} role="none">
                        {child.separatorBefore && <div className="ctx-sep" role="separator" />}
                        <button
                          type="button"
                          role="menuitem"
                          disabled={child.disabled}
                          className={cx("ctx-item", child.danger && "ctx-item--danger")}
                          onClick={() => { child.onClick?.(); onClose(); }}
                        >
                          {ChildIcon && <ChildIcon size={15} />}
                          <span>{child.label}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}
