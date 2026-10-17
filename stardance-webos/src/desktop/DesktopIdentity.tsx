import { useState } from "react";
import type { ReactNode } from "react";
import { IdentityContext, type IdentityController } from "../platform/IdentityContext";

const PROFILE_KEY = "orbitos-desktop-profile";
const DEFAULT_PROFILE = { id: "desktop-local", displayName: "Local User", avatar: "L", isGuest: false };

function readProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as Partial<typeof DEFAULT_PROFILE>;
    if (typeof parsed.displayName !== "string" || !parsed.displayName.trim()) return DEFAULT_PROFILE;
    return {
      id: "desktop-local",
      displayName: parsed.displayName.trim().slice(0, 32),
      avatar: typeof parsed.avatar === "string" && parsed.avatar ? parsed.avatar.slice(0, 2) : "L",
      isGuest: false,
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function DesktopIdentityProvider({ children }: { children: ReactNode }) {
  const [user] = useState(readProfile);
  const identity: IdentityController = {
    user,
    verifyPassword: async () => true,
    signOut: () => undefined,
    switchToGuest: () => undefined,
  };
  return <IdentityContext.Provider value={identity}>{children}</IdentityContext.Provider>;
}
