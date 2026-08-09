import { getMonthGridDays, getWeekDays, isSameDay, toDateKey } from "./dateUtils";

it("returns 42 days", () => {
  expect(getMonthGridDays(new Date(2026, 7, 15))).toHaveLength(42);
});

it("starts the grid on a Sunday and ends on a Saturday", () => {
  const days = getMonthGridDays(new Date(2026, 7, 15));
  expect(days[0].getDay()).toBe(0);
  expect(days[41].getDay()).toBe(6);
});

it("includes every day of the target month", () => {
  const days = getMonthGridDays(new Date(2026, 7, 15));
  const augustDays = days.filter((d) => d.getMonth() === 7);
  expect(augustDays).toHaveLength(31);
});

describe("isSameDay", () => {
  it("returns true for the same calendar day regardless of time", () => {
    expect(isSameDay(new Date(2026, 7, 10, 9, 0), new Date(2026, 7, 10, 23, 0))).toBe(true);
  });

  it("returns false for different days", () => {
    expect(isSameDay(new Date(2026, 7, 10), new Date(2026, 7, 11))).toBe(false);
  });
});

describe("toDateKey", () => {
  it("formats as YYYY-MM-DD using local date parts", () => {
    expect(toDateKey(new Date(2026, 7, 10))).toBe("2026-08-10");
  });
});

describe("getWeekDays", () => {
  it("returns 7 consecutive days starting on Sunday", () => {
    const days = getWeekDays(new Date(2026, 7, 12));
    expect(days).toHaveLength(7);
    expect(days[0].getDay()).toBe(0);
    expect(days[6].getDay()).toBe(6);
  });
});
