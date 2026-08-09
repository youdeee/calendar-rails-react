import { toDateKey } from "./dateUtils";
import type { CalendarEvent } from "../events/api";

export function groupEventsByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = toDateKey(new Date(event.start_at));
    const bucket = eventsByDay.get(key);
    if (bucket) {
      bucket.push(event);
    } else {
      eventsByDay.set(key, [event]);
    }
  }
  for (const bucket of eventsByDay.values()) {
    bucket.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }
  return eventsByDay;
}
