import type { FsNode } from "../types";

// Seed folders that back core OS features — protected from rename/move/delete.
const SYSTEM_FOLDERS = ["Desktop", "Documents", "Pictures", "System Apps"];

export function isProtectedNode(node: FsNode | undefined, rootId: string): boolean {
  if (!node) return true;
  if (node.id === rootId) return true;
  if (
    node.parentId === rootId &&
    node.type === "folder" &&
    SYSTEM_FOLDERS.includes(node.name)
  ) {
    return true;
  }
  // .app files are system shortcuts — always protected
  if (node.name.endsWith(".app")) return true;
  return false;
}

// The System Apps folder is fully locked for drag & drop: nothing can be
// dragged into it, and nothing can be dragged out of it.
export function isSystemAppsFolder(node: FsNode | undefined, rootId: string): boolean {
  return (
    !!node &&
    node.type === "folder" &&
    node.parentId === rootId &&
    node.name === "System Apps"
  );
}

// True if `maybeDescendantId` is inside the subtree rooted at `ancestorId`
// (including the ancestor itself). Used to stop moving a folder into itself.
export function isSelfOrDescendant(
  nodes: Record<string, FsNode>,
  ancestorId: string,
  maybeDescendantId: string,
): boolean {
  let current: FsNode | undefined = nodes[maybeDescendantId];
  while (current) {
    if (current.id === ancestorId) return true;
    current = current.parentId ? nodes[current.parentId] : undefined;
  }
  return false;
}

export const MAX_NODE_NAME = 120;

/**
 * Names live in a flat id-keyed map (no real paths), but they are still shown
 * in paths, used as download names and drive behaviour (".app" shortcuts), so
 * user-supplied names are normalised and constrained.
 * Returns the cleaned name, or null when it isn't acceptable.
 */
export function cleanNodeName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const name = raw.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!name || name.length > MAX_NODE_NAME) return null;
  if (name === "." || name === "..") return null;
  if (/[\\/]/.test(name)) return null;
  // ".app" marks system shortcuts (protected, launch an app) — users can't mint them.
  if (name.toLowerCase().endsWith(".app")) return null;
  return name;
}
