import { useSystemStore } from "../stores/useSystemStore";
import { useWindowStore } from "../stores/useWindowStore";
import { playSound } from "./sound";

/** Lock the screen (windows stay open underneath). */
export function lockOS() {
  window.dispatchEvent(new CustomEvent("webos:close-menus"));
  useSystemStore.getState().setLocked(true);
}

/** "Restart": close every window and replay the boot sequence. */
export function restartOS() {
  window.dispatchEvent(new CustomEvent("webos:close-menus"));
  const { topZIndex } = useWindowStore.getState();
  useWindowStore.getState().hydrate({ windows: [], focusedId: null, topZIndex, activeWorkspace: 0 });
  useSystemStore.getState().setBooted(false);
  playSound("close");
}
