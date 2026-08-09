import { useState, type FormEvent } from "react";
import { useCreateEvent, useUpdateEvent } from "./hooks";
import { validateEventForm, type EventFormValues, type EventFormErrors } from "./validateEventForm";
import type { CalendarEvent, RecurrenceParams } from "./api";

type Props = {
  event?: CalendarEvent;
  onClose: () => void;
};

function toFormValues(event?: CalendarEvent): EventFormValues {
  return {
    title: event?.title ?? "",
    startAt: event ? event.start_at.slice(0, 16) : "",
    endAt: event ? event.end_at.slice(0, 16) : "",
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
      updateEvent.mutate({ id: event.id, input });
    } else {
      createEvent.mutate(input);
    }
    onClose();
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        タイトル
        <input value={values.title} onChange={(e) => setValues({ ...values, title: e.target.value })} />
      </label>

      <label>
        開始日時
        <input
          type="datetime-local"
          value={values.startAt}
          onChange={(e) => setValues({ ...values, startAt: e.target.value })}
        />
      </label>

      <label>
        終了日時
        <input
          type="datetime-local"
          value={values.endAt}
          onChange={(e) => setValues({ ...values, endAt: e.target.value })}
        />
      </label>

      <label>
        繰り返す
        <input
          type="checkbox"
          checked={values.recurrenceEnabled}
          onChange={(e) => setValues({ ...values, recurrenceEnabled: e.target.checked })}
        />
      </label>

      {values.recurrenceEnabled && (
        <>
          <label>
            頻度
            <select
              value={values.frequency}
              onChange={(e) => setValues({ ...values, frequency: e.target.value as EventFormValues["frequency"] })}
            >
              <option value="daily">毎日</option>
              <option value="weekly">毎週</option>
              <option value="monthly">毎月</option>
            </select>
          </label>
          <label>
            間隔
            <input value={values.interval} onChange={(e) => setValues({ ...values, interval: e.target.value })} />
          </label>
        </>
      )}

      {errorMessages.length > 0 && (
        <p role="alert">{errorMessages.join(" ")}</p>
      )}
      {(createEvent.isError || updateEvent.isError) && <p role="alert">保存に失敗しました</p>}

      <button type="submit">保存</button>
      <button type="button" onClick={onClose}>
        キャンセル
      </button>
    </form>
  );
}
