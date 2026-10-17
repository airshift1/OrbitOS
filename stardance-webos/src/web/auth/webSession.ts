const SESSION_KEY = "orbitos-session";
const GUEST_ID = "guest";
export const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export interface SessionRecord {
  userId: string;
  isGuest: boolean;
  issuedAt?: number;
}

export function readSession(): SessionRecord | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SessionRecord>;
    if (typeof parsed.userId !== "string" || !/^[a-z0-9-]{1,80}$/i.test(parsed.userId)) return null;
    if (typeof parsed.issuedAt !== "number" || !Number.isFinite(parsed.issuedAt) || Date.now() - parsed.issuedAt > SESSION_MAX_AGE_MS) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return { userId: parsed.userId, isGuest: parsed.userId === GUEST_ID || parsed.isGuest === true, issuedAt: parsed.issuedAt };
  } catch {
    return null;
  }
}

export function writeSession(session: SessionRecord | null): void {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, issuedAt: Date.now() }));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Browser storage may be unavailable in private browsing.
  }
}

export function guestSession(): SessionRecord {
  return { userId: GUEST_ID, isGuest: true, issuedAt: Date.now() };
}
