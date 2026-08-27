import { useEffect, useRef } from "react";
import { useAuth } from "./AuthContext";
import { resolveTheme } from "../theme/theme";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: { theme: string; size: string }) => void;
        };
      };
    };
  }
}

export function GoogleLoginButton() {
  const { loginWithGoogleIdToken } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    function renderGoogleButton() {
      if (cancelled || !window.google || !buttonRef.current) return;

      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: (response) => {
          loginWithGoogleIdToken(response.credential).catch((error: unknown) => {
            console.error("Google login failed:", error);
          });
        },
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: resolveTheme() === "dark" ? "filled_black" : "outline",
        size: "large",
      });
    }

    if (window.google) {
      renderGoogleButton();
      return;
    }

    // index.html loads the GSI script with async defer, so it can still be
    // loading when this component mounts; poll until it's ready.
    const interval = setInterval(() => {
      if (window.google) {
        clearInterval(interval);
        renderGoogleButton();
      }
    }, 100);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [loginWithGoogleIdToken]);

  return <div ref={buttonRef} data-testid="google-login-button" />;
}
