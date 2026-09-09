class DispatchDueRemindersJob < ApplicationJob
  queue_as :default

  STALE_AFTER = 2.hours

  def perform(event_id = nil)
    scope = Event.includes(:user).where.not(reminder_minutes: nil)
    scope = scope.where(id: event_id) if event_id
    scope.find_each { |event| dispatch(event) }
  end

  private

  def dispatch(event)
    now = Time.current
    window_start = now - STALE_AFTER
    window_end = now + event.reminder_minutes.minutes
    occurrences = event.occurrences_between(window_start, window_end, time_zone: event.user.time_zone)

    if event.all_day?
      occurrences.each { |occurrence_on| deliver_all_day(event, occurrence_on, now) }
    else
      occurrences.each { |occurrence_start| deliver_timed(event, occurrence_start, now) }
    end
  end

  def deliver_timed(event, occurrence_start, now)
    return unless due?(occurrence_start - event.reminder_minutes.minutes, occurrence_start, now)

    send_once(event, occurrence_start) do
      EventReminderMailer.reminder(event: event, occurrence_start_at: occurrence_start).deliver_now
    end
  end

  def deliver_all_day(event, occurrence_on, now)
    start_instant = event.all_day_start_instant(occurrence_on, event.user.time_zone)
    return unless due?(start_instant - event.reminder_minutes.minutes, start_instant, now)

    marker = Time.utc(occurrence_on.year, occurrence_on.month, occurrence_on.day)
    send_once(event, marker) do
      EventReminderMailer.reminder(event: event, occurrence_on: occurrence_on).deliver_now
    end
  end

  def due?(due_at, start_instant, now)
    due_at <= now && start_instant > now - STALE_AFTER
  end

  def send_once(event, occurrence_start_at)
    delivery = ReminderDelivery.create_or_find_by!(event_id: event.id, occurrence_start_at: occurrence_start_at) do |row|
      row.user_id = event.user_id
    end
    return if delivery.delivered_at.present?

    yield
    delivery.update!(delivered_at: Time.current)
  end
end
