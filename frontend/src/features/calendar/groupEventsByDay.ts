import { toDateKey } from "./dateUtils";
import type { CalendarEvent } from "../events/api";

export function groupEventsByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const start = new Date(event.start_at);
    const end = new Date(event.end_at);
    const lastDay = event.all_day ? new Date(end.getTime() - 1) : end;
    for (const day = new Date(start.getFullYear(), start.getMonth(), start.getDate()); day <= lastDay; day.setDate(day.getDate() + 1)) {
      const key = toDateKey(day);
      const bucket = eventsByDay.get(key);
      if (bucket) bucket.push(event);
      else eventsByDay.set(key, [event]);
    }
  }
  for (const bucket of eventsByDay.values()) {
    bucket.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }
  return eventsByDay;
}
