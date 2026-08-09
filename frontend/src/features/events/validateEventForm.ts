export type EventFormValues = {
  title: string;
  allDay: boolean;
  date: string;
  startAt: string;
  endAt: string;
  recurrenceEnabled: boolean;
  frequency: "daily" | "weekly" | "monthly";
  interval: string;
  until: string;
};

export type EventFormErrors = Partial<Record<"title" | "date" | "startAt" | "endAt" | "interval", string>>;

export function validateEventForm(values: EventFormValues): EventFormErrors {
  const errors: EventFormErrors = {};

  if (!values.title.trim()) {
    errors.title = "タイトルを入力してください";
  } else if (values.title.length > 200) {
    errors.title = "タイトルは200文字以内で入力してください";
  }

  if (values.allDay) {
    if (!values.date) errors.date = "日付を入力してください";
    else if (Number.isNaN(new Date(values.date).getTime())) errors.date = "日付が不正です";
  } else {
    if (!values.startAt) errors.startAt = "開始日時を入力してください";
    else if (Number.isNaN(new Date(values.startAt).getTime())) errors.startAt = "開始日時が不正です";

    if (!values.endAt) errors.endAt = "終了日時を入力してください";
    else if (Number.isNaN(new Date(values.endAt).getTime())) errors.endAt = "終了日時が不正です";

    if (
      !errors.startAt &&
      !errors.endAt &&
      values.startAt &&
      values.endAt &&
      new Date(values.endAt) <= new Date(values.startAt)
    ) {
      errors.endAt = "終了日時は開始日時より後にしてください";
    }
  }

  if (values.recurrenceEnabled) {
    const interval = Number(values.interval);
    if (!Number.isInteger(interval) || interval <= 0) {
      errors.interval = "繰り返し間隔は1以上の整数で入力してください";
    }
  }

  return errors;
}
