import { useEffect, useState, type FormEvent } from "react";
import { useSystemStore } from "../../stores/useSystemStore";
import { useIdentity } from "../../platform/IdentityContext";
import { formatClock } from "../../lib/helpers";
import "./BootScreen.css";

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const username = useSystemStore((s) => s.username);
  const wallpaper = useSystemStore((s) => s.wallpaper);
  const { user, verifyPassword, signOut, switchToGuest } = useIdentity();

  const [now, setNow] = useState(new Date());
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setPassword("");
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onUnlock]);

  const { time, dateStr } = formatClock(now);

  async function unlock(event?: FormEvent) {
    event?.preventDefault();
    if (checking) return;
    setChecking(true);
    setError("");
    const valid = await verifyPassword(password);
    setChecking(false);
    if (!valid) {
      setError("That password is not correct.");
      return;
    }
    setPassword("");
    onUnlock();
  }

  function leave(action: () => void) {
    action();
    window.location.reload();
  }

  return (
    <div className="lock" role="dialog" aria-modal="true" aria-label="OrbitOS lock screen">
      <div className="lock__bg" style={{ background: wallpaper }} />
      <div className="lock__overlay" />
      <div className="lock__content">
        <div className="lock__clock">{time}</div>
        <div className="lock__date">{dateStr}</div>
        <div className="lock__avatar">{user?.avatar ?? username.slice(0, 1).toUpperCase()}</div>
        <div className="lock__user">{user?.displayName ?? username}</div>
        <form className="lock__form" onSubmit={unlock}>
          {!user?.isGuest && <input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" aria-label="Password" />}
          <button type="submit" className="lock__unlock">{checking ? "Checking…" : user?.isGuest ? "Unlock Guest Session" : "Unlock"}</button>
          {error && <div className="lock__error" role="alert">{error}</div>}
        </form>
        <div className="lock__actions">
          <button type="button" onClick={() => leave(switchToGuest)}>Continue as Guest</button>
          <button type="button" onClick={() => leave(signOut)}>{user?.isGuest ? "Exit Guest Session" : "Switch User"}</button>
        </div>
      </div>
    </div>
  );
}
