import { describe, expect, it } from "vitest";
import { Bot, Gamepad2 } from "lucide-react";
import { appList, appRegistry } from "../apps/registry";
import {
  externalCatalog,
  getStoreAction,
  getStoreActionUrl,
  getStoreListing,
  isStoreListingInstalled,
  openStoreExternalLink,
  searchStoreCatalog,
  sortStoreCatalog,
  storeCatalog,
} from "../apps/OrbitStore/catalog";
import { getIcon } from "../lib/icons";
import { safeHttpUrl } from "../lib/security";

describe("Orbit Store UI catalog", () => {
  it("is registered as a native single-instance OrbitOS app", () => {
    expect(appRegistry["orbit-store"]).toMatchObject({
      id: "orbit-store",
      name: "Orbit Store",
      singleInstance: true,
    });
    expect(appList.some((app) => app.id === "orbit-store")).toBe(true);
    expect(getIcon("Gamepad2")).toBe(Gamepad2);
    expect(getIcon("UserRound")).not.toBe(getIcon("AppWindow"));
  });

  it("keeps bundled OrbitOS apps and adds a distinct curated external catalog", () => {
    const bundled = storeCatalog.filter((item) => item.kind === "bundled");
    expect(bundled.length).toBe(appList.length - 1);
    expect(bundled.map(({ id }) => id)).not.toContain("orbit-store");
    expect(searchStoreCatalog("snake", "Games").map(({ id }) => id)).toContain("snake");
    expect(externalCatalog.map(({ id }) => id)).toEqual([
      "excalidraw",
      "scratch",
      "hexgl",
      "blender",
      "gimp",
      "godot",
    ]);
  });

  it("filters query terms and categories, including the local Ollama assistant", () => {
    expect(searchStoreCatalog("tiling", "Productivity").map(({ id }) => id)).toContain("workspaces");
    expect(searchStoreCatalog("", "AI").map(({ id }) => id)).toContain("assistant");
    expect(searchStoreCatalog("image editor").map(({ id }) => id)).toContain("gimp");
    expect(searchStoreCatalog("", "Games").map(({ id }) => id)).toContain("hexgl");
    expect(appRegistry.assistant).toMatchObject({ name: "Local Assistant", icon: "Bot" });
    expect(getIcon(appRegistry.assistant.icon)).toBe(Bot);
    expect(searchStoreCatalog("no matching app name")).toEqual([]);
  });

  it("only includes validated HTTPS official website, source, and download pages", () => {
    const ids = new Set<string>();
    for (const item of externalCatalog) {
      expect(ids.has(item.id)).toBe(false);
      ids.add(item.id);
      expect(item.publisher.trim()).not.toBe("");
      expect(safeHttpUrl(item.websiteUrl)?.startsWith("https://")).toBe(true);
      if (item.sourceUrl) expect(safeHttpUrl(item.sourceUrl)?.startsWith("https://")).toBe(true);
      if (item.licenseUrl) expect(safeHttpUrl(item.licenseUrl)?.startsWith("https://")).toBe(true);
      if (item.kind === "desktop") {
        expect(safeHttpUrl(item.downloadUrl)?.startsWith("https://")).toBe(true);
        expect(getStoreAction(item)).toBe("download");
        expect(getStoreActionUrl(item)).toBe(item.downloadUrl);
      } else {
        expect(item.kind).toBe("web");
        expect(getStoreAction(item)).toBe("visit-website");
        expect(getStoreActionUrl(item)).toBe(item.websiteUrl);
      }
    }
  });

  it("never treats external downloads or web apps as installed OrbitOS apps", () => {
    const blender = getStoreListing("blender");
    const excalidraw = getStoreListing("excalidraw");
    const snake = getStoreListing("snake");
    expect(blender && isStoreListingInstalled(blender, [])).toBe(false);
    expect(excalidraw && isStoreListingInstalled(excalidraw, [])).toBe(false);
    expect(snake && isStoreListingInstalled(snake, [])).toBe(true);
    expect(snake && isStoreListingInstalled(snake, ["snake"])).toBe(false);
    expect(snake && getStoreAction(snake, false)).toBe("add-to-library");
    expect(snake && getStoreAction(snake, true)).toBe("open");
  });

  it("launches web listings and desktop downloads only to their curated publisher URLs", () => {
    const opened: string[] = [];
    const open = (url: string) => {
      opened.push(url);
      return true;
    };
    const excalidraw = getStoreListing("excalidraw");
    const blender = getStoreListing("blender");
    const snake = getStoreListing("snake");
    expect(excalidraw && openStoreExternalLink(excalidraw, open)).toBe(true);
    expect(blender && openStoreExternalLink(blender, open)).toBe(true);
    expect(snake && openStoreExternalLink(snake, open)).toBe(false);
    expect(opened).toEqual([
      "https://excalidraw.com/",
      "https://www.blender.org/download/",
    ]);

    const unsafeListing = { ...externalCatalog[0], websiteUrl: "javascript:alert(1)" };
    expect(openStoreExternalLink(unsafeListing, open)).toBe(false);
    expect(opened).toHaveLength(2);
  });

  it("sorts results without mutating the source catalog", () => {
    const unsorted = searchStoreCatalog("").slice(0, 4);
    const originalIds = unsorted.map(({ id }) => id);
    const sorted = sortStoreCatalog(unsorted, "name");

    expect(sorted.map(({ name }) => name)).toEqual(
      [...sorted.map(({ name }) => name)].sort((a, b) => a.localeCompare(b)),
    );
    expect(unsorted.map(({ id }) => id)).toEqual(originalIds);
    expect(sortStoreCatalog(unsorted, "recommended")).toBe(unsorted);
  });
});
