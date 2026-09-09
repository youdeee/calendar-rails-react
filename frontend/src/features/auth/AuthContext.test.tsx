import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "./AuthContext";

function TestConsumer() {
  const { user, status, logout } = useAuth();
  if (status === "loading") return <div>loading</div>;
  if (status === "unauthenticated") return <div>logged out</div>;
  return (
    <div>
      <div>logged in as {user?.email}</div>
      <button onClick={() => void logout()}>Logout</button>
    </div>
  );
}

const sessionUser = { id: 1, email: "a@example.com", name: "A", avatar_url: null, time_zone: "Asia/Tokyo" };

function sessionFetch() {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/api/auth/refresh") || url.includes("/api/auth/login")) {
      return Promise.resolve(new Response(JSON.stringify({ access_token: "t1", user: sessionUser }), { status: 200 }));
    }
    if (url.includes("/api/me") && init?.method === "PATCH") {
      return Promise.resolve(new Response(JSON.stringify(sessionUser), { status: 200 }));
    }
    if (url.includes("/api/auth/logout")) {
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    return Promise.resolve(new Response("{}", { status: 404 }));
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

it("restores an existing session on mount", async () => {
  vi.stubGlobal("fetch", sessionFetch());

  render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );

  await waitFor(() => screen.getByText("logged in as a@example.com"));
});

it("syncs the browser time zone after restoring a session", async () => {
  const fetchMock = sessionFetch();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
    timeZone: "America/New_York",
  } as Intl.ResolvedDateTimeFormatOptions);

  render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );

  await waitFor(() => screen.getByText("logged in as a@example.com"));
  await waitFor(() => {
    const patch = fetchMock.mock.calls.find(
      ([url, init]) => String(url).includes("/api/me") && init?.method === "PATCH"
    );
    expect(patch).toBeTruthy();
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ time_zone: "America/New_York" });
  });
});

it("shows logged out state when there is no valid session", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));

  render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );

  await waitFor(() => screen.getByText("logged out"));
});

it("logs out and clears the user", async () => {
  vi.stubGlobal("fetch", sessionFetch());

  render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );

  await waitFor(() => screen.getByText("logged in as a@example.com"));
  await userEvent.click(screen.getByText("Logout"));

  await waitFor(() => screen.getByText("logged out"));
});

it("restores the session only once under StrictMode's double-mount", async () => {
  const fetchMock = sessionFetch();
  vi.stubGlobal("fetch", fetchMock);

  render(
    <StrictMode>
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    </StrictMode>
  );

  await waitFor(() => screen.getByText("logged in as a@example.com"));
  const refreshCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/auth/refresh"));
  expect(refreshCalls).toHaveLength(1);
});

it("shows logged out state when restoring the session throws", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

  render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );

  await waitFor(() => screen.getByText("logged out"));
});

it("clears the session even when the logout request fails", async () => {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/api/auth/refresh")) {
      return Promise.resolve(new Response(JSON.stringify({ access_token: "t1", user: sessionUser }), { status: 200 }));
    }
    if (url.includes("/api/me") && init?.method === "PATCH") {
      return Promise.resolve(new Response(JSON.stringify(sessionUser), { status: 200 }));
    }
    return Promise.reject(new Error("network down"));
  });
  vi.stubGlobal("fetch", fetchMock);

  render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );

  await waitFor(() => screen.getByText("logged in as a@example.com"));
  await userEvent.click(screen.getByText("Logout"));

  await waitFor(() => screen.getByText("logged out"));
});
