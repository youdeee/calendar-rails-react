import { allDayReminderMinutes, REMINDER_MINUTES_MAX } from "./reminderOffset";

export type EventFormValues = {
  title: string;
  allDay: boolean;
  startDate: string;
  endDate: string;
  startAt: string;
  endAt: string;
  recurrenceEnabled: boolean;
  frequency: "daily" | "weekly" | "monthly";
  interval: string;
  until: string;
  reminderEnabled: boolean;
  reminderMinutes: string;
  reminderDays: string;
  reminderTime: string;
};

export type EventFormErrors = Partial<
  Record<"title" | "startDate" | "endDate" | "startAt" | "endAt" | "interval" | "reminderMinutes" | "reminderDays", string>
>;

export function validateEventForm(values: EventFormValues): EventFormErrors {
  const errors: EventFormErrors = {};

  if (!values.title.trim()) {
    errors.title = "タイトルを入力してください";
  } else if (values.title.length > 200) {
    errors.title = "タイトルは200文字以内で入力してください";
  }

  if (values.allDay) {
    if (!values.startDate) errors.startDate = "開始日を入力してください";
    else if (Number.isNaN(new Date(values.startDate).getTime())) errors.startDate = "開始日が不正です";

    if (!values.endDate) errors.endDate = "終了日を入力してください";
    else if (Number.isNaN(new Date(values.endDate).getTime())) errors.endDate = "終了日が不正です";

    if (!errors.startDate && !errors.endDate && values.endDate < values.startDate) {
      errors.endDate = "終了日は開始日以降にしてください";
    }
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

  if (values.reminderEnabled) {
    if (values.allDay) {
      const days = Number(values.reminderDays);
      if (!Number.isInteger(days) || days < 1 || days > 30) {
        errors.reminderDays = "リマインドは1〜30日前にしてください";
      } else {
        const minutes = allDayReminderMinutes(days, values.reminderTime || "18:00");
        if (minutes < 1 || minutes > REMINDER_MINUTES_MAX) {
          errors.reminderDays = "リマインドは1分〜30日前にしてください";
        }
      }
    } else {
      const minutes = Number(values.reminderMinutes);
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > REMINDER_MINUTES_MAX) {
        errors.reminderMinutes = "リマインドは1〜43200分前にしてください";
      }
    }
  }

  return errors;
}
