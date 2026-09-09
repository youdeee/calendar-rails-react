export const MINUTES_PER_DAY = 1440;
export const REMINDER_MINUTES_MAX = 43_200;

export function allDayReminderMinutes(daysBefore: number, time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return daysBefore * MINUTES_PER_DAY - (hours * 60 + minutes);
}

export function minutesToAllDayFields(minutes: number): { days: number; time: string } {
  const remainder = minutes % MINUTES_PER_DAY;
  if (remainder === 0) {
    return { days: minutes / MINUTES_PER_DAY, time: "00:00" };
  }
  const days = Math.floor(minutes / MINUTES_PER_DAY) + 1;
  const timeMinutes = MINUTES_PER_DAY - remainder;
  const hours = Math.floor(timeMinutes / 60);
  const mins = timeMinutes % 60;
  return { days, time: `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}` };
}
