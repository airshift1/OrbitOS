/** Minimal WCAG colour maths, used to keep user-chosen accent colours readable. */

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Whichever of the two text colours reads better on `bg`. */
export function readableOn(bg: string, dark = "#16110d", light = "#fffaf2"): string {
  return contrast(dark, bg) >= contrast(light, bg) ? dark : light;
}

/**
 * Nudge `fg` towards white or black (whichever direction increases contrast
 * against `bg`) until it reaches `min`. Returns `fg` unchanged if already fine.
 */
export function ensureContrast(fg: string, bg: string, min = 4.5): string {
  if (contrast(fg, bg) >= min) return fg;
  const target: [number, number, number] = luminance(bg) > 0.4 ? [0, 0, 0] : [255, 255, 255];
  const base = hexToRgb(fg);
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const mixed = rgbToHex(base.map((v, i) => v + (target[i] - v) * t) as [number, number, number]);
    if (contrast(mixed, bg) >= min) return mixed;
  }
  return rgbToHex(target);
}
