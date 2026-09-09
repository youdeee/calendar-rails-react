require "rails_helper"

RSpec.describe DispatchDueRemindersJob, type: :job do
  let(:user) { User.create!(email: "a@example.com", google_uid: "g-1", name: "Taro", time_zone: "Asia/Tokyo") }
  let(:tokyo) { Time.find_zone("Asia/Tokyo") }

  before { ActionMailer::Base.deliveries.clear }

  it "sends one email 15 minutes before a timed event" do
    event = user.events.create!(
      title: "Lunch",
      start_at: tokyo.local(2026, 9, 10, 15, 0),
      end_at: tokyo.local(2026, 9, 10, 16, 0),
      reminder_minutes: 15
    )

    travel_to tokyo.local(2026, 9, 10, 14, 45) do
      described_class.perform_now(event.id)
    end

    expect(ActionMailer::Base.deliveries.size).to eq(1)
    mail = ActionMailer::Base.deliveries.first
    expect(mail.to).to eq([user.email])
    expect(mail.subject).to eq("リマインダー: Lunch")
    expect(mail.attachments["event.ics"]).to be_present
  end

  it "sends an all-day reminder the day before at 18:00 in the user time zone" do
    event = user.events.create!(
      title: "Holiday", all_day: true,
      start_on: Date.new(2026, 9, 10), end_on: Date.new(2026, 9, 10),
      reminder_minutes: 360
    )

    travel_to tokyo.local(2026, 9, 9, 18, 0) do
      described_class.perform_now(event.id)
    end

    expect(ActionMailer::Base.deliveries.size).to eq(1)
    ics = ActionMailer::Base.deliveries.first.attachments["event.ics"].body.to_s
    expect(ics).to include("DTSTART;VALUE=DATE:20260910")
  end

  it "sends only the due occurrence of a recurring event" do
    event = user.events.create!(
      title: "Standup",
      start_at: tokyo.local(2026, 8, 3, 10, 0),
      end_at: tokyo.local(2026, 8, 3, 10, 15),
      reminder_minutes: 15
    )
    event.recurrence_params = { "frequency" => "weekly", "interval" => 1 }
    event.save!

    travel_to tokyo.local(2026, 8, 10, 9, 45) do
      described_class.perform_now(event.id)
    end

    expect(ActionMailer::Base.deliveries.size).to eq(1)
  end

  it "does not send a second email for the same occurrence" do
    event = user.events.create!(
      title: "Lunch",
      start_at: tokyo.local(2026, 9, 10, 15, 0),
      end_at: tokyo.local(2026, 9, 10, 16, 0),
      reminder_minutes: 15
    )

    travel_to tokyo.local(2026, 9, 10, 14, 45) do
      described_class.perform_now(event.id)
      described_class.perform_now(event.id)
    end

    expect(ActionMailer::Base.deliveries.size).to eq(1)
  end

  it "does not send when reminder_minutes is blank" do
    event = user.events.create!(
      title: "Lunch",
      start_at: tokyo.local(2026, 9, 10, 15, 0),
      end_at: tokyo.local(2026, 9, 10, 16, 0)
    )

    travel_to tokyo.local(2026, 9, 10, 14, 45) do
      described_class.perform_now(event.id)
    end

    expect(ActionMailer::Base.deliveries).to be_empty
  end

  it "does not send for an event that started more than two hours ago" do
    event = user.events.create!(
      title: "Lunch",
      start_at: tokyo.local(2026, 9, 10, 15, 0),
      end_at: tokyo.local(2026, 9, 10, 16, 0),
      reminder_minutes: 15
    )

    travel_to tokyo.local(2026, 9, 10, 18, 0) do
      described_class.perform_now(event.id)
    end

    expect(ActionMailer::Base.deliveries).to be_empty
  end

  it "does not send an all-day reminder on the morning of the event" do
    event = user.events.create!(
      title: "Holiday", all_day: true,
      start_on: Date.new(2026, 9, 10), end_on: Date.new(2026, 9, 10),
      reminder_minutes: 360
    )

    travel_to tokyo.local(2026, 9, 10, 9, 0) do
      described_class.perform_now(event.id)
    end

    expect(ActionMailer::Base.deliveries).to be_empty
  end

  it "still sends a late reminder when the event itself is in the future" do
    event = user.events.create!(
      title: "Lunch",
      start_at: tokyo.local(2026, 10, 10, 15, 0),
      end_at: tokyo.local(2026, 10, 10, 16, 0),
      reminder_minutes: 43_200
    )

    travel_to tokyo.local(2026, 9, 10, 20, 0) do
      described_class.perform_now(event.id)
    end

    expect(ActionMailer::Base.deliveries.size).to eq(1)
  end

  it "still sends a late all-day reminder when the civil date is in the future" do
    event = user.events.create!(
      title: "Holiday", all_day: true,
      start_on: Date.new(2026, 10, 10), end_on: Date.new(2026, 10, 10),
      reminder_minutes: 43_200
    )

    travel_to tokyo.local(2026, 9, 10, 20, 0) do
      described_class.perform_now(event.id)
    end

    expect(ActionMailer::Base.deliveries.size).to eq(1)
  end
end
