import { describe, expect, it } from "vitest";
import { evaluateExpression as fn } from "../apps/Calculator/evaluate";

describe("calculator evaluator (hand-written parser, no eval)", () => {
  it("evaluates arithmetic", () => {
    expect(fn("2+3*4")).toBe(14);
    expect(fn("(2+3)*4")).toBe(20);
  });
  it("rejects code-like input instead of executing it", () => {
    for (const bad of ["alert(1)", "process.exit()", "2+constructor", "1;2", "`x`", "globalThis"]) {
      expect(fn(bad), bad).toBeNull();
    }
  });
});
