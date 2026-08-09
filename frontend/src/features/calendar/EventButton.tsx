import type { CalendarEvent } from "../events/api";

type Props = {
  event: CalendarEvent;
  onSelect: (event: CalendarEvent) => void;
};

export function EventButton({ event, onSelect }: Props) {
  return (
    <button onClick={() => onSelect(event)}>
      {event.title}
      {event.recurring && <span> (繰り返し)</span>}
    </button>
  );
}
