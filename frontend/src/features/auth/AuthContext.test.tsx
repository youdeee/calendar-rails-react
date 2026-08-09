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

beforeEach(() => {
  vi.restoreAllMocks();
});

it("restores an existing session on mount", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: "t1", user: { id: 1, email: "a@example.com", name: "A", avatar_url: null } }),
        { status: 200 }
      )
    )
  );

  render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );

  await waitFor(() => screen.getByText("logged in as a@example.com"));
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
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: "t1", user: { id: 1, email: "a@example.com", name: "A", avatar_url: null } }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
  );

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
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({ access_token: "t1", user: { id: 1, email: "a@example.com", name: "A", avatar_url: null } }),
      { status: 200 }
    )
  );
  vi.stubGlobal("fetch", fetchMock);

  render(
    <StrictMode>
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    </StrictMode>
  );

  await waitFor(() => screen.getByText("logged in as a@example.com"));
  expect(fetchMock).toHaveBeenCalledTimes(1);
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
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: "t1", user: { id: 1, email: "a@example.com", name: "A", avatar_url: null } }),
          { status: 200 }
        )
      )
      .mockRejectedValueOnce(new Error("network down"))
  );

  render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );

  await waitFor(() => screen.getByText("logged in as a@example.com"));
  await userEvent.click(screen.getByText("Logout"));

  await waitFor(() => screen.getByText("logged out"));
});
