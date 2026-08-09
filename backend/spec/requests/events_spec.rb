require "rails_helper"

RSpec.describe "Events", type: :request do
  let(:user) { User.create!(email: "a@example.com", google_uid: "g-1", name: "Taro") }
  let(:other_user) { User.create!(email: "b@example.com", google_uid: "g-2", name: "Jiro") }
  let(:token) { JsonWebToken.encode(user.id) }
  let(:auth_headers) { { "Authorization" => "Bearer #{token}" } }

  describe "GET /api/events" do
    it "requires authentication" do
      get "/api/events", params: { from: "2026-08-01", to: "2026-08-31" }

      expect(response).to have_http_status(:unauthorized)
    end

    it "returns events within the requested range" do
      user.events.create!(title: "In range", start_at: Time.zone.parse("2026-08-10 10:00"),
                           end_at: Time.zone.parse("2026-08-10 11:00"))
      user.events.create!(title: "Out of range", start_at: Time.zone.parse("2026-09-10 10:00"),
                           end_at: Time.zone.parse("2026-09-10 11:00"))

      get "/api/events", params: { from: "2026-08-01", to: "2026-08-31" }, headers: auth_headers

      expect(response).to have_http_status(:ok)
      titles = JSON.parse(response.body).map { |e| e["title"] }
      expect(titles).to eq(["In range"])
    end

    it "excludes other users' events" do
      other_user.events.create!(title: "Not mine", start_at: Time.zone.parse("2026-08-10 10:00"),
                                 end_at: Time.zone.parse("2026-08-10 11:00"))

      get "/api/events", params: { from: "2026-08-01", to: "2026-08-31" }, headers: auth_headers

      expect(JSON.parse(response.body)).to eq([])
    end

    it "expands a recurring event into multiple occurrences" do
      event = user.events.create!(title: "Standup", start_at: Time.zone.parse("2026-08-03 10:00"),
                                   end_at: Time.zone.parse("2026-08-03 10:15"))
      event.recurrence_params = { "frequency" => "weekly", "interval" => 1 }
      event.save!

      get "/api/events", params: { from: "2026-08-01", to: "2026-08-31" }, headers: auth_headers

      body = JSON.parse(response.body)
      expect(body.size).to eq(5)
      expect(body.all? { |e| e["id"] == event.id && e["recurring"] == true }).to be true
    end

    it "returns 400 for an invalid date" do
      get "/api/events", params: { from: "not-a-date", to: "2026-08-31" }, headers: auth_headers

      expect(response).to have_http_status(:bad_request)
    end

    it "returns 400 when the range exceeds 3 months" do
      get "/api/events", params: { from: "2026-01-01", to: "2026-08-31" }, headers: auth_headers

      expect(response).to have_http_status(:bad_request)
    end
  end
end
