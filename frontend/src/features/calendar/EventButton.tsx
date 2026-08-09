import type { CalendarEvent } from "../events/api";

export function EventLabel({ event }: { event: CalendarEvent }) {
  return (
    <>
      {event.title}
      {event.recurring && <span> (繰り返し)</span>}
    </>
  );
}
