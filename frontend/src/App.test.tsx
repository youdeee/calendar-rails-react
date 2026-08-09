import { render, screen, waitFor } from "@testing-library/react";
import App from "./App";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));
});

it("shows a loading state and then resolves to the logged-out view", async () => {
  render(<App />);

  expect(screen.getByText("Loading...")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByTestId("google-login-button")).toBeInTheDocument());
  expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
});
