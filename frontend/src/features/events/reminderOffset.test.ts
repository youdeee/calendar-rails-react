import { allDayReminderMinutes, minutesToAllDayFields } from "./reminderOffset";

it("converts 1 day before 18:00 to 360 minutes", () => {
  expect(allDayReminderMinutes(1, "18:00")).toBe(360);
});

it("round-trips minutes to days and time", () => {
  expect(minutesToAllDayFields(360)).toEqual({ days: 1, time: "18:00" });
  expect(minutesToAllDayFields(1440)).toEqual({ days: 1, time: "00:00" });
  expect(minutesToAllDayFields(43_200)).toEqual({ days: 30, time: "00:00" });
});
