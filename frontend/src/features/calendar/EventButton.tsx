import type { CalendarEvent } from "../events/api";

export function EventLabel({ event }: { event: CalendarEvent }) {
  return (
    <>
      {event.title}
      {event.recurring && <span> (繰り返し)</span>}
    </>
  );
}

type Props = {
  event: CalendarEvent;
  onSelect: (event: CalendarEvent) => void;
};

export function EventButton({ event, onSelect }: Props) {
  return (
    <button onClick={() => onSelect(event)}>
      <EventLabel event={event} />
    </button>
  );
}
