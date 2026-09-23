import { useCallback, useEffect, useState } from "react";
import { Desktop } from "./shell/Desktop/Desktop";
import { Window } from "./shell/Window/Window";
import { SnapOverlay } from "./shell/Window/SnapOverlay";
import { Taskbar } from "./shell/Taskbar/Taskbar";
import { StartMenu } from "./shell/StartMenu/StartMenu";
import { Spotlight } from "./shell/Spotlight/Spotlight";
import { QuickPanel } from "./shell/QuickPanel/QuickPanel";
import { ToastStack } from "./shell/QuickPanel/ToastStack";
import { BootScreen } from "./shell/BootScreen/BootScreen";
import { LockScreen } from "./shell/BootScreen/LockScreen";
import { useWindowStore } from "./stores/useWindowStore";
import { useSystemStore } from "./stores/useSystemStore";
import { notify } from "./stores/useNotificationStore";
import { useKeyboardShortcuts } from "./lib/useKeyboardShortcuts";
import { useAppearance } from "./lib/appearance";
import { launchApp } from "./lib/launch";

function App() {
  const windows = useWindowStore((s) => s.windows);
  const refitWindows = useWindowStore((s) => s.refitWindows);
  const booted = useSystemStore((s) => s.booted);
  const locked = useSystemStore((s) => s.locked);
  const welcomed = useSystemStore((s) => s.welcomed);
  const brightness = useSystemStore((s) => s.brightness);
  const nightMode = useSystemStore((s) => s.nightMode);
  const setBooted = useSystemStore((s) => s.setBooted);
  const setLocked = useSystemStore((s) => s.setLocked);
  const setWelcomed = useSystemStore((s) => s.setWelcomed);

  const [startOpen, setStartOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [spotlightOpen, setSpotlightOpen] = useState(false);

  useKeyboardShortcuts();
  useAppearance();

  // Menus close together; opening one closes the others.
  useEffect(() => {
    const closeMenus = () => {
      setStartOpen(false);
      setQuickOpen(false);
      setSpotlightOpen(false);
    };
    const toggleSpotlight = () => {
      setStartOpen(false);
      setQuickOpen(false);
      setSpotlightOpen((v) => !v);
    };
    window.addEventListener("webos:close-menus", closeMenus);
    window.addEventListener("webos:toggle-spotlight", toggleSpotlight);
    return () => {
      window.removeEventListener("webos:close-menus", closeMenus);
      window.removeEventListener("webos:toggle-spotlight", toggleSpotlight);
    };
  }, []);

  // Keep windows on-screen when the viewport changes (rotation, resize, snapping).
  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(refitWindows);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, [refitWindows]);

  // First run: open the Welcome tour and drop a notification.
  useEffect(() => {
    if (!booted || welcomed || useSystemStore.getState().welcomed) return;
    setWelcomed(true);
    if (useWindowStore.getState().windows.length === 0) launchApp("welcome");
    notify({
      title: "OrbitOS is ready",
      body: "Ctrl+K opens search.",
      kind: "info",
      appId: "welcome",
    });
  }, [booted, welcomed, setWelcomed]);

  const handleBootDone = useCallback(() => setBooted(true), [setBooted]);

  if (!booted) return <BootScreen onDone={handleBootDone} />;
  if (locked) return <LockScreen onUnlock={() => setLocked(false)} />;

  const dim = Math.max(0, (100 - brightness) / 100) * 0.8;

  return (
    <>
      <Desktop>
        {windows.map((w) => (
          <Window key={w.id} win={w} />
        ))}
        <SnapOverlay />
        <StartMenu open={startOpen} onClose={() => setStartOpen(false)} />
        <QuickPanel open={quickOpen} onClose={() => setQuickOpen(false)} />
        <Taskbar
          startOpen={startOpen}
          quickOpen={quickOpen}
          onToggleStart={() => {
            setQuickOpen(false);
            setStartOpen((v) => !v);
          }}
          onToggleQuick={() => {
            setStartOpen(false);
            setQuickOpen((v) => !v);
          }}
        />
        <ToastStack />
      </Desktop>
      <Spotlight open={spotlightOpen} onClose={() => setSpotlightOpen(false)} />
      {(dim > 0 || nightMode) && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 99999,
            background: nightMode ? `rgba(255, 150, 40, ${0.14 + dim})` : `rgba(0, 0, 0, ${dim})`,
            mixBlendMode: nightMode ? "multiply" : "normal",
          }}
        />
      )}
    </>
  );
}

export default App;
