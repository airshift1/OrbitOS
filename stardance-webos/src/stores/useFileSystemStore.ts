import { create } from "zustand";
import { persist } from "zustand/middleware";
import { cleanNodeName, isProtectedNode, isSelfOrDescendant, isSystemAppsFolder } from "../lib/fsGuards";
import { scopedStorageKey } from "../platform/storageScope";
import type { FsNode, NodeType } from "../types";

interface FsState {
  nodes: Record<string, FsNode>;
  rootId: string;
  getChildren: (parentId: string) => FsNode[];
  getNode: (id: string) => FsNode | undefined;
  createNode: (parentId: string, name: string, type: NodeType, content?: string) => string;
  renameNode: (id: string, newName: string) => void;
  deleteNode: (id: string) => void;
  updateContent: (id: string, content: string) => void;
  moveNode: (id: string, newParentId: string) => void;
  getPath: (id: string) => string;
  resetFileSystem: () => void;
}

export const MAX_NODE_CONTENT = 4_000_000;

function makeNode(
  name: string,
  type: NodeType,
  parentId: string | null,
  content?: string,
): FsNode {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name,
    type,
    parentId,
    content,
    createdAt: now,
    updatedAt: now,
  };
}

function safeContent(content: unknown): string | undefined {
  return typeof content === "string" && content.length <= MAX_NODE_CONTENT ? content : undefined;
}

function safeStoredName(name: unknown): name is string {
  return typeof name === "string" && name.length > 0 && name.length <= 120 && name !== "." && name !== ".." && !/[\\/\u0000-\u001f\u007f]/.test(name);
}

export function sanitizePersistedFilesystem(raw: unknown): { nodes: Record<string, FsNode>; rootId: string } {
  const fallback = buildSeed();
  if (!raw || typeof raw !== "object") return fallback;
  const input = raw as { nodes?: unknown; rootId?: unknown };
  if (!input.nodes || typeof input.nodes !== "object" || typeof input.rootId !== "string") return fallback;
  const nodes: Record<string, FsNode> = {};
  for (const [id, value] of Object.entries(input.nodes as Record<string, unknown>)) {
    if (!/^[a-z0-9-]{1,100}$/i.test(id) || !value || typeof value !== "object") continue;
    const node = value as Partial<FsNode>;
    if (node.id !== id || !safeStoredName(node.name) || (node.type !== "file" && node.type !== "folder")) continue;
    if (node.parentId !== null && typeof node.parentId !== "string") continue;
    if (typeof node.createdAt !== "number" || !Number.isFinite(node.createdAt) || typeof node.updatedAt !== "number" || !Number.isFinite(node.updatedAt)) continue;
    if (node.content !== undefined && safeContent(node.content) === undefined) continue;
    nodes[id] = {
      id,
      name: node.name,
      type: node.type,
      parentId: node.parentId,
      content: safeContent(node.content),
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
    };
  }
  const root = nodes[input.rootId];
  if (!root || root.type !== "folder" || root.parentId !== null) return fallback;
  for (const node of Object.values(nodes)) {
    const seen = new Set<string>();
    let current: FsNode | undefined = node;
    while (current && current.id !== input.rootId) {
      if (seen.has(current.id) || !current.parentId || !nodes[current.parentId]) return fallback;
      seen.add(current.id);
      current = nodes[current.parentId];
    }
  }
  return { nodes, rootId: input.rootId };
}

const SYSTEM_APP_FILES: [string, string][] = [
  ["File Explorer.app", "file-explorer"],
  ["Text Editor.app", "text-editor"],
  ["Terminal.app", "terminal"],
  ["Calculator.app", "calculator"],
  ["Settings.app", "settings"],
  ["Browser.app", "browser"],
  ["About OrbitOS.app", "about-orbitos"],
  ["Profile.app", "profile"],
  ["Paint.app", "paint"],
  ["Clock.app", "clock"],
  ["System Monitor.app", "task-manager"],
  ["Snake.app", "snake"],
  ["Orbit Blast.app", "orbit-blast"],
  ["Dino Run.app", "dino-run"],
  ["2048.app", "2048"],
  ["Sandtrix.app", "sandtrix"],
  ["Orbit Depths.app", "orbit-depths"],
  ["Mortal Kombat Mobile.app", "mortal-kombat-mobile"],
  ["Welcome.app", "welcome"],
  ["Notes.app", "notes"],
  ["App Launcher.app", "launcher"],
  ["Theme Studio.app", "theme-studio"],
  ["Workspaces.app", "workspaces"],
];

function buildSeed(): { nodes: Record<string, FsNode>; rootId: string } {
  const root = makeNode("/", "folder", null);
  const desktop = makeNode("Desktop", "folder", root.id);
  const documents = makeNode("Documents", "folder", root.id);
  const pictures = makeNode("Pictures", "folder", root.id);
  const systemApps = makeNode("System Apps", "folder", root.id);
  const aboutOrbit = makeNode(
    "About OrbitOS.txt",
    "file",
    root.id,
    "OrbitOS is a public browser-based operating system experience.\n\nExplore the built-in apps, use Guest mode, and keep personal data in your own session.",
  );
  const readme = makeNode(
    "readme.txt",
    "file",
    documents.id,
    "This is a virtual file system. Anything you create here is saved in your browser.",
  );
  const todo = makeNode(
    "todo.txt",
    "file",
    documents.id,
    "- [ ] Star this repo\n- [ ] Hire this developer\n- [x] Build a cool OS",
  );

  // System app shortcuts (.app files contain the appId)
  const appFiles = SYSTEM_APP_FILES.map(([name, content]) =>
    makeNode(name, "file", systemApps.id, content),
  );

  const all = [
    root, desktop, documents, pictures, systemApps, aboutOrbit, readme, todo,
    ...appFiles,
  ];
  const nodes: Record<string, FsNode> = {};
  for (const node of all) {
    nodes[node.id] = node;
  }
  return { nodes, rootId: root.id };
}

