import { useEffect, useLayoutEffect, useRef } from "react";

export function useSnakeAnimation(active: boolean, tick: (deltaMs: number) => void): void {
  const tickRef = useRef(tick);

  useLayoutEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let lastTime: number | null = null;
    let disposed = false;
    const animate = (time: number) => {
      if (disposed) return;
      if (document.hidden) {
        lastTime = time;
      } else if (lastTime !== null) {
        tickRef.current(Math.min(50, Math.max(0, time - lastTime)));
      }
      lastTime = time;
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    const resetOnVisibility = () => { lastTime = null; };
    document.addEventListener("visibilitychange", resetOnVisibility);
    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", resetOnVisibility);
    };
  }, [active]);
}
