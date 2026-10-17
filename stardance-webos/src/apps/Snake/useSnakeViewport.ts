import { useEffect, useState, type RefObject } from "react";

export interface SnakeViewport {
  columns: number;
  rows: number;
  width: number;
  height: number;
}

export function calculateSnakeViewport(width: number, height: number): SnakeViewport {
  const portrait = height > width;
  const columns = portrait ? 16 : 24;
  const rows = portrait ? 24 : 16;
  if (width <= 0 || height <= 0) return { columns, rows, width: 0, height: 0 };

  const cellSize = Math.min(width / columns, height / rows);
  return {
    columns,
    rows,
    width: Math.round(cellSize * columns * 100) / 100,
    height: Math.round(cellSize * rows * 100) / 100,
  };
}

export function useSnakeViewport(stageRef: RefObject<HTMLElement | null>, enabled = true): SnakeViewport {
  const [viewport, setViewport] = useState<SnakeViewport>(() => calculateSnakeViewport(0, 0));

  useEffect(() => {
    const stage = enabled ? stageRef.current : null;
    if (!stage) return;

    const update = (width = stage.clientWidth, height = stage.clientHeight) => {
      setViewport((current) => {
        const next = calculateSnakeViewport(width, height);
        return current.columns === next.columns && current.rows === next.rows &&
          current.width === next.width && current.height === next.height ? current : next;
      });
    };
    const updateOnResize = () => update();

    update();
    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver((entries) => {
          const entry = entries[0];
          if (entry) update(entry.contentRect.width, entry.contentRect.height);
        });
    observer?.observe(stage);
    window.addEventListener("resize", updateOnResize);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateOnResize);
    };
  }, [enabled, stageRef]);

  return viewport;
}
