import { describe, expect, it } from "vitest";
import { contrast, ensureContrast, readableOn } from "../lib/color";

describe("colour helpers", () => {
  it("computes WCAG contrast", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrast("#777777", "#777777")).toBeCloseTo(1, 5);
  });
  it("makes any accent readable as text on the surface", () => {
    for (const accent of ["#ffff00", "#00c8f0", "#e0653a", "#222222", "#ffffff", "#123456"]) {
      for (const surface of ["#191813", "#f7f3e9", "#000000"]) {
        expect(contrast(ensureContrast(accent, surface), surface), `${accent} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it("leaves already-readable colours alone", () => {
    expect(ensureContrast("#eae6dc", "#191813")).toBe("#eae6dc");
  });
  it("picks a readable text colour for any accent", () => {
    for (const accent of ["#ffff00", "#0000ff", "#e0653a", "#b5390f", "#00c8f0"]) {
      expect(contrast(readableOn(accent), accent), accent).toBeGreaterThanOrEqual(4.5);
    }
  });
});
