import { getWeekDays, isSameDay, toDateKey } from "./dateUtils";
import { useEvents } from "../events/hooks";
import type { CalendarEvent } from "../events/api";

type Props = {
  weekStart: Date;
  onSelectEvent: (event: CalendarEvent) => void;
};

export function WeekView({ weekStart, onSelectEvent }: Props) {
  const days = getWeekDays(weekStart);
  const { data: events = [], isError } = useEvents(days[0], days[days.length - 1]);

  return (
    <div className="grid grid-cols-7">
      {isError && <p role="alert">予定の取得に失敗しました</p>}
      {days.map((day) => (
        <div key={toDateKey(day)}>
          <div>{day.toLocaleDateString()}</div>
          {events
            .filter((event) => isSameDay(new Date(event.start_at), day))
            .map((event) => (
              <button key={`${event.id}-${event.start_at}`} onClick={() => onSelectEvent(event)}>
                {event.title}
                {event.recurring && <span> (繰り返し)</span>}
              </button>
            ))}
        </div>
      ))}
    </div>
  );
}
