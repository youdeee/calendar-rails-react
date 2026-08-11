import { toDateKey, isSameDay } from "./dateUtils";
import { layoutTimedEvent, assignEventColumns } from "./timeGridLayout";
import { EventLabel } from "./EventButton";
import type { CalendarEvent } from "../events/api";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_ROW_HEIGHT_PX = 48;
const GRID_HEIGHT_PX = HOUR_ROW_HEIGHT_PX * HOURS.length;
const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

type Props = {
  days: Date[];
  eventsByDay: Map<string, CalendarEvent[]>;
  onSelectEvent: (event: CalendarEvent) => void;
  onSelectDate?: (date: Date) => void;
};

function CurrentTimeLine() {
  const now = new Date();
  const topPercent = ((now.getHours() * 60 + now.getMinutes()) / (24 * 60)) * 100;
  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-10 border-t-2 border-red-500"
      style={{ top: `${topPercent}%` }}
    />
  );
}

export function TimeGrid({ days, eventsByDay, onSelectEvent, onSelectDate = () => {} }: Props) {
  const today = new Date();

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex border-b border-gray-200">
        <div className="w-14 shrink-0" />
        {days.map((day) => (
          <div
            key={toDateKey(day)}
            className="flex-1 border-l border-gray-200 py-1 text-center text-xs text-gray-500"
          >
            {WEEKDAY_LABELS[day.getDay()]}{" "}
            <span
              className={
                isSameDay(day, today)
                  ? "ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand font-medium text-white"
                  : "ml-1"
              }
            >
              {day.getDate()}
            </span>
          </div>
        ))}
      </div>

      <div className="flex border-b border-gray-200">
        <div className="w-14 shrink-0 text-right text-xs text-gray-400">終日</div>
        {days.map((day) => {
          const dayEvents = eventsByDay.get(toDateKey(day)) ?? [];
          const allDayEvents = dayEvents.filter((event) => event.all_day);
          return (
            <div key={toDateKey(day)} onClick={() => onSelectDate(day)} className="flex flex-1 flex-col gap-1 border-l border-gray-200 p-1">
              {allDayEvents.map((event) => (
                <button
                  key={`${event.id}-${event.start_at}`}
                  onClick={(e) => { e.stopPropagation(); onSelectEvent(event); }}
                  className="truncate rounded bg-brand px-1.5 py-0.5 text-left text-xs text-white"
                >
                  <EventLabel event={event} />
                </button>
              ))}
            </div>
          );
        })}
      </div>

      <div className="relative flex" style={{ height: `${GRID_HEIGHT_PX}px` }}>
        <div className="w-14 shrink-0">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="pr-1 text-right text-xs text-gray-400"
              style={{ height: `${HOUR_ROW_HEIGHT_PX}px` }}
            >
              {hour === 0 ? "" : `${hour}:00`}
            </div>
          ))}
        </div>

        {days.map((day) => {
          const dayEvents = eventsByDay.get(toDateKey(day)) ?? [];
          const timedEvents = dayEvents.filter((event) => !event.all_day);

          return (
            <div key={toDateKey(day)} onClick={() => onSelectDate(day)} className="relative flex-1 border-l border-gray-200">
              {HOURS.map((hour) => (
                <div key={hour} className="border-b border-gray-100" style={{ height: `${HOUR_ROW_HEIGHT_PX}px` }} />
              ))}
              {isSameDay(day, today) && <CurrentTimeLine />}
              {assignEventColumns(timedEvents, day).map(({ event, column, columnCount }) => {
                const { topPercent, heightPercent } = layoutTimedEvent(event, day);
                const widthPercent = 100 / columnCount;
                return (
                  <button
                    key={`${event.id}-${event.start_at}`}
                    onClick={(e) => { e.stopPropagation(); onSelectEvent(event); }}
                    className="absolute overflow-hidden rounded bg-brand px-1.5 py-0.5 text-left text-xs text-white"
                    style={{
                      top: `${topPercent}%`,
                      height: `${heightPercent}%`,
                      left: `${column * widthPercent}%`,
                      width: `${widthPercent}%`,
                    }}
                  >
                    <EventLabel event={event} />
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
