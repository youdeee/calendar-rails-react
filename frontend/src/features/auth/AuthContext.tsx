import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch, apiRequest, setAccessToken, setUnauthorizedHandler } from "../../api/client";

export type User = { id: number; email: string; name: string; avatar_url: string | null };
type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  loginWithGoogleIdToken: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    void restoreSession();
    return () => setUnauthorizedHandler(null);
  }, []);

  function clearSession() {
    setAccessToken(null);
    setUser(null);
    setStatus("unauthenticated");
  }

  async function restoreSession() {
    const response = await apiFetch("/api/auth/refresh", { method: "POST" });
    if (!response.ok) {
      setStatus("unauthenticated");
      return;
    }
    const body = await response.json();
    setAccessToken(body.access_token);
    setUser(body.user);
    setStatus("authenticated");
  }

  async function loginWithGoogleIdToken(idToken: string) {
    const body = await apiRequest<{ access_token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ id_token: idToken }),
    });
    setAccessToken(body.access_token);
    setUser(body.user);
    setStatus("authenticated");
  }

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "DELETE" });
    clearSession();
  }

  return (
    <AuthContext.Provider value={{ user, status, loginWithGoogleIdToken, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
