class Event < ApplicationRecord
  belongs_to :user
  has_many :reminder_deliveries, dependent: :destroy

  TITLE_MAX_LENGTH = 200
  DESCRIPTION_MAX_LENGTH = 5000
  ALLOWED_FREQUENCIES = %w[daily weekly monthly].freeze
  REMINDER_MINUTES_MAX = 43_200

  validates :title, presence: true, length: { maximum: TITLE_MAX_LENGTH }
  validates :description, length: { maximum: DESCRIPTION_MAX_LENGTH }
  validates :reminder_minutes, numericality: {
    only_integer: true, greater_than: 0, less_than_or_equal_to: REMINDER_MINUTES_MAX
  }, allow_nil: true
  validate :schedule_present
  validate :end_after_start
  validate :recurrence_params_valid

  def recurrence_params=(hash)
    self.recurrence_rule = hash.present? ? hash.to_json : nil
    @recurrence_params = nil
  end

  def recurrence_params
    return nil if recurrence_rule.blank?

    @recurrence_params ||= JSON.parse(recurrence_rule)
  end

  def reload(...)
    @recurrence_params = nil
    super
  end

  def recurring?
    recurrence_rule.present?
  end

  def ice_cube_rule
    params = recurrence_params
    return nil unless params

    rule = case params["frequency"]
    when "daily" then IceCube::Rule.daily(params["interval"])
    when "weekly" then IceCube::Rule.weekly(params["interval"])
    when "monthly" then IceCube::Rule.monthly(params["interval"])
    end
    rule = rule.until(Date.parse(params["until"])) if params["until"].present?
    rule
  end

  def occurrences_between(range_start, range_end, time_zone: "UTC")
    inclusive_range_end = range_end.end_of_day
    return all_day_occurrences_between(range_start, inclusive_range_end, time_zone) if all_day?

    unless recurring?
      return (start_at <= inclusive_range_end && end_at >= range_start) ? [start_at] : []
    end

    duration = end_at - start_at
    occurrence_search_start = range_start - duration
    schedule = IceCube::Schedule.new(start_at)
    schedule.add_recurrence_rule(ice_cube_rule)
    schedule.occurrences_between(occurrence_search_start, inclusive_range_end).select do |occurrence_start|
      occurrence_start <= inclusive_range_end && occurrence_start + duration >= range_start
    end
  end

  def all_day_start_instant(occurrence_on, time_zone)
    zone = Time.find_zone!(time_zone)
    zone.local(occurrence_on.year, occurrence_on.month, occurrence_on.day)
  end

  private

  def all_day_occurrences_between(range_start, inclusive_range_end, time_zone)
    unless recurring?
      return spans_instant_range?(start_on, end_on, range_start, inclusive_range_end, time_zone) ? [start_on] : []
    end

    duration_days = (end_on - start_on).to_i
    schedule = IceCube::Schedule.new(Time.utc(start_on.year, start_on.month, start_on.day))
    schedule.add_recurrence_rule(ice_cube_rule)
    search_start = range_start - duration_days.days
    schedule.occurrences_between(search_start.utc, inclusive_range_end.utc).filter_map do |time|
      occurrence_on = Date.new(time.year, time.month, time.day)
      occurrence_end_on = occurrence_on + duration_days
      next unless spans_instant_range?(occurrence_on, occurrence_end_on, range_start, inclusive_range_end, time_zone)

      occurrence_on
    end
  end

  def spans_instant_range?(first_on, last_on, range_start, inclusive_range_end, time_zone)
    starts = all_day_start_instant(first_on, time_zone)
    ends = all_day_start_instant(last_on, time_zone) + 1.day
    starts < inclusive_range_end && ends > range_start
  end

  def schedule_present
    if all_day?
      errors.add(:start_on, "can't be blank") if start_on.blank?
      errors.add(:end_on, "can't be blank") if end_on.blank?
    else
      errors.add(:start_at, "can't be blank") if start_at.blank?
      errors.add(:end_at, "can't be blank") if end_at.blank?
    end
  end

  def end_after_start
    if all_day?
      return if start_on.blank? || end_on.blank?

      errors.add(:end_on, "must be on or after start_on") if end_on < start_on
    else
      return if start_at.blank? || end_at.blank?

      errors.add(:end_at, "must be after start_at") if end_at <= start_at
    end
  end

  def recurrence_params_valid
    params = recurrence_params
    return if params.nil?

    unless ALLOWED_FREQUENCIES.include?(params["frequency"])
      errors.add(:recurrence_rule, "frequency must be one of #{ALLOWED_FREQUENCIES.join(', ')}")
    end

    interval = params["interval"]
    unless interval.is_a?(Integer) && interval.positive?
      errors.add(:recurrence_rule, "interval must be a positive integer")
    end

    if params["until"].present? && !valid_date_string?(params["until"])
      errors.add(:recurrence_rule, "until must be a valid date")
    end
  rescue JSON::ParserError
    errors.add(:recurrence_rule, "is not valid JSON")
  end

  def valid_date_string?(value)
    Date.parse(value.to_s)
    true
  rescue ArgumentError, TypeError
    false
  end
end
