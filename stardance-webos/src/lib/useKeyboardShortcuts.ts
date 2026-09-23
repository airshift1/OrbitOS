import { useEffect } from "react";
import { launchApp } from "./launch";
import { useWindowStore } from "../stores/useWindowStore";
import { WORKSPACE_COUNT } from "./workspaces";

/**
 * Global, OS-style keyboard shortcuts, registered once from <App>.
 *
 *   Ctrl/Cmd + K, Ctrl + Space   Spotlight
 *   Ctrl/Cmd + `                 launch / focus Terminal
 *   Ctrl/Cmd + E                 launch / focus File Explorer
 *   Ctrl/Cmd + ,                 launch / focus Settings
 *   Ctrl + Alt + 1‥4             switch virtual desktop   (also Ctrl/Cmd + 1‥4 where the browser allows it)
 *   Ctrl + Alt + Shift + 1‥4     move the focused window to that desktop
 *   Escape                       close the Start menu / open menus
 *
 * Per-window keys (arrows to move, Shift+arrows to resize, Ctrl+W to close)
 * live on <Window> so they only fire when that window has focus.
 */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    function closeMenus() {
      window.dispatchEvent(new CustomEvent("webos:close-menus"));
    }

    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;

      // Escape: never preventDefault so app-level Escape handlers keep working.
      if (e.key === "Escape" && !mod && !e.altKey && !e.shiftKey) {
        closeMenus();
        return;
      }

      // --- Virtual desktops: Ctrl/Cmd(+Alt) + 1..N ---
      if (mod) {
        const m = /^Digit([1-9])$/.exec(e.code);
        if (m) {
          const idx = Number(m[1]) - 1;
          if (idx < WORKSPACE_COUNT) {
            e.preventDefault();
            const ws = useWindowStore.getState();
            if (e.shiftKey) {
              if (ws.focusedId) {
                ws.moveWindowToWorkspace(ws.focusedId, idx);
                ws.switchWorkspace(idx);
                const moved = ws.focusedId;
                ws.focusWindow(moved);
              }
            } else {
              ws.switchWorkspace(idx);
            }
            return;
          }
        }
      }

      if (!mod) return;

      // --- Spotlight ---
      if (!e.altKey && !e.shiftKey && (e.key.toLowerCase() === "k" || e.code === "Space")) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("webos:toggle-spotlight"));
        return;
      }

      // --- App launch / focus ---
      if (!e.altKey && !e.shiftKey) {
        if (e.key === "`") {
          e.preventDefault();
          launchApp("terminal");
        } else if (e.key.toLowerCase() === "e") {
          e.preventDefault();
          launchApp("file-explorer");
        } else if (e.key === ",") {
          e.preventDefault();
          launchApp("settings");
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
