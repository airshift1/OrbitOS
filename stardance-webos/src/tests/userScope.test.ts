import { describe, expect, it } from "vitest";
import { readSession, SESSION_MAX_AGE_MS, writeSession } from "../web/auth/webSession";
import { getStorageScope, scopedStorageKey } from "../platform/storageScope";

describe("user-scoped persistence keys", () => {
  it("uses an isolated guest scope when no session exists", () => {
    expect(getStorageScope()).toBe("guest");
    expect(scopedStorageKey("notes")).toBe("orbitos-web:guest:notes");
  });

  it("expires stale sessions before deriving a user scope", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    } as unknown as Storage;
    const previous = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
    try {
      writeSession({ userId: "user-a", isGuest: false });
      expect(readSession()?.userId).toBe("user-a");
      values.set("orbitos-session", JSON.stringify({ userId: "user-a", isGuest: false, issuedAt: Date.now() - SESSION_MAX_AGE_MS - 1 }));
      expect(readSession()).toBeNull();
      expect(values.has("orbitos-session")).toBe(false);
    } finally {
      Object.defineProperty(globalThis, "localStorage", { value: previous, configurable: true });
    }
  });
});
