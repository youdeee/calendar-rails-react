import { groupEventsByDay } from "./groupEventsByDay";
import { TimeGrid } from "./TimeGrid";
import { useEvents } from "../events/hooks";
import type { CalendarEvent } from "../events/api";

type Props = {
  day: Date;
  onSelectEvent: (event: CalendarEvent) => void;
  onSelectDate: (date: Date) => void;
};

export function DayView({ day, onSelectEvent, onSelectDate }: Props) {
  const { data: events = [], isError } = useEvents(day, day);
  const eventsByDay = groupEventsByDay(events);

  return (
    <div className="flex h-full flex-col">
      {isError && <p role="alert">予定の取得に失敗しました</p>}
      <TimeGrid days={[day]} eventsByDay={eventsByDay} onSelectEvent={onSelectEvent} onSelectDate={onSelectDate} />
    </div>
  );
}
