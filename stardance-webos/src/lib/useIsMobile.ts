import { useEffect, useState } from "react";
import { MOBILE_BREAKPOINT } from "./geometry";

/** True below the mobile breakpoint (ported from @maomaolabs/core `useIsMobile`). */
export function useIsMobile(breakpoint = MOBILE_BREAKPOINT): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(`(max-width: ${breakpoint}px)`).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [breakpoint]);

  return isMobile;
}
