import { addDateKey, daysBetweenKeys } from "./dateUtils";

export function computeDroppedDates(
  event: {
    all_day?: boolean;
    start_at?: string | null;
    end_at?: string | null;
    start_on?: string | null;
    end_on?: string | null;
  },
  targetDateKey: string
): { start_at: string; end_at: string } | { start_on: string; end_on: string } | null {
  if (event.all_day && event.start_on && event.end_on) {
    if (targetDateKey === event.start_on) return null;
    const span = daysBetweenKeys(event.start_on, event.end_on);
    return { start_on: targetDateKey, end_on: addDateKey(targetDateKey, span) };
  }
  if (!event.start_at || !event.end_at) return null;

  const start = new Date(event.start_at);
  const end = new Date(event.end_at);
  const [year, month, day] = targetDateKey.split("-").map(Number);

  const newStart = new Date(start);
  newStart.setFullYear(year, month - 1, day);

  if (newStart.getTime() === start.getTime()) return null;

  const durationMs = end.getTime() - start.getTime();
  const newEnd = new Date(newStart.getTime() + durationMs);

  return { start_at: newStart.toISOString(), end_at: newEnd.toISOString() };
}
