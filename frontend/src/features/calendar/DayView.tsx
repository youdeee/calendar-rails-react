import { isSameDay } from "./dateUtils";
import { useEvents } from "../events/hooks";
import type { CalendarEvent } from "../events/api";

type Props = {
  day: Date;
  onSelectEvent: (event: CalendarEvent) => void;
};

export function DayView({ day, onSelectEvent }: Props) {
  const { data: events = [], isError } = useEvents(day, day);
  const dayEvents = events.filter((event) => isSameDay(new Date(event.start_at), day));

  return (
    <div>
      {isError && <p role="alert">予定の取得に失敗しました</p>}
      <div>{day.toLocaleDateString()}</div>
      {dayEvents.map((event) => (
        <button key={`${event.id}-${event.start_at}`} onClick={() => onSelectEvent(event)}>
          {event.title}
          {event.recurring && <span> (繰り返し)</span>}
        </button>
      ))}
    </div>
  );
}
