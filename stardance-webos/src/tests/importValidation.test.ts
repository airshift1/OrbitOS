import { describe, expect, it } from "vitest";
import { validateWallpaperDimensions, validateWallpaperFile } from "../lib/wallpaperStorage";

const pngSignature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function testFile(
  name: string,
  type = "image/png",
  bytes = pngSignature,
  size = bytes.length,
): Pick<File, "name" | "type" | "size" | "slice"> {
  const blob = new Blob([bytes]);
  return {
    name,
    type,
    size,
    slice: (start?: number, end?: number) => blob.slice(start, end),
  };
}

describe("wallpaper upload validation", () => {
  it("accepts image signatures matching a supported extension and MIME type", async () => {
    await expect(validateWallpaperFile(testFile("Wall.PNG"))).resolves.toBeUndefined();
  });

  it.each([
    ["photo.jpg", "image/jpeg", [0xff, 0xd8, 0xff]],
    ["animation.gif", "image/gif", [71, 73, 70, 56, 57, 97]],
    ["texture.webp", "image/webp", [82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]],
  ])("accepts a valid %s signature", async (name, type, signature) => {
    await expect(validateWallpaperFile(testFile(name, type, new Uint8Array(signature)))).resolves.toBeUndefined();
  });

  it.each([
    "shell.php",
    "SHELL.PHP",
    "wallpaper.php.png",
    "wallpaper.PHP.PNG",
    "page.jsp",
    "PAGE.JSP",
    "wallpaper.jsp.gif",
    "wallpaper.JSP.PNG",
    "wallpaper.jpg.php",
    "image.php5.webp",
  ])("rejects unsupported server-script extension in %s", async (name) => {
    await expect(validateWallpaperFile(testFile(name))).rejects.toThrow(/Server-script/);
  });

  it("rejects mismatched image metadata and invalid image bytes", async () => {
    await expect(validateWallpaperFile(testFile("image.jpg", "image/jpeg"))).rejects.toThrow(/signature/);
    await expect(validateWallpaperFile(testFile("image.png", "text/plain"))).rejects.toThrow(/matching file extension/);
  });

  it("rejects empty and oversized files before saving", async () => {
    await expect(validateWallpaperFile(testFile("empty.png", "image/png", pngSignature, 0))).rejects.toThrow(/8 MB or smaller/);
    await expect(validateWallpaperFile(testFile("maximum.png", "image/png", pngSignature, 8 * 1024 * 1024))).resolves.toBeUndefined();
    await expect(validateWallpaperFile(testFile("large.png", "image/png", pngSignature, 8 * 1024 * 1024 + 1))).rejects.toThrow(/8 MB or smaller/);
  });

  it("limits decoded dimensions to 32 megapixels", () => {
    expect(() => validateWallpaperDimensions(8000, 4000)).not.toThrow();
    expect(() => validateWallpaperDimensions(6000, 6000)).toThrow(/32 megapixels/);
    expect(() => validateWallpaperDimensions(0, 1)).toThrow(/positive/);
  });
});
