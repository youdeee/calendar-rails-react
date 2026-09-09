import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { apiFetch, apiRequest, setAccessToken, setUnauthorizedHandler } from "../../api/client";

export type User = { id: number; email: string; name: string; avatar_url: string | null; time_zone?: string };
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
  // StrictMode mounts effects twice in development; without this guard, two
  // concurrent restoreSession() calls would both submit the same single-use
  // refresh token, and the loser's 401 could flip a valid session back to
  // "unauthenticated".
  const restoreStartedRef = useRef(false);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const syncTimeZone = useCallback(async () => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timeZone) return;
    try {
      const updated = await apiRequest<User>("/api/me", {
        method: "PATCH",
        body: JSON.stringify({ time_zone: timeZone }),
      });
      setUser(updated);
    } catch (error) {
      console.error("Failed to sync time zone:", error);
    }
  }, []);

  const restoreSession = useCallback(async () => {
    try {
      const response = await apiFetch("/api/auth/refresh", { method: "POST" });
      if (!response.ok) {
        setStatus("unauthenticated");
        return;
      }
      const body = await response.json();
      setAccessToken(body.access_token);
      setUser(body.user);
      setStatus("authenticated");
      void syncTimeZone();
    } catch (error) {
      console.error("Failed to restore session:", error);
      setStatus("unauthenticated");
    }
  }, [syncTimeZone]);

  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    if (!restoreStartedRef.current) {
      restoreStartedRef.current = true;
      void restoreSession();
    }
    return () => setUnauthorizedHandler(null);
  }, [clearSession, restoreSession]);

  const loginWithGoogleIdToken = useCallback(async (idToken: string) => {
    const body = await apiRequest<{ access_token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ id_token: idToken }),
    });
    setAccessToken(body.access_token);
    setUser(body.user);
    setStatus("authenticated");
    void syncTimeZone();
  }, [syncTimeZone]);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "DELETE" });
    } catch (error) {
      console.error("Failed to notify the server about logout:", error);
    } finally {
      clearSession();
    }
  }, [clearSession]);

  return (
    <AuthContext.Provider value={{ user, status, loginWithGoogleIdToken, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
