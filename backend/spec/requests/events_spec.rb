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
      expect(body.first["recurrence"]).to eq({ "frequency" => "weekly", "interval" => 1 })
    end

    it "includes an event later in the day than the `to` boundary" do
      user.events.create!(title: "Evening", start_at: Time.zone.parse("2026-08-31 22:00"),
                           end_at: Time.zone.parse("2026-08-31 23:00"))

      get "/api/events", params: { from: "2026-08-01", to: "2026-08-31" }, headers: auth_headers

      titles = JSON.parse(response.body).map { |e| e["title"] }
      expect(titles).to eq(["Evening"])
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

  describe "POST /api/events" do
    it "creates a non-recurring event" do
      post "/api/events", params: {
        event: { title: "Lunch", start_at: "2026-08-10T12:00:00+09:00", end_at: "2026-08-10T13:00:00+09:00" }
      }, headers: auth_headers

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body["title"]).to eq("Lunch")
      expect(body["recurring"]).to eq(false)
      expect(user.events.count).to eq(1)
    end

    it "creates a recurring event from structured recurrence params" do
      post "/api/events", params: {
        event: {
          title: "Standup", start_at: "2026-08-03T10:00:00+09:00", end_at: "2026-08-03T10:15:00+09:00",
          recurrence: { frequency: "weekly", interval: "1", until: "2026-12-31" }
        }
      }, headers: auth_headers

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body["recurring"]).to eq(true)
      expect(body["recurrence"]).to eq({ "frequency" => "weekly", "interval" => 1, "until" => "2026-12-31" })
    end

    it "rejects an invalid recurrence frequency with 422" do
      post "/api/events", params: {
        event: {
          title: "Bad", start_at: "2026-08-03T10:00:00+09:00", end_at: "2026-08-03T10:15:00+09:00",
          recurrence: { frequency: "yearly", interval: "1" }
        }
      }, headers: auth_headers

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "rejects a title longer than 200 characters with 422" do
      post "/api/events", params: {
        event: { title: "a" * 201, start_at: "2026-08-10T12:00:00+09:00", end_at: "2026-08-10T13:00:00+09:00" }
      }, headers: auth_headers

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "requires authentication" do
      post "/api/events", params: {
        event: { title: "Lunch", start_at: "2026-08-10T12:00:00+09:00", end_at: "2026-08-10T13:00:00+09:00" }
      }

      expect(response).to have_http_status(:unauthorized)
    end

    it "returns 400 when recurrence is not an object" do
      post "/api/events", params: {
        event: { title: "Lunch", start_at: "2026-08-10T12:00:00+09:00", end_at: "2026-08-10T13:00:00+09:00",
                 recurrence: "not-a-hash" }
      }, headers: auth_headers

      expect(response).to have_http_status(:bad_request)
    end

    it "rejects an invalid recurrence until date with 422" do
      post "/api/events", params: {
        event: {
          title: "Bad until", start_at: "2026-08-03T10:00:00+09:00", end_at: "2026-08-03T10:15:00+09:00",
          recurrence: { frequency: "weekly", interval: "1", until: "not-a-date" }
        }
      }, headers: auth_headers

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "PATCH /api/events/:id" do
    it "updates an event's start_at and end_at (drag and drop)" do
      event = user.events.create!(title: "Meeting", start_at: Time.zone.parse("2026-08-10 10:00"),
                                   end_at: Time.zone.parse("2026-08-10 11:00"))

      patch "/api/events/#{event.id}", params: {
        event: { start_at: "2026-08-11T10:00:00+09:00", end_at: "2026-08-11T11:00:00+09:00" }
      }, headers: auth_headers

      expect(response).to have_http_status(:ok)
      event.reload
      expect(event.start_at).to eq(Time.zone.parse("2026-08-11T10:00:00+09:00"))
      expect(event.end_at).to eq(Time.zone.parse("2026-08-11T11:00:00+09:00"))
    end

    it "updates a recurring event's recurrence params" do
      event = user.events.create!(title: "Standup", start_at: Time.zone.parse("2026-08-03 10:00"),
                                   end_at: Time.zone.parse("2026-08-03 10:15"))
      event.recurrence_params = { "frequency" => "weekly", "interval" => 1 }
      event.save!

      patch "/api/events/#{event.id}", params: {
        event: { recurrence: { frequency: "weekly", interval: "2", until: "2026-12-31" } }
      }, headers: auth_headers

      expect(response).to have_http_status(:ok)
      expect(event.reload.recurrence_params).to eq(
        { "frequency" => "weekly", "interval" => 2, "until" => "2026-12-31" }
      )
    end

    it "returns 422 for an invalid update" do
      event = user.events.create!(title: "Meeting", start_at: Time.zone.parse("2026-08-10 10:00"),
                                   end_at: Time.zone.parse("2026-08-10 11:00"))

      patch "/api/events/#{event.id}", params: { event: { title: "" } }, headers: auth_headers

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "returns 404 when updating another user's event" do
      event = other_user.events.create!(title: "Not mine", start_at: Time.zone.parse("2026-08-10 10:00"),
                                         end_at: Time.zone.parse("2026-08-10 11:00"))

      patch "/api/events/#{event.id}", params: { event: { title: "Hijacked" } }, headers: auth_headers

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "DELETE /api/events/:id" do
    it "deletes the caller's event" do
      event = user.events.create!(title: "Meeting", start_at: Time.zone.parse("2026-08-10 10:00"),
                                   end_at: Time.zone.parse("2026-08-10 11:00"))

      delete "/api/events/#{event.id}", headers: auth_headers

      expect(response).to have_http_status(:no_content)
      expect(Event.exists?(event.id)).to be false
    end

    it "returns 404 when deleting another user's event" do
      event = other_user.events.create!(title: "Not mine", start_at: Time.zone.parse("2026-08-10 10:00"),
                                         end_at: Time.zone.parse("2026-08-10 11:00"))

      delete "/api/events/#{event.id}", headers: auth_headers

      expect(response).to have_http_status(:not_found)
      expect(Event.exists?(event.id)).to be true
    end
  end
end
