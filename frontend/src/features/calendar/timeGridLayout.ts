import { isSameDay } from "./dateUtils";

const MINUTES_PER_DAY = 24 * 60;

function minutesSinceStartOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function clippedRangeMinutes(event: { start_at: string; end_at: string }, day: Date): { start: number; end: number } {
  const start = new Date(event.start_at);
  const end = new Date(event.end_at);

  return {
    start: isSameDay(start, day) ? minutesSinceStartOfDay(start) : 0,
    end: isSameDay(end, day) ? minutesSinceStartOfDay(end) : MINUTES_PER_DAY,
  };
}

export function layoutTimedEvent(
  event: { start_at: string; end_at: string },
  day: Date
): { topPercent: number; heightPercent: number } {
  const { start: startMinutes, end: endMinutes } = clippedRangeMinutes(event, day);

  return {
    topPercent: (startMinutes / MINUTES_PER_DAY) * 100,
    heightPercent: Math.max(((endMinutes - startMinutes) / MINUTES_PER_DAY) * 100, 0),
  };
}

export type ColumnAssignment<T> = { event: T; column: number; columnCount: number };

// Assigns each of a day's timed events a horizontal column so overlapping
// events split the available width side-by-side instead of painting on top
// of one another. Not an optimal packing (a later-arriving narrower event
// won't backfill into space freed by an earlier column) — a simple greedy
// interval-coloring pass, chosen for correctness over optimal density.
export function assignEventColumns<T extends { start_at: string; end_at: string }>(
  events: T[],
  day: Date
): ColumnAssignment<T>[] {
  const withRange = events
    .map((event) => ({ event, ...clippedRangeMinutes(event, day) }))
    .sort((a, b) => a.start - b.start);

  const result: ColumnAssignment<T>[] = [];
  let cluster: { event: T; start: number; end: number; column: number }[] = [];
  let clusterColumnEnds: number[] = [];
  let clusterMaxEnd = -Infinity;

  function flushCluster() {
    if (cluster.length === 0) return;
    const columnCount = Math.max(...cluster.map((item) => item.column)) + 1;
    for (const item of cluster) {
      result.push({ event: item.event, column: item.column, columnCount });
    }
    cluster = [];
    clusterColumnEnds = [];
  }

  for (const item of withRange) {
    if (cluster.length > 0 && item.start >= clusterMaxEnd) {
      flushCluster();
      clusterMaxEnd = -Infinity;
    }

    let column = 0;
    while (clusterColumnEnds[column] !== undefined && clusterColumnEnds[column] > item.start) {
      column++;
    }
    clusterColumnEnds[column] = item.end;
    clusterMaxEnd = Math.max(clusterMaxEnd, item.end);
    cluster.push({ event: item.event, start: item.start, end: item.end, column });
  }
  flushCluster();

  return result;
}
