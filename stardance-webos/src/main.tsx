import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/ui.css";
import "./styles/window-styles.css";
import App from "./App.tsx";
import { restoreSession, startSessionPersistence } from "./lib/session";

/** Last-resort screen if startup itself throws. Built with DOM APIs only. */
function showFatal(root: HTMLElement) {
  const box = document.createElement("div");
  box.setAttribute("role", "alert");
  box.style.cssText = "max-width:32rem;margin:20vh auto;padding:1.5rem;font:16px/1.5 system-ui,sans-serif;color:#eae6dc";
  const h = document.createElement("h1");
  h.textContent = "OrbitOS couldn't start";
  h.style.cssText = "font-size:1.25rem;margin:0 0 .5rem";
  const p = document.createElement("p");
  p.textContent = "Reload the page. If it keeps happening, your saved data may be damaged; clear this site's storage in your browser settings to start fresh.";
  box.append(h, p);
  root.replaceChildren(box);
}

const rootEl = document.getElementById("root")!;
try {
  restoreSession();
  startSessionPersistence();
  createRoot(rootEl, {
    onUncaughtError: (error) => console.error("Uncaught error", error),
  }).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (error) {
  console.error("Startup failed", error);
  showFatal(rootEl);
}
