import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
}

interface NotesState {
  notes: Note[];
  selectedId: string | null;
  addNote: () => string;
  updateNote: (id: string, patch: Partial<Pick<Note, "title" | "content">>) => void;
  deleteNote: (id: string) => void;
  select: (id: string | null) => void;
}

const now = Date.now();
const HOUR = 3_600_000;

const SEED: Note[] = [
  {
    id: "note-ideas",
    title: "Project Ideas",
    updatedAt: now - 2 * HOUR,
    content:
      "Build an operating system in the browser using React + TypeScript.\n\nKey features:\n– Draggable, resizable windows\n– Snap tiling & virtual desktops\n– A tiling Workspace app\n– Notes that survive a reload\n\nNext steps:\n→ Add more apps\n→ Package as a PWA",
  },
  {
    id: "note-shortcuts",
    title: "OrbitOS Shortcuts",
    updatedAt: now - 24 * HOUR,
    content:
      "Keyboard shortcuts:\n\nCtrl + K / Ctrl + Space   →  Spotlight\nCtrl + `                  →  Terminal\nCtrl + E                  →  File Explorer\nCtrl + ,                  →  Settings\nCtrl + Alt + 1-4          →  Switch desktop\nCtrl + Alt + Shift + 1-4  →  Move window to desktop\nArrow keys                →  Move focused window\nShift + Arrow keys        →  Resize focused window\nDrag to an edge / corner  →  Snap tile\nDouble-click title bar    →  Maximize",
  },
  {
    id: "note-reading",
    title: "Reading List",
    updatedAt: now - 3 * 24 * HOUR,
    content:
      "Books to read:\n\n1. The Design of Everyday Things — Don Norman\n2. A Pattern Language — Christopher Alexander\n3. Thinking in Systems — Donella Meadows\n4. Working in Public — Nadia Eghbal",
  },
];

export const useNotesStore = create<NotesState>()(
  persist(
    (set, get) => ({
      notes: SEED,
      selectedId: SEED[0].id,

      addNote: () => {
        const id = crypto.randomUUID();
        set((s) => ({
          notes: [{ id, title: "New Note", content: "", updatedAt: Date.now() }, ...s.notes],
          selectedId: id,
        }));
        return id;
      },

      updateNote: (id, patch) =>
        set((s) => ({
          notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)),
        })),

      deleteNote: (id) => {
        const remaining = get().notes.filter((n) => n.id !== id);
        set((s) => ({
          notes: remaining,
          selectedId: s.selectedId === id ? (remaining[0]?.id ?? null) : s.selectedId,
        }));
      },

      select: (id) => set({ selectedId: id }),
    }),
    { name: "webos-notes", version: 1, partialize: (s) => ({ notes: s.notes, selectedId: s.selectedId }) },
  ),
);
