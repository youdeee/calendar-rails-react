import { getMonthGridDays, getWeekDays, isSameDay, toDateKey, addDays, addWeeks, addMonths } from "./dateUtils";

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

describe("addDays", () => {
  it("adds the given number of days", () => {
    expect(toDateKey(addDays(new Date(2026, 7, 10), 3))).toBe("2026-08-13");
  });

  it("subtracts days for a negative amount", () => {
    expect(toDateKey(addDays(new Date(2026, 7, 10), -3))).toBe("2026-08-07");
  });

  it("rolls over into the next month", () => {
    expect(toDateKey(addDays(new Date(2026, 7, 30), 3))).toBe("2026-09-02");
  });
});

describe("addWeeks", () => {
  it("adds 7 days per week", () => {
    expect(toDateKey(addWeeks(new Date(2026, 7, 10), 1))).toBe("2026-08-17");
  });

  it("subtracts weeks for a negative amount", () => {
    expect(toDateKey(addWeeks(new Date(2026, 7, 10), -1))).toBe("2026-08-03");
  });
});

describe("addMonths", () => {
  it("adds months, keeping the same day of month", () => {
    expect(toDateKey(addMonths(new Date(2026, 7, 10), 1))).toBe("2026-09-10");
  });

  it("subtracts months for a negative amount", () => {
    expect(toDateKey(addMonths(new Date(2026, 7, 10), -1))).toBe("2026-07-10");
  });

  it("rolls over the year when crossing December", () => {
    expect(toDateKey(addMonths(new Date(2026, 11, 15), 1))).toBe("2027-01-15");
  });

  it("clamps to the last day of the target month instead of overflowing", () => {
    // Jan 31 + 1 month must land on Feb 28 (2026 is not a leap year), not Mar 3
    expect(toDateKey(addMonths(new Date(2026, 0, 31), 1))).toBe("2026-02-28");
  });
});
