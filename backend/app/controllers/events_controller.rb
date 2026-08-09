class EventsController < ApplicationController
  before_action :authenticate_request!

  MAX_RANGE = 3.months

  def index
    from = parse_date!(params[:from])
    to = parse_date!(params[:to])
    raise ActionController::BadRequest, "to must be after from" if to < from
    raise ActionController::BadRequest, "range too large" if to - from > MAX_RANGE

    candidates = current_user.events.where(
      "(recurrence_rule IS NULL AND start_at <= ? AND end_at >= ?) OR (recurrence_rule IS NOT NULL AND start_at <= ?)",
      to, from, to
    )

    occurrences = candidates.flat_map do |event|
      duration = event.end_at - event.start_at
      event.occurrences_between(from, to).map do |occurrence_start|
        serialize_occurrence(event, occurrence_start, duration)
      end
    end

    render json: occurrences
  end

  private

  def parse_date!(value)
    parsed = Time.zone.parse(value.to_s)
    raise ActionController::BadRequest, "invalid date: #{value}" if parsed.nil?

    parsed
  rescue ArgumentError
    raise ActionController::BadRequest, "invalid date: #{value}"
  end

  def serialize_occurrence(event, occurrence_start, duration)
    {
      id: event.id,
      title: event.title,
      description: event.description,
      all_day: event.all_day,
      recurring: event.recurring?,
      start_at: occurrence_start.iso8601,
      end_at: (occurrence_start + duration).iso8601
    }
  end
end
