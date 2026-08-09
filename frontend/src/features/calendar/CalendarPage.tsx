import { useState } from "react";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";
import { DayView } from "./DayView";
import { EventFormModal } from "../events/EventFormModal";
import type { CalendarEvent } from "../events/api";

type ViewMode = "month" | "week" | "day";

export function CalendarPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate] = useState(() => new Date());
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>(undefined);
  const [isCreating, setIsCreating] = useState(false);

  const isModalOpen = isCreating || editingEvent !== undefined;

  function closeModal() {
    setIsCreating(false);
    setEditingEvent(undefined);
  }

  return (
    <div>
      <div>
        <button onClick={() => setViewMode("month")}>月</button>
        <button onClick={() => setViewMode("week")}>週</button>
        <button onClick={() => setViewMode("day")}>日</button>
        <button onClick={() => setIsCreating(true)}>予定を追加</button>
      </div>

      {viewMode === "month" && <MonthView month={currentDate} onSelectEvent={setEditingEvent} />}
      {viewMode === "week" && <WeekView weekStart={currentDate} onSelectEvent={setEditingEvent} />}
      {viewMode === "day" && <DayView day={currentDate} onSelectEvent={setEditingEvent} />}

      {isModalOpen && <EventFormModal event={editingEvent} onClose={closeModal} />}
    </div>
  );
}
