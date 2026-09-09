import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { getMonthGridDays, isSameDay, parseDateKey, toDateKey } from "./dateUtils";
import { computeDroppedDates } from "./dragDrop";
import { groupEventsByDay } from "./groupEventsByDay";
import { EventLabel } from "./EventButton";
import { useEvents, useUpdateEvent } from "../events/hooks";
import type { CalendarEvent } from "../events/api";

type Props = {
  month: Date;
  onSelectEvent: (event: CalendarEvent) => void;
  onSelectDate?: (date: Date) => void;
};

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const MAX_VISIBLE_EVENTS = 3;

function capEvents(events: CalendarEvent[]): { visible: CalendarEvent[]; overflowCount: number } {
  if (events.length <= MAX_VISIBLE_EVENTS) return { visible: events, overflowCount: 0 };
  return { visible: events.slice(0, MAX_VISIBLE_EVENTS), overflowCount: events.length - MAX_VISIBLE_EVENTS };
}

function EventChip({ event, day, onSelectEvent }: { event: CalendarEvent; day: Date; onSelectEvent: (e: CalendarEvent) => void }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `${event.id}:${event.start_on ?? event.start_at}`,
    disabled: event.recurring,
    data: { event },
  });

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => { e.stopPropagation(); onSelectEvent(event); }}
      className={`truncate bg-brand px-1.5 py-0.5 text-left text-xs text-white hover:brightness-110 ${
        !event.all_day || isSameDay(parseDateKey(event.start_on ?? ""), day) ? "rounded-l" : "rounded-l-none"
      } ${!event.all_day || isSameDay(parseDateKey(event.end_on ?? ""), day) ? "rounded-r" : "rounded-r-none"}`}
    >
      <EventLabel event={event} />
    </button>
  );
}

function DayCell({
  day,
  today,
  month,
  events,
  onSelectEvent,
  onSelectDate,
}: {
  day: Date;
  today: Date;
  month: Date;
  events: CalendarEvent[];
  onSelectEvent: (e: CalendarEvent) => void;
  onSelectDate: (date: Date) => void;
}) {
  const key = toDateKey(day);
  const { setNodeRef } = useDroppable({ id: key });
  const isCurrentMonth = day.getMonth() === month.getMonth();
  const { visible, overflowCount } = capEvents(events);

  const dateLabelClass = isSameDay(day, today)
    ? "flex h-6 w-6 items-center justify-center rounded-full bg-brand font-medium text-white"
    : isCurrentMonth
      ? "text-gray-700 dark:text-gray-200"
      : "text-gray-400 dark:text-gray-500";

  return (
    <div
      ref={setNodeRef}
      data-date-key={key}
      onClick={() => onSelectDate(day)}
      className={`flex min-h-24 flex-col gap-1 border-b border-r border-gray-200 p-1 dark:border-gray-700 ${
        isSameDay(day, today) ? "bg-blue-50 dark:bg-blue-950" : ""
      }`}
    >
      <div className={`self-end text-sm ${dateLabelClass}`}>{day.getDate()}</div>
      {visible.map((event) => (
        <EventChip key={`${event.id}-${event.start_on ?? event.start_at}`} event={event} day={day} onSelectEvent={onSelectEvent} />
      ))}
      {overflowCount > 0 && <span className="text-xs text-gray-500 dark:text-gray-400">+{overflowCount}件</span>}
    </div>
  );
}

export function MonthView({ month, onSelectEvent, onSelectDate = () => {} }: Props) {
  const days = getMonthGridDays(month);
  const { data: events = [], isError } = useEvents(days[0], days[days.length - 1]);
  const updateEvent = useUpdateEvent();
  const eventsByDay = groupEventsByDay(events);
  const today = new Date();
  // Without a movement threshold, PointerSensor activates a drag on plain
  // pointerdown and swallows the resulting click, breaking click-to-open.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over) return;

    const event = active.data.current?.event as CalendarEvent | undefined;
    if (!event || event.recurring) return;

    const updated = computeDroppedDates(event, String(over.id));
    if (!updated) return;

    updateEvent.mutate({ id: event.id, input: updated });
  }

  return (
    <div className="flex h-full flex-col">
      {isError && <p role="alert">予定の取得に失敗しました</p>}
      {updateEvent.isError && <p role="alert">予定の更新に失敗しました</p>}
      <div className="grid grid-cols-7 border-b border-gray-200 text-center text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-2">
            {label}
          </div>
        ))}
      </div>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid flex-1 grid-cols-7 border-l border-t border-gray-200 dark:border-gray-700">
          {days.map((day) => {
            const key = toDateKey(day);
            return (
              <DayCell
                key={key}
                day={day}
                today={today}
                month={month}
                events={eventsByDay.get(key) ?? []}
                onSelectEvent={onSelectEvent}
                onSelectDate={onSelectDate}
              />
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}
