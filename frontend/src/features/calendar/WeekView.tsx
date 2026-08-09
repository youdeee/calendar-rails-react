import { getWeekDays, toDateKey } from "./dateUtils";
import { groupEventsByDay } from "./groupEventsByDay";
import { EventButton } from "./EventButton";
import { useEvents } from "../events/hooks";
import type { CalendarEvent } from "../events/api";

type Props = {
  weekStart: Date;
  onSelectEvent: (event: CalendarEvent) => void;
};

export function WeekView({ weekStart, onSelectEvent }: Props) {
  const days = getWeekDays(weekStart);
  const { data: events = [], isError } = useEvents(days[0], days[days.length - 1]);
  const eventsByDay = groupEventsByDay(events);

  return (
    <div className="grid grid-cols-7">
      {isError && <p role="alert">予定の取得に失敗しました</p>}
      {days.map((day) => {
        const key = toDateKey(day);
        return (
          <div key={key}>
            <div>{day.toLocaleDateString()}</div>
            {(eventsByDay.get(key) ?? []).map((event) => (
              <EventButton key={`${event.id}-${event.start_at}`} event={event} onSelect={onSelectEvent} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
