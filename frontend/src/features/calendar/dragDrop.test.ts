import { computeDroppedDates } from "./dragDrop";
import { toDateKey } from "./dateUtils";

it("shifts the date to the drop target while preserving time and duration", () => {
  const originalStart = new Date(2026, 7, 10, 12, 0);
  const originalEnd = new Date(2026, 7, 10, 13, 0);
  const event = { start_at: originalStart.toISOString(), end_at: originalEnd.toISOString() };

  const result = computeDroppedDates(event, "2026-08-15");

  expect(result).not.toBeNull();
  const newStart = new Date(result!.start_at);
  expect(newStart.getFullYear()).toBe(2026);
  expect(newStart.getMonth()).toBe(7);
  expect(newStart.getDate()).toBe(15);
  expect(newStart.getHours()).toBe(originalStart.getHours());
  expect(newStart.getMinutes()).toBe(originalStart.getMinutes());

  const durationMs = new Date(result!.end_at).getTime() - newStart.getTime();
  expect(durationMs).toBe(60 * 60 * 1000);
});

it("returns null when dropped on the same day", () => {
  const originalStart = new Date(2026, 7, 10, 12, 0);
  const originalEnd = new Date(2026, 7, 10, 13, 0);
  const event = { start_at: originalStart.toISOString(), end_at: originalEnd.toISOString() };
  expect(computeDroppedDates(event, toDateKey(originalStart))).toBeNull();
});
