import { groupEventsByDay } from "./groupEventsByDay";
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

it("sorts each day's bucket by start_at ascending, regardless of input order", () => {
  const late = makeEvent({ id: 1, title: "Late", start_at: "2026-08-10T15:00:00", end_at: "2026-08-10T16:00:00" });
  const early = makeEvent({ id: 2, title: "Early", start_at: "2026-08-10T08:00:00", end_at: "2026-08-10T09:00:00" });
  const middle = makeEvent({
    id: 3,
    title: "Middle",
    start_at: "2026-08-10T12:00:00",
    end_at: "2026-08-10T13:00:00",
  });

  const grouped = groupEventsByDay([late, early, middle]);

  expect(grouped.get("2026-08-10")?.map((e) => e.title)).toEqual(["Early", "Middle", "Late"]);
});

it("keeps events grouped under separate day keys untouched", () => {
  const day1 = makeEvent({ id: 1, start_at: "2026-08-10T09:00:00", end_at: "2026-08-10T10:00:00" });
  const day2 = makeEvent({ id: 2, start_at: "2026-08-11T09:00:00", end_at: "2026-08-11T10:00:00" });

  const grouped = groupEventsByDay([day1, day2]);

  expect(grouped.get("2026-08-10")?.map((e) => e.id)).toEqual([1]);
  expect(grouped.get("2026-08-11")?.map((e) => e.id)).toEqual([2]);
});
