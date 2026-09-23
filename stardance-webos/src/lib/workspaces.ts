/**
 * Virtual desktops — single source of truth for the workspace count and clamp.
 * (Ported from webos-master's `os/workspaces.ts`.)
 */
export const WORKSPACE_COUNT = 4;

export const WORKSPACE_INDICES: number[] = Array.from({ length: WORKSPACE_COUNT }, (_, i) => i);

/** Coerce anything into a valid workspace index (non-finite → 0). */
export function clampWorkspace(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.min(WORKSPACE_COUNT - 1, Math.max(0, Math.trunc(n)));
}
