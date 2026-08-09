import { useState, type FormEvent } from "react";
import { useCreateEvent, useUpdateEvent } from "./hooks";
import { validateEventForm, type EventFormValues, type EventFormErrors } from "./validateEventForm";
import type { CalendarEvent, RecurrenceParams } from "./api";

type Props = {
  event?: CalendarEvent;
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

function toFormValues(event?: CalendarEvent): EventFormValues {
  return {
    title: event?.title ?? "",
    startAt: event ? toDatetimeLocalValue(event.start_at) : "",
    endAt: event ? toDatetimeLocalValue(event.end_at) : "",
    recurrenceEnabled: Boolean(event?.recurrence),
    frequency: event?.recurrence?.frequency ?? "weekly",
    interval: String(event?.recurrence?.interval ?? 1),
    until: event?.recurrence?.until ?? "",
  };
}

export function EventFormModal({ event, onClose }: Props) {
  const [values, setValues] = useState<EventFormValues>(() => toFormValues(event));
  const [errors, setErrors] = useState<EventFormErrors>({});
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const errorMessages = Object.values(errors).filter((message): message is string => Boolean(message));

  function updateField<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validationErrors = validateEventForm(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const recurrence: RecurrenceParams | null = values.recurrenceEnabled
      ? { frequency: values.frequency, interval: Number(values.interval), until: values.until || null }
      : null;

    const input = {
      title: values.title,
      start_at: new Date(values.startAt).toISOString(),
      end_at: new Date(values.endAt).toISOString(),
      recurrence,
    };

    if (event) {
      updateEvent.mutate({ id: event.id, input }, { onSuccess: onClose });
    } else {
      createEvent.mutate(input, { onSuccess: onClose });
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        タイトル
        <input value={values.title} onChange={(e) => updateField("title", e.target.value)} />
      </label>

      <label>
        開始日時
        <input
          type="datetime-local"
          value={values.startAt}
          onChange={(e) => updateField("startAt", e.target.value)}
        />
      </label>

      <label>
        終了日時
        <input type="datetime-local" value={values.endAt} onChange={(e) => updateField("endAt", e.target.value)} />
      </label>

      <label>
        繰り返す
        <input
          type="checkbox"
          checked={values.recurrenceEnabled}
          onChange={(e) => updateField("recurrenceEnabled", e.target.checked)}
        />
      </label>

      {values.recurrenceEnabled && (
        <>
          <label>
            頻度
            <select
              value={values.frequency}
              onChange={(e) => updateField("frequency", e.target.value as EventFormValues["frequency"])}
            >
              <option value="daily">毎日</option>
              <option value="weekly">毎週</option>
              <option value="monthly">毎月</option>
            </select>
          </label>
          <label>
            間隔
            <input value={values.interval} onChange={(e) => updateField("interval", e.target.value)} />
          </label>
        </>
      )}

      {errorMessages.length > 0 && <p role="alert">{errorMessages.join(" ")}</p>}
      {(createEvent.isError || updateEvent.isError) && <p role="alert">保存に失敗しました</p>}

      <button type="submit">保存</button>
      <button type="button" onClick={onClose}>
        キャンセル
      </button>
    </form>
  );
}
