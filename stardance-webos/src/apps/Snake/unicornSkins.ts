export const UNICORN_SKINS = [
  { id: "lavender", name: "Lavender", description: "A dreamy purple coat and rosy-pink mane." },
  { id: "rainbow", name: "Rainbow", description: "Bright, cheerful colors with a rainbow mane." },
  { id: "midnight", name: "Midnight", description: "Deep twilight colors dusted with stars." },
  { id: "cotton-candy", name: "Cotton Candy", description: "Soft pink and blue with a fluffy pastel mane." },
  { id: "golden", name: "Golden", description: "A sunny golden coat with a contrasting mane." },
] as const;

export type UnicornSkin = typeof UNICORN_SKINS[number]["id"];
const STORAGE_KEY = "orbitos-snake-unicorn-skin";

export function readUnicornSkin(): UnicornSkin {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return UNICORN_SKINS.find((skin) => skin.id === saved)?.id ?? "lavender";
  } catch {
    return "lavender";
  }
}

export function saveUnicornSkin(skin: UnicornSkin): void {
  try {
    localStorage.setItem(STORAGE_KEY, skin);
  } catch {
    return;
  }
}
