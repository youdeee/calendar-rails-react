import { getMonthGridDays, isSameDay, toDateKey } from "./dateUtils";
import { useEvents } from "../events/hooks";
import type { CalendarEvent } from "../events/api";

type Props = {
  month: Date;
  onSelectEvent: (event: CalendarEvent) => void;
};

export function MonthView({ month, onSelectEvent }: Props) {
  const days = getMonthGridDays(month);
  const { data: events = [], isError } = useEvents(days[0], days[days.length - 1]);

  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = toDateKey(new Date(event.start_at));
    const bucket = eventsByDay.get(key);
    if (bucket) {
      bucket.push(event);
    } else {
      eventsByDay.set(key, [event]);
    }
  }

  const today = new Date();

  return (
    <div>
      {isError && <p role="alert">予定の取得に失敗しました</p>}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = toDateKey(day);
          return (
            <div key={key} data-date-key={key} className={isSameDay(day, today) ? "bg-blue-50" : ""}>
              <div>{day.getDate()}</div>
              {(eventsByDay.get(key) ?? []).map((event) => (
                <button key={`${event.id}-${event.start_at}`} onClick={() => onSelectEvent(event)}>
                  {event.title}
                  {event.recurring && <span> (繰り返し)</span>}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
