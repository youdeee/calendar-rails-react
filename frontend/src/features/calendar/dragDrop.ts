export function computeDroppedDates(
  event: { start_at: string; end_at: string },
  targetDateKey: string
): { start_at: string; end_at: string } | null {
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
