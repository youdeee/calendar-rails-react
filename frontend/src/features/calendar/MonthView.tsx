import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { getMonthGridDays, isSameDay, toDateKey } from "./dateUtils";
import { computeDroppedDates } from "./dragDrop";
import { groupEventsByDay } from "./groupEventsByDay";
import { EventLabel } from "./EventButton";
import { useEvents, useUpdateEvent } from "../events/hooks";
import type { CalendarEvent } from "../events/api";

type Props = {
  month: Date;
  onSelectEvent: (event: CalendarEvent) => void;
};

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const MAX_VISIBLE_EVENTS = 3;

function capEvents(events: CalendarEvent[]): { visible: CalendarEvent[]; overflowCount: number } {
  if (events.length <= MAX_VISIBLE_EVENTS) return { visible: events, overflowCount: 0 };
  return { visible: events.slice(0, MAX_VISIBLE_EVENTS), overflowCount: events.length - MAX_VISIBLE_EVENTS };
}

function EventChip({ event, onSelectEvent }: { event: CalendarEvent; onSelectEvent: (e: CalendarEvent) => void }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `${event.id}:${event.start_at}`,
    disabled: event.recurring,
    data: { event },
  });

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onSelectEvent(event)}
      className="truncate rounded bg-brand px-1.5 py-0.5 text-left text-xs text-white hover:brightness-110"
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
}: {
  day: Date;
  today: Date;
  month: Date;
  events: CalendarEvent[];
  onSelectEvent: (e: CalendarEvent) => void;
}) {
  const key = toDateKey(day);
  const { setNodeRef } = useDroppable({ id: key });
  const isCurrentMonth = day.getMonth() === month.getMonth();
  const { visible, overflowCount } = capEvents(events);

  const dateLabelClass = isSameDay(day, today)
    ? "flex h-6 w-6 items-center justify-center rounded-full bg-brand font-medium text-white"
    : isCurrentMonth
      ? "text-gray-700"
      : "text-gray-400";

  return (
    <div
      ref={setNodeRef}
      data-date-key={key}
      className={`flex min-h-24 flex-col gap-1 border-b border-r border-gray-200 p-1 ${
        isSameDay(day, today) ? "bg-blue-50" : ""
      }`}
    >
      <div className={`self-end text-sm ${dateLabelClass}`}>{day.getDate()}</div>
      {visible.map((event) => (
        <EventChip key={`${event.id}-${event.start_at}`} event={event} onSelectEvent={onSelectEvent} />
      ))}
      {overflowCount > 0 && <span className="text-xs text-gray-500">+{overflowCount}件</span>}
    </div>
  );
}

export function MonthView({ month, onSelectEvent }: Props) {
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
      <div className="grid grid-cols-7 border-b border-gray-200 text-center text-xs text-gray-500">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-2">
            {label}
          </div>
        ))}
      </div>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid flex-1 grid-cols-7 border-l border-t border-gray-200">
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
              />
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}
