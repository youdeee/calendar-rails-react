import { layoutTimedEvent } from "./timeGridLayout";

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
