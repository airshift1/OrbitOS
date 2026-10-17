import { useState } from "react";
import { ExternalLink, Smartphone } from "lucide-react";
import type { AppProps } from "../../types";
import { openExternal } from "../../lib/security";
import "./MortalKombatMobile.css";

const GAME_LISTING = "https://www.google.com/search?kgmid=%2Fg%2F11h5rq570k&q=Mortal+Kombat+Mobile";

export function MortalKombatMobile(_props: AppProps) {
  const [opened, setOpened] = useState(false);

  function openListing() {
    setOpened(openExternal(GAME_LISTING));
  }

  return (
    <main className="mortal-mobile">
      <div className="mortal-mobile__mark" aria-hidden="true"><Smartphone size={27} /></div>
      <span className="mortal-mobile__eyebrow">MOBILE GAME</span>
      <h2>Mortal Kombat Mobile</h2>
      <p>This native phone game cannot run inside Orbit OS. Use an official store on a compatible device to install it.</p>
      <button type="button" className="mortal-mobile__open" onClick={openListing}>
        <ExternalLink size={15} /> Open Google listing
      </button>
      <span className="mortal-mobile__status" aria-live="polite">
        {opened ? "Google listing opened in a new tab." : "The game is not installed in Orbit OS."}
      </span>
    </main>
  );
}