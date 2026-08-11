import { validateEventForm, type EventFormValues } from "./validateEventForm";

const base: EventFormValues = {
  title: "Meeting",
  allDay: false,
  startDate: "2026-08-10",
  endDate: "2026-08-10",
  startAt: "2026-08-10T10:00",
  endAt: "2026-08-10T11:00",
  recurrenceEnabled: false,
  frequency: "weekly",
  interval: "1",
  until: "",
};

it("passes for valid values", () => {
  expect(validateEventForm(base)).toEqual({});
});

it("requires a title", () => {
  expect(validateEventForm({ ...base, title: "" })).toHaveProperty("title");
});

it("rejects a title longer than 200 characters", () => {
  expect(validateEventForm({ ...base, title: "a".repeat(201) })).toHaveProperty("title");
});

it("requires end_at to be after start_at", () => {
  expect(validateEventForm({ ...base, endAt: "2026-08-10T09:00" })).toHaveProperty("endAt");
});

it("rejects end_at equal to start_at, matching the backend's strict inequality", () => {
  expect(validateEventForm({ ...base, endAt: base.startAt })).toHaveProperty("endAt");
});

it("requires a positive integer interval when recurrence is enabled", () => {
  expect(validateEventForm({ ...base, recurrenceEnabled: true, interval: "0" })).toHaveProperty("interval");
  expect(validateEventForm({ ...base, recurrenceEnabled: true, interval: "abc" })).toHaveProperty("interval");
});

it("does not validate interval when recurrence is disabled", () => {
  expect(validateEventForm({ ...base, recurrenceEnabled: false, interval: "abc" })).toEqual({});
});

it("requires valid inclusive start and end dates when all-day is enabled", () => {
  const allDayValues = { ...base, allDay: true, startDate: "", endDate: "", startAt: "", endAt: "" };
  expect(validateEventForm(allDayValues)).toHaveProperty("startDate");
  expect(validateEventForm(allDayValues)).toHaveProperty("endDate");
  expect(validateEventForm({ ...allDayValues, startDate: "2026-08-10", endDate: "2026-08-09" })).toHaveProperty("endDate");
  expect(validateEventForm({ ...allDayValues, startDate: "2026-08-10", endDate: "2026-08-10" })).toEqual({});
});

it("rejects an unparsable start_at value instead of letting it reach submit", () => {
  // Reproduces clearing the all-day date field, then unchecking 終日: the
  // component builds `T09:00` (an empty date), which is not a parsable date.
  const errors = validateEventForm({ ...base, startAt: "T09:00" });
  expect(errors).toHaveProperty("startAt");
  expect(errors.endAt).toBeUndefined();
});

it("rejects an unparsable end_at value instead of letting it reach submit", () => {
  const errors = validateEventForm({ ...base, endAt: "NaN-NaN-NaNTNaN:NaN" });
  expect(errors).toHaveProperty("endAt");
  expect(errors.startAt).toBeUndefined();
});

it("rejects an unparsable all-day date instead of letting it reach submit", () => {
  // Reproduces: clear 日付 while all-day, uncheck 終日 (date stays ""), then
  // re-check 終日 — handleAllDayToggle adopts startAt ("T09:00") into date,
  // which is not a parsable date.
  const errors = validateEventForm({ ...base, allDay: true, startDate: "T09:00" });
  expect(errors).toHaveProperty("startDate");
});
