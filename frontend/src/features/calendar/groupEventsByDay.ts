import { addDateKey, parseDateKey, toDateKey } from "./dateUtils";
import type { CalendarEvent } from "../events/api";

export function groupEventsByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    if (event.all_day && event.start_on && event.end_on) {
      for (let key = event.start_on; key <= event.end_on; key = addDateKey(key, 1)) {
        pushEvent(eventsByDay, key, event);
      }
      continue;
    }
    if (!event.start_at || !event.end_at) continue;
    const start = new Date(event.start_at);
    const end = new Date(event.end_at);
    for (const day = new Date(start.getFullYear(), start.getMonth(), start.getDate()); day <= end; day.setDate(day.getDate() + 1)) {
      pushEvent(eventsByDay, toDateKey(day), event);
    }
  }
  for (const bucket of eventsByDay.values()) {
    bucket.sort((a, b) => eventSortValue(a) - eventSortValue(b));
  }
  return eventsByDay;
}

function pushEvent(eventsByDay: Map<string, CalendarEvent[]>, key: string, event: CalendarEvent) {
  const bucket = eventsByDay.get(key);
  if (bucket) bucket.push(event);
  else eventsByDay.set(key, [event]);
}

function eventSortValue(event: CalendarEvent): number {
  if (event.all_day && event.start_on) return parseDateKey(event.start_on).getTime();
  return event.start_at ? new Date(event.start_at).getTime() : 0;
}
