import { useEffect, useRef } from "react";
import { useAuth } from "./AuthContext";

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
    if (!window.google || !buttonRef.current) return;

    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: (response) => {
        void loginWithGoogleIdToken(response.credential);
      },
    });
    window.google.accounts.id.renderButton(buttonRef.current, { theme: "outline", size: "large" });
  }, [loginWithGoogleIdToken]);

  return <div ref={buttonRef} />;
}
