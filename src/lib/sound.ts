import { useSystemStore } from "../stores/useSystemStore";

export type SoundName = "open" | "close" | "click" | "error" | "chime" | "notify" | "startup";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface Tone {
  freq: number;
  dur: number;
  type: OscillatorType;
  /** Delay before this tone starts, seconds. */
  at?: number;
}

const TONES: Record<SoundName, Tone[]> = {
  open: [{ freq: 660, dur: 0.1, type: "sine" }],
  close: [{ freq: 440, dur: 0.08, type: "sine" }],
  click: [{ freq: 520, dur: 0.06, type: "triangle" }],
  error: [{ freq: 200, dur: 0.12, type: "square" }],
  chime: [{ freq: 880, dur: 0.35, type: "sine" }],
  notify: [
    { freq: 784, dur: 0.12, type: "sine" },
    { freq: 1047, dur: 0.18, type: "sine", at: 0.11 },
  ],
  startup: [
    { freq: 392, dur: 0.22, type: "sine" },
    { freq: 523, dur: 0.22, type: "sine", at: 0.18 },
    { freq: 784, dur: 0.4, type: "sine", at: 0.36 },
  ],
};

/** Sounds that "Do not disturb" silences. */
const ALERT_SOUNDS: SoundName[] = ["chime", "notify"];

/** Synthesised UI sounds (Web Audio, no audio files). Honors sound, volume & DND settings. */
export function playSound(name: SoundName) {
  const { soundEnabled, volume, doNotDisturb } = useSystemStore.getState();
  if (!soundEnabled || volume <= 0) return;
  if (doNotDisturb && ALERT_SOUNDS.includes(name)) return;

  const audio = getCtx();
  if (!audio) return;

  try {
    const level = 0.22 * (volume / 100);
    for (const { freq, dur, type, at = 0 } of TONES[name]) {
      const start = audio.currentTime + at;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(level, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.connect(gain).connect(audio.destination);
      osc.start(start);
      osc.stop(start + dur);
    }
  } catch {
    // blocked by browser autoplay policy — silently ignore
  }
}
