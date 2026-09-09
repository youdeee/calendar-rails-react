import { apiRequest } from "../../api/client";

export type RecurrenceParams = { frequency: "daily" | "weekly" | "monthly"; interval: number; until?: string | null };

export type CalendarEvent = {
  id: number;
  title: string;
  description: string | null;
  start_at: string | null;
  end_at: string | null;
  start_on: string | null;
  end_on: string | null;
  all_day: boolean;
  reminder_minutes: number | null;
  recurring: boolean;
  recurrence: RecurrenceParams | null;
};

export type EventInput = {
  title: string;
  description?: string;
  all_day?: boolean;
  start_at?: string | null;
  end_at?: string | null;
  start_on?: string | null;
  end_on?: string | null;
  reminder_minutes?: number | null;
  recurrence?: RecurrenceParams | null;
};

export function fetchEvents(from: Date, to: Date, signal?: AbortSignal): Promise<CalendarEvent[]> {
  // Callers pass whatever time-of-day their `from`/`to` Dates happen to carry
  // (e.g. CalendarPage seeds "today" from `new Date()`, keeping the current
  // wall-clock time). The backend compares against these instants directly
  // (end_at >= from) with no truncation, so without normalizing here, events
  // earlier in the day than the moment the page loaded would be silently
  // dropped. Widen to the full local day on both ends.
  const rangeStart = new Date(from);
  rangeStart.setHours(0, 0, 0, 0);
  // The backend extends `to` through the end of its own calendar day, but it
  // does so in UTC. Sending local midnight for `to` lands on the PREVIOUS
  // UTC calendar day for zones ahead of UTC (e.g. JST), truncating the
  // range hours early and silently dropping events on the last day shown.
  // Send local end-of-day instead so the UTC day it falls on always covers
  // the whole intended local day.
  const rangeEnd = new Date(to);
  rangeEnd.setHours(23, 59, 59, 999);
  const params = new URLSearchParams({ from: rangeStart.toISOString(), to: rangeEnd.toISOString() });
  return apiRequest<CalendarEvent[]>(`/api/events?${params.toString()}`, { signal });
}

export function createEvent(input: EventInput): Promise<CalendarEvent> {
  return apiRequest<CalendarEvent>("/api/events", { method: "POST", body: JSON.stringify({ event: input }) });
}

export function updateEvent(id: number, input: Partial<EventInput>): Promise<CalendarEvent> {
  return apiRequest<CalendarEvent>(`/api/events/${id}`, { method: "PATCH", body: JSON.stringify({ event: input }) });
}

export function deleteEvent(id: number): Promise<void> {
  return apiRequest<void>(`/api/events/${id}`, { method: "DELETE" });
}
