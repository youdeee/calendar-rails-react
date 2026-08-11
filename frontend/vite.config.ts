/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { buildContentSecurityPolicy } from "./src/contentSecurityPolicy.ts";

function injectContentSecurityPolicy(): { name: string; transformIndexHtml(html: string): string } {
  return {
    name: "inject-content-security-policy",
    transformIndexHtml(html) {
      const csp = buildContentSecurityPolicy(process.env.VITE_API_BASE_URL);
      return html.replace(
        /<meta http-equiv="Content-Security-Policy" content="[^"]*"\s*\/>/,
        `<meta http-equiv="Content-Security-Policy" content="${csp}" />`,
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), injectContentSecurityPolicy()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/setupTests.ts"],
    globals: true,
  },
});
