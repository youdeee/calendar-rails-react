/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { buildContentSecurityPolicy } from "./src/contentSecurityPolicy.ts";
import { themeBlockingScript } from "./themeBlockingScript.ts";

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
  plugins: [themeBlockingScript(), react(), tailwindcss(), injectContentSecurityPolicy()],
  server: {
    proxy: {
      "/api": {
        // Rails: http://localhost:3000  /  Spring: http://localhost:8080
        target: process.env.VITE_API_PROXY_TARGET ?? "http://localhost:3000",
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
