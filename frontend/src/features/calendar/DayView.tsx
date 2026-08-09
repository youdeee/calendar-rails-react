import { toDateKey } from "./dateUtils";
import { groupEventsByDay } from "./groupEventsByDay";
import { EventButton } from "./EventButton";
import { useEvents } from "../events/hooks";
import type { CalendarEvent } from "../events/api";

type Props = {
  day: Date;
  onSelectEvent: (event: CalendarEvent) => void;
};

export function DayView({ day, onSelectEvent }: Props) {
  const { data: events = [], isError } = useEvents(day, day);
  const dayEvents = groupEventsByDay(events).get(toDateKey(day)) ?? [];

  return (
    <div>
      {isError && <p role="alert">予定の取得に失敗しました</p>}
      <div>{day.toLocaleDateString()}</div>
      {dayEvents.map((event) => (
        <EventButton key={`${event.id}-${event.start_at}`} event={event} onSelect={onSelectEvent} />
      ))}
    </div>
  );
}
