import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { bundleThemeInit } from "./themeBlockingScript.ts";

const themeInitPath = resolve(dirname(fileURLToPath(import.meta.url)), "src/features/theme/theme-init.ts");

it("bundles theme-init as an IIFE that applies the stored theme", async () => {
  const code = await bundleThemeInit(themeInitPath);

  expect(code).not.toMatch(/\bimport\b/);
  expect(code).not.toMatch(/\bexport\b/);

  localStorage.setItem("theme", "dark");
  document.documentElement.classList.remove("dark");

  new Function(code)();

  expect(document.documentElement).toHaveClass("dark");
  expect(document.documentElement.style.colorScheme).toBe("dark");
});
