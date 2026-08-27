import { useState } from "react";
import { resolveTheme, setTheme } from "./theme";

export function ThemeToggle() {
  const [theme, setThemeState] = useState(resolveTheme);

  function handleToggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setThemeState(next);
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "ライトモードに切り替え" : "ダークモードに切り替え"}
      aria-pressed={isDark}
      onClick={handleToggle}
      className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-2">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v1.5M12 19.5V21M4.5 12H3M21 12h-1.5M6.2 6.2l1.1 1.1M16.7 16.7l1.1 1.1M6.2 17.8l1.1-1.1M16.7 7.3l1.1-1.1" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-2">
          <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 0 0 20 14.5z" />
        </svg>
      )}
    </button>
  );
}
