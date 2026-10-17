const DB_NAME = "orbitos-wallpapers";
const STORE_NAME = "images";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 32_000_000;
const WALLPAPER_TYPES = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
]);

function hasUnsupportedScriptExtension(name: string): boolean {
  return name.split(".").slice(1).some((part) => /^(?:php\d*|phtml|phar|jsp|jspx|jhtml)$/i.test(part));
}

function hasImageSignature(type: string, bytes: Uint8Array): boolean {
  if (type === "image/png") return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  if (type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/gif") return bytes.length >= 6 && ["GIF87a", "GIF89a"].some((signature) => String.fromCharCode(...bytes.slice(0, 6)) === signature);
  if (type === "image/webp") return bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

export async function validateWallpaperFile(file: Pick<File, "name" | "type" | "size" | "slice">): Promise<void> {
  if (file.name.length > 255 || hasUnsupportedScriptExtension(file.name)) {
    throw new Error("Server-script file extensions are not supported for wallpapers.");
  }
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    throw new Error("Wallpaper images must be 8 MB or smaller.");
  }
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  const expectedType = WALLPAPER_TYPES.get(extension);
  if (!expectedType || file.type !== expectedType) {
    throw new Error("Choose a PNG, JPEG, WebP, or GIF image with a matching file extension.");
  }
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!hasImageSignature(expectedType, bytes)) {
    throw new Error("The selected file does not contain a valid image signature.");
  }
}

export function validateWallpaperDimensions(width: number, height: number): void {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width * height > MAX_IMAGE_PIXELS) {
    throw new Error("Wallpaper dimensions must be positive and at most 32 megapixels.");
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Image storage is unavailable in this browser."));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open image storage."));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Image storage operation failed."));
  });
}

export async function saveWallpaperImage(file: File): Promise<string> {
  await validateWallpaperFile(file);
  if (typeof createImageBitmap !== "function") {
    throw new Error("Image decoding is unavailable in this browser, so the wallpaper cannot be validated.");
  }
  const bitmap = await createImageBitmap(file);
  try {
    validateWallpaperDimensions(bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
  const db = await openDatabase();
  const id = crypto.randomUUID();
  try {
    await requestResult(db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(file, id));
    return id;
  } finally {
    db.close();
  }
}

export async function loadWallpaperImage(id: string): Promise<Blob | undefined> {
  if (!id) return undefined;
  const db = await openDatabase();
  try {
    return await requestResult(db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id));
  } finally {
    db.close();
  }
}

export async function deleteWallpaperImage(id: string): Promise<void> {
  if (!id) return;
  const db = await openDatabase();
  try {
    await requestResult(db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(id));
  } finally {
    db.close();
  }
}
