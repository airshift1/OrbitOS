import { useEffect, useState } from "react";

interface BatteryManagerLike extends EventTarget {
  level: number;
  charging: boolean;
}

export interface BatteryInfo {
  level: number;
  charging: boolean;
}

/** Real battery status where the (Chromium-only) Battery API exists; otherwise null. */
export function useBattery(): BatteryInfo | null {
  const [info, setInfo] = useState<BatteryInfo | null>(null);

  useEffect(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManagerLike> };
    if (!nav.getBattery) return;
    let battery: BatteryManagerLike | null = null;
    let cancelled = false;
    const update = () => {
      if (battery && !cancelled) setInfo({ level: battery.level, charging: battery.charging });
    };
    nav
      .getBattery()
      .then((b) => {
        battery = b;
        update();
        b.addEventListener("levelchange", update);
        b.addEventListener("chargingchange", update);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      battery?.removeEventListener("levelchange", update);
      battery?.removeEventListener("chargingchange", update);
    };
  }, []);

  return info;
}
