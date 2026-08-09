import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MonthView } from "./MonthView";

function renderMonthView() {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <MonthView month={new Date(2026, 7, 1)} onSelectEvent={vi.fn()} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

it("renders events on their day and marks recurring events", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 1, title: "Lunch", description: null, start_at: "2026-08-10T12:00:00+09:00",
            end_at: "2026-08-10T13:00:00+09:00", all_day: false, recurring: false,
          },
          {
            id: 2, title: "Standup", description: null, start_at: "2026-08-03T10:00:00+09:00",
            end_at: "2026-08-03T10:15:00+09:00", all_day: false, recurring: true,
          },
        ]),
        { status: 200 }
      )
    )
  );

  renderMonthView();

  await waitFor(() => screen.getByText("Lunch"));
  expect(screen.getByText("Lunch").closest("button")).not.toHaveTextContent("(繰り返し)");
  expect(screen.getByText("Standup").closest("button")).toHaveTextContent("(繰り返し)");
});
