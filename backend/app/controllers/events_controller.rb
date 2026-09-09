class EventsController < ApplicationController
  before_action :authenticate_request!

  MAX_RANGE = 3.months

  def index
    from = parse_date!(params[:from])
    to = parse_date!(params[:to])
    raise ActionController::BadRequest, "to must be after from" if to < from
    raise ActionController::BadRequest, "range too large" if to - from > MAX_RANGE

    to_boundary = to.end_of_day
    zone = current_user.time_zone
    zone_start_date = from.in_time_zone(zone).to_date
    zone_end_date = to_boundary.in_time_zone(zone).to_date

    candidates = current_user.events.where(
      "(all_day = FALSE AND recurrence_rule IS NULL AND start_at <= ? AND end_at >= ?) OR " \
      "(all_day = FALSE AND recurrence_rule IS NOT NULL AND start_at <= ?) OR " \
      "(all_day = TRUE AND recurrence_rule IS NULL AND start_on <= ? AND end_on >= ?) OR " \
      "(all_day = TRUE AND recurrence_rule IS NOT NULL AND start_on <= ?)",
      to_boundary, from, to_boundary,
      zone_end_date, zone_start_date, zone_end_date
    )

    occurrences = candidates.flat_map do |event|
      event.occurrences_between(from, to, time_zone: zone).map do |occurrence|
        serialize_occurrence(event, occurrence)
      end
    end

    render json: occurrences
  end

  def create
    event = current_user.events.new
    persist_event(event, status: :created)
  end

  def update
    event = current_user.events.find(params[:id])
    persist_event(event, status: :ok)
  end

  def destroy
    current_user.events.find(params[:id]).destroy!
    head :no_content
  end

  private

  def persist_event(event, status:)
    event.assign_attributes(event_params)
    apply_recurrence(event)
    apply_schedule_kind(event)
    event.save!
    DispatchDueRemindersJob.perform_later(event.id) if event.reminder_minutes.present?
    render json: serialize_event(event), status: status
  end

  def parse_date!(value)
    parsed = Time.zone.parse(value.to_s)
    raise ActionController::BadRequest, "invalid date: #{value}" if parsed.nil?

    parsed
  rescue ArgumentError
    raise ActionController::BadRequest, "invalid date: #{value}"
  end

  def serialize_occurrence(event, occurrence)
    if event.all_day?
      duration_days = (event.end_on - event.start_on).to_i
      event_attributes(event).merge(
        start_on: occurrence.iso8601,
        end_on: (occurrence + duration_days).iso8601,
        start_at: nil,
        end_at: nil
      )
    else
      duration = event.end_at - event.start_at
      event_attributes(event).merge(
        start_at: occurrence.iso8601,
        end_at: (occurrence + duration).iso8601,
        start_on: nil,
        end_on: nil
      )
    end
  end

  def serialize_event(event)
    serialize_occurrence(event, event.all_day? ? event.start_on : event.start_at)
  end

  def event_attributes(event)
    {
      id: event.id,
      title: event.title,
      description: event.description,
      all_day: event.all_day,
      reminder_minutes: event.reminder_minutes,
      recurring: event.recurring?,
      recurrence: event.recurrence_params
    }
  end

  def event_params
    permitted = params.require(:event).permit(
      :title, :description, :start_at, :end_at, :start_on, :end_on, :all_day, :reminder_minutes
    )
    if permitted.key?(:reminder_minutes) && permitted[:reminder_minutes].blank?
      permitted[:reminder_minutes] = nil
    end
    permitted
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

  def apply_schedule_kind(event)
    if event.all_day?
      event.start_at = nil
      event.end_at = nil
    else
      event.start_on = nil
      event.end_on = nil
    end
  end

  def build_recurrence_params(input)
    {
      "frequency" => input[:frequency],
      "interval" => input[:interval].to_i,
      "until" => input[:until].presence
    }.compact
  end
end
