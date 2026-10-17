import { create } from "zustand";
import { guestSession, readSession, writeSession, type SessionRecord } from "../web/auth/webSession";

const ACCOUNTS_KEY = "orbitos-accounts";
const GUEST_ID = "guest";
const PBKDF2_ITERATIONS = 120_000;
const MAX_PASSWORD_LENGTH = 128;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type AccountRecord = {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  avatar: string;
  salt: string;
  verifier: string;
  createdAt: number;
};

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  isGuest: boolean;
}

interface AuthState {
  user: AuthUser | null;
  pending: boolean;
  error: string | null;
  failedAttempts: number;
  lockedUntil: number;
  signIn: (identifier: string, password: string) => Promise<boolean>;
  createAccount: (displayName: string, email: string, password: string) => Promise<boolean>;
  continueAsGuest: () => void;
  verifyCurrentPassword: (password: string) => Promise<boolean>;
  signOut: () => void;
  switchToGuest: () => void;
  clearError: () => void;
}

function loadAccounts(): AccountRecord[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is AccountRecord =>
      !!item && typeof item === "object" &&
      typeof item.id === "string" && /^[a-z0-9-]{1,80}$/i.test(item.id) &&
      typeof item.username === "string" && item.username.length >= 2 && item.username.length <= 32 &&
      typeof item.displayName === "string" && item.displayName.length >= 2 && item.displayName.length <= 32 &&
      (item.email === undefined || (typeof item.email === "string" && item.email.length <= 254 && EMAIL_PATTERN.test(item.email))) &&
      typeof item.salt === "string" && /^[a-f0-9]{32}$/i.test(item.salt) &&
      typeof item.verifier === "string" && /^[a-f0-9]{64}$/i.test(item.verifier),
    );
  } catch {
    return [];
  }
}

function saveAccounts(accounts: AccountRecord[]): void {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function toUser(account: AccountRecord): AuthUser {
  return {
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    avatar: account.avatar,
    isGuest: false,
  };
}

function guestUser(): AuthUser {
  return { id: GUEST_ID, username: "guest", displayName: "Guest", avatar: "G", isGuest: true };
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

async function deriveVerifier(password: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: hexToBytes(saltHex) as unknown as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

function sameSecret(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

function normalizeName(value: string): string {
  return Array.from(value).filter((character) => {
    const code = character.charCodeAt(0);
    return code >= 32 && code !== 127;
  }).join("").trim().slice(0, 32);
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase().slice(0, 254);
}

function sessionUser(session: SessionRecord | null): AuthUser | null {
  if (!session) return null;
  if (session.userId === GUEST_ID || session.isGuest) return guestUser();
  const account = loadAccounts().find((candidate) => candidate.id === session.userId);
  return account ? toUser(account) : null;
}

const initialSession = readSession();
const initialUser = sessionUser(initialSession);
if (initialSession && !initialUser) writeSession(null);

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initialUser,
  pending: false,
  error: null,
  failedAttempts: 0,
  lockedUntil: 0,

  signIn: async (identifier, password) => {
    const now = Date.now();
    if (now < get().lockedUntil) {
      set({ error: "Sign-in is temporarily unavailable. Try again shortly." });
      return false;
    }
    const normalized = normalizeName(identifier).toLowerCase();
    const account = loadAccounts().find((candidate) => candidate.username === normalized || candidate.email === normalizeEmail(identifier));
    set({ pending: true, error: null });
    const valid = !!account && password.length > 0 && password.length <= MAX_PASSWORD_LENGTH && sameSecret(await deriveVerifier(password, account.salt), account.verifier);
    if (!valid) {
      const failedAttempts = get().failedAttempts + 1;
      set({ pending: false, error: "The username or password is not correct.", failedAttempts, lockedUntil: failedAttempts >= 5 ? now + 30_000 : 0 });
      return false;
    }
    writeSession({ userId: account.id, isGuest: false });
    set({ user: toUser(account), pending: false, failedAttempts: 0, error: null });
    return true;
  },

  createAccount: async (displayName, email, password) => {
    const name = normalizeName(displayName);
    const username = name.toLowerCase();
    const normalizedEmail = normalizeEmail(email);
    if (name.length < 2 || !EMAIL_PATTERN.test(normalizedEmail) || normalizedEmail.length > 254 || password.length < 8 || password.length > MAX_PASSWORD_LENGTH) {
      set({ error: "Use a display name, valid email, and password with at least 8 characters." });
      return false;
    }
    const accounts = loadAccounts();
    if (accounts.some((account) => account.username === username || account.email === normalizedEmail)) {
      set({ error: "Unable to create an account with those details." });
      return false;
    }
    set({ pending: true, error: null });
    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const salt = bytesToHex(saltBytes);
    const account: AccountRecord = {
      id: `user-${crypto.randomUUID()}`,
      username,
      displayName: name,
      email: normalizedEmail,
      avatar: name.slice(0, 1).toUpperCase(),
      salt,
      verifier: await deriveVerifier(password, salt),
      createdAt: Date.now(),
    };
    saveAccounts([...accounts, account]);
    writeSession({ userId: account.id, isGuest: false });
    set({ user: toUser(account), pending: false, error: null });
    return true;
  },

  continueAsGuest: () => {
    writeSession(guestSession());
    set({ user: guestUser(), error: null });
  },

  verifyCurrentPassword: async (password) => {
    const user = get().user;
    if (!user || user.isGuest) return true;
    const account = loadAccounts().find((candidate) => candidate.id === user.id);
    return !!account && sameSecret(await deriveVerifier(password, account.salt), account.verifier);
  },

  signOut: () => {
    writeSession(null);
    set({ user: null, error: null });
  },

  switchToGuest: () => {
    writeSession(guestSession());
    set({ user: guestUser(), error: null });
  },

  clearError: () => set({ error: null }),
}));
