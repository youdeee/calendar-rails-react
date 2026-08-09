import { layoutTimedEvent, assignEventColumns } from "./timeGridLayout";

function event(startAt: string, endAt: string) {
  return { start_at: startAt, end_at: endAt };
}

it("positions an event fully within the day", () => {
  const { topPercent, heightPercent } = layoutTimedEvent(
    event("2026-08-10T10:00:00", "2026-08-10T11:00:00"),
    new Date(2026, 7, 10)
  );

  expect(topPercent).toBeCloseTo(((10 * 60) / 1440) * 100);
  expect(heightPercent).toBeCloseTo((60 / 1440) * 100);
});

it("starts at 0% for an event beginning at midnight", () => {
  const { topPercent } = layoutTimedEvent(event("2026-08-10T00:00:00", "2026-08-10T01:00:00"), new Date(2026, 7, 10));

  expect(topPercent).toBe(0);
});

it("clips an overnight event to the end of the day when viewed on its start day", () => {
  const { topPercent, heightPercent } = layoutTimedEvent(
    event("2026-08-10T23:00:00", "2026-08-11T01:00:00"),
    new Date(2026, 7, 10)
  );

  expect(topPercent).toBeCloseTo(((23 * 60) / 1440) * 100);
  expect(heightPercent).toBeCloseTo(((1440 - 23 * 60) / 1440) * 100);
});

it("clips an overnight event to the start of the day when viewed on its end day", () => {
  const { topPercent, heightPercent } = layoutTimedEvent(
    event("2026-08-10T23:00:00", "2026-08-11T01:00:00"),
    new Date(2026, 7, 11)
  );

  expect(topPercent).toBe(0);
  expect(heightPercent).toBeCloseTo((60 / 1440) * 100);
});

describe("assignEventColumns", () => {
  const day = new Date(2026, 7, 10);

  it("gives a single non-overlapping event the full width", () => {
    const events = [event("2026-08-10T09:00:00", "2026-08-10T10:00:00")];
    const [assignment] = assignEventColumns(events, day);

    expect(assignment.column).toBe(0);
    expect(assignment.columnCount).toBe(1);
  });

  it("splits two overlapping events into separate columns", () => {
    const first = event("2026-08-10T09:00:00", "2026-08-10T10:00:00");
    const second = event("2026-08-10T09:30:00", "2026-08-10T10:30:00");

    const assignments = assignEventColumns([first, second], day);
    const firstAssignment = assignments.find((a) => a.event === first)!;
    const secondAssignment = assignments.find((a) => a.event === second)!;

    expect(firstAssignment.column).not.toBe(secondAssignment.column);
    expect(firstAssignment.columnCount).toBe(2);
    expect(secondAssignment.columnCount).toBe(2);
  });

  it("gives a third, non-overlapping event later in the day its own full-width cluster", () => {
    const first = event("2026-08-10T09:00:00", "2026-08-10T10:00:00");
    const second = event("2026-08-10T09:30:00", "2026-08-10T10:30:00");
    const third = event("2026-08-10T14:00:00", "2026-08-10T15:00:00");

    const assignments = assignEventColumns([first, second, third], day);
    const thirdAssignment = assignments.find((a) => a.event === third)!;

    expect(thirdAssignment.column).toBe(0);
    expect(thirdAssignment.columnCount).toBe(1);
  });

  it("does not overlap columns for events that only touch at the boundary", () => {
    const first = event("2026-08-10T09:00:00", "2026-08-10T10:00:00");
    const second = event("2026-08-10T10:00:00", "2026-08-10T11:00:00");

    const assignments = assignEventColumns([first, second], day);

    expect(assignments.every((a) => a.column === 0 && a.columnCount === 1)).toBe(true);
  });
});
