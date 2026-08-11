import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useCreateEvent, useDeleteEvent, useUpdateEvent } from "./hooks";
import { validateEventForm, type EventFormValues, type EventFormErrors } from "./validateEventForm";
import { toDateKey } from "../calendar/dateUtils";
import type { CalendarEvent, RecurrenceParams } from "./api";

type Props = {
  event?: CalendarEvent;
  defaultDate: Date;
  onClose: () => void;
};

// datetime-local inputs display and submit local wall-clock time, but the API
// exchanges UTC ISO strings; slicing the UTC string directly would show (and
// on re-save, silently shift by) the browser's UTC offset.
function toDatetimeLocalValue(isoString: string): string {
  const date = new Date(isoString);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function addHours(datetimeLocalValue: string, hours: number): string {
  const date = new Date(datetimeLocalValue);
  date.setHours(date.getHours() + hours);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function dateOnlyToRange(startDate: string, endDate: string): { start_at: string; end_at: string } {
  const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
  const start = new Date(startYear, startMonth - 1, startDay);
  // The form's end date is inclusive; the API stores all-day ranges as an
  // exclusive next-midnight boundary.
  const end = new Date(endYear, endMonth - 1, endDay + 1);
  return { start_at: start.toISOString(), end_at: end.toISOString() };
}

function toFormValues(event: CalendarEvent | undefined, defaultDate: Date): EventFormValues {
  if (!event) {
    return {
      title: "",
      allDay: true,
      startDate: toDateKey(defaultDate),
      endDate: toDateKey(defaultDate),
      startAt: "",
      endAt: "",
      recurrenceEnabled: false,
      frequency: "weekly",
      interval: "1",
      until: "",
    };
  }

  return {
    title: event.title,
    allDay: event.all_day,
    startDate: toDateKey(new Date(event.start_at)),
    endDate: event.all_day ? toDateKey(new Date(new Date(event.end_at).getTime() - 1)) : toDateKey(new Date(event.start_at)),
    startAt: event.all_day ? "" : toDatetimeLocalValue(event.start_at),
    endAt: event.all_day ? "" : toDatetimeLocalValue(event.end_at),
    recurrenceEnabled: Boolean(event.recurrence),
    frequency: event.recurrence?.frequency ?? "weekly",
    interval: String(event.recurrence?.interval ?? 1),
    until: event.recurrence?.until ?? "",
  };
}

export function EventFormModal({ event, defaultDate, onClose }: Props) {
  const [values, setValues] = useState<EventFormValues>(() => toFormValues(event, defaultDate));
  const [errors, setErrors] = useState<EventFormErrors>({});
  const [endAtTouched, setEndAtTouched] = useState(Boolean(event) && !event?.all_day);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();
  const errorMessages = Object.values(errors).filter((message): message is string => Boolean(message));

  function updateField<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleStartAtChange(newStartAt: string) {
    setValues((prev) => {
      const shouldAutoFillEnd = !endAtTouched || !prev.endAt || new Date(prev.endAt) <= new Date(newStartAt);
      return {
        ...prev,
        startAt: newStartAt,
        endAt: shouldAutoFillEnd && newStartAt ? addHours(newStartAt, 1) : prev.endAt,
      };
    });
  }

  function handleEndAtChange(newEndAt: string) {
    setEndAtTouched(true);
    updateField("endAt", newEndAt);
  }

  function handleAllDayToggle(checked: boolean) {
    if (checked) {
      // Re-checking all-day: prefer the date the user just set via 開始日時
      // over the stale `date` field, which was never updated while in timed mode.
      const startDate = values.startAt ? values.startAt.slice(0, 10) : values.startDate;
      setValues((prev) => ({ ...prev, allDay: true, startDate, endDate: startDate }));
      return;
    }
    const startAt = `${values.startDate}T09:00`;
    setEndAtTouched(false);
    setValues((prev) => ({ ...prev, allDay: false, startAt, endAt: addHours(startAt, 1) }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validationErrors = validateEventForm(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const recurrence: RecurrenceParams | null = values.recurrenceEnabled
      ? { frequency: values.frequency, interval: Number(values.interval), until: values.until || null }
      : null;

    const { start_at, end_at } = values.allDay
      ? dateOnlyToRange(values.startDate, values.endDate)
      : { start_at: new Date(values.startAt).toISOString(), end_at: new Date(values.endAt).toISOString() };

    const input = { title: values.title, start_at, end_at, all_day: values.allDay, recurrence };

    if (event) {
      updateEvent.mutate({ id: event.id, input }, { onSuccess: onClose });
    } else {
      createEvent.mutate(input, { onSuccess: onClose });
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") onClose();
  }

  function handleDelete() {
    if (!event) return;
    deleteEvent.mutate(event.id, { onSuccess: onClose });
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40">
      <form
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label={event ? "予定を編集" : "予定を追加"}
        className="flex w-full max-w-md flex-col gap-3 rounded-lg bg-white p-6 shadow-lg"
      >
        {event && (
          <button
            type="button"
            aria-label="予定を削除"
            onClick={() => setIsDeleteConfirmOpen(true)}
            className="-mt-2 -mr-2 self-end rounded p-2 text-red-600 hover:bg-red-50"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-2">
              <path d="M4 7h16M10 11v6m4-6v6M9 7l1-2h4l1 2m-9 0 1 13h10l1-13" />
            </svg>
          </button>
        )}

        <label className="flex flex-col gap-1 text-sm text-gray-700">
          タイトル
          <input
            value={values.title}
            onChange={(e) => updateField("title", e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={values.allDay} onChange={(e) => handleAllDayToggle(e.target.checked)} />
          終日
        </label>

        {values.allDay ? (
          <>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              開始日
              <input
                type="date"
                value={values.startDate}
                onChange={(e) => {
                  const startDate = e.target.value;
                  setValues((prev) => ({
                    ...prev,
                    startDate,
                    endDate: !prev.endDate || prev.endDate < startDate ? startDate : prev.endDate,
                  }));
                }}
                className="rounded border border-gray-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              終了日
              <input
                type="date"
                value={values.endDate}
                onChange={(e) => updateField("endDate", e.target.value)}
                className="rounded border border-gray-300 px-2 py-1.5"
              />
            </label>
          </>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              開始日時
              <input
                type="datetime-local"
                value={values.startAt}
                onChange={(e) => handleStartAtChange(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1.5"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-gray-700">
              終了日時
              <input
                type="datetime-local"
                value={values.endAt}
                onChange={(e) => handleEndAtChange(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1.5"
              />
            </label>
          </>
        )}

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={values.recurrenceEnabled}
            onChange={(e) => updateField("recurrenceEnabled", e.target.checked)}
          />
          繰り返す
        </label>

        {values.recurrenceEnabled && (
          <>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              頻度
              <select
                value={values.frequency}
                onChange={(e) => updateField("frequency", e.target.value as EventFormValues["frequency"])}
                className="rounded border border-gray-300 px-2 py-1.5"
              >
                <option value="daily">毎日</option>
                <option value="weekly">毎週</option>
                <option value="monthly">毎月</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              間隔
              <input
                value={values.interval}
                onChange={(e) => updateField("interval", e.target.value)}
                className="rounded border border-gray-300 px-2 py-1.5"
              />
            </label>
          </>
        )}

        {errorMessages.length > 0 && (
          <p role="alert" className="text-sm text-red-600">
            {errorMessages.join(" ")}
          </p>
        )}
        {(createEvent.isError || updateEvent.isError) && (
          <p role="alert" className="text-sm text-red-600">
            保存に失敗しました
          </p>
        )}

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-sm hover:bg-gray-100">
            キャンセル
          </button>
          <button
            type="submit"
            className="rounded bg-brand px-4 py-1.5 text-sm font-medium text-white hover:brightness-110"
          >
            保存
          </button>
        </div>
      </form>

      {isDeleteConfirmOpen && event && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-confirmation-title"
            className="flex w-full max-w-sm flex-col gap-4 rounded-lg bg-white p-6 shadow-lg"
          >
            <h2 id="delete-confirmation-title" className="text-lg font-medium text-gray-800">
              {event.recurring ? "この繰り返し予定をすべて削除しますか？" : "このイベントを削除しますか？"}
            </h2>
            <p className="text-sm text-gray-600">この操作は取り消せません。</p>
            {deleteEvent.isError && <p role="alert" className="text-sm text-red-600">削除に失敗しました</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={deleteEvent.isPending}
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="rounded px-3 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={deleteEvent.isPending}
                onClick={handleDelete}
                className="rounded bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteEvent.isPending ? "削除中…" : "削除する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
