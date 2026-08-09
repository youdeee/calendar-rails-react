import { getWeekDays } from "./dateUtils";
import { groupEventsByDay } from "./groupEventsByDay";
import { TimeGrid } from "./TimeGrid";
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
    <div className="flex h-full flex-col">
      {isError && <p role="alert">予定の取得に失敗しました</p>}
      <TimeGrid days={days} eventsByDay={eventsByDay} onSelectEvent={onSelectEvent} />
    </div>
  );
}
