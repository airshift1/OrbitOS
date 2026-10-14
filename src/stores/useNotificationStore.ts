import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppId } from "../types";
import { useSystemStore } from "./useSystemStore";
import { playSound } from "../lib/sound";

export type NotifKind = "info" | "success" | "warning" | "error";

export interface Notif {
  id: string;
  title: string;
  body: string;
  kind: NotifKind;
  /** App to open when the notification is clicked. */
  appId?: AppId;
  time: number;
  read: boolean;
}

interface NotificationState {
  items: Notif[];
  /** Transient popups (not persisted). */
  toasts: Notif[];
  push: (n: { title: string; body?: string; kind?: NotifKind; appId?: AppId }) => void;
  dismissToast: (id: string) => void;
  remove: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
}

const MAX_ITEMS = 30;
const TOAST_MS = 4800;

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      items: [],
      toasts: [],

      push: ({ title, body = "", kind = "info", appId }) => {
        const n: Notif = {
          id: crypto.randomUUID(),
          title,
          body,
          kind,
          appId,
          time: Date.now(),
          read: false,
        };
        const dnd = useSystemStore.getState().doNotDisturb;
        set((s) => ({
          items: [n, ...s.items].slice(0, MAX_ITEMS),
          // Do-not-disturb still logs the notification, it just doesn't pop up.
          toasts: dnd ? s.toasts : [...s.toasts, n].slice(-4),
        }));
        if (!dnd) {
          playSound(kind === "error" ? "error" : "notify");
          setTimeout(() => get().dismissToast(n.id), TOAST_MS);
        }
      },

      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      markAllRead: () => set((s) => ({ items: s.items.map((i) => (i.read ? i : { ...i, read: true })) })),
      clear: () => set({ items: [], toasts: [] }),
    }),
    {
      name: "webos-notifications",
      version: 1,
      partialize: (s) => ({ items: s.items }),
    },
  ),
);

/** Fire-and-forget helper for apps: `notify({ title: "Timer finished" })`. */
export function notify(n: { title: string; body?: string; kind?: NotifKind; appId?: AppId }) {
  useNotificationStore.getState().push(n);
}
