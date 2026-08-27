import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import type { Plugin } from "vite";

const defaultEntry = resolve(dirname(fileURLToPath(import.meta.url)), "src/features/theme/theme-init.ts");

export async function bundleThemeInit(entry = defaultEntry): Promise<string> {
  const bundle = await rolldown({ input: entry });
  try {
    const { output } = await bundle.generate({ format: "iife" });
    const chunk = output.find((file) => file.type === "chunk");
    if (!chunk) throw new Error("theme IIFE chunk missing");
    return chunk.code;
  } finally {
    await bundle.close();
  }
}

export function themeBlockingScript(): Plugin {
  return {
    name: "theme-blocking-script",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] !== "/theme.js") {
          next();
          return;
        }
        void bundleThemeInit()
          .then((code) => {
            res.setHeader("Content-Type", "application/javascript; charset=utf-8");
            res.end(code);
          })
          .catch(next);
      });
    },
    async generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "theme.js",
        source: await bundleThemeInit(),
      });
    },
  };
}
