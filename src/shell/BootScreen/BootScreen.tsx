import { useEffect, useState } from "react";
import { useSystemStore } from "../../stores/useSystemStore";
import { playSound } from "../../lib/sound";
import "./BootScreen.css";

const STEPS = ["Loading settings", "Mounting file system", "Starting window manager", "Ready"];
const TOTAL_MS = 2000;

export function BootScreen({ onDone }: { onDone: () => void }) {
  const [fading, setFading] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const per = (TOTAL_MS - 250) / STEPS.length;
    const stepTimers = STEPS.map((_, i) => setTimeout(() => setStep(i), i * per));
    const fadeTimer = setTimeout(() => setFading(true), TOTAL_MS - 250);
    const doneTimer = setTimeout(() => {
      if (useSystemStore.getState().startupSound) playSound("startup");
      onDone();
    }, TOTAL_MS);
    return () => {
      stepTimers.forEach(clearTimeout);
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div className={`boot ${fading ? "boot--out" : ""}`} role="status" aria-live="polite" aria-label="Starting OrbitOS">
      <div className="boot__inner">
        <div className="eyebrow">Stardance WebOS</div>
        <div className="boot__word display">OrbitOS</div>
        <div className="boot__bar" aria-hidden="true">
          <div className="boot__fill" />
        </div>
        <div className="boot__status">{STEPS[step]}</div>
      </div>
    </div>
  );
}
