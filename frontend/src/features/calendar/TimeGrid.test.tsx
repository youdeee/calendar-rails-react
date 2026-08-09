import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimeGrid } from "./TimeGrid";
import type { CalendarEvent } from "../events/api";

function makeEvent(overrides: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: 1,
    title: "Event",
    description: null,
    start_at: "2026-08-10T09:00:00",
    end_at: "2026-08-10T10:00:00",
    all_day: false,
    recurring: false,
    recurrence: null,
    ...overrides,
  };
}

it("renders all-day events in the all-day row", () => {
  const day = new Date(2026, 7, 10);
  const eventsByDay = new Map([["2026-08-10", [makeEvent({ id: 1, title: "Holiday", all_day: true })]]]);

  render(<TimeGrid days={[day]} eventsByDay={eventsByDay} onSelectEvent={vi.fn()} />);

  expect(screen.getByText("Holiday")).toBeInTheDocument();
});

it("calls onSelectEvent when a timed event block is clicked", async () => {
  const day = new Date(2026, 7, 10);
  const eventsByDay = new Map([["2026-08-10", [makeEvent({ id: 2, title: "Lunch" })]]]);
  const onSelectEvent = vi.fn();

  render(<TimeGrid days={[day]} eventsByDay={eventsByDay} onSelectEvent={onSelectEvent} />);

  await userEvent.click(screen.getByText("Lunch"));

  expect(onSelectEvent).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
});

it("shows the current time line only on the column matching today", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 10, 12, 0));

  const today = new Date(2026, 7, 10);
  const otherDay = new Date(2026, 7, 11);
  const eventsByDay = new Map<string, CalendarEvent[]>();

  const { container } = render(<TimeGrid days={[today, otherDay]} eventsByDay={eventsByDay} onSelectEvent={vi.fn()} />);

  const lines = container.querySelectorAll(".border-red-500");
  expect(lines).toHaveLength(1);

  vi.useRealTimers();
});
