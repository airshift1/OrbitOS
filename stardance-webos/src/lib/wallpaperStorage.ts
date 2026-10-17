const DB_NAME = "orbitos-wallpapers";
const STORE_NAME = "images";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

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
  if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
    throw new Error("Choose a PNG, JPEG, WebP, or GIF image.");
  }
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    throw new Error("Wallpaper images must be smaller than 8 MB.");
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
