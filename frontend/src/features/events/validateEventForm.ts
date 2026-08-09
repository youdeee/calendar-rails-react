export type EventFormValues = {
  title: string;
  startAt: string;
  endAt: string;
  recurrenceEnabled: boolean;
  frequency: "daily" | "weekly" | "monthly";
  interval: string;
  until: string;
};

export type EventFormErrors = Partial<Record<"title" | "startAt" | "endAt" | "interval", string>>;

export function validateEventForm(values: EventFormValues): EventFormErrors {
  const errors: EventFormErrors = {};

  if (!values.title.trim()) {
    errors.title = "タイトルを入力してください";
  } else if (values.title.length > 200) {
    errors.title = "タイトルは200文字以内で入力してください";
  }

  if (!values.startAt) errors.startAt = "開始日時を入力してください";
  if (!values.endAt) errors.endAt = "終了日時を入力してください";
  if (values.startAt && values.endAt && new Date(values.endAt) < new Date(values.startAt)) {
    errors.endAt = "終了日時は開始日時より後にしてください";
  }

  if (values.recurrenceEnabled) {
    const interval = Number(values.interval);
    if (!Number.isInteger(interval) || interval <= 0) {
      errors.interval = "繰り返し間隔は1以上の整数で入力してください";
    }
  }

  return errors;
}
