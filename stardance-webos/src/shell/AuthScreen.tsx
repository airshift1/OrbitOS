import { useState, type FormEvent } from "react";
import { HelpCircle, LockKeyhole, LogIn, Mail, UserPlus, Users } from "lucide-react";
import { useAuthStore } from "../stores/useAuthStore";
import "./AuthScreen.css";

type Mode = "welcome" | "signin" | "create" | "recovery";

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("welcome");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryNotice, setRecoveryNotice] = useState("");
  const user = useAuthStore((state) => state.user);
  const pending = useAuthStore((state) => state.pending);
  const error = useAuthStore((state) => state.error);
  const signIn = useAuthStore((state) => state.signIn);
  const createAccount = useAuthStore((state) => state.createAccount);
  const continueAsGuest = useAuthStore((state) => state.continueAsGuest);
  const clearError = useAuthStore((state) => state.clearError);

  if (user) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (mode === "recovery") {
      setRecoveryNotice("Email recovery is not available in this browser-only build. No email was sent. A future OrbitOS server must send a verified, time-limited recovery link.");
      return;
    }
    const success = mode === "create"
      ? await createAccount(displayName, email, password)
      : await signIn(displayName, password);
    if (success) window.location.reload();
  }

  function changeMode(next: Mode) {
    clearError();
    setEmail("");
    setPassword("");
    setRecoveryNotice("");
    setMode(next);
  }

  return (
    <main className="auth-screen">
      <div className="auth-screen__glow" aria-hidden="true" />
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-card__mark"><span>O</span></div>
        <p className="auth-card__eyebrow">A shared browser operating system</p>
        <h1 id="auth-title">OrbitOS</h1>
        <p className="auth-card__lede">A focused desktop for exploring, creating, and working together.</p>

        {mode === "welcome" ? (
          <div className="auth-actions">
            <button className="auth-action auth-action--primary" onClick={() => changeMode("signin")}><LogIn size={18} /> Sign in</button>
            <button className="auth-action" onClick={() => changeMode("create")}><UserPlus size={18} /> Create account</button>
            <button className="auth-action auth-action--quiet" onClick={() => { continueAsGuest(); window.location.reload(); }}><Users size={18} /> Continue as Guest</button>
            <button className="auth-link" onClick={() => changeMode("recovery")}><HelpCircle size={15} /> Forgot email or password?</button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            <div className="auth-form__heading">
              <button type="button" className="auth-back" onClick={() => changeMode("welcome")}>Back</button>
              <h2>{mode === "create" ? "Create your account" : mode === "recovery" ? "Recover your account" : "Welcome back"}</h2>
            </div>
            {mode !== "recovery" && <label>
              {mode === "signin" ? "Email or display name" : "Display name"}
              <input autoFocus value={displayName} maxLength={32} autoComplete="username" onChange={(event) => setDisplayName(event.target.value)} placeholder="e.g. Alex" required />
            </label>}
            {(mode === "create" || mode === "recovery") && <label>
              Email address
              <input autoFocus={mode === "recovery"} type="email" value={email} maxLength={254} autoComplete={mode === "create" ? "email" : "username"} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
            </label>}
            {mode !== "recovery" && <label>
              Password
              <input type="password" value={password} maxLength={128} autoComplete={mode === "create" ? "new-password" : "current-password"} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "create" ? "At least 8 characters" : "Your password"} required />
            </label>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            {recoveryNotice && <p className="auth-notice" role="status">{recoveryNotice}</p>}
            <button className="auth-action auth-action--primary" type="submit" disabled={pending}>
              {mode === "recovery" ? <Mail size={18} /> : <LockKeyhole size={18} />} {pending ? "Checking…" : mode === "create" ? "Create account" : mode === "recovery" ? "Request recovery email" : "Sign in"}
            </button>
            {mode !== "recovery" && <button className="auth-action auth-action--quiet" type="button" onClick={() => { continueAsGuest(); window.location.reload(); }}>Continue as Guest</button>}
          </form>
        )}
        <p className="auth-card__foot">Guest sessions are isolated and can be exited at any time.</p>
      </section>
    </main>
  );
}
