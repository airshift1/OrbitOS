import { useEffect, useRef, useState } from "react";

export function useSnakeAnimation(active: boolean, stepMs: number, tick: () => void): number {
  const tickRef = useRef(tick);
  const [progress, setProgress] = useState(0);
  tickRef.current = tick;

  useEffect(() => {
    if (!active) {
      setProgress(0);
      return;
    }
    let frame = 0;
    let lastTime: number | null = null;
    let accumulator = 0;
    let disposed = false;
    const animate = (time: number) => {
      if (disposed) return;
      if (document.hidden) {
        lastTime = time;
        accumulator = 0;
        setProgress(0);
      } else if (lastTime !== null) {
        accumulator += Math.max(0, time - lastTime);
        while (accumulator >= stepMs) {
          tickRef.current();
          accumulator -= stepMs;
        }
        setProgress(accumulator / stepMs);
      }
      lastTime = time;
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    const resetOnVisibility = () => { lastTime = null; accumulator = 0; setProgress(0); };
    document.addEventListener("visibilitychange", resetOnVisibility);
    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", resetOnVisibility);
    };
  }, [active, stepMs]);

  return progress;
}

export function useSnakeSnapshotInterpolation(active: boolean, stepMs: number, snapshot: unknown): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!active) {
      setProgress(0);
      return;
    }
    let frame = 0;
    let startedAt: number | null = null;
    let disposed = false;
    const animate = (time: number) => {
      if (disposed) return;
      if (document.hidden) {
        startedAt = null;
        setProgress(0);
      } else {
        startedAt ??= time;
        const nextProgress = Math.min(1, Math.max(0, (time - startedAt) / stepMs));
        setProgress(nextProgress);
        if (nextProgress >= 1) return;
      }
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    const resetOnVisibility = () => {
      startedAt = null;
      setProgress(0);
      frame = window.requestAnimationFrame(animate);
    };
    document.addEventListener("visibilitychange", resetOnVisibility);
    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", resetOnVisibility);
    };
  }, [active, snapshot, stepMs]);

  return progress;
}
