import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { SECURITY_HEADERS } from "./security-headers.ts";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // `vite preview` serves the production build with the same headers as vercel.json.
  preview: { headers: SECURITY_HEADERS },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
