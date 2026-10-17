import { createContext, useContext } from "react";

export interface IdentityUser {
  id: string;
  displayName: string;
  avatar: string;
  isGuest: boolean;
}

export interface IdentityController {
  user: IdentityUser;
  verifyPassword: (password: string) => Promise<boolean>;
  signOut: () => void;
  switchToGuest: () => void;
}

export const IdentityContext = createContext<IdentityController | null>(null);

export function useIdentity(): IdentityController {
  const identity = useContext(IdentityContext);
  if (!identity) throw new Error("OrbitOS identity context is unavailable");
  return identity;
}
