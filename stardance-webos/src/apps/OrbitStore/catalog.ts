import { appList } from "../registry";
import type { AppDefinition, AppId } from "../../types";
import { openExternal, safeHttpUrl } from "../../lib/security";

export const STORE_CATEGORIES = [
  "Games",
  "Productivity",
  "Creativity",
  "Utilities",
  "Education",
  "AI",
] as const;

export type StoreCategory = (typeof STORE_CATEGORIES)[number];
export type StoreListingKind = "bundled" | "web" | "desktop";
export type StoreAction = "open" | "add-to-library" | "visit-website" | "download";

export interface StoreListing {
  id: string;
  name: string;
  description: string;
  category: StoreCategory;
  icon: string;
  kind: StoreListingKind;
  publisher: string;
  license: string;
  websiteUrl?: string;
  downloadUrl?: string;
  sourceUrl?: string;
  licenseUrl?: string;
  features: string[];
  app?: AppDefinition;
}

const APP_CATEGORIES: Partial<Record<AppId, StoreCategory>> = {
  snake: "Games",
  "orbit-blast": "Games",
  "dino-run": "Games",
  "2048": "Games",
  sandtrix: "Games",
  "orbit-depths": "Games",
  "mortal-kombat-mobile": "Games",
  notes: "Productivity",
  "text-editor": "Productivity",
  workspaces: "Productivity",
  paint: "Creativity",
  "theme-studio": "Creativity",
  calculator: "Utilities",
  clock: "Utilities",
  "file-explorer": "Utilities",
  terminal: "Utilities",
  browser: "Utilities",
  "task-manager": "Utilities",
  welcome: "Education",
  "about-orbitos": "Education",
  assistant: "AI",
};

const bundledCatalog: StoreListing[] = appList
  .filter((app) => app.id !== "orbit-store")
  .map((app) => ({
    id: app.id,
    name: app.name,
    description: app.description,
    category: APP_CATEGORIES[app.id] ?? "Utilities",
    icon: app.icon,
    kind: "bundled",
    publisher: "OrbitOS",
    license: "Not specified in the app registry",
    features: [
      "Bundled with this OrbitOS build",
      "Opens in an OrbitOS application window",
    ],
    app,
  }));

export const externalCatalog: StoreListing[] = [
  {
    id: "excalidraw",
    name: "Excalidraw",
    description: "A collaborative, hand-drawn style whiteboard for diagrams and sketches.",
    category: "Creativity",
    icon: "Brush",
    kind: "web",
    publisher: "Excalidraw",
    license: "MIT",
    websiteUrl: "https://excalidraw.com/",
    sourceUrl: "https://github.com/excalidraw/excalidraw",
    licenseUrl: "https://github.com/excalidraw/excalidraw/blob/master/LICENSE",
    features: ["Browser-based whiteboard", "Open-source project", "No OrbitOS installation required"],
  },
  {
    id: "scratch",
    name: "Scratch",
    description: "Create and share interactive stories, games, and animations in your browser.",
    category: "Education",
    icon: "Gamepad2",
    kind: "web",
    publisher: "Scratch Foundation",
    license: "Free web app; source license varies by component",
    websiteUrl: "https://scratch.mit.edu/",
    features: ["Visual programming", "Create browser projects", "No OrbitOS installation required"],
  },
  {
    id: "hexgl",
    name: "HexGL",
    description: "A futuristic, browser-based racing game built with HTML5 and WebGL.",
    category: "Games",
    icon: "Gamepad2",
    kind: "web",
    publisher: "BKcore",
    license: "MIT",
    websiteUrl: "https://hexgl.bkcore.com/",
    sourceUrl: "https://github.com/BKcore/HexGL",
    licenseUrl: "https://github.com/BKcore/HexGL",
    features: ["Playable in a modern browser", "WebGL racing game", "Open-source project"],
  },
  {
    id: "blender",
    name: "Blender",
    description: "A free and open-source 3D creation suite for modeling, animation, rendering, and more.",
    category: "Creativity",
    icon: "Layers",
    kind: "desktop",
    publisher: "Blender Foundation",
    license: "GPL-3.0-or-later",
    websiteUrl: "https://www.blender.org/",
    downloadUrl: "https://www.blender.org/download/",
    sourceUrl: "https://projects.blender.org/blender/blender",
    licenseUrl: "https://www.blender.org/about/license/",
    features: ["3D modeling and animation", "Rendering and compositing", "Native desktop software"],
  },
  {
    id: "gimp",
    name: "GIMP",
    description: "A free, open-source image editor for photo retouching, composition, and authoring.",
    category: "Creativity",
    icon: "Image",
    kind: "desktop",
    publisher: "The GIMP Team",
    license: "GPL-3.0-or-later",
    websiteUrl: "https://www.gimp.org/",
    downloadUrl: "https://www.gimp.org/downloads/",
    sourceUrl: "https://gitlab.gnome.org/GNOME/gimp",
    licenseUrl: "https://gitlab.gnome.org/GNOME/gimp/-/raw/master/COPYING",
    features: ["Image editing and retouching", "Extensible workflow", "Native desktop software"],
  },
  {
    id: "godot",
    name: "Godot Engine",
    description: "A free, open-source engine for making 2D and 3D games.",
    category: "Games",
    icon: "Gamepad2",
    kind: "desktop",
    publisher: "The Godot Engine community",
    license: "MIT",
    websiteUrl: "https://godotengine.org/",
    downloadUrl: "https://godotengine.org/download/",
    sourceUrl: "https://github.com/godotengine/godot",
    licenseUrl: "https://godotengine.org/license",
    features: ["2D and 3D game development", "Cross-platform editor", "Native desktop software"],
  },
];

export const storeCatalog: StoreListing[] = [...bundledCatalog, ...externalCatalog];

export function getStoreListing(id: string): StoreListing | undefined {
  return storeCatalog.find((item) => item.id === id);
}

export function searchStoreCatalog(
  query: string,
  category?: StoreCategory,
): StoreListing[] {
  const normalized = query.trim().toLocaleLowerCase();
  return storeCatalog.filter((item) => {
    if (category && item.category !== category) return false;
    if (!normalized) return true;
    return `${item.name} ${item.description} ${item.category} ${item.publisher} ${item.license}`
      .toLocaleLowerCase()
      .includes(normalized);
  });
}

export function sortStoreCatalog(
  listings: StoreListing[],
  sort: "recommended" | "name" | "category",
): StoreListing[] {
  if (sort === "recommended") return listings;
  return [...listings].sort((a, b) =>
    sort === "name"
      ? a.name.localeCompare(b.name)
      : a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
  );
}

export function getStoreAction(
  listing: StoreListing,
  installed = false,
): StoreAction {
  if (listing.kind === "web") return "visit-website";
  if (listing.kind === "desktop") return "download";
  return installed ? "open" : "add-to-library";
}

export function getStoreActionUrl(listing: StoreListing): string | null {
  const candidate = listing.kind === "desktop" ? listing.downloadUrl : listing.websiteUrl;
  return safeHttpUrl(candidate);
}

export function openStoreExternalLink(
  listing: StoreListing,
  open: (url: string) => boolean = openExternal,
): boolean {
  const action = getStoreAction(listing);
  if (action !== "visit-website" && action !== "download") return false;
  const url = getStoreActionUrl(listing);
  return url ? open(url) : false;
}

export function isStoreListingInstalled(
  listing: StoreListing,
  uninstalledApps: AppId[],
): boolean {
  const bundledApp = listing.app;
  return listing.kind === "bundled"
    && bundledApp !== undefined
    && !uninstalledApps.includes(bundledApp.id);
}
