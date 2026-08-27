import { useState } from "react";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";
import { DayView } from "./DayView";
import { EventFormModal } from "../events/EventFormModal";
import { addMonths, addWeeks, addDays } from "./dateUtils";
import { useAuth } from "../auth/AuthContext";
import { ThemeToggle } from "../theme/ThemeToggle";
import type { CalendarEvent } from "../events/api";

type ViewMode = "month" | "week" | "day";

const VIEW_LABELS: Record<ViewMode, string> = { month: "月", week: "週", day: "日" };

function formatHeaderLabel(date: Date, viewMode: ViewMode): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (viewMode === "day") return `${year}年${month}月${date.getDate()}日`;
  return `${year}年${month}月`;
}

function stepDate(date: Date, viewMode: ViewMode, direction: 1 | -1): Date {
  if (viewMode === "month") return addMonths(date, direction);
  if (viewMode === "week") return addWeeks(date, direction);
  return addDays(date, direction);
}

export function CalendarPage() {
  const { user, logout } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>(undefined);
  const [isCreating, setIsCreating] = useState(false);
  const [createDate, setCreateDate] = useState<Date | undefined>();

  const isModalOpen = isCreating || editingEvent !== undefined;

  function closeModal() {
    setIsCreating(false);
    setEditingEvent(undefined);
    setCreateDate(undefined);
  }

  function openCreateForDate(date: Date) {
    setCreateDate(date);
    setIsCreating(true);
  }

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-gray-950">
      <header className="flex items-center gap-3 border-b border-gray-200 px-4 py-2 dark:border-gray-700">
        <span className="text-xl font-medium text-gray-700 dark:text-gray-200">カレンダー</span>
        <button
          onClick={() => setCurrentDate(new Date())}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
        >
          今日
        </button>
        <div className="flex items-center">
          <button
            aria-label="前へ"
            onClick={() => setCurrentDate((d) => stepDate(d, viewMode, -1))}
            className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            ←
          </button>
          <button
            aria-label="次へ"
            onClick={() => setCurrentDate((d) => stepDate(d, viewMode, 1))}
            className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            →
          </button>
        </div>
        <span className="text-lg text-gray-700 dark:text-gray-200">{formatHeaderLabel(currentDate, viewMode)}</span>

        <button
          onClick={() => setIsCreating(true)}
          className="ml-4 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:brightness-110"
        >
          予定を追加
        </button>

        <div className="ml-auto flex items-center gap-2">
          {(["month", "week", "day"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              aria-pressed={viewMode === mode}
              className={`rounded px-3 py-1.5 text-sm ${
                viewMode === mode
                  ? "bg-blue-100 text-brand dark:bg-blue-900 dark:text-blue-300"
                  : "hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {VIEW_LABELS[mode]}
            </button>
          ))}
          <ThemeToggle />
          {user?.avatar_url && <img src={user.avatar_url} alt={user.name} className="h-8 w-8 rounded-full" />}
          <button onClick={() => void logout()} className="rounded px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800">
            ログアウト
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        {viewMode === "month" && <MonthView month={currentDate} onSelectEvent={setEditingEvent} onSelectDate={openCreateForDate} />}
        {viewMode === "week" && <WeekView weekStart={currentDate} onSelectEvent={setEditingEvent} onSelectDate={openCreateForDate} />}
        {viewMode === "day" && <DayView day={currentDate} onSelectEvent={setEditingEvent} onSelectDate={openCreateForDate} />}
      </div>

      {isModalOpen && <EventFormModal event={editingEvent} defaultDate={createDate ?? currentDate} onClose={closeModal} />}
    </div>
  );
}
