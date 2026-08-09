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
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
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
