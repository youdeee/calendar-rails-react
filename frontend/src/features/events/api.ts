import { apiRequest } from "../../api/client";

export type RecurrenceParams = { frequency: "daily" | "weekly" | "monthly"; interval: number; until?: string | null };

export type CalendarEvent = {
  id: number;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  recurring: boolean;
  recurrence: RecurrenceParams | null;
};

export type EventInput = {
  title: string;
  description?: string;
  start_at: string;
  end_at: string;
  all_day?: boolean;
  recurrence?: RecurrenceParams | null;
};

export function fetchEvents(from: Date, to: Date): Promise<CalendarEvent[]> {
  // The backend extends `to` through the end of its own calendar day, but it
  // does so in UTC. Sending local midnight for `to` lands on the PREVIOUS
  // UTC calendar day for zones ahead of UTC (e.g. JST), truncating the
  // range hours early and silently dropping events on the last day shown.
  // Send local end-of-day instead so the UTC day it falls on always covers
  // the whole intended local day.
  const rangeEnd = new Date(to);
  rangeEnd.setHours(23, 59, 59, 999);
  const params = new URLSearchParams({ from: from.toISOString(), to: rangeEnd.toISOString() });
  return apiRequest<CalendarEvent[]>(`/api/events?${params.toString()}`);
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
