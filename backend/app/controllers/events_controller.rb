class EventsController < ApplicationController
  before_action :authenticate_request!

  MAX_RANGE = 3.months

  def index
    from = parse_date!(params[:from])
    to = parse_date!(params[:to])
    raise ActionController::BadRequest, "to must be after from" if to < from
    raise ActionController::BadRequest, "range too large" if to - from > MAX_RANGE

    to_boundary = to.end_of_day
    candidates = current_user.events.where(
      "(recurrence_rule IS NULL AND start_at <= ? AND end_at >= ?) OR (recurrence_rule IS NOT NULL AND start_at <= ?)",
      to_boundary, from, to_boundary
    )

    occurrences = candidates.flat_map do |event|
      duration = event.end_at - event.start_at
      event.occurrences_between(from, to).map do |occurrence_start|
        serialize_occurrence(event, occurrence_start, duration)
      end
    end

    render json: occurrences
  end

  def create
    event = current_user.events.new(event_params)
    persist_event(event, status: :created)
  end

  def update
    event = current_user.events.find(params[:id])
    event.assign_attributes(event_params)
    persist_event(event, status: :ok)
  end

  def destroy
    current_user.events.find(params[:id]).destroy!
    head :no_content
  end

  private

  def persist_event(event, status:)
    apply_recurrence(event)
    event.save!
    render json: serialize_event(event), status: status
  end

  def parse_date!(value)
    parsed = Time.zone.parse(value.to_s)
    raise ActionController::BadRequest, "invalid date: #{value}" if parsed.nil?

    parsed
  rescue ArgumentError
    raise ActionController::BadRequest, "invalid date: #{value}"
  end

  def serialize_occurrence(event, occurrence_start, duration)
    event_attributes(event).merge(
      start_at: occurrence_start.iso8601,
      end_at: (occurrence_start + duration).iso8601
    )
  end

  def event_attributes(event)
    {
      id: event.id,
      title: event.title,
      description: event.description,
      all_day: event.all_day,
      recurring: event.recurring?
    }
  end

  def event_params
    params.require(:event).permit(:title, :description, :start_at, :end_at, :all_day)
  end

  def recurrence_input
    value = params.dig(:event, :recurrence)
    return nil if value.nil?
    raise ActionController::BadRequest, "recurrence must be an object" unless value.is_a?(ActionController::Parameters)

    value.permit(:frequency, :interval, :until)
  end

  def apply_recurrence(event)
    return unless params[:event]&.key?(:recurrence)

    input = recurrence_input
    event.recurrence_params = input.present? ? build_recurrence_params(input) : nil
  end

  def build_recurrence_params(input)
    {
      "frequency" => input[:frequency],
      "interval" => input[:interval].to_i,
      "until" => input[:until].presence
    }.compact
  end

  def serialize_event(event)
    event_attributes(event).merge(
      start_at: event.start_at.iso8601,
      end_at: event.end_at.iso8601,
      recurrence: event.recurrence_params
    )
  end
end
