let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body?.error?.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

function clearSessionAndNotify() {
  setAccessToken(null);
  unauthorizedHandler?.();
}

// Concurrent 401s must share one in-flight refresh instead of each calling
// /api/auth/refresh independently: the backend's refresh token is single-use,
// so a second concurrent call would lose the race and wrongly look like an
// expired session.
let refreshInFlight: Promise<boolean> | null = null;

function refreshAccessToken(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      const response = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
      if (!response.ok) {
        if (response.status === 401) clearSessionAndNotify();
        return false;
      }
      const body = await response.json();
      setAccessToken(body.access_token);
      return true;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function fetchWithAuth(path: string, options: RequestInit, retried: boolean): Promise<Response> {
  const isAuthEndpoint = path.startsWith("/api/auth/");
  const headers = new Headers(options.headers);
  if (accessToken && !isAuthEndpoint) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  if (typeof options.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: isAuthEndpoint ? "include" : "same-origin",
  });

  if (response.status === 401 && !isAuthEndpoint) {
    if (retried) {
      clearSessionAndNotify();
      return response;
    }
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return fetchWithAuth(path, options, true);
    }
  }

  return response;
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetchWithAuth(path, options, false);
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, options);
  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorMessage(response));
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json();
}
