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
