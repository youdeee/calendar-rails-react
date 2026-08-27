import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeToggle } from "./ThemeToggle";
import { THEME_STORAGE_KEY } from "./theme";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = "";
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    media: "",
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

it("toggles dark mode on the document and persists the choice", () => {
  render(<ThemeToggle />);

  const enable = screen.getByRole("button", { name: "ダークモードに切り替え" });
  expect(enable).toHaveAttribute("aria-pressed", "false");

  fireEvent.click(enable);

  expect(document.documentElement).toHaveClass("dark");
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

  const disable = screen.getByRole("button", { name: "ライトモードに切り替え" });
  expect(disable).toHaveAttribute("aria-pressed", "true");

  fireEvent.click(disable);

  expect(document.documentElement).not.toHaveClass("dark");
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
});
