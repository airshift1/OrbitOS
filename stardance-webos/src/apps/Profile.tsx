import { useState } from "react";
import { LogOut, Save, UserRound } from "lucide-react";
import type { AppProps } from "../types";
import { useIdentity } from "../platform/IdentityContext";
import { useSystemStore } from "../stores/useSystemStore";
import "./Profile.css";

export function Profile(_props: AppProps) {
  const { user, signOut } = useIdentity();
  const username = useSystemStore((state) => state.username);
  const setUsername = useSystemStore((state) => state.setUsername);
  const [name, setName] = useState(username || user?.displayName || "User");

  function save() {
    setUsername(name.trim() || "User");
  }

  function exit() {
    signOut();
    window.location.reload();
  }

  return (
    <div className="profile-app">
      <div className="profile-app__hero"><div className="profile-app__avatar">{user?.avatar ?? "U"}</div><div><p className="profile-app__eyebrow">User account</p><h1>{user?.displayName ?? "User"}</h1><p>{user?.isGuest ? "Temporary guest session" : "Private OrbitOS profile"}</p></div></div>
      <label className="profile-app__field">Display name<input value={name} maxLength={32} onChange={(event) => setName(event.target.value)} /></label>
      <div className="profile-app__actions"><button onClick={save}><Save size={15} /> Save preferences</button><button className="profile-app__quiet" onClick={exit}><LogOut size={15} /> Sign out</button></div>
      <div className="profile-app__note"><UserRound size={16} /> Notes, files, themes, workspaces, and other personal settings stay scoped to this user session.</div>
    </div>
  );
}