function hasSiblingName(nodes: Record<string, FsNode>, parentId: string, name: string, excludeId?: string): boolean {
  return Object.values(nodes).some(
    (n) => n.parentId === parentId && n.name === name && n.id !== excludeId,
  );
}

function collectDescendants(nodes: Record<string, FsNode>, id: string): string[] {
  const ids: string[] = [];
  const queue = [id];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const current = queue.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    ids.push(current);
    for (const node of Object.values(nodes)) {
      if (node.parentId === current) {
        queue.push(node.id);
      }
    }
  }
  return ids;
}

export const useFileSystemStore = create<FsState>()(
  persist(
    (set, get) => ({
      ...buildSeed(),

      getChildren: (parentId: string) => {
        const { nodes } = get();
        return Object.values(nodes)
          .filter((n) => n.parentId === parentId)
          .sort((a, b) => {
            if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
            return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
          });
      },

      getNode: (id: string) => get().nodes[id],

      createNode: (parentId: string, rawName: string, type: NodeType, content?: string) => {
        const { nodes } = get();
        const name = cleanNodeName(rawName);
        if (!name || (type !== "file" && type !== "folder") || !nodes[parentId] || nodes[parentId].type !== "folder") return "";
        if (isSystemAppsFolder(nodes[parentId], get().rootId)) return "";
        if (typeof content === "string" && safeContent(content) === undefined) return "";
        if (hasSiblingName(nodes, parentId, name)) return "";
        const node = makeNode(name, type, parentId, safeContent(content));
        set((state) => ({
          nodes: { ...state.nodes, [node.id]: node },
        }));
        return node.id;
      },

      renameNode: (id: string, rawName: string) => {
        set((state) => {
          const existing = state.nodes[id];
          if (!existing) return state;
          const newName = cleanNodeName(rawName);
          if (!newName || isProtectedNode(existing, state.rootId)) return state;
          if (existing.parentId && hasSiblingName(state.nodes, existing.parentId, newName, id)) return state;
          return {
            nodes: {
              ...state.nodes,
              [id]: { ...existing, name: newName, updatedAt: Date.now() },
            },
          };
        });
      },

      deleteNode: (id: string) => {
        set((state) => {
          if (id === state.rootId || isProtectedNode(state.nodes[id], state.rootId)) return state;
          const idsToRemove = collectDescendants(state.nodes, id);
          const next = { ...state.nodes };
          for (const removeId of idsToRemove) {
            delete next[removeId];
          }
          return { nodes: next };
        });
      },

      updateContent: (id: string, content: string) => {
        set((state) => {
          const existing = state.nodes[id];
          if (!existing || existing.type !== "file" || isProtectedNode(existing, state.rootId) || safeContent(content) === undefined) return state;
          return {
            nodes: {
              ...state.nodes,
              [id]: { ...existing, content, updatedAt: Date.now() },
            },
          };
        });
      },

      moveNode: (id: string, newParentId: string) => {
        set((state) => {
          const existing = state.nodes[id];
          const destination = state.nodes[newParentId];
          if (!existing || !destination || destination.type !== "folder" || id === state.rootId) return state;
          if (isProtectedNode(existing, state.rootId) || isSystemAppsFolder(destination, state.rootId)) return state;
          if (isSelfOrDescendant(state.nodes, id, newParentId)) return state;
          if (hasSiblingName(state.nodes, newParentId, existing.name, id)) return state;
          return {
            nodes: {
              ...state.nodes,
              [id]: { ...existing, parentId: newParentId, updatedAt: Date.now() },
            },
          };
        });
      },

      getPath: (id: string) => {
        const { nodes, rootId } = get();
        const parts: string[] = [];
        let current = nodes[id];
        const seen = new Set<string>();
        while (current && current.id !== rootId) {
          if (seen.has(current.id)) return "/";
          seen.add(current.id);
          parts.unshift(current.name);
          current = current.parentId ? nodes[current.parentId] : undefined!;
        }
        return "/" + parts.join("/");
      },

      resetFileSystem: () => {
        set(buildSeed());
      },
    }),
    {
      name: scopedStorageKey("filesystem"),
      version: 6,
      partialize: (state) => ({ nodes: state.nodes, rootId: state.rootId }),
      migrate: (persisted: unknown, version: number) => {
        const state = sanitizePersistedFilesystem(persisted);
        if (version < 6) {
          // ensure the System Apps folder exists, then add app shortcuts introduced since v4.
          let sysFolder = Object.values(state.nodes).find(
            (n) => n.parentId === state.rootId && n.type === "folder" && n.name === "System Apps",
          );
          if (!sysFolder) {
            sysFolder = makeNode("System Apps", "folder", state.rootId);
            state.nodes[sysFolder.id] = sysFolder;
          }
          // "Task Manager" became "System Monitor"
          for (const n of Object.values(state.nodes)) {
            if (n.parentId === sysFolder.id && n.name === "Task Manager.app") {
              state.nodes[n.id] = { ...n, name: "System Monitor.app" };
            }
          }
          // add any app shortcuts that are missing
          for (const [name, content] of SYSTEM_APP_FILES) {
            const exists = Object.values(state.nodes).some(
              (n) => n.parentId === sysFolder!.id && n.name === name,
            );
            if (!exists) {
              const appNode = makeNode(name, "file", sysFolder.id, content);
              state.nodes[appNode.id] = appNode;
            }
          }
        }
        return state;
      },
      merge: (persisted, current) => ({ ...current, ...sanitizePersistedFilesystem(persisted) }),
    },
  ),
);
