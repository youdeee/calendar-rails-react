import { applyTheme, resolveTheme, setTheme, THEME_STORAGE_KEY } from "./theme";

function stubPrefersDark(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-color-scheme: dark") ? matches : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = "";
  stubPrefersDark(false);
});

it("resolves to the stored theme when localStorage has an explicit value", () => {
  localStorage.setItem(THEME_STORAGE_KEY, "dark");
  expect(resolveTheme()).toBe("dark");
});

it("falls back to light when matchMedia is unavailable", () => {
  vi.stubGlobal("matchMedia", undefined);
  expect(resolveTheme()).toBe("light");
});

it("falls back to the OS preference when nothing is stored", () => {
  stubPrefersDark(true);
  expect(resolveTheme()).toBe("dark");

  stubPrefersDark(false);
  expect(resolveTheme()).toBe("light");
});

it("ignores invalid stored values and falls back to the OS preference", () => {
  localStorage.setItem(THEME_STORAGE_KEY, "sepia");
  stubPrefersDark(true);
  expect(resolveTheme()).toBe("dark");
});

it("applies the dark class and color-scheme on the document element", () => {
  applyTheme("dark");
  expect(document.documentElement).toHaveClass("dark");
  expect(document.documentElement.style.colorScheme).toBe("dark");

  applyTheme("light");
  expect(document.documentElement).not.toHaveClass("dark");
  expect(document.documentElement.style.colorScheme).toBe("light");
});

it("persists the choice and applies it", () => {
  setTheme("dark");
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  expect(document.documentElement).toHaveClass("dark");
});
