import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles/fonts.css";
import "../styles/tokens.css";
import "../styles/global.css";
import "../styles/ui.css";
import "../styles/window-styles.css";
import DesktopApp from "./DesktopApp";
import { restoreSession, startSessionPersistence } from "../lib/session";

const root = document.getElementById("root");
if (!root) throw new Error("OrbitOS desktop root is missing");
restoreSession();
startSessionPersistence();
createRoot(root).render(<StrictMode><DesktopApp /></StrictMode>);
