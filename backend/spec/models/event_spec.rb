require "rails_helper"

RSpec.describe Event, type: :model do
  let(:user) { User.create!(email: "a@example.com", google_uid: "g-1", name: "Taro") }

  def build_event(**attrs)
    user.events.new({ title: "Meeting", start_at: Time.zone.parse("2026-08-10 10:00"),
                       end_at: Time.zone.parse("2026-08-10 11:00") }.merge(attrs))
  end

  it "is valid with title, start_at, end_at" do
    expect(build_event).to be_valid
  end

  it "rejects a title longer than 200 characters" do
    expect(build_event(title: "a" * 201)).not_to be_valid
  end

  it "rejects a description longer than 5000 characters" do
    expect(build_event(description: "a" * 5001)).not_to be_valid
  end

  it "rejects end_at before start_at" do
    event = build_event(end_at: Time.zone.parse("2026-08-10 09:00"))
    expect(event).not_to be_valid
    expect(event.errors[:end_at]).to be_present
  end

  describe "recurrence validation" do
    it "rejects an unknown frequency" do
      event = build_event
      event.recurrence_params = { "frequency" => "yearly", "interval" => 1 }
      expect(event).not_to be_valid
    end

    it "rejects a zero interval" do
      event = build_event
      event.recurrence_params = { "frequency" => "weekly", "interval" => 0 }
      expect(event).not_to be_valid
    end

    it "accepts a valid recurrence" do
      event = build_event
      event.recurrence_params = { "frequency" => "weekly", "interval" => 1, "until" => "2026-12-31" }
      expect(event).to be_valid
    end
  end

  describe "#occurrences_between" do
    it "returns the single occurrence when it falls in range and the event is not recurring" do
      event = build_event
      result = event.occurrences_between(Time.zone.parse("2026-08-01"), Time.zone.parse("2026-08-31"))
      expect(result).to eq([event.start_at])
    end

    it "returns no occurrences when the single event falls outside the range" do
      event = build_event
      result = event.occurrences_between(Time.zone.parse("2026-09-01"), Time.zone.parse("2026-09-30"))
      expect(result).to eq([])
    end

    it "expands a weekly recurring event across the range" do
      event = build_event(start_at: Time.zone.parse("2026-08-03 10:00"), end_at: Time.zone.parse("2026-08-03 11:00"))
      event.recurrence_params = { "frequency" => "weekly", "interval" => 1 }
      event.save!

      result = event.occurrences_between(Time.zone.parse("2026-08-01"), Time.zone.parse("2026-08-31"))
      expect(result.size).to eq(5)
      expect(result.first.to_date).to eq(Date.new(2026, 8, 3))
    end

    it "includes an occurrence later in the day than range_end" do
      event = build_event(start_at: Time.zone.parse("2026-08-10 10:00"), end_at: Time.zone.parse("2026-08-10 11:00"))
      result = event.occurrences_between(Time.zone.parse("2026-08-01"), Time.zone.parse("2026-08-10"))
      expect(result).to eq([event.start_at])
    end

    it "excludes an occurrence on the day after range_end" do
      event = build_event(start_at: Time.zone.parse("2026-08-11 00:30"), end_at: Time.zone.parse("2026-08-11 01:30"))
      result = event.occurrences_between(Time.zone.parse("2026-08-01"), Time.zone.parse("2026-08-10"))
      expect(result).to eq([])
    end
  end
end
