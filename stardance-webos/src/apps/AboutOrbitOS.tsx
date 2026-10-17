import { CircleCheck, Code2, ExternalLink, Info, ShieldCheck } from "lucide-react";
import type { AppProps } from "../types";
import "./AboutOrbitOS.css";

const features = ["Windowed desktop with snap layouts", "Virtual filesystem and private user data", "Built-in notes, browser, terminal, paint and settings", "Guest sessions for instant evaluation", "Keyboard-accessible shell controls"];
const environments = ["Modern browsers with Web Crypto", "Vite development and static hosting", "Portable React application for future desktop packaging"];

export function AboutOrbitOS(_props: AppProps) {
  return (
    <div className="about-orbitos">
      <header className="about-orbitos__hero">
        <div className="about-orbitos__mark">O</div>
        <div>
          <p className="about-orbitos__eyebrow">Public system information</p>
          <h1>About OrbitOS</h1>
          <p>OrbitOS is a browser-based operating system experience designed for shared use, experimentation, and future desktop packaging.</p>
        </div>
      </header>
      <div className="about-orbitos__version"><CircleCheck size={16} /> OrbitOS 1.0.0 · Current build</div>
      <section><h2><Info size={16} /> Features</h2><ul>{features.map((feature) => <li key={feature}>{feature}</li>)}</ul></section>
      <section><h2><ShieldCheck size={16} /> Supported environments</h2><ul>{environments.map((environment) => <li key={environment}>{environment}</li>)}</ul></section>
      <section><h2><Code2 size={16} /> Project and credits</h2><p>OrbitOS is built with React, TypeScript, Vite, Zustand, Lucide, and open-source browser APIs. See the included license and third-party notices for component attribution.</p><div className="about-orbitos__links"><a href="https://github.com/airshift1/OrbitOS" target="_blank" rel="noopener noreferrer">OrbitOS project <ExternalLink size={13} /></a></div></section>
    </div>
  );
}
