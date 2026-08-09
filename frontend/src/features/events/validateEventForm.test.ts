import { validateEventForm, type EventFormValues } from "./validateEventForm";

const base: EventFormValues = {
  title: "Meeting",
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
