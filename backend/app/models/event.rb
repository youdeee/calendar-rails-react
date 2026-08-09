class Event < ApplicationRecord
  belongs_to :user

  TITLE_MAX_LENGTH = 200
  DESCRIPTION_MAX_LENGTH = 5000
  ALLOWED_FREQUENCIES = %w[daily weekly monthly].freeze

  validates :title, presence: true, length: { maximum: TITLE_MAX_LENGTH }
  validates :description, length: { maximum: DESCRIPTION_MAX_LENGTH }
  validates :start_at, presence: true
  validates :end_at, presence: true
  validate :end_at_after_start_at
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

  def occurrences_between(range_start, range_end)
    # ice_cube's occurrences_between excludes anything after range_end down to
    # the exact clock time; callers pass calendar-day boundaries (e.g. a bare
    # date parses to midnight), so treat range_end as inclusive through the
    # end of that day.
    inclusive_range_end = range_end.end_of_day

    unless recurring?
      return (start_at <= inclusive_range_end && end_at >= range_start) ? [start_at] : []
    end

    schedule = IceCube::Schedule.new(start_at)
    schedule.add_recurrence_rule(ice_cube_rule)
    schedule.occurrences_between(range_start, inclusive_range_end)
  end

  private

  def end_at_after_start_at
    return if start_at.blank? || end_at.blank?

    errors.add(:end_at, "must be after start_at") if end_at <= start_at
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
