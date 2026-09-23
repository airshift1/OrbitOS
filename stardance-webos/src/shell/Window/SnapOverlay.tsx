import { useWindowStore } from "../../stores/useWindowStore";

/** Translucent preview of the tile a dragged window will snap into. */
export function SnapOverlay() {
  const rect = useWindowStore((s) => s.snapPreview);
  if (!rect) return null;
  return (
    <div
      className="snap-overlay"
      aria-hidden="true"
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
    />
  );
}
