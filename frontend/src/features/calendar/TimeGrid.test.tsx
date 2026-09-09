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
    start_on: null,
    end_on: null,
    all_day: false,
    reminder_minutes: null,
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

it("renders overlapping timed events side-by-side instead of stacked on top of each other", () => {
  const day = new Date(2026, 7, 10);
  const eventsByDay = new Map([
    [
      "2026-08-10",
      [
        makeEvent({ id: 1, title: "First", start_at: "2026-08-10T09:00:00", end_at: "2026-08-10T10:00:00" }),
        makeEvent({ id: 2, title: "Second", start_at: "2026-08-10T09:30:00", end_at: "2026-08-10T10:30:00" }),
      ],
    ],
  ]);

  render(<TimeGrid days={[day]} eventsByDay={eventsByDay} onSelectEvent={vi.fn()} />);

  const firstButton = screen.getByText("First").closest("button")!;
  const secondButton = screen.getByText("Second").closest("button")!;

  expect(firstButton.style.left).not.toBe(secondButton.style.left);
  expect(firstButton.style.width).toBe("50%");
  expect(secondButton.style.width).toBe("50%");

  // Both remain in the document and clickable — neither is fully hidden behind the other.
  expect(firstButton).toBeVisible();
  expect(secondButton).toBeVisible();
});

it("gives a non-overlapping event later in the day the full column width", () => {
  const day = new Date(2026, 7, 10);
  const eventsByDay = new Map([
    [
      "2026-08-10",
      [
        makeEvent({ id: 1, title: "Morning", start_at: "2026-08-10T09:00:00", end_at: "2026-08-10T10:00:00" }),
        makeEvent({ id: 2, title: "Afternoon", start_at: "2026-08-10T14:00:00", end_at: "2026-08-10T15:00:00" }),
      ],
    ],
  ]);

  render(<TimeGrid days={[day]} eventsByDay={eventsByDay} onSelectEvent={vi.fn()} />);

  const afternoonButton = screen.getByText("Afternoon").closest("button")!;
  expect(afternoonButton.style.width).toBe("100%");
  expect(afternoonButton.style.left).toBe("0%");
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
