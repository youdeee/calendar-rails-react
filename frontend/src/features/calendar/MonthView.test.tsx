import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MonthView } from "./MonthView";
import { toDateKey } from "./dateUtils";

function renderMonthView(month = new Date(2026, 7, 1)) {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <MonthView month={month} onSelectEvent={vi.fn()} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("[]", { status: 200 })));
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

it("still opens a non-recurring event on click, despite being draggable", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 1, title: "Lunch", description: null, start_at: "2026-08-10T12:00:00+09:00",
            end_at: "2026-08-10T13:00:00+09:00", all_day: false, recurring: false,
          },
        ]),
        { status: 200 }
      )
    )
  );
  const onSelectEvent = vi.fn();
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <MonthView month={new Date(2026, 7, 1)} onSelectEvent={onSelectEvent} />
    </QueryClientProvider>
  );

  await waitFor(() => screen.getByText("Lunch"));
  await userEvent.click(screen.getByText("Lunch"));

  expect(onSelectEvent).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
});

it("highlights today's cell, not the first day of the displayed month", async () => {
  const today = new Date(2026, 7, 20);
  vi.useFakeTimers();
  vi.setSystemTime(today);

  const { container } = render(
    <QueryClientProvider client={new QueryClient()}>
      <MonthView month={new Date(2026, 7, 1)} onSelectEvent={vi.fn()} />
    </QueryClientProvider>
  );

  const highlighted = container.querySelector(`[data-date-key="${toDateKey(today)}"]`);
  expect(highlighted).toHaveClass("bg-blue-50");
  const firstOfMonth = container.querySelector(`[data-date-key="2026-08-01"]`);
  expect(firstOfMonth).not.toHaveClass("bg-blue-50");

  vi.useRealTimers();
});

it("caps events at 3 per day and shows an overflow count", async () => {
  const events = Array.from({ length: 5 }, (_, i) => ({
    id: i + 1,
    title: `Event ${i + 1}`,
    description: null,
    start_at: "2026-08-10T09:00:00+09:00",
    end_at: "2026-08-10T10:00:00+09:00",
    all_day: false,
    recurring: false,
  }));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(events), { status: 200 })));

  renderMonthView();

  await waitFor(() => screen.getByText("Event 1"));
  expect(screen.getByText("Event 3")).toBeInTheDocument();
  expect(screen.queryByText("Event 4")).not.toBeInTheDocument();
  expect(screen.getByText("+2件")).toBeInTheDocument();
});
