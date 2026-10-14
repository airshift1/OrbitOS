import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { WindowState } from "../../types";
import { getIcon } from "../../lib/icons";
import { TASKBAR_HEIGHT } from "../../lib/geometry";

const PREVIEW_W = 240;
const PREVIEW_H = 150;

interface Props {
  win: WindowState;
  /** Bounding rect of the taskbar button being hovered. */
  anchor: DOMRect;
}

/**
 * Live thumbnail of a window: the real window DOM is cloned, made inert and
 * scaled down (technique from @maomaolabs/core's WindowPreview). Canvas
 * pixels are copied across so Paint & friends preview correctly.
 */
export function WindowPreview({ win, anchor }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const Icon = getIcon(win.icon);

  useLayoutEffect(() => {
    const src = document.getElementById(`window-${win.id}`);
    const box = boxRef.current;
    if (!src || !box) return;

    const clone = src.cloneNode(true) as HTMLElement;
    clone.removeAttribute("id");
    clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
    clone.classList.remove("window--closing");

    const srcCanvases = src.querySelectorAll("canvas");
    const dstCanvases = clone.querySelectorAll("canvas");
    srcCanvases.forEach((c, i) => {
      const d = dstCanvases[i] as HTMLCanvasElement | undefined;
      if (!d || !c.width || !c.height) return;
      d.width = c.width;
      d.height = c.height;
      d.getContext("2d")?.drawImage(c, 0, 0);
    });

    const w = Math.max(240, win.width);
    const h = Math.max(160, win.height);
    const scale = Math.min((PREVIEW_W - 16) / w, (PREVIEW_H - 16) / h);
    clone.inert = true;
    Object.assign(clone.style, {
      display: "flex",
      position: "absolute",
      left: "0px",
      top: "0px",
      width: `${w}px`,
      height: `${h}px`,
      transform: `scale(${scale})`,
      transformOrigin: "top left",
      pointerEvents: "none",
      animation: "none",
      opacity: "1",
      zIndex: "0",
    });
    box.style.width = `${w * scale}px`;
    box.style.height = `${h * scale}px`;
    box.replaceChildren(clone);
  }, [win.id, win.width, win.height]);

  const left = Math.min(
    Math.max(8, anchor.left + anchor.width / 2 - PREVIEW_W / 2),
    window.innerWidth - PREVIEW_W - 8,
  );

  return createPortal(
    <div className="tb-preview" style={{ left, bottom: TASKBAR_HEIGHT + 10, width: PREVIEW_W }} role="tooltip">
      <div className="tb-preview__title">
        <Icon size={13} />
        <span>{win.title}</span>
      </div>
      <div className="tb-preview__frame">
        <div ref={boxRef} className="tb-preview__box" />
      </div>
    </div>,
    document.body,
  );
}
