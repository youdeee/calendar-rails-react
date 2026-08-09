import { isSameDay } from "./dateUtils";

const MINUTES_PER_DAY = 24 * 60;

function minutesSinceStartOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function layoutTimedEvent(
  event: { start_at: string; end_at: string },
  day: Date
): { topPercent: number; heightPercent: number } {
  const start = new Date(event.start_at);
  const end = new Date(event.end_at);

  const startMinutes = isSameDay(start, day) ? minutesSinceStartOfDay(start) : 0;
  const endMinutes = isSameDay(end, day) ? minutesSinceStartOfDay(end) : MINUTES_PER_DAY;

  return {
    topPercent: (startMinutes / MINUTES_PER_DAY) * 100,
    heightPercent: Math.max(((endMinutes - startMinutes) / MINUTES_PER_DAY) * 100, 0),
  };
}
