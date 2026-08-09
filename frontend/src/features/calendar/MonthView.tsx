import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { getMonthGridDays, isSameDay, toDateKey } from "./dateUtils";
import { computeDroppedDates } from "./dragDrop";
import { groupEventsByDay } from "./groupEventsByDay";
import { useEvents, useUpdateEvent } from "../events/hooks";
import type { CalendarEvent } from "../events/api";

type Props = {
  month: Date;
  onSelectEvent: (event: CalendarEvent) => void;
};

function EventChip({ event, onSelectEvent }: { event: CalendarEvent; onSelectEvent: (e: CalendarEvent) => void }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `${event.id}:${event.start_at}`,
    disabled: event.recurring,
    data: { event },
  });

  return (
    <button ref={setNodeRef} {...listeners} {...attributes} onClick={() => onSelectEvent(event)}>
      {event.title}
      {event.recurring && <span> (繰り返し)</span>}
    </button>
  );
}

function DayCell({
  day,
  today,
  events,
  onSelectEvent,
}: {
  day: Date;
  today: Date;
  events: CalendarEvent[];
  onSelectEvent: (e: CalendarEvent) => void;
}) {
  const key = toDateKey(day);
  const { setNodeRef } = useDroppable({ id: key });

  return (
    <div ref={setNodeRef} data-date-key={key} className={isSameDay(day, today) ? "bg-blue-50" : ""}>
      <div>{day.getDate()}</div>
      {events.map((event) => (
        <EventChip key={`${event.id}-${event.start_at}`} event={event} onSelectEvent={onSelectEvent} />
      ))}
    </div>
  );
}

export function MonthView({ month, onSelectEvent }: Props) {
  const days = getMonthGridDays(month);
  const { data: events = [], isError } = useEvents(days[0], days[days.length - 1]);
  const updateEvent = useUpdateEvent();
  const eventsByDay = groupEventsByDay(events);
  const today = new Date();

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over) return;

    const event = active.data.current?.event as CalendarEvent | undefined;
    if (!event || event.recurring) return;

    const updated = computeDroppedDates(event, String(over.id));
    if (!updated) return;

    updateEvent.mutate({ id: event.id, input: updated });
  }

  return (
    <div>
      {isError && <p role="alert">予定の取得に失敗しました</p>}
      <DndContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = toDateKey(day);
            return (
              <DayCell
                key={key}
                day={day}
                today={today}
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
