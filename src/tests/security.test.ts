import { describe, expect, it } from "vitest";
import vercelRaw from "../../vercel.json?raw";
import { isHexColor, isSafeWallpaper, isSameOrigin, safeHttpUrl, safeMailto } from "../lib/security";
import { cleanNodeName } from "../lib/fsGuards";
import { sanitizePersisted } from "../stores/useSystemStore";
import { WALLPAPERS } from "../lib/wallpapers";
import { SECURITY_HEADERS } from "../../security-headers";

describe("safeHttpUrl", () => {
  it("accepts http(s) URLs", () => {
    expect(safeHttpUrl("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(safeHttpUrl("  http://example.com  ")).toBe("http://example.com/");
  });
  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "blob:https://example.com/x",
    "//example.com",
    "https://user:pass@example.com",
    "",
    "   ",
  ])("rejects %j", (bad) => {
    expect(safeHttpUrl(bad)).toBeNull();
  });
  it("rejects non-strings and huge values", () => {
    expect(safeHttpUrl(undefined)).toBeNull();
    expect(safeHttpUrl(42)).toBeNull();
    expect(safeHttpUrl("https://example.com/" + "a".repeat(5000))).toBeNull();
  });
});

describe("isSameOrigin", () => {
  it("detects the app's own origin", () => {
    expect(isSameOrigin("http://localhost:4173/x", "http://localhost:4173/")).toBe(true);
    expect(isSameOrigin("https://example.com", "http://localhost:4173/")).toBe(false);
    expect(isSameOrigin("http://localhost:9999", "http://localhost:4173/")).toBe(false);
  });
});

describe("safeMailto", () => {
  it("accepts a plain address", () => expect(safeMailto("a.b@example.com")).toBe("mailto:a.b@example.com"));
  it.each(["a@b.co?cc=evil@x.com", "a@b.co&bcc=x@y.zz", "a@b.co,c@d.ee", "javascript:alert(1)", "<a@b.co>", "", "no-at-sign"])(
    "rejects %j",
    (bad) => expect(safeMailto(bad)).toBeNull(),
  );
});

describe("isHexColor", () => {
  it("only accepts #rrggbb", () => {
    expect(isHexColor("#a1B2c3")).toBe(true);
    for (const bad of ["red", "#fff", "#12345g", "#123456; background:url(x)", "url(x)", 5, null]) {
      expect(isHexColor(bad)).toBe(false);
    }
  });
});

describe("isSafeWallpaper", () => {
  it("accepts every built-in preset", () => {
    for (const w of WALLPAPERS) expect(isSafeWallpaper(w.css), w.id).toBe(true);
  });
  it("accepts colours, gradients, local and embedded images", () => {
    expect(isSafeWallpaper("#123456")).toBe(true);
    expect(isSafeWallpaper("linear-gradient(180deg, #111, #222)")).toBe(true);
    expect(isSafeWallpaper("url(/wallpapers/webos.png) center / cover")).toBe(true);
    expect(isSafeWallpaper('url("data:image/png;base64,iVBORw0KGgo=")')).toBe(true);
  });
  it.each([
    "url(https://tracker.example/pixel.gif)",
    "url(//tracker.example/pixel.gif)",
    "url('javascript:alert(1)')",
    'url("data:image/svg+xml;base64,PHN2Zz4=")',
    "url(data:text/html;base64,AAAA)",
    'image-set("https://tracker.example/a.png" 1x)',
    "cross-fade(url(/a.png), url(/b.png), 50%)",
    "element(#foo)",
    "red; position: fixed",
    "red } body { display: none",
    "@import 'x'",
    "expression(alert(1))",
    "",
  ])("rejects %j", (bad) => {
    expect(isSafeWallpaper(bad)).toBe(false);
  });
});

describe("cleanNodeName", () => {
  it("keeps ordinary names", () => {
    expect(cleanNodeName("  notes v2.txt ")).toBe("notes v2.txt");
    expect(cleanNodeName("日本語.md")).toBe("日本語.md");
  });
  it.each(["", "   ", ".", "..", "a/b", "a\\b", "x".repeat(121), "run.app", "RUN.APP", 5 as unknown as string])(
    "rejects %j",
    (bad) => expect(cleanNodeName(bad)).toBeNull(),
  );
  it("strips control characters", () => {
    expect(cleanNodeName("a\u0000b\nc")).toBe("abc");
  });
});

describe("sanitizePersisted (tampered localStorage)", () => {
  it("drops invalid values and keeps valid ones", () => {
    const out = sanitizePersisted({
      theme: "evil",
      windowStyle: "aero",
      wallpaper: "url(https://tracker.example/x.png)",
      accentColor: "red; background: url(x)",
      username: "Ada",
      volume: 9999,
      brightness: -5,
      wifi: "yes",
      pinnedApps: ["notes", "<img onerror=1>", "settings", "notes"],
      themeOverrides: { surface: "javascript:1", surface2: "#101010", radiusWin: 999, radiusSm: "x" },
      desktopIconPos: { a: { x: 1, y: 2 }, b: { x: "1", y: NaN }, c: null },
    });
    expect(out.theme).toBeUndefined();
    expect(out.windowStyle).toBe("aero");
    expect(out.wallpaper).toBeUndefined();
    expect(out.accentColor).toBeUndefined();
    expect(out.username).toBe("Ada");
    expect(out.volume).toBe(100);
    expect(out.brightness).toBe(20);
    expect(out.wifi).toBe(true);
    expect(out.pinnedApps).toEqual(["notes", "settings"]);
    expect(out.themeOverrides).toEqual({ surface2: "#101010", radiusWin: 24 });
    expect(out.desktopIconPos).toEqual({ a: { x: 1, y: 2 } });
  });
  it("tolerates garbage", () => {
    for (const junk of [null, undefined, 5, "x", [], {}]) expect(() => sanitizePersisted(junk)).not.toThrow();
  });
});

describe("deployment headers", () => {
  it("vercel.json mirrors security-headers.ts", () => {
    const vercel = JSON.parse(vercelRaw);
    const listed = Object.fromEntries(vercel.headers[0].headers.map((h: { key: string; value: string }) => [h.key, h.value]));
    expect(listed).toEqual(SECURITY_HEADERS);
  });
  it("CSP forbids inline/remote scripts, plugins and framing of the app", () => {
    const csp = SECURITY_HEADERS["Content-Security-Policy"];
    expect(csp).toContain("script-src 'self';");
    expect(csp).not.toMatch(/script-src[^;]*unsafe/);
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
