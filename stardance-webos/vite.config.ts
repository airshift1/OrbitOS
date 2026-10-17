import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { SECURITY_HEADERS } from "./security-headers.ts";

// Web and desktop builds share the shell but have separate composition roots.
export default defineConfig(({ mode }) => {
  const desktop = mode === "desktop";
  return {
    plugins: [react()],
    define: { "import.meta.env.VITE_ORBITOS_TARGET": JSON.stringify(desktop ? "desktop" : "web") },
    build: desktop ? { outDir: "dist-desktop", rollupOptions: { input: "desktop.html" } } : undefined,
    preview: { headers: SECURITY_HEADERS },
    test: {
      environment: "node",
      include: ["src/**/*.test.ts"],
    },
  };
});
