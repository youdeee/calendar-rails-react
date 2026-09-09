class EventReminderMailer < ApplicationMailer
  def reminder(event:, occurrence_start_at: nil, occurrence_on: nil)
    @event = event
    @occurrence_start_at = occurrence_start_at
    @occurrence_on = occurrence_on
    attachments["event.ics"] = { mime_type: "text/calendar", content: ics_body }
    mail(to: event.user.email, subject: "リマインダー: #{event.title}")
  end

  private

  def ics_body
    uid = "event-#{@event.id}-#{occurrence_token}@calendar.local"
    stamp = Time.current.utc.strftime("%Y%m%dT%H%M%SZ")
    <<~ICS
      BEGIN:VCALENDAR
      VERSION:2.0
      PRODID:-//calendar//EN
      BEGIN:VEVENT
      UID:#{uid}
      DTSTAMP:#{stamp}
      #{ics_dtstart}
      #{ics_dtend}
      SUMMARY:#{ics_escape(@event.title)}
      END:VEVENT
      END:VCALENDAR
    ICS
  end

  def occurrence_token
    @occurrence_on&.iso8601 || @occurrence_start_at.utc.iso8601
  end

  def ics_dtstart
    return "DTSTART;VALUE=DATE:#{@occurrence_on.strftime('%Y%m%d')}" if @event.all_day?

    "DTSTART:#{@occurrence_start_at.utc.strftime('%Y%m%dT%H%M%SZ')}"
  end

  def ics_dtend
    if @event.all_day?
      last_on = @occurrence_on + (@event.end_on - @event.start_on).to_i
      return "DTEND;VALUE=DATE:#{(last_on + 1).strftime('%Y%m%d')}"
    end

    duration = @event.end_at - @event.start_at
    "DTEND:#{(@occurrence_start_at + duration).utc.strftime('%Y%m%dT%H%M%SZ')}"
  end

  def ics_escape(text)
    text.to_s.gsub("\\", "\\\\").gsub(";", "\\;").gsub(",", "\\,").gsub("\n", "\\n")
  end
end
